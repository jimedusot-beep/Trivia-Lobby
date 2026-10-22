import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { putObject,readObject,removeObject } from "./object-storage";
test("private filesystem is lossless, refuses overwrite and blocks traversal/application paths",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"trivia-object-test-"));process.env.PRIVATE_STORAGE_DIR=dir;
  const key=randomUUID()+"/"+randomUUID()+".blob",bytes=Buffer.from("private Ω bytes");
  try{await putObject("filesystem",key,bytes);assert.deepEqual(await readObject("filesystem",key,bytes.length),bytes);
    await assert.rejects(()=>putObject("filesystem",key,bytes));await assert.rejects(()=>readObject("filesystem","../secret",1));
    process.env.PRIVATE_STORAGE_DIR=process.cwd();await assert.rejects(()=>putObject("filesystem",key,bytes));
    process.env.PRIVATE_STORAGE_DIR=dir;await removeObject("filesystem",key);await assert.rejects(()=>readObject("filesystem",key,bytes.length));
  }finally{await rm(dir,{recursive:true,force:true});}
});
test("S3 adapter requests private encrypted conditional writes and bounded reads (SDK contract test)",async()=>{
  const old=S3Client.prototype.send,commands:any[]=[];process.env.SOURCE_S3_BUCKET="private-fixture";process.env.SOURCE_S3_ENDPOINT="https://storage.example.test";
  S3Client.prototype.send=(async function(command:any){commands.push(command);if(command.constructor.name==="GetObjectCommand")return {ContentLength:3,Body:(async function*(){yield Buffer.from("abc");})()};return {};}) as typeof old;
  const key=randomUUID()+"/"+randomUUID()+".blob";
  try{await putObject("s3",key,Buffer.from("abc"));assert.equal(commands[0].input.ServerSideEncryption,"AES256");assert.equal(commands[0].input.IfNoneMatch,"*");assert.equal(commands[0].input.ACL,undefined);
    assert.equal((await readObject("s3",key,3)).toString(),"abc");await assert.rejects(()=>readObject("s3",key,4));await removeObject("s3",key);
  }finally{S3Client.prototype.send=old;delete process.env.SOURCE_S3_BUCKET;delete process.env.SOURCE_S3_ENDPOINT;}
});
