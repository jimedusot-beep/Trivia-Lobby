import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from "node:crypto";
export const BACKUP_MAGIC=Buffer.from("TLBACKUP1");
export const HEADER_BYTES=BACKUP_MAGIC.length+16+12;
export function backupCipher(secret:string) {
  if(secret.length<32)throw new Error("BACKUP_PASSPHRASE must contain at least 32 characters");
  const salt=randomBytes(16),iv=randomBytes(12),header=Buffer.concat([BACKUP_MAGIC,salt,iv]);
  const cipher=createCipheriv("aes-256-gcm",scryptSync(secret,salt,32),iv);cipher.setAAD(header);
  return {cipher,header};
}
export function backupDecipher(secret:string,header:Buffer,tag:Buffer) {
  if(secret.length<32 || header.length!==HEADER_BYTES || !header.subarray(0,BACKUP_MAGIC.length).equals(BACKUP_MAGIC) || tag.length!==16)throw new Error("Invalid encrypted backup");
  const salt=header.subarray(BACKUP_MAGIC.length,BACKUP_MAGIC.length+16),iv=header.subarray(-12);
  const decipher=createDecipheriv("aes-256-gcm",scryptSync(secret,salt,32),iv);decipher.setAAD(header);decipher.setAuthTag(tag);
  return decipher;
}
