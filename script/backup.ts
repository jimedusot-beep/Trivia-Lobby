import { mkdtemp,mkdir,writeFile,readFile,rm,stat,open,appendFile } from "node:fs/promises";
import { createReadStream,createWriteStream } from "node:fs";
import { join,resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { once } from "node:events";
import { createHash } from "node:crypto";
import pg from "pg";
import { S3Client,PutObjectCommand } from "@aws-sdk/client-s3";
import { backupCipher,backupDecipher,HEADER_BYTES } from "../server/backup-crypto";
import { getPrivateObject,putPrivateObject,deletePrivateObject } from "../server/object-storage";

const [action,output]=process.argv.slice(2),secret=process.env.BACKUP_PASSPHRASE??"";
if(!output || !["create","restore"].includes(action))throw new Error("Usage: backup.ts create|restore /absolute/backup.enc");
const dir=await mkdtemp(join(tmpdir(),"trivia-backup-"));
type FileRow={object_key:string;size_bytes:number;sha256:string};
function pgEnv(url:string){const u=new URL(url);return {...process.env,PGHOST:u.hostname,PGPORT:u.port||"5432",PGDATABASE:decodeURIComponent(u.pathname.slice(1)),PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),...(u.searchParams.has("sslmode")?{PGSSLMODE:u.searchParams.get("sslmode")!}:{})};}
async function command(binary:string,args:string[],env=process.env){const child=spawn(binary,args,{env,stdio:["ignore","ignore","pipe"]});let error="";child.stderr.on("data",data=>{error+=data.toString().slice(0,2000);});const [code]=await once(child,"exit");if(code!==0)throw new Error(binary+" failed: "+error);}
function safeKey(key:string){if(!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.blob$/.test(key))throw new Error("Invalid backup object key");return key;}
try {
  if(action==="create") {
    if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL required");
    const backupDatabaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
    const client=new pg.Client({connectionString:backupDatabaseUrl});await client.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const snapshot=(await client.query("SELECT pg_export_snapshot() AS id")).rows[0].id;
      const files:FileRow[]=(await client.query("SELECT object_key,size_bytes,sha256 FROM library_files ORDER BY object_key")).rows;
      await command("pg_dump",["--format=custom","--no-owner","--no-privileges","--snapshot="+snapshot,"--file="+join(dir,"db.dump")],pgEnv(process.env.DATABASE_URL));
      for(const file of files){const key=safeKey(file.object_key),bytes=await getPrivateObject(key);
        if(bytes.length!==file.size_bytes||createHash("sha256").update(bytes).digest("hex")!==file.sha256)throw new Error("Source integrity failure; backup aborted");
        const dest=join(dir,"objects",key);await mkdir(join(dest,".."),{recursive:true,mode:0o700});await writeFile(dest,bytes,{mode:0o600});}
      await writeFile(join(dir,"manifest.json"),JSON.stringify({format:"trivia-lobby-recovery-v1",createdAt:new Date().toISOString(),files}),{mode:0o600});
      await client.query("COMMIT");
    }finally{await client.end();}
    const {cipher,header}=backupCipher(secret),dest=resolve(output);
    await writeFile(dest,header,{flag:"wx",mode:0o600});
    try {
      const tar=spawn("tar",["-C",dir,"-cf","-","."],{stdio:["ignore","pipe","pipe"]});
      const done=once(tar,"exit");
      await pipeline(tar.stdout,cipher,createWriteStream(dest,{flags:"a",mode:0o600}));
      if((await done)[0]!==0)throw new Error("Backup archive failed");
      await appendFile(dest,cipher.getAuthTag());
      if(process.env.BACKUP_S3_BUCKET){const s3=new S3Client({region:process.env.AWS_REGION??"us-east-1"});try{
        await s3.send(new PutObjectCommand({Bucket:process.env.BACKUP_S3_BUCKET,Key:"trivia-backups/"+new Date().toISOString().replace(/:/g,"-")+".enc",Body:createReadStream(dest),ContentLength:(await stat(dest)).size,ServerSideEncryption:"AES256",IfNoneMatch:"*"}));
      }finally{s3.destroy();}}
      console.log("Encrypted database and retained-source backup created");
    }catch(e){await rm(dest,{force:true});throw e;}
  }else {
    const target=process.env.RESTORE_DATABASE_URL;
    if(!target||process.env.RESTORE_DISPOSABLE!=="1")throw new Error("Set RESTORE_DATABASE_URL to an empty isolated database and RESTORE_DISPOSABLE=1");
    const same=(a:string,b:string)=>{const x=new URL(a),y=new URL(b);return x.hostname===y.hostname&&(x.port||"5432")===(y.port||"5432")&&x.pathname===y.pathname;};
    if(process.env.DATABASE_URL&&same(target,process.env.DATABASE_URL))throw new Error("Restore target must differ from the source database");
    const client=new pg.Client({connectionString:target});await client.connect();
    const written:string[]=[];
    try {
      if(Number((await client.query("SELECT count(*) AS n FROM information_schema.tables WHERE table_schema='public'")).rows[0].n)!==0)throw new Error("Restore database must be empty");
      const source=resolve(output),size=(await stat(source)).size;
      if(size<HEADER_BYTES+16)throw new Error("Truncated backup");
      const handle=await open(source,"r"),header=Buffer.alloc(HEADER_BYTES),tag=Buffer.alloc(16);
      try{await handle.read(header,0,header.length,0);await handle.read(tag,0,16,size-16);}finally{await handle.close();}
      const tarFile=join(dir,"verified.tar");
      // Authenticate fully before extracting anything or touching the target database.
      await pipeline(createReadStream(source,{start:HEADER_BYTES,end:size-17}),backupDecipher(secret,header,tag),createWriteStream(tarFile,{mode:0o600}));
      await command("tar",["--no-same-owner","--no-same-permissions","-xf",tarFile,"-C",dir]);
      const manifest=JSON.parse(await readFile(join(dir,"manifest.json"),"utf8"));
      if(manifest.format!=="trivia-lobby-recovery-v1"||!Array.isArray(manifest.files))throw new Error("Invalid recovery manifest");
      for(const file of manifest.files as FileRow[]){const key=safeKey(file.object_key),bytes=await readFile(join(dir,"objects",key));
        if(bytes.length!==file.size_bytes||createHash("sha256").update(bytes).digest("hex")!==file.sha256)throw new Error("Backup source integrity failure");
        await putPrivateObject(key,bytes,file.sha256);written.push(key);}
      await command("pg_restore",["--dbname="+decodeURIComponent(new URL(target).pathname.slice(1)),"--no-owner","--no-privileges","--exit-on-error","--single-transaction",join(dir,"db.dump")],pgEnv(target));
      console.log("Isolated database and "+written.length+" retained originals restored; verify before promotion");
    }catch(e){for(const key of written)await deletePrivateObject(key).catch(()=>{});throw e;}
    finally{await client.end();}
  }
}finally{await rm(dir,{recursive:true,force:true});}
