import test from "node:test";
import assert from "node:assert/strict";
import { backupCipher,backupDecipher } from "./backup-crypto";
test("backups round-trip private bytes and reject corruption, wrong passwords and short secrets",()=>{
  const secret="a sufficiently long backup recovery passphrase",bytes=Buffer.from("Private source and question keys"),{cipher,header}=backupCipher(secret);
  const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]),tag=cipher.getAuthTag();
  const decipher=backupDecipher(secret,header,tag);assert.deepEqual(Buffer.concat([decipher.update(encrypted),decipher.final()]),bytes);
  const bad=Buffer.from(encrypted);bad[0]^=1;
  const invalid=backupDecipher(secret,header,tag);invalid.update(bad);assert.throws(()=>invalid.final());
  const wrong=backupDecipher(secret+"wrong",header,tag);wrong.update(encrypted);assert.throws(()=>wrong.final());
  assert.throws(()=>backupCipher("short"));
});
