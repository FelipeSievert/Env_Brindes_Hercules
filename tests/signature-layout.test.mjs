import test from "node:test";
import assert from "node:assert/strict";
import { inkBounds } from "../supabase/functions/send-tracking-email/signature-layout.ts";
const blank=()=>new Uint8ClampedArray(600*180*4);
function ink(data,x,y){data.set([20,30,60,255],(y*600+x)*4);}
test("transparent margins cropped without altering aspect ratio",()=>{
 const data=blank();ink(data,100,50);ink(data,499,129);
 assert.deepEqual(inkBounds(data,600,180),{x:97,y:47,width:406,height:86});
});
test("white background excluded",()=>{
 const data=blank().fill(255);ink(data,150,60);ink(data,450,100);
 assert.deepEqual(inkBounds(data,600,180),{x:147,y:57,width:307,height:47});
});
test("edge ink and blank canvas handled",()=>{
 const data=blank();assert.deepEqual(inkBounds(data,600,180),{x:0,y:0,width:600,height:180});
 ink(data,0,0);ink(data,599,179);assert.deepEqual(inkBounds(data,600,180),{x:0,y:0,width:600,height:180});
});
