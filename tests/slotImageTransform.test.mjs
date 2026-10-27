import assert from 'node:assert/strict';
import { getSlotImageTransform as transform, detachSwapSlot } from '../src/lib/slotImageTransform.js';
for (const [w,h] of [[1600,1000],[1000,1600],[1000,1000]]) {
 for (const rotation of [0,90,180,270]) {
  const base={width:1080,height:675,imageZoom:1.4,imageOffsetX:71,imageOffsetY:-29,imageRotation:rotation};
  const patch={width:367.2,height:367.2};
  const a=transform(w,h,base), b=transform(w,h,patch,base);
  assert.equal(a.width,b.width); assert.equal(a.height,b.height); assert.equal(a.rotation,b.rotation);
  assert.ok(Math.abs((a.groupX-b.groupX)-(base.width-patch.width)/2)<1e-9);
  assert.ok(Math.abs((a.groupY-b.groupY)-(base.height-patch.height)/2)<1e-9);
 }
}
console.log('PASS: 12 image aspect/rotation cases preserve scale and central crop coordinates with zoom and offsets.');

const source = {id:"base", swapGroup:"one", swapSource:"a", swapLayer:"base", width:1080, height:675, imageZoom:1.5, imageOffsetX:20, imageRotation:90};
const overlay = {id:"patch", swapGroup:"one", swapSource:"a", swapLayer:"overlay", width:367, height:367};
const detached = detachSwapSlot(overlay, [source,overlay]);
assert.deepEqual(transform(1600,1000,detached), transform(1600,1000,overlay,source));
assert.equal(detached.swapGroup,undefined);
console.log('PASS: copying or detaching the patch preserves the exact rendering transform.');

// Every frame corner must stay inside the photo after extreme crop moves.
for (const rotation of [0, 30, 90, 135, 180, 270]) {
  for (const [imageOffsetX, imageOffsetY] of [[2,0], [500,-500], [-500,500]]) {
    const slot = {width:1080, height:675, imageZoom:1, imageOffsetX, imageOffsetY, imageRotation:rotation};
    const result = transform(1600,1000,slot);
    const radians = rotation * Math.PI / 180;
    for (const x of [0,slot.width]) for (const y of [0,slot.height]) {
      const dx=x-result.groupX, dy=y-result.groupY;
      assert.ok(Math.abs(Math.cos(radians)*dx+Math.sin(radians)*dy) <= result.width/2+1e-8);
      assert.ok(Math.abs(-Math.sin(radians)*dx+Math.cos(radians)*dy) <= result.height/2+1e-8);
    }
  }
}
console.log('PASS: crop moves and rotated photos cover every frame corner without exposed edges.');

const {alignSwapBase} = await import('../src/lib/slotImageTransform.js');
for (const height of [1080,1350,1920,608]) {
  const old = {swapLayer:'base',swapGroup:'swap-2',swapSource:'b',x:1082.5,y:679,width:1060,height:650,rotation:0.2,radius:4,strokeWidth:6,imageSrc:'photo',imageZoom:1.3};
  const fixed=alignSwapBase(old,1080,height);
  assert.equal(fixed.x,1080); assert.equal(fixed.y,height/2);
  assert.equal(fixed.width,1080); assert.equal(fixed.height,height/2);
  assert.equal(fixed.strokeWidth,0); assert.equal(fixed.rotation,0);
  assert.equal(fixed.imageSrc,'photo'); assert.equal(fixed.imageZoom,1.3);
  assert.equal(alignSwapBase(fixed,1080,height),fixed);
}
console.log('PASS: old shifted swap backgrounds align without losing photos across all ratios.');
