// Keep the point between the fingers anchored while scaling, rotating and panning.
export function pinchPosition(origin, pivot, movement, scale, degrees) {
  const radians = degrees * Math.PI / 180;
  const dx = origin.x - pivot.x;
  const dy = origin.y - pivot.y;
  return {
    x: pivot.x + movement.x + scale * (Math.cos(radians) * dx - Math.sin(radians) * dy),
    y: pivot.y + movement.y + scale * (Math.sin(radians) * dx + Math.cos(radians) * dy),
  };
}

export function toLocalVector(vector, degrees) {
  const radians = degrees * Math.PI / 180;
  return {x: Math.cos(radians) * vector.x + Math.sin(radians) * vector.y,
    y: -Math.sin(radians) * vector.x + Math.cos(radians) * vector.y};
}

export const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];

export function snapRotationAngle(angle, snaps = ROTATION_SNAPS, tolerance = 12) {
  const normalized = ((angle % 360) + 360) % 360;
  let best = normalized;
  let bestDiff = Infinity;

  for (const snap of snaps) {
    let diff = Math.abs(normalized - snap);
    if (diff > 180) diff = 360 - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = snap;
    }
  }

  return bestDiff <= tolerance ? best : normalized;
}

// Restore the original release snap without discarding simultaneous pan/zoom.
export function finishPinch(item, isSlot) {
  const key = isSlot && item.imageSrc ? 'imageRotation' : 'rotation';
  return {...item, [key]: snapRotationAngle(item[key] || 0)};
}
