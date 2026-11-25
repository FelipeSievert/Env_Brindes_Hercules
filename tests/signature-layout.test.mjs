import test from "node:test";
import assert from "node:assert/strict";
import { inkBounds, blueInk, SIGNATURE_HEIGHT_MM } from "../supabase/functions/send-tracking-email/signature-layout.ts";
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

test("blue pen keeps transparent pixels and soft edges",()=>{
 const pixels=new Uint8ClampedArray([0,0,0,255,255,255,255,255,100,100,100,128,0,0,0,0]);
 blueInk(pixels);
 assert.ok(pixels[0]>=21&&pixels[0]<=31);
 assert.ok(pixels[1]>=57&&pixels[1]<=73);
 assert.ok(pixels[2]>=139&&pixels[2]<=164);
 assert.ok(pixels[3]>=145&&pixels[3]<=165);
 assert.equal(pixels[7],0);
 assert.ok(pixels[11]>0&&pixels[11]<128);
 assert.equal(pixels[15],0);
 assert.equal(SIGNATURE_HEIGHT_MM,10);
});

test("stroke edges lighter than core, marks preserved",()=>{
 const p=new Uint8ClampedArray(7*7*4);
 for(let y=2;y<=4;y++)for(let x=2;x<=4;x++)p[(y*7+x)*4+3]=255;
 blueInk(p,7);
 const a=(x,y)=>p[(y*7+x)*4+3];
 assert.ok(a(3,3)>a(2,3));assert.ok(a(2,3)>0);assert.equal(a(1,3),0);
});
