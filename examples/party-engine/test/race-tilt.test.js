import test from 'node:test';
import assert from 'node:assert/strict';
import {screenRoll,tiltValue} from '../public/race-tilt.js';
test('screen-relative roll follows portrait and both landscape holds',()=>{
 assert.equal(screenRoll(60,0,0),0);
 assert(screenRoll(60,25,0)>0);assert(screenRoll(60,-25,0)<0);
 assert(screenRoll(15,-60,90)>0);assert(screenRoll(-15,-60,90)<0);
 assert(screenRoll(-15,60,270)>0);assert(screenRoll(15,60,270)<0);
 assert.equal(screenRoll(0,0),null);assert.equal(screenRoll(null,0),null);assert.equal(screenRoll(91,100),null);
});
test('calibration wraps angles, rejects jitter and bounds proportional steering',()=>{
 assert.equal(tiltValue(21,20),0);assert.equal(tiltValue(-179,179),0);
 assert.equal(tiltValue(44,20),1);assert.equal(tiltValue(-4,20),-1);
 assert(tiltValue(32,20)>0 && tiltValue(32,20)<1);
});
