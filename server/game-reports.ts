import { z } from "zod";
import type { Express } from "express";
import { requireUser } from "./auth";
import { pool } from "./db";
import type { GameReportSink } from "./game-report-types";

const idSchema = z.string().uuid();
export const gameReportSink: GameReportSink = {
  async created(input) {
    await pool.query(
      "INSERT INTO live_game_sessions(id,owner_id,deck_id,deck_title) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",
      [input.id,input.ownerId,input.deckId,input.deckTitle.slice(0,200)],
    );
  },
  async round(input) {
    await pool.query(
      `INSERT INTO live_game_rounds(session_id,question_index,prompt,kind,options,correct_answers,duration_ms,player_answers)
       VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8::jsonb)
       ON CONFLICT(session_id,question_index) DO NOTHING`,
      [input.id,input.questionIndex,input.prompt,input.kind,JSON.stringify(input.options),
        JSON.stringify(input.correctAnswers),input.durationMs,JSON.stringify(input.playerAnswers)],
    );
  },
  async finished(input) {
    await pool.query(
      "UPDATE live_game_sessions SET mode=$2,leaderboard=$3::jsonb,finished_at=COALESCE(finished_at,now()) WHERE id=$1",
      [input.id,input.mode,JSON.stringify(input.leaderboard)],
    );
  },
};

/** Prevent spreadsheet applications from executing player-supplied names/prompts as formulas. */
export function csvCell(value: unknown): string {
  const raw = typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
  const safe = /^[\s]*[=+\-@]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g,'""') + '"';
}

export function registerGameReportRoutes(app: Express): void {
  app.use("/api/reports",requireUser);
  app.get("/api/reports",async(req,res,next)=>{
    try {
      const rows=await pool.query(
        `SELECT id,deck_title AS "deckTitle",mode,created_at AS "createdAt",
         finished_at AS "finishedAt",leaderboard
         FROM live_game_sessions WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [req.studyUser!.id]);
      res.json(rows.rows);
    } catch(err){next(err);}
  });

  async function ownedReport(ownerId:string,id:string) {
    const session=await pool.query(
      `SELECT id,deck_title AS "deckTitle",mode,created_at AS "createdAt",finished_at AS "finishedAt",leaderboard
       FROM live_game_sessions WHERE id=$1 AND owner_id=$2`,[id,ownerId]);
    if(!session.rowCount)return null;
    const rounds=await pool.query(
      `SELECT question_index AS "questionIndex",prompt,kind,options,
         correct_answers AS "correctAnswers",duration_ms AS "durationMs",
         player_answers AS "playerAnswers",revealed_at AS "revealedAt"
       FROM live_game_rounds WHERE session_id=$1 ORDER BY question_index`,[id]);
    return {...session.rows[0],rounds:rounds.rows};
  }

  app.get("/api/reports/:id.csv",async(req,res,next)=>{
    try {
      const parsed=idSchema.safeParse(req.params.id);
      if(!parsed.success){res.status(400).json({message:"Invalid report ID"});return;}
      const report=await ownedReport(req.studyUser!.id,parsed.data);
      if(!report){res.status(404).json({message:"Report not found"});return;}
      const rows=[["Question","Type","Player","Correct","Points","Response ms","Response"]];
      for(const round of report.rounds){
        for(const answer of round.playerAnswers as Array<{name:string;correct:boolean;awarded:number;responseMs:number|null;response:unknown}>){
          rows.push([String(round.questionIndex+1)+": "+round.prompt,round.kind,answer.name,
            String(answer.correct),String(answer.awarded),answer.responseMs===null?"":String(answer.responseMs),
            JSON.stringify(answer.response)]);
        }
      }
      const csv=rows.map(row=>row.map(csvCell).join(",")).join("\r\n")+"\r\n";
      res.setHeader("Content-Type","text/csv; charset=utf-8");
      res.setHeader("Content-Disposition",'attachment; filename="trivia-live-report.csv"');
      res.send(csv);
    } catch(err){next(err);}
  });

  app.get("/api/reports/:id",async(req,res,next)=>{
    try {
      const parsed=idSchema.safeParse(req.params.id);
      if(!parsed.success){res.status(400).json({message:"Invalid report ID"});return;}
      const report=await ownedReport(req.studyUser!.id,parsed.data);
      if(!report){res.status(404).json({message:"Report not found"});return;}
      res.json(report);
    } catch(err){next(err);}
  });

  app.delete("/api/reports/:id",async(req,res,next)=>{
    try {
      const parsed=idSchema.safeParse(req.params.id);
      if(!parsed.success){res.status(400).json({message:"Invalid report ID"});return;}
      const removed=await pool.query("DELETE FROM live_game_sessions WHERE id=$1 AND owner_id=$2",
        [parsed.data,req.studyUser!.id]);
      if(!removed.rowCount){res.status(404).json({message:"Report not found"});return;}
      res.status(204).send();
    } catch(err){next(err);}
  });
}
