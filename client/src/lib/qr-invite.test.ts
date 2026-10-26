import test from "node:test";
import assert from "node:assert/strict";
import { qrcodegen } from "./vendor/qrcodegen";
import jsQR from "jsqr";
import { guestInvitation, invitationGeometry } from "../../../examples/party-engine/public/room-invite.js";

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

function decodeGeometry(url: string) {
  const geometry = invitationGeometry(url);
  assert(geometry, "Invitation must encode successfully");
  const scale = 6, size = geometry.size * scale;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  for (const match of geometry.path.matchAll(/M(\d+),(\d+)h1v1h-1z/g)) {
    const x = Number(match[1]) * scale, y = Number(match[2]) * scale;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const at = ((y + dy) * size + x + dx) * 4;
      pixels[at] = 32; pixels[at + 1] = 38; pixels[at + 2] = 75;
    }
  }
  return jsQR(pixels, size, size)?.data;
}

test("guest invitation drops local quiz IDs, credentials and fragments on both servers", () => {
  for (const [page, expected] of [
    ["https://trivia.example/party/?deck=private-local-id&hostToken=secret#player-token", "https://trivia.example/party/?code=ABC234"],
    ["https://party.example/index.html?token=secret#private", "https://party.example/?code=ABC234"],
  ]) {
    const invite = guestInvitation(page, "ABC234");
    assert.equal(invite, expected);
    assert.equal(decodeGeometry(invite), expected);
  }
});

test("independent decoder reads public live, guest and assignment invitation QR pixels", () => {
  for (const url of [
    "https://trivia-lobby.onrender.com/party/?code=ABC234",
    "https://trivia.example/join?code=DEF567",
    "https://trivia.example/assignment/2c12a582-9849-49e7-9eca-753f797f932e",
    "https://a-long-custom-domain-for-a-game-night.example/party/?code=GHJ789",
  ]) assert.equal(decodeGeometry(url), url);
  assert.equal(invitationGeometry("a".repeat(10_000)), null, "Encoding failure must allow ordinary links to remain available");
});
