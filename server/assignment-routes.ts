import type { Express, Request, Response } from "express";
import { randomBytes, randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { pool } from "./db";
import { requireUser } from "./auth";
import { storage } from "./storage";
import { listUniversalQuestions } from "./universal-question-store";
import { gradeUniversalAnswer, withoutAnswerKeys, legacyCardToQuestion, universalQuestionSchema, type UniversalQuestion } from "@shared/universal-questions";
import { withOpaqueOptionIds } from "./opaque-question-options";

const uuid=z.string().uuid();
const requestToCreate=z.object({
  deckId:z.number().int().positive(),title:z.string().trim().min(1).max(200),
  opensAt:z.string().datetime({offset:true}).nullable().optional(),
  closesAt:z.string().datetime({offset:true}).nullable().optional(),
  maxAttempts:z.number().int().min(1).max(3).default(1),
}).strict();
const nickname=z.string().trim().min(1).max(24);
const access=z.object({attemptId:uuid,secret:z.string().min(32).max(128)}).strict();
const responses=z.array(z.object({questionId:z.string().min(1).max(80),response:z.unknown()}).strict()).max(100);
const writeRequest=access.extend({answers:responses});
const supported=new Set(["multiple_choice","true_false","multiple_select","ordering"]);
type Assignment = {
  id:string;owner_id:string;title:string;questions:unknown;opens_at:Date|null;closes_at:Date|null;max_attempts:number;
};
const parseQuestions=(raw:unknown)=>z.array(universalQuestionSchema).min(1).max(100).parse(raw);
const hash=(secret:string)=>createHash("sha256").update(secret).digest();
function validSecret(candidate:string,expected:string){
  if(!/^[a-f0-9]{64}$/.test(expected))return false;
  return timingSafeEqual(hash(candidate),Buffer.from(expected,"hex"));
}
function active(a:Assignment){
  const now=Date.now();
  if(a.opens_at&&new Date(a.opens_at).getTime()>now)return "Assignment is not open yet";
  if(a.closes_at&&new Date(a.closes_at).getTime()<=now)return "Assignment has closed";
  return null;
}
async function publicAssignment(rawId:unknown):Promise<Assignment|null>{
  const id=uuid.safeParse(rawId);if(!id.success)return null;
  const found=await pool.query("SELECT * FROM quiz_assignments WHERE id=$1",[id.data]);
  return found.rows[0]??null;
}
function publicView(a:Assignment){
  return {id:a.id,title:a.title,opensAt:a.opens_at,closesAt:a.closes_at,maxAttempts:a.max_attempts,
    available:!active(a),availabilityMessage:active(a),
    questions:active(a)?[]:parseQuestions(a.questions).map(q=>withoutAnswerKeys(q))};
}
function safeAnswers(qs:UniversalQuestion[],value:unknown){
  const parsed=responses.parse(value);
  const ids=new Set(qs.map(q=>q.id));
  if(new Set(parsed.map(x=>x.questionId)).size!==parsed.length||parsed.some(x=>!ids.has(x.questionId)))
    throw new Error("Unknown or duplicate question ID");
  return parsed;
}
async function authorizedAttempt(a:Assignment,body:{attemptId:string;secret:string}){
  const result=await pool.query("SELECT * FROM quiz_assignment_attempts WHERE id=$1 AND assignment_id=$2",[body.attemptId,a.id]);
  const item=result.rows[0];
  return item&&validSecret(body.secret,item.secret_hash)?item:null;
}

export function registerAssignmentRoutes(app:Express):void{
  app.get("/api/assignments/public/:id",async(req,res,next)=>{
    try {
      const a=await publicAssignment(req.params.id);
      if(!a){res.status(404).json({message:"Assignment not found"});return;}
      res.json(publicView(a));
    }catch(err){next(err);}
  });

  app.post("/api/assignments/public/:id/start",async(req,res,next)=>{
    const client=await pool.connect().catch(next);
    if(!client)return;
    try {
      const a=await publicAssignment(req.params.id);
      if(!a){res.status(404).json({message:"Assignment not found"});return;}
      const status=active(a);
      if(status){res.status(409).json({message:status});return;}
      const parsed=nickname.safeParse(req.body?.name);
      if(!parsed.success){res.status(400).json({message:"Enter a nickname (1–24 characters)"});return;}
      const name=parsed.data;
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[a.id+":"+name.toLocaleLowerCase()]);
      const count=await client.query(
        "SELECT count(*)::int AS count FROM quiz_assignment_attempts WHERE assignment_id=$1 AND lower(participant_name)=lower($2)",
        [a.id,name]);
      if(count.rows[0].count>=a.max_attempts){
        await client.query("ROLLBACK");
        res.status(409).json({message:"This nickname has reached the assignment attempt limit"});return;
      }
      const attemptId=randomUUID(),secret=randomBytes(32).toString("base64url");
      await client.query(
        "INSERT INTO quiz_assignment_attempts(id,assignment_id,participant_name,secret_hash) VALUES($1,$2,$3,$4)",
        [attemptId,a.id,name,hash(secret).toString("hex")]);
      await client.query("COMMIT");
      res.status(201).json({attemptId,secret,name,answers:[],submittedAt:null});
    }catch(err){await client.query("ROLLBACK").catch(()=>{});next(err);}
    finally{client.release();}
  });

  app.post("/api/assignments/public/:id/resume",async(req,res,next)=>{
    try {
      const a=await publicAssignment(req.params.id);
      const token=access.safeParse(req.body);
      if(!a||!token.success){res.status(404).json({message:"Attempt not found"});return;}
      const attempt=await authorizedAttempt(a,token.data);
      if(!attempt){res.status(404).json({message:"Attempt not found"});return;}
      res.json({attemptId:attempt.id,name:attempt.participant_name,answers:attempt.answers,
        submittedAt:attempt.submitted_at,score:attempt.submitted_at?attempt.score:null,
        correctCount:attempt.submitted_at?attempt.correct_count:null});
    }catch(err){next(err);}
  });

  app.put("/api/assignments/public/:id/attempt",async(req,res,next)=>{
    try {
      const a=await publicAssignment(req.params.id),parsed=writeRequest.safeParse(req.body);
      if(!a||!parsed.success){res.status(400).json({message:"Invalid attempt or answers"});return;}
      const attempt=await authorizedAttempt(a,parsed.data);
      if(!attempt){res.status(404).json({message:"Attempt not found"});return;}
      const status=active(a);
      if(status){res.status(409).json({message:status});return;}
      let answers;
      try{answers=safeAnswers(parseQuestions(a.questions),parsed.data.answers);}
      catch {res.status(400).json({message:"Unknown or duplicate question ID"});return;}
      const updated=await pool.query(
        "UPDATE quiz_assignment_attempts SET answers=$3::jsonb,updated_at=now() WHERE id=$1 AND assignment_id=$2 AND submitted_at IS NULL RETURNING id",
        [attempt.id,a.id,JSON.stringify(answers)]);
      if(!updated.rowCount){res.status(409).json({message:"This attempt has already been submitted"});return;}
      res.json({saved:true});
    }catch(err){next(err);}
  });

  app.post("/api/assignments/public/:id/submit",async(req,res,next)=>{
    const client=await pool.connect().catch(next);
    if(!client)return;
    try {
      const a=await publicAssignment(req.params.id),parsed=access.safeParse(req.body);
      if(!a||!parsed.success){res.status(404).json({message:"Attempt not found"});return;}
      await client.query("BEGIN");
      const result=await client.query("SELECT * FROM quiz_assignment_attempts WHERE id=$1 AND assignment_id=$2 FOR UPDATE",
        [parsed.data.attemptId,a.id]);
      const attempt=result.rows[0];
      if(!attempt||!validSecret(parsed.data.secret,attempt.secret_hash)){
        await client.query("ROLLBACK");res.status(404).json({message:"Attempt not found"});return;
      }
      const questions=parseQuestions(a.questions);
      if(attempt.submitted_at){
        await client.query("COMMIT");
        res.json({submittedAt:attempt.submitted_at,score:attempt.score,correctCount:attempt.correct_count,total:questions.length});
        return;
      }
      const status=active(a);
      if(status){await client.query("ROLLBACK");res.status(409).json({message:status});return;}
      const draft=safeAnswers(questions,attempt.answers);
      let correctCount=0;
      for(const q of questions){
        const answer=draft.find(item=>item.questionId===q.id);
        if(!answer)continue;
        try{if(gradeUniversalAnswer(q,answer.response))correctCount++;}
        catch {/* Malformed submitted answers are not awarded credit. */}
      }
      const score=correctCount*100;
      const saved=await client.query(
        "UPDATE quiz_assignment_attempts SET score=$3,correct_count=$4,submitted_at=now(),updated_at=now() WHERE id=$1 AND assignment_id=$2 RETURNING submitted_at",
        [attempt.id,a.id,score,correctCount]);
      await client.query("COMMIT");
      res.json({submittedAt:saved.rows[0].submitted_at,score,correctCount,total:questions.length});
    }catch(err){await client.query("ROLLBACK").catch(()=>{});next(err);}
    finally{client.release();}
  });

  app.use("/api/assignments",requireUser);
  app.post("/api/assignments",async(req,res,next)=>{
    try {
      const parsed=requestToCreate.safeParse(req.body);
      if(!parsed.success){res.status(400).json({message:"Invalid assignment configuration"});return;}
      const data=parsed.data;
      const deck=await storage.getDeck(data.deckId,req.studyUser!.id);
      if(!deck){res.status(404).json({message:"Deck not found"});return;}
      const rows=await listUniversalQuestions(data.deckId);
      const universal=rows.map(r=>r.question).filter(q=>supported.has(q.answer.kind));
      const legacy=deck.cards.flatMap(card=>{
        try{const q=legacyCardToQuestion(card);return supported.has(q.answer.kind)?[q]:[];}
        catch{return [];}
      });
      const questions=[...legacy,...universal].slice(0,100);
      if(!questions.length){res.status(400).json({message:"The deck has no supported assignment questions"});return;}
      const opens=data.opensAt?new Date(data.opensAt):null,closes=data.closesAt?new Date(data.closesAt):null;
      if(opens&&closes&&closes<=opens){res.status(400).json({message:"Closing time must follow opening time"});return;}
      if(closes&&closes.getTime()<=Date.now()){res.status(400).json({message:"Closing time must be in the future"});return;}
      const id=randomUUID();
      await pool.query(
        "INSERT INTO quiz_assignments(id,owner_id,deck_id,title,questions,opens_at,closes_at,max_attempts) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8)",
        [id,req.studyUser!.id,data.deckId,data.title,JSON.stringify(questions),opens,closes,data.maxAttempts]);
      res.status(201).json({id,title:data.title,questionCount:questions.length,publicUrl:"/assignment/"+id});
    }catch(err){next(err);}
  });
  app.get("/api/assignments",async(req,res,next)=>{
    try {
      const rows=await pool.query(
        `SELECT a.id,a.title,a.opens_at AS "opensAt",a.closes_at AS "closesAt",a.created_at AS "createdAt",
          a.max_attempts AS "maxAttempts",jsonb_array_length(a.questions) AS "questionCount",
          count(t.id)::int AS "attempts",
          count(t.submitted_at)::int AS "completed"
         FROM quiz_assignments a LEFT JOIN quiz_assignment_attempts t ON t.assignment_id=a.id
         WHERE a.owner_id=$1 GROUP BY a.id ORDER BY a.created_at DESC LIMIT 100`,[req.studyUser!.id]);
      res.json(rows.rows);
    }catch(err){next(err);}
  });
  app.get("/api/assignments/:id",async(req,res,next)=>{
    try {
      const id=uuid.safeParse(req.params.id);
      if(!id.success){res.status(400).json({message:"Invalid assignment ID"});return;}
      const row=await pool.query(
        "SELECT id,title,opens_at AS \"opensAt\",closes_at AS \"closesAt\",max_attempts AS \"maxAttempts\" FROM quiz_assignments WHERE id=$1 AND owner_id=$2",
        [id.data,req.studyUser!.id]);
      if(!row.rowCount){res.status(404).json({message:"Assignment not found"});return;}
      const attempts=await pool.query(
        `SELECT id,participant_name AS "name",score,correct_count AS "correctCount",
          answers,submitted_at AS "submittedAt",created_at AS "createdAt"
         FROM quiz_assignment_attempts WHERE assignment_id=$1 ORDER BY created_at`,[id.data]);
      res.json({...row.rows[0],attempts:attempts.rows});
    }catch(err){next(err);}
  });
  app.delete("/api/assignments/:id",async(req,res,next)=>{
    try {
      const id=uuid.safeParse(req.params.id);
      if(!id.success){res.status(400).json({message:"Invalid assignment ID"});return;}
      const removed=await pool.query("DELETE FROM quiz_assignments WHERE id=$1 AND owner_id=$2",[id.data,req.studyUser!.id]);
      if(!removed.rowCount){res.status(404).json({message:"Assignment not found"});return;}
      res.status(204).send();
    }catch(err){next(err);}
  });
}
