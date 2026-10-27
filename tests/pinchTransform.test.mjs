import assert from 'node:assert/strict';
import {pinchPosition,toLocalVector} from '../src/lib/pinchTransform.js';
const near=(actual,expected)=>{assert.ok(Math.abs(actual.x-expected.x)<1e-8);assert.ok(Math.abs(actual.y-expected.y)<1e-8);};
near(pinchPosition({x:100,y:200},{x:150,y:250},{x:40,y:-20},1,0),{x:140,y:180});
near(pinchPosition({x:100,y:200},{x:150,y:250},{x:40,y:-20},2,0),{x:90,y:130});
near(pinchPosition({x:100,y:200},{x:150,y:250},{x:40,y:-20},2,90),{x:290,y:130});
// A point under the initial midpoint follows the new midpoint, regardless of angle.
for(const scale of [.5,1,2,3]) for(const angle of [-90,-20,0,45,180]) {
 const pivot={x:220,y:360}, delta={x:35,y:-80}, start={x:40,y:90};
 const position=pinchPosition(start,pivot,delta,scale,angle);
 const relative=toLocalVector({x:(pivot.x-start.x)*scale,y:(pivot.y-start.y)*scale},-angle);
 near({x:position.x+relative.x,y:position.y+relative.y},{x:pivot.x+delta.x,y:pivot.y+delta.y});
}
near(toLocalVector({x:60,y:0},90),{x:0,y:-60});
console.log('PASS: simultaneous translation, zoom, rotation and finger midpoint anchoring.');

const {finishPinch, snapRotationAngle} = await import('../src/lib/pinchTransform.js');
for (const [input, expected] of [[8,0],[359,0],[-8,0],[34,45],[78,90],[102,90],[103,103],[173,180],[268,270]]) {
  assert.equal(snapRotationAngle(input),expected);
}
const moved = {x:130,y:240,width:400,height:600,rotation:88};
assert.deepEqual(finishPinch(moved,false),{...moved,rotation:90});
const cropped = {...moved,imageSrc:'photo',imageZoom:1.8,imageOffsetX:34,imageOffsetY:-70,imageRotation:358};
assert.deepEqual(finishPinch(cropped,true),{...cropped,imageRotation:0});
assert.deepEqual(finishPinch(moved,true),{...moved,rotation:90});
console.log('PASS: original 45-degree/12-degree release snap restored; final pan, size and crop preserved.');
