import assert from "node:assert/strict";
import test from "node:test";
import { normalizedHotspotPoint } from "./hotspots";
test("hotspots stay at same normalized location when images resize",()=>{
  const desktop=normalizedHotspotPoint(300,375,{left:100,top:75,width:400,height:400});
  const mobile=normalizedHotspotPoint(150,225,{left:50,top:75,width:200,height:200});
  assert.deepEqual(desktop,{x:0.5,y:0.75});
  assert.deepEqual(mobile,desktop);
});
test("hotspot placement clamps edges and rejects missing dimensions",()=>{
  assert.deepEqual(normalizedHotspotPoint(-10,110,{left:0,top:0,width:100,height:100}),{x:0,y:1});
  assert.throws(()=>normalizedHotspotPoint(20,20,{left:0,top:0,width:0,height:0}));
  assert.throws(()=>normalizedHotspotPoint(NaN,20,{left:0,top:0,width:100,height:100}));
});
