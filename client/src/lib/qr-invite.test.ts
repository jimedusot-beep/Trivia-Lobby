import test from "node:test";
import assert from "node:assert/strict";
import { qrcodegen } from "./vendor/qrcodegen";

function fingerprint(url:string){
  const qr=qrcodegen.QrCode.encodeText(url,qrcodegen.QrCode.Ecc.MEDIUM);
  assert(qr.size>=21 && qr.size<=177);
  assert.equal(qr.getModule(0,0),true);
  assert.equal(qr.getModule(6,0),true);
  assert.equal(qr.getModule(0,6),true);
  assert.equal(qr.getModule(3,3),true);
  const modules=[];
  for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)modules.push(qr.getModule(x,y)?"1":"0");
  return modules.join("");
}
test("QR encoder locally produces valid deterministic finder geometry and different guest URLs",()=>{
  const first="https://trivia.example/join?code=ABC234";
  const second="https://trivia.example/join?code=DEF567";
  assert.equal(fingerprint(first),fingerprint(first));
  assert.notEqual(fingerprint(first),fingerprint(second));
});
