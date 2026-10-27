// An exchanged patch shares its source frame's image scale and composition.
// Only the clipping window changes; it must never run its own cover fit.
export function getSlotImageTransform(imgW, imgH, slot, sourceSlot) {
  const source = sourceSlot || slot;
  const rotation = source.imageRotation || 0;
  const radians = rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const frameW = source.imageFitWidth || source.width;
  const frameH = source.imageFitHeight || source.height;
  // Project the clipping frame onto the photo axes, including arbitrary rotation.
  const requiredW = Math.abs(cos) * frameW + Math.abs(sin) * frameH;
  const requiredH = Math.abs(sin) * frameW + Math.abs(cos) * frameH;
  const scale = Math.max(requiredW / imgW, requiredH / imgH) * Math.max(1, source.imageZoom || 1);
  const limitX = Math.max(0, (imgW * scale - requiredW) / 2);
  const limitY = Math.max(0, (imgH * scale - requiredH) / 2);
  const offsetX = source.imageOffsetX || 0;
  const offsetY = source.imageOffsetY || 0;
  const localX = Math.max(-limitX, Math.min(limitX, cos * offsetX + sin * offsetY));
  const localY = Math.max(-limitY, Math.min(limitY, -sin * offsetX + cos * offsetY));
  return {
    groupX: slot.width / 2 + cos * localX - sin * localY,
    groupY: slot.height / 2 + sin * localX + cos * localY,
    imageX: -imgW * scale / 2,
    imageY: -imgH * scale / 2,
    width: imgW * scale,
    height: imgH * scale,
    rotation,
  };
}

// Preserve an exchanged patch when its source frame is removed or it is copied.
export function detachSwapSlot(slot, slots) {
  const { swapGroup, swapSource, swapLayer, ...detached } = slot;
  const source = swapLayer === "overlay" ? slots.find(candidate => candidate.swapLayer === "base" && candidate.swapGroup === swapGroup && candidate.swapSource === swapSource) : null;
  if (!source) return detached;
  return {
    ...detached,
    imageFitWidth: source.imageFitWidth || source.width,
    imageFitHeight: source.imageFitHeight || source.height,
    imageZoom: source.imageZoom,
    imageOffsetX: source.imageOffsetX,
    imageOffsetY: source.imageOffsetY,
    imageRotation: source.imageRotation,
    imageSrc: source.imageSrc,
    imageName: source.imageName,
  };
}

// Swap backgrounds are full-bleed layout cells, not freely positioned objects.
export function alignSwapBase(slot, singleW, canvasH) {
  if (slot.swapLayer !== 'base' || !/^swap-\d+$/.test(slot.swapGroup || '')) return slot;
  const index = Number(slot.swapGroup.slice(5)) - 1;
  const geometry = {x: index * singleW, y: slot.swapSource === 'b' ? canvasH / 2 : 0,
    width: singleW, height: canvasH / 2, rotation: 0, radius: 0, strokeWidth: 0,
    imageFitWidth: undefined, imageFitHeight: undefined};
  if (Object.entries(geometry).every(([key, value]) => slot[key] === value)) return slot;
  return {...slot, ...geometry};
}
