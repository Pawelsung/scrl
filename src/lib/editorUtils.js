import { EDGE_OVERDRAG, SNAP_RELEASE, SNAP_THRESHOLD } from "../constants/editor.js";

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function hexToRgba(hex, alpha = 1) {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((s) => s + s).join("") : raw;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function createGradientStops(colorA, colorB) {
  return [0, colorA, 1, colorB];
}

export function normalizeRotation(rotation = 0) {
  let next = rotation % 360;
  if (next < 0) next += 360;
  return next;
}

export function rotateDelta(dx, dy, rotation = 0) {
  const rad = (rotation * Math.PI) / 180;
  return {
    dx: dx * Math.cos(rad) - dy * Math.sin(rad),
    dy: dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

export function getSelectedTypeLabel(item, slot) {
  if (slot?.swapLayer === "overlay") return "置換方形";
  if (slot?.swapLayer === "base") return "置換主圖";
  if (slot) return slot.imageSrc ? "裁切框" : "模板圖框";
  if (!item) return "";
  if (item.type === "image") return "圖片";
  if (item.type === "text") return "文字";
  if (item.type === "sticker") return "貼紙";
  return "物件";
}

export function getSlotFrameStrokeWidth(slot, isSelected) {
  const baseWidth = slot.strokeWidth == null ? 4 : slot.strokeWidth;
  if (!isSelected) return baseWidth;
  return baseWidth > 0 ? baseWidth + 1 : 3;
}

export function getRotatedGeometry(x, y, width, height, rotation = 0) {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners = [
    { x, y },
    { x: x + width * cos, y: y + width * sin },
    { x: x - height * sin, y: y + height * cos },
    {
      x: x + width * cos - height * sin,
      y: y + width * sin + height * cos,
    },
  ];

  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);

  const centerX = x + (width / 2) * cos - (height / 2) * sin;
  const centerY = y + (width / 2) * sin + (height / 2) * cos;

  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
    centerX,
    centerY,
  };
}

export function getSnapResultForRotatedBox({ x, y, width, height, rotation = 0 }, snapGuides) {
  const geo = getRotatedGeometry(x, y, width, height, rotation);

  let bestV = { diff: Infinity, guide: null, mode: null };
  let bestH = { diff: Infinity, guide: null, mode: null };

  const xCandidates = [
    { key: "left", value: geo.left },
    { key: "center", value: geo.centerX },
    { key: "right", value: geo.right },
  ];

  const yCandidates = [
    { key: "top", value: geo.top },
    { key: "center", value: geo.centerY },
    { key: "bottom", value: geo.bottom },
  ];

  for (const guide of snapGuides.vertical) {
    for (const c of xCandidates) {
      const diff = Math.abs(c.value - guide);
      if (diff < bestV.diff) bestV = { diff, guide, mode: c.key };
    }
  }

  for (const guide of snapGuides.horizontal) {
    for (const c of yCandidates) {
      const diff = Math.abs(c.value - guide);
      if (diff < bestH.diff) bestH = { diff, guide, mode: c.key };
    }
  }

  let dx = 0;
  let dy = 0;
  let vertical = null;
  let horizontal = null;

  if (bestV.diff <= SNAP_THRESHOLD) {
    if (bestV.mode === "left") dx = bestV.guide - geo.left;
    if (bestV.mode === "center") dx = bestV.guide - geo.centerX;
    if (bestV.mode === "right") dx = bestV.guide - geo.right;
    vertical = bestV.guide;
  } else if (bestV.diff > SNAP_RELEASE) {
    vertical = null;
  }

  if (bestH.diff <= SNAP_THRESHOLD) {
    if (bestH.mode === "top") dy = bestH.guide - geo.top;
    if (bestH.mode === "center") dy = bestH.guide - geo.centerY;
    if (bestH.mode === "bottom") dy = bestH.guide - geo.bottom;
    horizontal = bestH.guide;
  } else if (bestH.diff > SNAP_RELEASE) {
    horizontal = null;
  }

  return { dx, dy, vertical, horizontal };
}

export function clampDraggedPositionForRotatedBox(
  x,
  y,
  width,
  height,
  rotation,
  canvasW,
  canvasH
) {
  const geo = getRotatedGeometry(x, y, width, height, rotation);

  let nextX = x;
  let nextY = y;

  // 用中心點限制，而不是直接限制四個邊。
  // 這樣大圖不會一拖就被吸到畫布邊。
  const geoWidth = geo.right - geo.left;
  const geoHeight = geo.bottom - geo.top;

  const marginX = Math.max(EDGE_OVERDRAG, geoWidth * 0.35, canvasW * 0.18);
  const marginY = Math.max(EDGE_OVERDRAG, geoHeight * 0.35, canvasH * 0.18);

  const minCenterX = -marginX;
  const maxCenterX = canvasW + marginX;
  const minCenterY = -marginY;
  const maxCenterY = canvasH + marginY;

  const clampedCenterX = clamp(geo.centerX, minCenterX, maxCenterX);
  const clampedCenterY = clamp(geo.centerY, minCenterY, maxCenterY);

  nextX += clampedCenterX - geo.centerX;
  nextY += clampedCenterY - geo.centerY;

  return { x: nextX, y: nextY };
}

export function getShortestAngleDelta(current, start) {
  let delta = current - start;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}



export function pointInRotatedRect(px, py, x, y, width, height, rotation = 0, padding = 24) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rad = (-rotation * Math.PI) / 180;

  const dx = px - cx;
  const dy = py - cy;

  const localX = dx * Math.cos(rad) - dy * Math.sin(rad) + width / 2;
  const localY = dx * Math.sin(rad) + dy * Math.cos(rad) + height / 2;

  return (
    localX >= -padding &&
    localX <= width + padding &&
    localY >= -padding &&
    localY <= height + padding
  );
}

export function touchPointToCanvasPoint(touch, pan, displayScale) {
  return {
    x: (touch.clientX - pan.x) / displayScale,
    y: (touch.clientY - pan.y) / displayScale,
  };
}

export function createSlot({
  x,
  y,
  width,
  height,
  radius = 24,
  stroke = "#ffffff",
  strokeWidth = 6,
  fill = "rgba(255,255,255,0.06)",
  label = "Image Slot",
}) {
  return {
    id: uid("slot"),
    type: "slot",
    x,
    y,
    width,
    height,
    rotation: 0,
    radius,
    stroke,
    strokeWidth,
    fill,
    label,
    imageSrc: null,
    imageName: null,
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageZoom: 1,
    imageRotation: 0,
  };
}

export function getCoverPlacement(imgW, imgH, frameW, frameH, zoom = 1, offsetX = 0, offsetY = 0) {
  if (!imgW || !imgH || !frameW || !frameH) {
    return { x: 0, y: 0, width: frameW, height: frameH };
  }

  const baseScale = Math.max(frameW / imgW, frameH / imgH);
  const scale = baseScale * zoom;
  const width = imgW * scale;
  const height = imgH * scale;

  return {
    x: (frameW - width) / 2 + offsetX,
    y: (frameH - height) / 2 + offsetY,
    width,
    height,
  };
}

export function getCoverImageTransform(
  imgW,
  imgH,
  frameW,
  frameH,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
  rotation = 0
) {
  if (!imgW || !imgH || !frameW || !frameH) {
    return { groupX: frameW / 2, groupY: frameH / 2, imageX: 0, imageY: 0, width: frameW, height: frameH };
  }

  const normalized = normalizeRotation(rotation);
  const rotated = normalized === 90 || normalized === 270;
  const fitW = rotated ? imgH : imgW;
  const fitH = rotated ? imgW : imgH;
  const scale = Math.max(frameW / fitW, frameH / fitH) * zoom;
  const width = imgW * scale;
  const height = imgH * scale;

  return {
    groupX: frameW / 2 + offsetX,
    groupY: frameH / 2 + offsetY,
    imageX: -width / 2,
    imageY: -height / 2,
    width,
    height,
    rotation: normalized,
  };
}

export function resizeImageSource(image, maxDimension, mime = "image/jpeg", quality = 0.9) {
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);
  return {
    src: canvas.toDataURL(mime, quality),
    width,
    height,
  };
}

export async function loadImageFile(file) {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return bitmap;
    } catch {
      // Fall back to an HTMLImageElement for browsers with partial createImageBitmap support.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function roundedRectPath(ctx, w, h, r) {
  const rr = Math.max(0, Math.min(r || 0, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(rr, 0);
  ctx.lineTo(w - rr, 0);
  ctx.quadraticCurveTo(w, 0, w, rr);
  ctx.lineTo(w, h - rr);
  ctx.quadraticCurveTo(w, h, w - rr, h);
  ctx.lineTo(rr, h);
  ctx.quadraticCurveTo(0, h, 0, h - rr);
  ctx.lineTo(0, rr);
  ctx.quadraticCurveTo(0, 0, rr, 0);
  ctx.closePath();
}
