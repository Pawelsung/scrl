import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Konva from "konva";
import { pinchPosition, toLocalVector, ROTATION_SNAPS, finishPinch } from "./lib/pinchTransform.js";
import { zipSync } from "fflate";

// The editor already uses a full-resolution, multi-slide canvas. Device DPR
// multiplication can exhaust mobile canvas memory; exports set their own ratio.
Konva.pixelRatio = 1;

import {
  Stage,
  Layer,
  Rect,
  Text,
  Image as KonvaImage,
  Group,
  Line,
  Transformer,
} from "react-konva";

import { getSlotImageTransform, detachSwapSlot, alignSwapBase } from "./lib/slotImageTransform.js";

import ProjectPanelUI from "./components/panels/ProjectPanel";
import PreviewPanelUI from "./components/panels/PreviewPanel";
import MobileBottomBarUI from "./components/mobile/MobileBottomBar";
import MobileDrawerUI from "./components/mobile/MobileDrawer";
import BottomAssetTray from "./components/mobile/BottomAssetTray";
import MobileBottomDock from "./components/mobile/MobileBottomDock";

const RATIOS = {
  "4:5": { w: 1080, h: 1350 },
  "1:1": { w: 1080, h: 1080 },
  "16:9": { w: 1080, h: 608 },
  "9:16": { w: 1080, h: 1920 },
};

const TEMPLATES = [
  { id: "blank", name: "空白畫布" },
  { id: "magazine", name: "雜誌留白" },
  { id: "cover", name: "大標題封面" },
  { id: "film", name: "底片拼貼" },
  { id: "split", name: "左右文圖" },
  { id: "frame", name: "留白框版型" },
  { id: "grid4", name: "四格拼貼" },
  { id: "duo", name: "雙圖對照" },
  { id: "triptych", name: "三連圖集" },
  { id: "polaroid", name: "拍立得拼貼" },
  { id: "quote", name: "語錄留白" },
  { id: "product", name: "產品展示" },
  { id: "checker", name: "棋盤拼貼" },
  { id: "swap-square", name: "中心方形置換" },
];

const FONT_OPTIONS = [
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times", value: '"Times New Roman", Times, serif' },
  { label: "Courier", value: '"Courier New", Courier, monospace' },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet", value: '"Trebuchet MS", sans-serif' },
  { label: "Impact", value: "Impact, Haettenschweiler, sans-serif" },
];

const STICKERS = [
  { id: "tape", label: "紙膠帶", type: "tape" },
  { id: "star", label: "星星", type: "star" },
  { id: "circle", label: "圓點", type: "circle" },
  { id: "heart", label: "愛心", type: "heart" },
  { id: "diamond", label: "菱形", type: "diamond" },
  { id: "triangle", label: "三角形", type: "triangle" },
  { id: "spark", label: "閃光", type: "spark" },
];

const SNAP_THRESHOLD = 18;
const SNAP_RELEASE = 28;
const EDGE_OVERDRAG = 140;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const SLOT_NUDGE = 24;
const SLOT_ZOOM_STEP = 0.08;
const STORAGE_KEY = "scrl_draft_v1";
const MAX_IMAGE_DIMENSION_DESKTOP = 3200;
const MAX_IMAGE_DIMENSION_MOBILE = 2200;
const DEFAULT_CANVAS_COLOR = "#d9dde3";
const DEFAULT_CANVAS_COLOR_2 = "#eef0f3";

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgba(hex, alpha = 1) {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((s) => s + s).join("") : raw;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createGradientStops(colorA, colorB) {
  return [0, colorA, 1, colorB];
}

function normalizeRotation(rotation = 0) {
  let next = rotation % 360;
  if (next < 0) next += 360;
  return next;
}

function rotateDelta(dx, dy, rotation = 0) {
  const rad = (rotation * Math.PI) / 180;
  return {
    dx: dx * Math.cos(rad) - dy * Math.sin(rad),
    dy: dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

function getSelectedTypeLabel(item, slot) {
  if (slot?.swapLayer === "overlay") return "置換方形";
  if (slot?.swapLayer === "base") return "置換主圖";
  if (slot) return slot.imageSrc ? "裁切框" : "模板圖框";
  if (!item) return "";
  if (item.type === "image") return "圖片";
  if (item.type === "text") return "文字";
  if (item.type === "sticker") return "貼紙";
  return "物件";
}

function getSlotFrameStrokeWidth(slot, isSelected) {
  const baseWidth = slot.strokeWidth == null ? 4 : slot.strokeWidth;
  if (!isSelected) return baseWidth;
  return baseWidth > 0 ? baseWidth + 1 : 3;
}

function useImage(src) {
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    let active = true;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (active) setImage(img);
    };
    img.src = src;

    return () => {
      active = false;
    };
  }, [src]);

  return image;
}

function getRotatedGeometry(x, y, width, height, rotation = 0) {
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

function getSnapResultForRotatedBox({ x, y, width, height, rotation = 0 }, snapGuides) {
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

function clampDraggedPositionForRotatedBox(
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

function getShortestAngleDelta(current, start) {
  let delta = current - start;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}



function pointInRotatedRect(px, py, x, y, width, height, rotation = 0, padding = 24) {
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

function touchPointToCanvasPoint(touch, pan, displayScale) {
  return {
    x: (touch.clientX - pan.x) / displayScale,
    y: (touch.clientY - pan.y) / displayScale,
  };
}

function createSlot({
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

function getCoverPlacement(imgW, imgH, frameW, frameH, zoom = 1, offsetX = 0, offsetY = 0) {
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

function getCoverImageTransform(
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

function resizeImageSource(image, maxDimension, mime = "image/jpeg", quality = 0.9) {
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

async function loadImageFile(file) {
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

function roundedRectPath(ctx, w, h, r) {
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

function DraggableImage({
  item,
  isSelected,
  onSelect,
  onChange,
  snapGuides,
  canvasW,
  canvasH,
  transformerAnchorSize = 18,
  editing = true,
  keepRatioOnTransform = false,
  centeredScaling = false,
  onInteractionChange,
  pushHistory,
  registerSelectableNode,
  onSnapChange,
}) {
  const image = useImage(item.src);
  const shapeRef = useRef(null);

  useEffect(() => {
    if (!shapeRef.current) return undefined;
    registerSelectableNode?.("element", item.id, shapeRef.current);
    return () => registerSelectableNode?.("element", item.id, null);
  }, [item.id, registerSelectableNode]);

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={image}
        x={item.x}
        y={item.y}
        width={item.width}
        height={item.height}
        rotation={item.rotation || 0}
        opacity={item.opacity ?? 1}
        cornerRadius={item.radius || 0}
        shadowBlur={item.shadow || 0}
        shadowOpacity={item.shadow ? 0.28 : 0}
        shadowOffsetY={item.shadow ? 8 : 0}
        stroke={item.borderWidth ? item.borderColor || "#ffffff" : undefined}
        strokeWidth={item.borderWidth || 0}
        draggable={editing}
        onClick={editing ? onSelect : undefined}
        onTap={editing ? onSelect : undefined}
        onDragStart={() => {
          pushHistory?.();
          onInteractionChange?.(true);
        }}
        onDragMove={
          editing
            ? (e) => {
                const node = e.target;

                const snapped = getSnapResultForRotatedBox(
                  {
                    x: node.x(),
                    y: node.y(),
                    width: item.width,
                    height: item.height,
                    rotation: node.rotation(),
                  },
                  snapGuides
                );
                onSnapChange?.({
                  vertical: snapped.vertical != null ? [snapped.vertical] : [],
                  horizontal: snapped.horizontal != null ? [snapped.horizontal] : [],
                });

                const nextPos = clampDraggedPositionForRotatedBox(
                  node.x() + snapped.dx,
                  node.y() + snapped.dy,
                  item.width,
                  item.height,
                  node.rotation(),
                  canvasW,
                  canvasH
                );

                node.position(nextPos);
              }
            : undefined
        }
        onDragEnd={
          editing
            ? (e) => {
                const node = e.target;
                onInteractionChange?.(false);
                onSnapChange?.({ vertical: [], horizontal: [] });
                onChange({
                  ...item,
                  x: node.x(),
                  y: node.y(),
                  rotation: normalizeRotation(node.rotation()),
                  snapV: null,
                  snapH: null,
                });
              }
            : undefined
        }
        onTransformStart={() => {
          pushHistory?.();
          onInteractionChange?.(true);
        }}
        onTransformEnd={
          editing
            ? () => {
                const node = shapeRef.current;
                const scaleX = node.scaleX();
                const scaleY = node.scaleY();

                onInteractionChange?.(false);

                const next = {
                  ...item,
                  x: node.x(),
                  y: node.y(),
                  rotation: normalizeRotation(node.rotation()),
                  width: Math.max(40, node.width() * scaleX),
                  height: Math.max(40, node.height() * scaleY),
                };

                node.scaleX(1);
                node.scaleY(1);
                onChange(next);
              }
            : undefined
        }
      />
    </>
  );
}

function DraggableText({
  item,
  isSelected,
  onSelect,
  onChange,
  snapGuides,
  canvasW,
  canvasH,
  transformerAnchorSize = 18,
  editing = true,
  onInteractionChange,
  pushHistory,
  registerSelectableNode,
  onSnapChange,
}) {
  const textRef = useRef(null);

  useEffect(() => {
    if (!textRef.current) return undefined;
    registerSelectableNode?.("element", item.id, textRef.current);
    return () => registerSelectableNode?.("element", item.id, null);
  }, [item.id, registerSelectableNode]);

  return (
    <>
      {editing && (
        <Rect
          x={-18}
          y={-18}
          width={item.width + 36}
          height={Math.max(item.fontSize * 1.8, 56)}
          fill="rgba(255,255,255,0.001)"
          listening
          onClick={onSelect}
          onTap={onSelect}
        />
      )}

      <Text
        ref={textRef}
        x={item.x}
        y={item.y}
        text={item.text}
        width={item.width || 400}
        fontSize={item.fontSize}
        fontStyle={item.fontStyle || "normal"}
        fontFamily={item.fontFamily || "Inter, system-ui, sans-serif"}
        fill={item.fill || "#111111"}
        align={item.align || "left"}
        opacity={item.opacity ?? 1}
        draggable={editing}
        onClick={editing ? onSelect : undefined}
        onTap={editing ? onSelect : undefined}
        onDragStart={() => {
          pushHistory?.();
          onInteractionChange?.(true);
        }}
        onDragMove={
          editing
            ? (e) => {
                const node = e.target;

                const snapped = getSnapResultForRotatedBox(
                  {
                    x: node.x(),
                    y: node.y(),
                    width: item.width || 400,
                    height: item.fontSize * 1.6,
                    rotation: node.rotation(),
                  },
                  snapGuides
                );
                onSnapChange?.({
                  vertical: snapped.vertical != null ? [snapped.vertical] : [],
                  horizontal: snapped.horizontal != null ? [snapped.horizontal] : [],
                });

                const nextPos = clampDraggedPositionForRotatedBox(
                  node.x() + snapped.dx,
                  node.y() + snapped.dy,
                  item.width || 400,
                  item.fontSize * 1.6,
                  node.rotation(),
                  canvasW,
                  canvasH
                );

                node.position(nextPos);
              }
            : undefined
        }
        onDragEnd={
          editing
            ? (e) => {
                const node = e.target;
                onInteractionChange?.(false);
                onSnapChange?.({ vertical: [], horizontal: [] });
                onChange({
                  ...item,
                  x: node.x(),
                  y: node.y(),
                  rotation: normalizeRotation(node.rotation()),
                  snapV: null,
                  snapH: null,
                });
              }
            : undefined
        }
        onTransformStart={() => {
          pushHistory?.();
          onInteractionChange?.(true);
        }}
        onTransformEnd={
          editing
            ? () => {
                const node = textRef.current;
                const scaleX = node.scaleX();
                const nextWidth = Math.max(120, (item.width || 400) * scaleX);

                node.scaleX(1);
                node.scaleY(1);
                onInteractionChange?.(false);

                onChange({
                  ...item,
                  x: node.x(),
                  y: node.y(),
                  width: nextWidth,
                  rotation: normalizeRotation(node.rotation()),
                });
              }
            : undefined
        }
      />
    </>
  );
}

function StickerShape({
  item,
  isSelected,
  onSelect,
  onChange,
  snapGuides,
  canvasW,
  canvasH,
  transformerAnchorSize = 18,
  editing = true,
  centeredScaling = false,
  onInteractionChange,
  pushHistory,
  registerSelectableNode,
  onSnapChange,
}) {
  const groupRef = useRef(null);

  useEffect(() => {
    if (!groupRef.current) return undefined;
    registerSelectableNode?.("element", item.id, groupRef.current);
    return () => registerSelectableNode?.("element", item.id, null);
  }, [item.id, registerSelectableNode]);

  return (
    <>
      <Group
        ref={groupRef}
        x={item.x}
        y={item.y}
        rotation={item.rotation || 0}
        opacity={item.opacity ?? 1}
        draggable={editing}
        onClick={editing ? onSelect : undefined}
        onTap={editing ? onSelect : undefined}
        onDragStart={() => {
          pushHistory?.();
          onInteractionChange?.(true);
        }}
        onDragMove={
          editing
            ? (e) => {
                const node = e.target;

                const snapped = getSnapResultForRotatedBox(
                  {
                    x: node.x(),
                    y: node.y(),
                    width: item.width,
                    height: item.height,
                    rotation: node.rotation(),
                  },
                  snapGuides
                );
                onSnapChange?.({
                  vertical: snapped.vertical != null ? [snapped.vertical] : [],
                  horizontal: snapped.horizontal != null ? [snapped.horizontal] : [],
                });

                const nextPos = clampDraggedPositionForRotatedBox(
                  node.x() + snapped.dx,
                  node.y() + snapped.dy,
                  item.width,
                  item.height,
                  node.rotation(),
                  canvasW,
                  canvasH
                );

                node.position(nextPos);
              }
            : undefined
        }
        onDragEnd={
          editing
            ? (e) => {
                const node = e.target;
                onInteractionChange?.(false);
                onSnapChange?.({ vertical: [], horizontal: [] });
                onChange({
                  ...item,
                  x: node.x(),
                  y: node.y(),
                  rotation: normalizeRotation(node.rotation()),
                  snapV: null,
                  snapH: null,
                });
              }
            : undefined
        }
        onTransformStart={() => {
          pushHistory?.();
          onInteractionChange?.(true);
        }}
        onTransformEnd={
          editing
            ? () => {
                const node = groupRef.current;
                onInteractionChange?.(false);
                const next = {
                  ...item,
                  x: node.x(),
                  y: node.y(),
                  rotation: normalizeRotation(node.rotation()),
                  width: Math.max(30, item.width * node.scaleX()),
                  height: Math.max(30, item.height * node.scaleY()),
                };
                node.scaleX(1);
                node.scaleY(1);
                onChange(next);
              }
            : undefined
        }
      >
        {item.stickerType === "tape" && (
          <Rect
            width={item.width}
            height={item.height}
            cornerRadius={10}
            fill={hexToRgba(item.fill || "#f8df8f", 0.55)}
            stroke={hexToRgba("#ffffff", 0.25)}
            strokeWidth={1}
          />
        )}
        {item.stickerType === "circle" && (
          <Rect width={item.width} height={item.height} cornerRadius={999} fill={item.fill || "#ffffff"} />
        )}
        {item.stickerType === "star" && (
          <Line
            points={[
              item.width * 0.5, 0,
              item.width * 0.62, item.height * 0.34,
              item.width, item.height * 0.38,
              item.width * 0.7, item.height * 0.62,
              item.width * 0.82, item.height,
              item.width * 0.5, item.height * 0.78,
              item.width * 0.18, item.height,
              item.width * 0.3, item.height * 0.62,
              0, item.height * 0.38,
              item.width * 0.38, item.height * 0.34,
            ]}
            closed
            fill={item.fill || "#ffeb79"}
            stroke={hexToRgba("#ffffff", 0.35)}
            strokeWidth={1}
          />
        )}
        {item.stickerType === "heart" && (
          <Line
            points={[
              item.width * 0.5, item.height,
              item.width * 0.12, item.height * 0.58,
              item.width * 0.04, item.height * 0.28,
              item.width * 0.24, item.height * 0.08,
              item.width * 0.5, item.height * 0.24,
              item.width * 0.76, item.height * 0.08,
              item.width * 0.96, item.height * 0.28,
              item.width * 0.88, item.height * 0.58,
            ]}
            closed
            fill={item.fill || "#ff7a90"}
            stroke={hexToRgba("#ffffff", 0.35)}
            strokeWidth={1}
          />
        )}
        {item.stickerType === "diamond" && (
          <Line
            points={[
              item.width * 0.5, 0,
              item.width, item.height * 0.5,
              item.width * 0.5, item.height,
              0, item.height * 0.5,
            ]}
            closed
            fill={item.fill || "#9ad8ff"}
            stroke={hexToRgba("#ffffff", 0.35)}
            strokeWidth={1}
          />
        )}
        {item.stickerType === "triangle" && (
          <Line
            points={[item.width * 0.5, 0, item.width, item.height, 0, item.height]}
            closed
            fill={item.fill || "#b7f07a"}
            stroke={hexToRgba("#ffffff", 0.35)}
            strokeWidth={1}
          />
        )}
        {item.stickerType === "spark" && (
          <Line
            points={[
              item.width * 0.5, 0,
              item.width * 0.62, item.height * 0.38,
              item.width, item.height * 0.5,
              item.width * 0.62, item.height * 0.62,
              item.width * 0.5, item.height,
              item.width * 0.38, item.height * 0.62,
              0, item.height * 0.5,
              item.width * 0.38, item.height * 0.38,
            ]}
            closed
            fill={item.fill || "#ffffff"}
            stroke={hexToRgba("#ffffff", 0.35)}
            strokeWidth={1}
          />
        )}
      </Group>
    </>
  );
}

function TemplateSlot({
  slot,
  sourceSlot,
  isSelected,
  onSelect,
  onChange,
  snapGuides,
  canvasW,
  canvasH,
  transformerAnchorSize = 18,
  editing = true,
  onInteractionChange,
  pushHistory,
  showContent = true,
  showFrame = true,
  showPlaceholder = true,
  showTransformer = true,
  showHitArea = true,
  interactive = true,
  registerSelectableNode,
  onSnapChange,
}) {
  const groupRef = useRef(null);
  const image = useImage(slot.imageSrc);

  useEffect(() => {
    if (!groupRef.current) return undefined;
    registerSelectableNode?.("slot", slot.id, groupRef.current);
    return () => registerSelectableNode?.("slot", slot.id, null);
  }, [slot.id, registerSelectableNode]);

  return (
    <>
      <Group
        ref={groupRef}
        _useStrictMode={slot.swapLayer === "base"}
        x={slot.x}
        y={slot.y}
        rotation={slot.rotation || 0}
        draggable={editing && interactive && slot.swapLayer !== "base"}
        onClick={editing && interactive ? onSelect : undefined}
        onTap={editing && interactive ? onSelect : undefined}
        onDragStart={() => {
          pushHistory?.();
          onInteractionChange?.(true);
        }}
        onDragMove={
          editing && interactive
            ? (e) => {
                const node = e.target;

                const snapped = getSnapResultForRotatedBox(
                  {
                    x: node.x(),
                    y: node.y(),
                    width: slot.width,
                    height: slot.height,
                    rotation: node.rotation(),
                  },
                  snapGuides
                );
                onSnapChange?.({
                  vertical: snapped.vertical != null ? [snapped.vertical] : [],
                  horizontal: snapped.horizontal != null ? [snapped.horizontal] : [],
                });

                const nextPos = clampDraggedPositionForRotatedBox(
                  node.x() + snapped.dx,
                  node.y() + snapped.dy,
                  slot.width,
                  slot.height,
                  node.rotation(),
                  canvasW,
                  canvasH
                );

                node.position(nextPos);
              }
            : undefined
        }
        onDragEnd={
          editing && interactive
            ? (e) => {
                const node = e.target;
                onInteractionChange?.(false);
                onSnapChange?.({ vertical: [], horizontal: [] });
                onChange({
                  ...slot,
                  x: node.x(),
                  y: node.y(),
                  rotation: normalizeRotation(node.rotation()),
                  snapV: null,
                  snapH: null,
                });
              }
            : undefined
        }
        onTransformStart={() => {
          pushHistory?.();
          onInteractionChange?.(true);
        }}
        onTransformEnd={
          editing && interactive
            ? () => {
                const node = groupRef.current;
                onInteractionChange?.(false);
                const next = {
                  ...slot,
                  x: node.x(),
                  y: node.y(),
                  rotation: normalizeRotation(node.rotation()),
                  width: Math.max(80, slot.width * node.scaleX()),
                  height: Math.max(80, slot.height * node.scaleY()),
                };
                node.scaleX(1);
                node.scaleY(1);
                onChange(next);
              }
            : undefined
        }
      >
        {showHitArea && (
          <Rect
            width={slot.width}
            height={slot.height}
            cornerRadius={slot.radius || 0}
            fill="rgba(255,255,255,0.001)"
            listening={editing && interactive}
          />
        )}

        {showContent && (
          <Group
            clipFunc={(ctx) => {
              roundedRectPath(ctx, slot.width, slot.height, slot.radius || 0);
            }}
          >
            <Rect
              width={slot.width}
              height={slot.height}
              fill={slot.fill || "rgba(255,255,255,0.06)"}
              cornerRadius={slot.radius || 0}
            />

            {image && (() => {
              const transform = getSlotImageTransform(image.width, image.height, slot, sourceSlot);
              return (
                <Group
                  x={transform.groupX}
                  y={transform.groupY}
                  rotation={transform.rotation}
                >
                  <KonvaImage
                    image={image}
                    x={transform.imageX}
                    y={transform.imageY}
                    width={transform.width}
                    height={transform.height}
                  />
                </Group>
              );
            })()}
          </Group>
        )}

        {editing && showPlaceholder && !slot.imageSrc && (
          <>
            <Rect
              x={16}
              y={16}
              width={Math.max(20, slot.width - 32)}
              height={Math.max(20, slot.height - 32)}
              cornerRadius={Math.max(8, (slot.radius || 0) - 8)}
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={2}
              dash={[10, 8]}
            />
            <Text
              x={24}
              y={Math.max(20, slot.height / 2 - 14)}
              width={Math.max(40, slot.width - 48)}
              text={slot.label || "Image Slot"}
              align="center"
              fontSize={22}
              fontStyle="bold"
              fill="rgba(255,255,255,0.8)"
            />
          </>
        )}

        {showFrame && (
          <Rect
            width={slot.width}
            height={slot.height}
            cornerRadius={slot.radius || 0}
            stroke={isSelected ? "#7db2ff" : slot.stroke || "#ffffff"}
            strokeEnabled={getSlotFrameStrokeWidth(slot, isSelected) > 0}
            strokeWidth={getSlotFrameStrokeWidth(slot, isSelected)}
          />
        )}
      </Group>

    </>
  );
}

function SelectionTransformer({
  selectedNode,
  selectedType,
  editing,
  transformerAnchorSize,
  keepRatioOnTransform = false,
  centeredScaling = false,
}) {
  const trRef = useRef(null);

  useEffect(() => {
    if (!trRef.current) return;

    if (editing && selectedNode) {
      trRef.current.nodes([selectedNode]);
      trRef.current.getLayer()?.batchDraw();
      return;
    }

    trRef.current.nodes([]);
    trRef.current.getLayer()?.batchDraw();
  }, [editing, selectedNode, selectedType, keepRatioOnTransform, centeredScaling]);

  if (!editing || !selectedNode) return null;

  const isText = selectedType === "text";
  const isSticker = selectedType === "sticker";
  const isSlot = selectedType === "slot";
  const isImage = selectedType === "image";

  const enabledAnchors = isText
    ? ["middle-left", "middle-right"]
    : isSticker
      ? ["top-left", "top-right", "bottom-left", "bottom-right"]
      : [
          "top-left",
          "top-center",
          "top-right",
          "middle-left",
          "middle-right",
          "bottom-left",
          "bottom-center",
          "bottom-right",
        ];

  return (
    <Transformer
      ref={trRef}
      rotateEnabled
      keepRatio={isImage ? keepRatioOnTransform : false}
      centeredScaling={isImage || isSticker ? centeredScaling : false}
      shiftBehavior="default"
      rotationSnaps={ROTATION_SNAPS}
      rotationSnapTolerance={6}
      anchorSize={transformerAnchorSize}
      borderStroke="#7db2ff"
      anchorStroke="#7db2ff"
      anchorFill="#0b0f17"
      enabledAnchors={enabledAnchors}
      boundBoxFunc={(oldBox, newBox) => {
        if (isText && newBox.width < 120) return oldBox;
        if (isSlot && (newBox.width < 80 || newBox.height < 80)) return oldBox;
        if (!isText && !isSlot && (newBox.width < 40 || newBox.height < 40)) return oldBox;
        return newBox;
      }}
    />
  );
}

function SelectionQuickControls({ actions, compact = false }) {
  if (!actions?.hasSelection) return null;

  return (
    <div className={`selection-quick-controls ${compact ? "compact" : ""}`}>
      <div className="desktop-object-pad">
        <div className="desktop-object-pad__head">物件控制</div>
        <div className="desktop-object-pad__grid">
          <button type="button" className="ghost" onClick={actions.onScaleDown}>縮小</button>
          <button type="button" className="ghost" onClick={actions.onNudgeUp}>↑</button>
          <button type="button" className="ghost" onClick={actions.onScaleUp}>放大</button>
          <button type="button" className="ghost" onClick={actions.onNudgeLeft}>←</button>
          <button type="button" className="ghost" onClick={actions.onRotate90}>旋轉 90°</button>
          <button type="button" className="ghost" onClick={actions.onNudgeRight}>→</button>
          <button type="button" className="ghost" onClick={actions.onFit45}>4:5</button>
          <button type="button" className="ghost" onClick={actions.onNudgeDown}>↓</button>
          <button type="button" className="ghost" onClick={actions.onSpanTwoSlides}>跨兩張</button>
        </div>
      </div>
    </div>
  );
}

function NumericSlider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  suffix = "",
}) {
  const numericValue = Number(value ?? min);
  const precision = String(step).includes(".") ? String(step).split(".")[1].length : 0;
  const displayValue = precision ? numericValue.toFixed(precision) : String(Math.round(numericValue));
  const clampValue = (next) => clamp(Number(next), Number(min), Number(max));
  const commit = (next) => onChange(clampValue(next));
  const nudge = (dir) => commit(numericValue + Number(step) * dir);

  return (
    <label className="field field--slider">
      <span className="field__label-row">
        <span>{label}</span>
        <output>
          {displayValue}
          {suffix}
        </output>
      </span>
      <div className="slider-stepper">
        <button type="button" className="slider-stepper__button" onClick={() => nudge(-1)} aria-label={`${label} 減少`}>
          -
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numericValue}
          onChange={(e) => commit(e.target.value)}
        />
        <button type="button" className="slider-stepper__button" onClick={() => nudge(1)} aria-label={`${label} 增加`}>
          +
        </button>
      </div>
    </label>
  );
}

function InspectorContent({
  selectedItem,
  selectedSlot,
  updateElement,
  updateSlot,
  setShowGuides,
  showGuides,
}) {
  const guidesButton = (
    <div className="inspector-section">
      <div className="inspector-section__title">輔助</div>
      <div className="button-row">
        <button className="ghost" onClick={() => setShowGuides((v) => !v)}>
          {showGuides ? "隱藏參考線" : "顯示參考線"}
        </button>
      </div>
    </div>
  );

  if (!selectedItem && !selectedSlot) {
    return (
      <div className="hint-card">
        先選模板、上傳圖片，再點圖框填入。選取畫布物件後，這裡會顯示對應工具。
      </div>
    );
  }

  if (selectedSlot) {
    return (
      <>
        <div className="hint-card" style={{ marginBottom: 12 }}>
          <strong>{selectedSlot.imageSrc ? "已選取裁切框" : "已選取模板圖框"}</strong>
          <div style={{ marginTop: 8, color: "#9ba8bb" }}>
            {selectedSlot.imageName
              ? `已放入：${selectedSlot.imageName}。畫面只會輸出遮罩框內的範圍，可調整框內圖片縮放與位置。`
              : "目前尚未放圖，先點選這個圖框，再到素材區點圖片即可填入。"}
          </div>
        </div>

        <div className="inspector-section">
          <div className="inspector-section__title">外框</div>
          <NumericSlider
            label="圓角"
            min={0}
            max={120}
            value={selectedSlot.radius || 0}
            onChange={(value) => updateSlot({ ...selectedSlot, radius: value })}
          />

          <NumericSlider
            label="框線粗細"
            min={0}
            max={30}
            value={selectedSlot.strokeWidth || 0}
            onChange={(value) => updateSlot({ ...selectedSlot, strokeWidth: value })}
          />

          <label className="field">
            <span>框線顏色</span>
            <input
              type="color"
              value={selectedSlot.stroke || "#ffffff"}
              onChange={(e) => updateSlot({ ...selectedSlot, stroke: e.target.value })}
            />
          </label>
        </div>

        {selectedSlot.imageSrc && (
          <div className="inspector-section">
            <div className="inspector-section__title">框內圖片</div>
            <NumericSlider
              label="框內圖片縮放"
              min={1}
              max={3}
              step={0.01}
              value={selectedSlot.imageZoom || 1}
              onChange={(value) => updateSlot({ ...selectedSlot, imageZoom: value })}
            />

            <NumericSlider
              label="框內圖片左右"
              min={-500}
              max={500}
              value={selectedSlot.imageOffsetX || 0}
              onChange={(value) => updateSlot({ ...selectedSlot, imageOffsetX: value })}
            />

            <NumericSlider
              label="框內圖片上下"
              min={-500}
              max={500}
              value={selectedSlot.imageOffsetY || 0}
              onChange={(value) => updateSlot({ ...selectedSlot, imageOffsetY: value })}
            />

            <div className="button-row">
              <button
                className="ghost"
                onClick={() => {
                  setShowGuides((v) => v);
                  updateSlot({
                    ...selectedSlot,
                    imageSrc: null,
                    imageName: null,
                    imageOffsetX: 0,
                    imageOffsetY: 0,
                    imageZoom: 1,
                    imageRotation: 0,
                  });
                }}
              >
                清空圖框圖片
              </button>
            </div>
          </div>
        )}

        {guidesButton}
      </>
    );
  }

  return (
    <>
      {selectedItem?.type === "image" && (
        <div className="inspector-section">
          <div className="inspector-section__title">圖片外觀</div>
          <NumericSlider
            label="圓角"
            min={0}
            max={120}
            value={selectedItem.radius || 0}
            onChange={(value) => updateElement({ ...selectedItem, radius: value })}
          />
          <NumericSlider
            label="陰影"
            min={0}
            max={40}
            value={selectedItem.shadow || 0}
            onChange={(value) => updateElement({ ...selectedItem, shadow: value })}
          />
          <NumericSlider
            label="透明度"
            min={0.1}
            max={1}
            step={0.01}
            value={selectedItem.opacity ?? 1}
            onChange={(value) => updateElement({ ...selectedItem, opacity: value })}
          />
          <NumericSlider
            label="邊框粗細"
            min={0}
            max={20}
            value={selectedItem.borderWidth || 0}
            onChange={(value) => updateElement({ ...selectedItem, borderWidth: value })}
          />
          <label className="field">
            <span>邊框顏色</span>
            <input
              type="color"
              value={selectedItem.borderColor || "#ffffff"}
              onChange={(e) => updateElement({ ...selectedItem, borderColor: e.target.value })}
            />
          </label>
        </div>
      )}

      {selectedItem?.type === "text" && (
        <div className="inspector-section">
          <div className="inspector-section__title">文字</div>
          <label className="field">
            <span>文字內容</span>
            <textarea
              rows="4"
              value={selectedItem.text}
              onChange={(e) => updateElement({ ...selectedItem, text: e.target.value })}
            />
          </label>
          <NumericSlider
            label="字體大小"
            min={16}
            max={180}
            value={selectedItem.fontSize}
            onChange={(value) => updateElement({ ...selectedItem, fontSize: value })}
          />
          <label className="field">
            <span>字體</span>
            <select
              value={selectedItem.fontFamily || "Inter, system-ui, sans-serif"}
              onChange={(e) => updateElement({ ...selectedItem, fontFamily: e.target.value })}
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.label} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>顏色</span>
            <input
              type="color"
              value={selectedItem.fill || "#111111"}
              onChange={(e) => updateElement({ ...selectedItem, fill: e.target.value })}
            />
          </label>
          <label className="field">
            <span>字重</span>
            <select
              value={selectedItem.fontStyle || "normal"}
              onChange={(e) => updateElement({ ...selectedItem, fontStyle: e.target.value })}
            >
              <option value="normal">normal</option>
              <option value="bold">bold</option>
              <option value="italic">italic</option>
            </select>
          </label>
          <label className="field">
            <span>對齊</span>
            <select
              value={selectedItem.align || "left"}
              onChange={(e) => updateElement({ ...selectedItem, align: e.target.value })}
            >
              <option value="left">left</option>
              <option value="center">center</option>
              <option value="right">right</option>
            </select>
          </label>
        </div>
      )}

      {selectedItem?.type === "sticker" && (
        <div className="inspector-section">
          <div className="inspector-section__title">貼紙</div>
          <label className="field">
            <span>顏色</span>
            <input
              type="color"
              value={selectedItem.fill || "#ffffff"}
              onChange={(e) => updateElement({ ...selectedItem, fill: e.target.value })}
            />
          </label>
          <NumericSlider
            label="透明度"
            min={0.1}
            max={1}
            step={0.01}
            value={selectedItem.opacity ?? 1}
            onChange={(value) => updateElement({ ...selectedItem, opacity: value })}
          />
        </div>
      )}

      {guidesButton}
    </>
  );
}

function DesktopInspectorPanel({
  selectedItem,
  selectedSlot,
  updateElement,
  updateSlot,
  setShowGuides,
  showGuides,
  onBringForward,
  onSendBackward,
  onDuplicate,
  onRemove,
  onClearSelection,
  selectedActions,
}) {
  const hasSelection = !!selectedItem || !!selectedSlot;

  return (
    <div className="panel">
      <h2>選取物件</h2>

      {hasSelection && (
        <>
          <div className="inspector-section">
            <div className="inspector-section__title">快速操作</div>
            <SelectionQuickControls actions={selectedActions} />
          </div>

          <div className="inspector-section">
            <div className="inspector-section__title">圖層與物件</div>
            <div className="desktop-layer-actions">
              <button className="ghost" onClick={onSendBackward}>下移</button>
              <button className="ghost" onClick={onBringForward}>上移</button>
              <button className="ghost" onClick={onDuplicate}>複製</button>
              <button className="ghost danger" onClick={onRemove}>刪除</button>
              <button className="ghost" onClick={onClearSelection}>取消</button>
            </div>
          </div>
        </>
      )}

      <InspectorContent
        selectedItem={selectedItem}
        selectedSlot={selectedSlot}
        updateElement={updateElement}
        updateSlot={updateSlot}
        setShowGuides={setShowGuides}
        showGuides={showGuides}
      />
    </div>
  );
}

function normalizeLayerOrder(order, elements, slots) {
  const elementIds = new Set(elements.map((item) => item.id));
  const slotIds = new Set(slots.map((slot) => slot.id));
  const seen = new Set();
  const normalized = [];

  for (const entry of Array.isArray(order) ? order : []) {
    if (!entry || !entry.id || !entry.kind) continue;
    const key = `${entry.kind}:${entry.id}`;
    if (seen.has(key)) continue;
    if (entry.kind === "element" && !elementIds.has(entry.id)) continue;
    if (entry.kind === "slot" && !slotIds.has(entry.id)) continue;
    seen.add(key);
    normalized.push(entry);
  }

  for (const slot of slots) {
    const key = `slot:${slot.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push({ kind: "slot", id: slot.id });
    }
  }

  for (const item of elements) {
    const key = `element:${item.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push({ kind: "element", id: item.id });
    }
  }

  return normalized;
}




function buildTemplateLayout(id, singleW, canvasH, slides) {
  const canvasW = singleW * slides;
  const nextSlots = [];
  const nextManagedElements = [];
    if (id === "magazine") {
      nextSlots.push(
        createSlot({
          x: singleW * 0.48,
          y: 110,
          width: singleW * 0.42,
          height: canvasH * 0.7,
          radius: 28,
          stroke: "#ffffff",
          strokeWidth: 6,
          label: "Cover Image",
        })
      );

      nextManagedElements.push({
        id: uid("text"),
        type: "text",
        text: "Your Story",
        x: 80,
        y: 80,
        width: 420,
        fontSize: 72,
        fontStyle: "bold",
        fill: "#111827",
        align: "left",
        opacity: 1,
        isTemplateManaged: true,
      });
    }

    if (id === "cover") {
      nextSlots.push(
        createSlot({
          x: canvasW * 0.52,
          y: 90,
          width: canvasW * 0.38,
          height: canvasH * 0.72,
          radius: 30,
          stroke: "#ffffff",
          strokeWidth: 6,
          label: "Hero Image",
        })
      );

      nextManagedElements.push(
        {
          id: uid("text"),
          type: "text",
          text: "A Quiet\nCarousel Story",
          x: 100,
          y: canvasH * 0.16,
          width: canvasW * 0.36,
          fontSize: 88,
          fontStyle: "bold",
          fill: "#111827",
          align: "left",
          opacity: 1,
          isTemplateManaged: true,
        },
        {
          id: uid("text"),
          type: "text",
          text: "Minimal layout · seamless slices",
          x: 108,
          y: canvasH * 0.58,
          width: 580,
          fontSize: 32,
          fontStyle: "normal",
          fill: "#4b5563",
          align: "left",
          opacity: 0.92,
          isTemplateManaged: true,
        }
      );
    }

    if (id === "film") {
      for (let i = 0; i < slides; i++) {
        nextSlots.push(
          createSlot({
            x: i * singleW + 72,
            y: 78,
            width: singleW - 144,
            height: canvasH - 156,
            radius: 24,
            stroke: "#f3f4f6",
            strokeWidth: 18,
            fill: "rgba(255,255,255,0.02)",
            label: `Frame ${i + 1}`,
          })
        );
      }

      nextManagedElements.push({
        id: uid("text"),
        type: "text",
        text: "Film Diary",
        x: 92,
        y: 88,
        width: 340,
        fontSize: 40,
        fontStyle: "bold",
        fill: "#111827",
        align: "left",
        opacity: 1,
        isTemplateManaged: true,
      });
    }

    if (id === "split") {
      nextSlots.push(
        createSlot({
          x: singleW * 0.52,
          y: canvasH * 0.16,
          width: singleW * 0.38,
          height: canvasH * 0.68,
          radius: 24,
          stroke: "#ffffff",
          strokeWidth: 6,
          label: "Right Image",
        })
      );

      nextManagedElements.push(
        {
          id: uid("text"),
          type: "text",
          text: "Moodboard",
          x: 100,
          y: canvasH * 0.2,
          width: 420,
          fontSize: 84,
          fontStyle: "bold",
          fill: "#111827",
          align: "left",
          opacity: 1,
          isTemplateManaged: true,
        },
        {
          id: uid("text"),
          type: "text",
          text: "Left text, right image.\nSimple and clean.",
          x: 100,
          y: canvasH * 0.44,
          width: 440,
          fontSize: 32,
          fontStyle: "normal",
          fill: "#4b5563",
          align: "left",
          opacity: 1,
          isTemplateManaged: true,
        }
      );
    }

    if (id === "frame") {
      nextSlots.push(
        createSlot({
          x: 72,
          y: 72,
          width: canvasW - 144,
          height: canvasH - 144,
          radius: 34,
          stroke: "#ffffff",
          strokeWidth: 20,
          fill: "rgba(255,255,255,0.03)",
          label: "Main Image",
        })
      );

      nextManagedElements.push({
        id: uid("text"),
        type: "text",
        text: "Framed Layout",
        x: 100,
        y: 92,
        width: 420,
        fontSize: 44,
        fontStyle: "bold",
        fill: "#111827",
        align: "left",
        opacity: 1,
        isTemplateManaged: true,
      });
    }

    if (id === "grid4") {
      const outerPad = 72;
      const gap = 20;

      const frameW = canvasW - outerPad * 2;
      const frameH = canvasH - outerPad * 2;

      const cellW = (frameW - gap) / 2;
      const cellH = (frameH - gap) / 2;

      nextSlots.push(
        createSlot({
          x: outerPad,
          y: outerPad,
          width: cellW,
          height: cellH,
          radius: 24,
          stroke: "#ffffff",
          strokeWidth: 6,
          fill: "rgba(255,255,255,0.04)",
          label: "Photo 1",
        }),
        createSlot({
          x: outerPad + cellW + gap,
          y: outerPad,
          width: cellW,
          height: cellH,
          radius: 24,
          stroke: "#ffffff",
          strokeWidth: 6,
          fill: "rgba(255,255,255,0.04)",
          label: "Photo 2",
        }),
        createSlot({
          x: outerPad,
          y: outerPad + cellH + gap,
          width: cellW,
          height: cellH,
          radius: 24,
          stroke: "#ffffff",
          strokeWidth: 6,
          fill: "rgba(255,255,255,0.04)",
          label: "Photo 3",
        }),
        createSlot({
          x: outerPad + cellW + gap,
          y: outerPad + cellH + gap,
          width: cellW,
          height: cellH,
          radius: 24,
          stroke: "#ffffff",
          strokeWidth: 6,
          fill: "rgba(255,255,255,0.04)",
          label: "Photo 4",
        })
      );

      nextManagedElements.push({
        id: uid("text"),
        type: "text",
        text: "Grid Collage",
        x: 96,
        y: 20,
        width: 420,
        fontSize: 40,
        fontStyle: "bold",
        fill: "#111827",
        align: "left",
        opacity: 1,
        isTemplateManaged: true,
      });
    }

    if (id === "duo") {
      nextSlots.push(
        createSlot({
          x: 72,
          y: 120,
          width: singleW * 0.42,
          height: canvasH * 0.66,
          radius: 28,
          stroke: "#ffffff",
          strokeWidth: 8,
          fill: "rgba(255,255,255,0.08)",
          label: "Before",
        }),
        createSlot({
          x: singleW * 0.52,
          y: 120,
          width: singleW * 0.42,
          height: canvasH * 0.66,
          radius: 28,
          stroke: "#ffffff",
          strokeWidth: 8,
          fill: "rgba(255,255,255,0.08)",
          label: "After",
        })
      );

      nextManagedElements.push({
        id: uid("text"),
        type: "text",
        text: "Before / After",
        x: 82,
        y: 52,
        width: 520,
        fontSize: 52,
        fontStyle: "bold",
        fill: "#111827",
        align: "left",
        opacity: 1,
        isTemplateManaged: true,
      });
    }

    if (id === "triptych") {
      const gap = 22;
      const pad = 58;
      const slotW = (canvasW - pad * 2 - gap * 2) / 3;
      nextSlots.push(
        createSlot({
          x: pad,
          y: 150,
          width: slotW,
          height: canvasH * 0.68,
          radius: 26,
          stroke: "#ffffff",
          strokeWidth: 8,
          fill: "rgba(255,255,255,0.08)",
          label: "Story 1",
        }),
        createSlot({
          x: pad + slotW + gap,
          y: 150,
          width: slotW,
          height: canvasH * 0.68,
          radius: 26,
          stroke: "#ffffff",
          strokeWidth: 8,
          fill: "rgba(255,255,255,0.08)",
          label: "Story 2",
        }),
        createSlot({
          x: pad + (slotW + gap) * 2,
          y: 150,
          width: slotW,
          height: canvasH * 0.68,
          radius: 26,
          stroke: "#ffffff",
          strokeWidth: 8,
          fill: "rgba(255,255,255,0.08)",
          label: "Story 3",
        })
      );

      nextManagedElements.push({
        id: uid("text"),
        type: "text",
        text: "Three Moments",
        x: 72,
        y: 62,
        width: 620,
        fontSize: 56,
        fontStyle: "bold",
        fill: "#111827",
        align: "left",
        opacity: 1,
        isTemplateManaged: true,
      });
    }

    if (id === "polaroid") {
      nextSlots.push(
        createSlot({
          x: 88,
          y: 118,
          width: singleW * 0.34,
          height: canvasH * 0.46,
          radius: 12,
          stroke: "#ffffff",
          strokeWidth: 24,
          fill: "rgba(255,255,255,0.16)",
          label: "Photo 1",
        }),
        createSlot({
          x: singleW * 0.48,
          y: 244,
          width: singleW * 0.36,
          height: canvasH * 0.5,
          radius: 12,
          stroke: "#ffffff",
          strokeWidth: 24,
          fill: "rgba(255,255,255,0.16)",
          label: "Photo 2",
        })
      );

      nextManagedElements.push({
        id: uid("text"),
        type: "text",
        text: "Weekend Notes",
        x: 96,
        y: canvasH * 0.73,
        width: 620,
        fontSize: 54,
        fontStyle: "bold",
        fill: "#111827",
        align: "left",
        opacity: 1,
        isTemplateManaged: true,
      });
    }

    if (id === "quote") {
      nextSlots.push(
        createSlot({
          x: canvasW * 0.62,
          y: 128,
          width: canvasW * 0.28,
          height: canvasH * 0.64,
          radius: 34,
          stroke: "#ffffff",
          strokeWidth: 8,
          fill: "rgba(255,255,255,0.08)",
          label: "Portrait",
        })
      );

      nextManagedElements.push(
        {
          id: uid("text"),
          type: "text",
          text: "A small idea,\nclearly framed.",
          x: 96,
          y: canvasH * 0.22,
          width: canvasW * 0.48,
          fontSize: 78,
          fontStyle: "bold",
          fill: "#111827",
          align: "left",
          opacity: 1,
          isTemplateManaged: true,
        },
        {
          id: uid("text"),
          type: "text",
          text: "Use this layout for quotes, announcements, or educational carousel openings.",
          x: 104,
          y: canvasH * 0.62,
          width: canvasW * 0.42,
          fontSize: 30,
          fontStyle: "normal",
          fill: "#4b5563",
          align: "left",
          opacity: 1,
          isTemplateManaged: true,
        }
      );
    }

    if (id === "product") {
      nextSlots.push(
        createSlot({
          x: canvasW * 0.12,
          y: 112,
          width: canvasW * 0.44,
          height: canvasH * 0.72,
          radius: 38,
          stroke: "#ffffff",
          strokeWidth: 10,
          fill: "rgba(255,255,255,0.1)",
          label: "Product",
        })
      );

      nextManagedElements.push(
        {
          id: uid("text"),
          type: "text",
          text: "Product\nStory",
          x: canvasW * 0.62,
          y: canvasH * 0.18,
          width: canvasW * 0.28,
          fontSize: 76,
          fontStyle: "bold",
          fill: "#111827",
          align: "left",
          opacity: 1,
          isTemplateManaged: true,
        },
        {
          id: uid("text"),
          type: "text",
          text: "Feature highlight · detail · result",
          x: canvasW * 0.62,
          y: canvasH * 0.56,
          width: canvasW * 0.3,
          fontSize: 28,
          fontStyle: "normal",
          fill: "#4b5563",
          align: "left",
          opacity: 1,
          isTemplateManaged: true,
        }
      );
    }

    if (id === "checker") {
      const pad = 60;
      const gap = 18;
      const cellW = (canvasW - pad * 2 - gap * 2) / 3;
      const cellH = (canvasH - pad * 2 - gap) / 2;
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          nextSlots.push(
            createSlot({
              x: pad + col * (cellW + gap),
              y: pad + row * (cellH + gap),
              width: cellW,
              height: cellH,
              radius: 22,
              stroke: "#ffffff",
              strokeWidth: 6,
              fill: "rgba(255,255,255,0.08)",
              label: `Photo ${row * 3 + col + 1}`,
            })
          );
        }
      }
    }

    if (id === "swap-square") {
      const halfH = canvasH / 2;
      const squareSize = Math.min(singleW * 0.34, halfH * 0.62);

      for (let i = 0; i < slides; i += 1) {
        const slideX = i * singleW;
        const group = `swap-${i + 1}`;
        const squareX = slideX + (singleW - squareSize) / 2;
        const topSquareY = (halfH - squareSize) / 2;
        const bottomSquareY = halfH + (halfH - squareSize) / 2;

        const topBase = {
          ...createSlot({
            x: slideX,
            y: 0,
            width: singleW,
            height: halfH,
            radius: 0,
            strokeWidth: 0,
            fill: "rgba(255,255,255,0.08)",
            label: `第 ${i + 1} 張 · 上方圖片`,
          }),
          swapGroup: group,
          swapSource: "a",
          swapLayer: "base",
        };
        const bottomBase = {
          ...createSlot({
            x: slideX,
            y: halfH,
            width: singleW,
            height: halfH,
            radius: 0,
            strokeWidth: 0,
            fill: "rgba(255,255,255,0.08)",
            label: `第 ${i + 1} 張 · 下方圖片`,
          }),
          swapGroup: group,
          swapSource: "b",
          swapLayer: "base",
        };
        const topOverlay = {
          ...createSlot({
            x: squareX,
            y: topSquareY,
            width: squareSize,
            height: squareSize,
            radius: 0,
            strokeWidth: 0,
            fill: "rgba(255,255,255,0.12)",
            label: "下方圖片置換區",
          }),
          swapGroup: group,
          swapSource: "b",
          swapLayer: "overlay",
        };
        const bottomOverlay = {
          ...createSlot({
            x: squareX,
            y: bottomSquareY,
            width: squareSize,
            height: squareSize,
            radius: 0,
            strokeWidth: 0,
            fill: "rgba(255,255,255,0.12)",
            label: "上方圖片置換區",
          }),
          swapGroup: group,
          swapSource: "a",
          swapLayer: "overlay",
        };

        nextSlots.push(topBase, bottomBase, topOverlay, bottomOverlay);
      }
    }

  return { slots: nextSlots, elements: nextManagedElements };
}

export default function App() {
  const [slides, setSlides] = useState(3);
  const [ratioKey, setRatioKey] = useState("4:5");
  const [backgroundMode, setBackgroundMode] = useState("solid");
  const [bgPrimary, setBgPrimary] = useState(DEFAULT_CANVAS_COLOR);
  const [bgSecondary, setBgSecondary] = useState(DEFAULT_CANVAS_COLOR_2);
  const [images, setImages] = useState([]);
  const [elements, setElements] = useState([]);
  const [templateSlots, setTemplateSlots] = useState([]);
  const [layerOrder, setLayerOrder] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [previews, setPreviews] = useState([]);
  const [containerSize, setContainerSize] = useState({ w: 1200, h: 700 });
  const [templateId, setTemplateId] = useState("blank");
  const [showGuides, setShowGuides] = useState(true);
  const [modifiers, setModifiers] = useState({ shift: false, alt: false, ctrlOrMeta: false });

  const [userZoom, setUserZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const isInteractingRef = useRef(false);
  const [previewExpandSignal, setPreviewExpandSignal] = useState(0);
  const [saveFallback, setSaveFallback] = useState(null);
  const [exportScale, setExportScale] = useState(1);
  const [exportStatus, setExportStatus] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [exportError, setExportError] = useState("");
  const [previewsStale, setPreviewsStale] = useState(false);
  useEffect(() => {
    setPreviewsStale(true);
  }, [slides, ratioKey, backgroundMode, bgPrimary, bgSecondary, elements, templateSlots, layerOrder, exportScale]);
  const [liveGuides, setLiveGuides] = useState({ vertical: [], horizontal: [] });
  const selectableNodesRef = useRef(new Map());
  const [selectableNodeRevision, setSelectableNodeRevision] = useState(0);
  const liveGuidesRef = useRef(liveGuides);
  const liveGuidesRafRef = useRef(null);

  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);
  const historyLockRef = useRef(false);
  const hasHydratedDraftRef = useRef(false);
  const autosaveTimerRef = useRef(null);

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );
  const [mobileTab, setMobileTab] = useState("project");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const containerRef = useRef(null);
  const panLayerRef = useRef(null);
  const mobileScrollbarThumbRef = useRef(null);
  const stageRef = useRef(null);
  const fileRef = useRef(null);
  const importRef = useRef(null);
  const panRef = useRef(pan);

  const gestureRef = useRef({
    isPanning: false,
    pinchMode: "viewport",
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    pinchStartDistance: 0,
    pinchStartAngle: 0,
    pinchStartZoom: 1,
    pinchStartPan: { x: 0, y: 0 },
    pinchCenter: { x: 0, y: 0 },
    pinchStartObject: null,
    pinchLastRatio: 1,
    pinchLastAngleDelta: 0,
    pinchTargetType: null,
    pinchTargetId: null,
    pinchLocked: false,
  });

  const singleW = RATIOS[ratioKey].w;
  const singleH = RATIOS[ratioKey].h;
  const canvasW = singleW * slides;
  const canvasH = singleH;
  useEffect(() => {
    setTemplateSlots(previous => {
      const aligned = previous.map(slot => alignSwapBase(slot, singleW, canvasH));
      return aligned.some((slot, index) => slot !== previous[index]) ? aligned : previous;
    });
  }, [templateSlots, singleW, canvasH]);
  const exportW = Math.round(singleW * exportScale);
  const exportH = Math.round(singleH * exportScale);
  const hasStartedProject = images.length > 0 || elements.length > 0 || templateSlots.length > 0;

  const selectedItem = elements.find((el) => el.id === selectedId) || null;
  const selectedSlot = templateSlots.find((slot) => slot.id === selectedSlotId) || null;
  const mobileWorkspaceReserve = isMobile ? 148 : 0;
  const registerSelectableNode = useCallback((kind, id, node) => {
    const key = `${kind}:${id}`;
    if (node) {
      if (selectableNodesRef.current.get(key) === node) return;
      selectableNodesRef.current.set(key, node);
    } else {
      if (!selectableNodesRef.current.has(key)) return;
      selectableNodesRef.current.delete(key);
    }
    setSelectableNodeRevision((value) => value + 1);
  }, []);
  const setObjectInteracting = useCallback((value) => {
    isInteractingRef.current = value;
  }, []);
  const setViewportInteracting = useCallback((value) => {
    isInteractingRef.current = value;
    setIsInteracting(value);
  }, []);
  const selectedNode = useMemo(() => {
    if (selectedSlot?.swapLayer === "base") return null;
    if (selectedSlot) return selectableNodesRef.current.get(`slot:${selectedSlot.id}`) || null;
    if (selectedItem) return selectableNodesRef.current.get(`element:${selectedItem.id}`) || null;
    return null;
  }, [selectedItem, selectedSlot, selectableNodeRevision]);
  const selectedNodeType = selectedSlot ? "slot" : selectedItem?.type || null;
  const visibleLayerOrder = useMemo(
    () => normalizeLayerOrder(layerOrder, elements, templateSlots),
    [layerOrder, elements, templateSlots]
  );

  const compactSnapshotRefs = (snap) => {
    const srcToAsset = new Map(images.map((img) => [img.src, img.id]));
    const nextElements = (snap.elements || []).map((item) => {
      const assetId = item.src ? srcToAsset.get(item.src) : null;
      if (!assetId) return item;
      const { src, ...rest } = item;
      return { ...rest, sourceAssetId: assetId };
    });
    const nextSlots = (snap.templateSlots || []).map((slot) => {
      const assetId = slot.imageSrc ? srcToAsset.get(slot.imageSrc) : null;
      if (!assetId) return slot;
      const { imageSrc, ...rest } = slot;
      return { ...rest, imageAssetId: assetId };
    });

    return {
      ...snap,
      elements: nextElements,
      templateSlots: nextSlots,
    };
  };

  const hydrateSnapshotRefs = (snap) => {
    const availableImages = Array.isArray(snap.images) ? snap.images : images;
    const assetToSrc = new Map(availableImages.map((img) => [img.id, img.src]));
    return {
      ...snap,
      images: availableImages,
      elements: (snap.elements || []).map((item) =>
        !item.src && item.sourceAssetId && assetToSrc.has(item.sourceAssetId)
          ? { ...item, src: assetToSrc.get(item.sourceAssetId) }
          : item
      ),
      templateSlots: (snap.templateSlots || []).map((slot) =>
        !slot.imageSrc && slot.imageAssetId && assetToSrc.has(slot.imageAssetId)
          ? { ...slot, imageSrc: assetToSrc.get(slot.imageAssetId) }
          : slot
      ),
    };
  };

  const captureSnapshot = ({ includeImages = true } = {}) => ({
    slides,
    ratioKey,
    backgroundMode,
    bgPrimary,
    bgSecondary,
    ...(includeImages ? { images } : {}),
    elements,
    templateSlots,
    layerOrder,
    templateId,
  });

  const applySnapshot = (snap) => {
    const hydrated = hydrateSnapshotRefs(snap);
    setSlides(hydrated.slides);
    setRatioKey(hydrated.ratioKey);
    setBackgroundMode(hydrated.backgroundMode);
    setBgPrimary(hydrated.bgPrimary);
    setBgSecondary(hydrated.bgSecondary);
    if (Array.isArray(snap.images)) setImages(hydrated.images);
    setElements(hydrated.elements || []);
    setTemplateSlots(hydrated.templateSlots || []);
    setLayerOrder(normalizeLayerOrder(hydrated.layerOrder, hydrated.elements || [], hydrated.templateSlots || []));
    setTemplateId(hydrated.templateId);
    setSelectedId(null);
    setSelectedSlotId(null);
  };

  const pushHistory = () => {
    if (historyLockRef.current) return;
    const snap = compactSnapshotRefs(captureSnapshot({ includeImages: false }));
    setHistoryPast((prev) => [...prev.slice(-49), snap]);
    setHistoryFuture([]);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setTimeout(() => {
          hasHydratedDraftRef.current = true;
        }, 0);
        return;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        setTimeout(() => {
          hasHydratedDraftRef.current = true;
        }, 0);
        return;
      }

      const snap = parsed.snapshot || parsed;

      if (
        snap &&
        typeof snap === "object" &&
        snap.slides &&
        snap.ratioKey &&
        snap.backgroundMode
      ) {
        historyLockRef.current = true;
        applySnapshot(snap);
        setHistoryPast([]);
        setHistoryFuture([]);
        setTimeout(() => {
          historyLockRef.current = false;
          hasHydratedDraftRef.current = true;
        }, 0);
        return;
      }
    } catch (err) {
      console.error("Failed to restore draft:", err);
    }

    setTimeout(() => {
      hasHydratedDraftRef.current = true;
    }, 0);
  }, []);

  useEffect(() => {
    if (!hasHydratedDraftRef.current) return;
    if (isInteractingRef.current) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    setDraftStatus("尚有變更待儲存");
    autosaveTimerRef.current = setTimeout(() => {
      try {
        const payload = {
          savedAt: Date.now(),
          snapshot: compactSnapshotRefs(captureSnapshot()),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        setDraftStatus("已儲存於此瀏覽器");
      } catch (err) {
        console.error("Failed to save draft:", err);
        setDraftStatus("草稿儲存失敗，請匯出專案備份");
      }
    }, isMobile ? 3200 : 900);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [
    slides,
    ratioKey,
    backgroundMode,
    bgPrimary,
    bgSecondary,
    images,
    elements,
    templateSlots,
    layerOrder,
    templateId,
    isInteracting,
    isMobile,
  ]);

  const clearSavedDraft = () => {
    const ok = window.confirm("要清除本瀏覽器的所有照片素材、畫布、草稿與復原紀錄嗎？此操作無法復原。");
    if (!ok) return;

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error("Failed to clear draft:", err);
    }

    historyLockRef.current = true;

    setSlides(3);
    setRatioKey("4:5");
    setBackgroundMode("solid");
    setBgPrimary(DEFAULT_CANVAS_COLOR);
    setBgSecondary(DEFAULT_CANVAS_COLOR_2);
    setImages([]);
    setElements([]);
    setTemplateSlots([]);
    setLayerOrder([]);
    setTemplateId("blank");
    setSelectedId(null);
    setSelectedSlotId(null);
    setHistoryPast([]);
    setHistoryFuture([]);
    setUserZoom(1);
    setPan({ x: 0, y: 0 });
    setPreviews([]);

    setTimeout(() => {
      historyLockRef.current = false;
    }, 0);
  };

  const undo = () => {
    setHistoryPast((prev) => {
      if (!prev.length) return prev;

      const current = compactSnapshotRefs(captureSnapshot({ includeImages: false }));
      const previous = prev[prev.length - 1];

      historyLockRef.current = true;
      applySnapshot(previous);

      setTimeout(() => {
        historyLockRef.current = false;
      }, 0);

      setHistoryFuture((f) => [current, ...f].slice(0, 50));
      return prev.slice(0, -1);
    });
  };

  const redo = () => {
    setHistoryFuture((prev) => {
      if (!prev.length) return prev;

      const current = compactSnapshotRefs(captureSnapshot({ includeImages: false }));
      const next = prev[0];

      historyLockRef.current = true;
      applySnapshot(next);

      setTimeout(() => {
        historyLockRef.current = false;
      }, 0);

      setHistoryPast((p) => [...p.slice(-49), current]);
      return prev.slice(1);
    });
  };

  const rotationDisplay = selectedSlot
    ? Math.round(normalizeRotation(selectedSlot.rotation || 0))
    : selectedItem
    ? Math.round(normalizeRotation(selectedItem.rotation || 0))
    : 0;

  useEffect(() => {
    const element = containerRef.current;
    const measure = () => {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      setContainerSize(previous => previous.w === rect.width && previous.h === rect.height ? previous : { w: rect.width, h: rect.height });
    };
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    const observer = new ResizeObserver(measure);
    if (element) observer.observe(element);
    measure();
    onResize();
    window.addEventListener("resize", onResize);
    return () => { observer.disconnect(); window.removeEventListener("resize", onResize); };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const preventSafariGesture = (e) => {
      e.preventDefault();
    };

    el.addEventListener("gesturestart", preventSafariGesture);
    el.addEventListener("gesturechange", preventSafariGesture);
    el.addEventListener("gestureend", preventSafariGesture);

    return () => {
      el.removeEventListener("gesturestart", preventSafariGesture);
      el.removeEventListener("gesturechange", preventSafariGesture);
      el.removeEventListener("gestureend", preventSafariGesture);
    };
  }, []);

  useEffect(() => {
    const syncModifiers = (e) => {
      setModifiers({
        shift: !!e.shiftKey,
        alt: !!e.altKey,
        ctrlOrMeta: !!(e.ctrlKey || e.metaKey),
      });
    };

    const resetModifiers = () => {
      setModifiers({ shift: false, alt: false, ctrlOrMeta: false });
    };

    window.addEventListener("keydown", syncModifiers);
    window.addEventListener("keyup", syncModifiers);
    window.addEventListener("blur", resetModifiers);

    return () => {
      window.removeEventListener("keydown", syncModifiers);
      window.removeEventListener("keyup", syncModifiers);
      window.removeEventListener("blur", resetModifiers);
    };
  }, []);

  const fitScale = useMemo(() => {
    const pad = isMobile ? 16 : 32;
    const fitWidth = isMobile ? singleW * Math.min(slides, 2) : canvasW;
    const usableW = Math.max(260, containerSize.w - pad);
    const usableH = Math.max(220, containerSize.h - mobileWorkspaceReserve - pad);
    return Math.min(usableW / fitWidth, usableH / canvasH, 1);
  }, [containerSize, canvasW, canvasH, isMobile, mobileWorkspaceReserve, singleW, slides]);

  const displayScale = fitScale * userZoom;
  const mobileVisibleSlideCount = Math.min(slides, 2);
  const mobileScrollProgress = useMemo(() => {
    if (!isMobile || slides <= mobileVisibleSlideCount) return 0;
    const scaledW = canvasW * displayScale;
    const viewportW = containerSize.w;
    const pad = 10;
    const minX = viewportW - scaledW - pad;
    const maxX = pad;
    const range = maxX - minX;
    if (range <= 0) return 0;
    return clamp((maxX - pan.x) / range, 0, 1);
  }, [canvasW, containerSize.w, displayScale, isMobile, mobileVisibleSlideCount, pan.x, slides]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const updateMobileScrollbarPreview = useCallback((nextPan) => {
    if (!mobileScrollbarThumbRef.current || !isMobile || slides <= mobileVisibleSlideCount) return;
    const scaledW = canvasW * displayScale;
    const viewportW = containerSize.w;
    const pad = 10;
    const minX = viewportW - scaledW - pad;
    const maxX = pad;
    const range = maxX - minX;
    const progress = range <= 0 ? 0 : clamp((maxX - nextPan.x) / range, 0, 1);
    const thumbWidth = Math.max(28, (mobileVisibleSlideCount / slides) * 100);
    mobileScrollbarThumbRef.current.style.left = `${(100 - thumbWidth) * progress}%`;
  }, [canvasW, containerSize.w, displayScale, isMobile, mobileVisibleSlideCount, slides]);

  const applyPanPreview = useCallback((nextPan) => {
    panRef.current = nextPan;
    if (panLayerRef.current) {
      panLayerRef.current.style.transform = `translate(${nextPan.x}px, ${nextPan.y}px)`;
    }
    updateMobileScrollbarPreview(nextPan);
  }, [updateMobileScrollbarPreview]);

  const commitPanPreview = useCallback(() => {
    setPan(panRef.current);
  }, []);

  const clampPan = (nextX, nextY, zoom = userZoom) => {
    const scaledW = canvasW * fitScale * zoom;
    const scaledH = canvasH * fitScale * zoom;
    const viewportW = containerSize.w;
    const viewportH = isMobile ? Math.max(220, containerSize.h - mobileWorkspaceReserve) : containerSize.h;
    const pad = isMobile ? 10 : 24;

    const horizontalSlack = Math.max(0, viewportW - scaledW - pad * 2);
    const verticalSlack = Math.max(0, viewportH - scaledH - pad * 2);

    const minX = scaledW + pad * 2 <= viewportW ? pad + horizontalSlack / 2 : viewportW - scaledW - pad;
    const maxX = scaledW + pad * 2 <= viewportW ? pad + horizontalSlack / 2 : pad;

    const centeredY = pad + verticalSlack / 2;
    const mobileFreeUp = isMobile ? Math.max(84, mobileWorkspaceReserve * 0.42) : 0;
    const mobileFreeDown = isMobile ? 42 : 0;
    const minY = scaledH + pad * 2 <= viewportH
      ? centeredY - mobileFreeUp
      : viewportH - scaledH - pad;
    const maxY = scaledH + pad * 2 <= viewportH
      ? centeredY + mobileFreeDown
      : pad;

    return {
      x: clamp(nextX, Math.min(minX, maxX), Math.max(minX, maxX)),
      y: clamp(nextY, Math.min(minY, maxY), Math.max(minY, maxY)),
    };
  };

  useEffect(() => {
    setPan((prev) => clampPan(prev.x, prev.y, userZoom));
  }, [fitScale, containerSize.w, containerSize.h, isMobile, mobileWorkspaceReserve, userZoom]);

  const resetView = () => {
    setUserZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const visibleSlideIndex = clamp(Math.floor((containerSize.w / 2 - pan.x) / (singleW * displayScale)), 0, slides - 1);
  const showSlides = (index = null) => {
    const width = index === null ? canvasW : singleW;
    const availableHeight = Math.max(100, containerSize.h - mobileWorkspaceReserve - 64);
    const scale = Math.min((containerSize.w - 24) / width, availableHeight / canvasH);
    const zoom = clamp(scale / fitScale, MIN_ZOOM, MAX_ZOOM);
    const actualScale = fitScale * zoom;
    const center = index === null ? canvasW / 2 : (index + 0.5) * singleW;
    setUserZoom(zoom);
    setPan(clampPan(containerSize.w / 2 - center * actualScale, 48 + (availableHeight - canvasH * actualScale) / 2, zoom));
  };

  const clearSelection = () => {
    setSelectedId(null);
    setSelectedSlotId(null);  };

  const duplicateSelected = () => {
    if (!selectedItem && !selectedSlot) return;
    pushHistory();

    if (selectedSlot) {
      const detachedSlot = detachSwapSlot(selectedSlot, templateSlots);
      const clone = {
        ...detachedSlot,
        id: uid("slot"),
        x: selectedSlot.x + 32,
        y: selectedSlot.y + 32,
        label: `${selectedSlot.label || "圖框"} 複本`,
      };
      setTemplateSlots((prev) => [...prev, clone]);
      setLayerOrder((prev) => {
        const order = normalizeLayerOrder(prev, elements, templateSlots);
        const idx = order.findIndex((entry) => entry.kind === "slot" && entry.id === selectedSlot.id);
        const nextEntry = { kind: "slot", id: clone.id };
        if (idx < 0) return [...order, nextEntry];
        return [...order.slice(0, idx + 1), nextEntry, ...order.slice(idx + 1)];
      });
      setSelectedId(null);
      setSelectedSlotId(clone.id);
      return;
    }

    const clone = {
      ...selectedItem,
      id: uid(selectedItem.type),
      x: selectedItem.x + 32,
      y: selectedItem.y + 32,
      isTemplateManaged: false,
    };
    setElements((prev) => [...prev, clone]);
    setLayerOrder((prev) => {
      const order = normalizeLayerOrder(prev, elements, templateSlots);
      const idx = order.findIndex((entry) => entry.kind === "element" && entry.id === selectedItem.id);
      const nextEntry = { kind: "element", id: clone.id };
      if (idx < 0) return [...order, nextEntry];
      return [...order.slice(0, idx + 1), nextEntry, ...order.slice(idx + 1)];
    });
    setSelectedId(clone.id);
    setSelectedSlotId(null);
  };

  const setZoomAroundCenter = (nextZoom) => {
    const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const viewportCenterX = containerSize.w / 2;
    const viewportCenterY = containerSize.h / 2;

    const oldScale = fitScale * userZoom;
    const newScale = fitScale * zoom;

    const contentX = (viewportCenterX - pan.x) / oldScale;
    const contentY = (viewportCenterY - pan.y) / oldScale;

    let nextPanX = viewportCenterX - contentX * newScale;
    let nextPanY = viewportCenterY - contentY * newScale;

    const clamped = clampPan(nextPanX, nextPanY, zoom);
    setUserZoom(zoom);
    setPan(clamped);
  };

  const zoomIn = () => setZoomAroundCenter(userZoom * 1.2);
  const zoomOut = () => setZoomAroundCenter(userZoom / 1.2);
  const zoom100 = () => {
    const zoom = clamp(1 / fitScale, MIN_ZOOM, MAX_ZOOM);
    setZoomAroundCenter(zoom);
  };
  const fitToScreen = () => resetView();

  const snapGuides = useMemo(() => {
    const vertical = [0, canvasW / 2, canvasW];
    const horizontal = [0, canvasH / 2, canvasH];

    for (let i = 0; i <= slides; i++) vertical.push(i * singleW);
    for (let i = 0; i < slides; i++) vertical.push(i * singleW + singleW / 2);

    return { vertical, horizontal };
  }, [canvasW, canvasH, slides, singleW]);

  const activeGuides = useMemo(() => {
    if (liveGuides.vertical.length || liveGuides.horizontal.length) return liveGuides;
    const target = selectedSlot || selectedItem;
    if (!target) return { vertical: [], horizontal: [] };
    return {
      vertical: target.snapV != null ? [target.snapV] : [],
      horizontal: target.snapH != null ? [target.snapH] : [],
    };
  }, [liveGuides, selectedItem, selectedSlot]);

  const updateElement = (next) => {
    setElements((prev) => prev.map((el) => (el.id === next.id ? next : el)));
  };

  const updateSlot = (next) => {
    next = alignSwapBase(next, singleW, canvasH);
    setTemplateSlots((prev) => {
      const current = prev.find((slot) => slot.id === next.id);
      const swapImageChanged =
        current?.swapGroup &&
        current?.swapSource &&
        ["imageSrc", "imageName", "imageZoom", "imageOffsetX", "imageOffsetY", "imageRotation"].some(key => current[key] !== next[key]);

      return prev.map((slot) => {
        if (slot.id === next.id) return next;
        if (
          swapImageChanged &&
          slot.swapGroup === current.swapGroup &&
          slot.swapSource === current.swapSource
        ) {
          return {
            ...slot,
            imageSrc: next.imageSrc,
            imageName: next.imageName,
            imageZoom: next.imageZoom,
            imageOffsetX: next.imageOffsetX,
            imageOffsetY: next.imageOffsetY,
            imageRotation: next.imageRotation,
            ...(next.imageSrc
              ? null
              : {
                  imageOffsetX: 0,
                  imageOffsetY: 0,
                  imageZoom: 1,
                  imageRotation: 0,
                }),
          };
        }
        return slot;
      });
    });
  };

  const updateLiveGuides = useCallback(
    (next) => {
      const current = liveGuidesRef.current;
      const sameVertical =
        current.vertical.length === next.vertical.length &&
        current.vertical.every((value, index) => value === next.vertical[index]);
      const sameHorizontal =
        current.horizontal.length === next.horizontal.length &&
        current.horizontal.every((value, index) => value === next.horizontal[index]);
      if (sameVertical && sameHorizontal) return;

      const apply = () => {
        liveGuidesRef.current = next;
        setLiveGuides(next);
      };

      if (!isMobile) {
        apply();
        return;
      }

      if (liveGuidesRafRef.current) cancelAnimationFrame(liveGuidesRafRef.current);
      liveGuidesRafRef.current = requestAnimationFrame(() => {
        liveGuidesRafRef.current = null;
        apply();
      });
    },
    [isMobile]
  );

  useEffect(() => {
    updateLiveGuides({ vertical: [], horizontal: [] });
  }, [selectedId, selectedSlotId, updateLiveGuides]);

  useEffect(
    () => () => {
      if (liveGuidesRafRef.current) cancelAnimationFrame(liveGuidesRafRef.current);
    },
    []
  );

  const nudgeSelectedSlot = (dxDir, dyDir) => {
    if (!selectedSlot) return;
    pushHistory();
    updateSlot({
      ...selectedSlot,
      imageOffsetX: (selectedSlot.imageOffsetX || 0) + dxDir * SLOT_NUDGE,
      imageOffsetY: (selectedSlot.imageOffsetY || 0) + dyDir * SLOT_NUDGE,
    });
  };

  const zoomSelectedSlot = (dir) => {
    if (!selectedSlot) return;
    pushHistory();
    updateSlot({
      ...selectedSlot,
      imageZoom: clamp((selectedSlot.imageZoom || 1) + dir * SLOT_ZOOM_STEP, 1, 3),
    });
  };

  const updateSelectedBox = (updater) => {
    const target = selectedSlot || selectedItem;
    if (!target) return;
    pushHistory();
    const next = updater(target);
    if (selectedSlot) updateSlot(next);
    if (selectedItem) updateElement(next);
  };

  const nudgeSelectedBox = (dx, dy) => {
    if (selectedSlot?.swapLayer === "base") {
      pushHistory();
      updateSlot({...selectedSlot, imageOffsetX: (selectedSlot.imageOffsetX || 0) + dx, imageOffsetY: (selectedSlot.imageOffsetY || 0) + dy});
      return;
    }
    const target = selectedSlot || selectedItem;
    const moved = rotateDelta(dx, dy, target?.rotation || 0);
    updateSelectedBox((target) => ({
      ...target,
      x: (target.x || 0) + moved.dx,
      y: (target.y || 0) + moved.dy,
    }));
  };

  const scaleSelectedBox = (factor) => {
    if (selectedSlot?.swapLayer === "base") {
      pushHistory();
      updateSlot({...selectedSlot, imageZoom: clamp((selectedSlot.imageZoom || 1) * factor, 1, 3)});
      return;
    }
    updateSelectedBox((target) => {
      if (target.type === "text") {
        return {
          ...target,
          fontSize: Math.max(12, (target.fontSize || 40) * factor),
          width: Math.max(120, (target.width || 400) * factor),
        };
      }

      return {
        ...target,
        width: Math.max(selectedSlot ? 80 : 40, (target.width || 120) * factor),
        height: Math.max(selectedSlot ? 80 : 40, (target.height || 120) * factor),
      };
    });
  };

  const setSelectedBoxAspect = (widthRatio, heightRatio) => {
    updateSelectedBox((target) => {
      const width = Math.max(selectedSlot ? 80 : 40, target.width || 240);
      return {
        ...target,
        width,
        height: Math.max(selectedSlot ? 80 : 40, width * (heightRatio / widthRatio)),
      };
    });
  };

  const setSelectedCrop45 = () => {
    const getCurrentSlideFrame = (target, fallbackWidth, fallbackHeight) => {
      const rotation = target.rotation || 0;
      const center = getRotatedGeometry(
        target.x || 0,
        target.y || 0,
        target.width || fallbackWidth,
        target.height || fallbackHeight,
        rotation
      );
      const slideIndex = clamp(Math.floor(center.centerX / singleW), 0, slides - 1);
      return {
        x: slideIndex * singleW,
        y: 0,
        width: singleW,
        height: singleH,
      };
    };

    if (selectedSlot) {
      updateSelectedBox((target) => {
        const frame = getCurrentSlideFrame(target, singleW, singleH);

        return {
          ...target,
          ...frame,
          rotation: 0,
          radius: 0,
          strokeWidth: 0,
          fill: "rgba(255,255,255,0)",
          label: "IG 4:5 裁切框",
          imageOffsetX: 0,
          imageOffsetY: 0,
          imageZoom: 1,
          imageRotation: 0,
        };
      });
      return;
    }

    if (selectedItem?.type !== "image") {
      setSelectedBoxAspect(4, 5);
      return;
    }

    pushHistory();
    const frame = getCurrentSlideFrame(selectedItem, selectedItem.width || singleW, selectedItem.height || singleH);
    const slot = createSlot({
      ...frame,
      radius: 0,
      stroke: "#7db2ff",
      strokeWidth: 0,
      fill: "rgba(255,255,255,0)",
      label: "IG 4:5 裁切框",
    });
    const nextSlot = {
      ...slot,
      rotation: 0,
      imageSrc: selectedItem.src,
      imageName: selectedItem.name || "圖片",
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageZoom: 1,
      imageRotation: 0,
    };

    setTemplateSlots((prev) => [...prev, nextSlot]);
    setElements((prev) => prev.filter((item) => item.id !== selectedItem.id));
    setLayerOrder((prev) => {
      let replaced = false;
      const mapped = normalizeLayerOrder(prev, elements, templateSlots).map((entry) => {
        if (entry.kind === "element" && entry.id === selectedItem.id) {
          replaced = true;
          return { kind: "slot", id: nextSlot.id };
        }
        return entry;
      });
      return replaced ? mapped : [...mapped, { kind: "slot", id: nextSlot.id }];
    });
    setSelectedId(null);
    setSelectedSlotId(nextSlot.id);
  };

  const spanSelectedBoxAcrossTwoSlides = () => {
    if (selectedSlot) {
      updateSelectedBox((target) => {
        const center = getRotatedGeometry(
          target.x || 0,
          target.y || 0,
          target.width || singleW,
          target.height || singleH,
          target.rotation || 0
        );
        const spanCount = slides > 1 ? 2 : 1;
        const startIndex = clamp(Math.floor(center.centerX / singleW), 0, Math.max(0, slides - spanCount));

        return {
          ...target,
          x: startIndex * singleW,
          y: 0,
          width: singleW * spanCount,
          height: singleH,
          rotation: 0,
          radius: 0,
          strokeWidth: 0,
          fill: "rgba(255,255,255,0)",
          label: spanCount === 2 ? "跨兩張輪播裁切框" : "IG 4:5 裁切框",
          imageOffsetX: 0,
          imageOffsetY: 0,
          imageZoom: 1,
        };
      });
      return;
    }

    updateSelectedBox((target) => {
      const nextWidth = singleW * 2;
      const currentWidth = Math.max(selectedSlot ? 80 : 40, target.width || nextWidth);
      const currentHeight = Math.max(
        selectedSlot ? 80 : 40,
        target.height || target.fontSize * 1.6 || currentWidth
      );
      const nextHeight = nextWidth * (currentHeight / currentWidth);
      const rotation = target.rotation || 0;
      const center = getRotatedGeometry(
        target.x || 0,
        target.y || 0,
        currentWidth,
        currentHeight,
        rotation
      );
      const rad = (rotation * Math.PI) / 180;

      return {
        ...target,
        x: center.centerX - (nextWidth / 2) * Math.cos(rad) + (nextHeight / 2) * Math.sin(rad),
        y: center.centerY - (nextWidth / 2) * Math.sin(rad) - (nextHeight / 2) * Math.cos(rad),
        width: nextWidth,
        height: nextHeight,
      };
    });
  };

  const rotateSelectedBox90 = () => {
    if (selectedSlot?.imageSrc) {
      updateSelectedBox((target) => ({
        ...target,
        imageRotation: normalizeRotation((target.imageRotation || 0) + 90),
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageZoom: 1,
      }));
      return;
    }

    updateSelectedBox((target) => {
      const width = target.width || 240;
      const height = target.height || target.fontSize * 1.6 || 240;
      const currentRotation = target.rotation || 0;
      const nextRotation = normalizeRotation(currentRotation + 90);
      const center = getRotatedGeometry(target.x || 0, target.y || 0, width, height, currentRotation);
      const rad = (nextRotation * Math.PI) / 180;

      return {
        ...target,
        x: center.centerX - (width / 2) * Math.cos(rad) + (height / 2) * Math.sin(rad),
        y: center.centerY - (width / 2) * Math.sin(rad) - (height / 2) * Math.cos(rad),
        rotation: nextRotation,
      };
    });
  };

  const clearSelectedSlotImage = () => {
    if (!selectedSlot) return;
    updateSlot({
      ...selectedSlot,
      imageSrc: null,
      imageName: null,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageZoom: 1,
      imageRotation: 0,
    });
  };

  const applySelectionPinch = (ratio, angleDelta, midpoint) => {
    const gesture = gestureRef.current;
    const start = gesture.pinchStartObject;
    if (!start) return;
    const movement = {x: (midpoint.x - gesture.pinchCenter.x) / gesture.pinchScale,
      y: (midpoint.y - gesture.pinchCenter.y) / gesture.pinchScale};
    if (gesture.pinchTargetType === "slot" && start.imageSrc) {
      const zoom = clamp((start.imageZoom || 1) * ratio, 1, 3);
      const local = toLocalVector({x: gesture.pinchPoint.x - start.x, y: gesture.pinchPoint.y - start.y}, start.rotation || 0);
      const pivot = {x: local.x - start.width / 2, y: local.y - start.height / 2};
      const offset = pinchPosition({x: start.imageOffsetX || 0, y: start.imageOffsetY || 0}, pivot,
        toLocalVector(movement, start.rotation || 0), zoom / (start.imageZoom || 1), angleDelta);
      const next = {...start, imageZoom: zoom, imageRotation: normalizeRotation((start.imageRotation || 0) + angleDelta),
        imageOffsetX: offset.x, imageOffsetY: offset.y};
      gesture.pinchLastObject = next;
      updateSlot(next);
    } else {
      const minimum = gesture.pinchTargetType === "slot" ? 80 : 40;
      const scale = Math.max(ratio, minimum / start.width, minimum / start.height);
      const position = pinchPosition(start, gesture.pinchPoint, movement, scale, angleDelta);
      const next = {...start, ...position, width: start.width * scale, height: start.height * scale,
        rotation: normalizeRotation((start.rotation || 0) + angleDelta)};
      gesture.pinchLastObject = next;
      if (gesture.pinchTargetType === "slot") updateSlot(next);
      else updateElement(next);
    }
  };

  const canPinchSelectedObject =
    !!selectedSlot || !!(selectedItem && (selectedItem.type === "image" || selectedItem.type === "sticker"));


  const addImageToCanvas = (img) => {
    pushHistory();

    if (selectedSlotId) {
      const targetSlot = templateSlots.find((slot) => slot.id === selectedSlotId);
      const isSwapSlot = targetSlot?.swapGroup && targetSlot?.swapSource;
      const nextSwapTarget = isSwapSlot
        ? templateSlots.find(
            (slot) =>
              slot.swapGroup === targetSlot.swapGroup &&
              slot.swapSource !== targetSlot.swapSource &&
              slot.swapLayer === "base" &&
              !slot.imageSrc
          ) ||
          templateSlots.find(
            (slot) =>
              slot.swapLayer === "base" &&
              !slot.imageSrc &&
              slot.swapGroup !== targetSlot.swapGroup
          )
        : null;

      setTemplateSlots((prev) =>
        prev.map((slot) =>
          slot.id === selectedSlotId ||
          (isSwapSlot &&
            slot.swapGroup === targetSlot.swapGroup &&
            slot.swapSource === targetSlot.swapSource)
            ? {
                ...slot,
                imageSrc: img.src,
                imageName: img.name,
                imageOffsetX: 0,
                imageOffsetY: 0,
                imageZoom: 1,
                imageRotation: 0,
              }
            : slot
        )
      );
      if (nextSwapTarget) setSelectedSlotId(nextSwapTarget.id);
      if (isMobile) setMobileDrawerOpen(false);
      return;
    }

    const ratio = img.width / img.height || 1;
    const targetW = Math.min(singleW * 0.8, canvasH * 0.72 * ratio);
    const targetH = targetW / ratio;
    const currentSlide = clamp(Math.floor((containerSize.w / 2 - pan.x) / (singleW * displayScale)), 0, slides - 1);

    const item = {
      id: uid("img"),
      type: "image",
      src: img.src,
      x: currentSlide * singleW + (singleW - targetW) / 2,
      y: Math.max(20, canvasH / 2 - targetH / 2),
      width: targetW,
      height: targetH,
      rotation: 0,
      opacity: 1,
      radius: 0,
      shadow: 0,
      borderWidth: 0,
      borderColor: "#ffffff",
      isTemplateManaged: false,
    };
    setElements((prev) => [...prev, item]);
    setLayerOrder((prev) => [...normalizeLayerOrder(prev, elements, templateSlots), { kind: "element", id: item.id }]);
    setSelectedId(item.id);
    setSelectedSlotId(null);
    if (isMobile) { setMobileDrawerOpen(false); showSlides(currentSlide); }
  };

  const onUploadFiles = async (e) => {
    const input = e.target;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    setExportError("正在載入照片…");
    const next = await Promise.all(
      files.map(
        async (file) => {
          try {
            const img = await loadImageFile(file);
            const maxDimension = isMobile ? MAX_IMAGE_DIMENSION_MOBILE : MAX_IMAGE_DIMENSION_DESKTOP;
            const working = resizeImageSource(img, maxDimension, "image/jpeg", isMobile ? 0.82 : 0.86);
            const thumb = resizeImageSource(img, 260, "image/jpeg", 0.72);
            img.close?.();
            return {
              id: uid("asset"),
              name: file.name,
              src: working.src,
              thumbSrc: thumb.src,
              width: working.width,
              height: working.height,
              mediaType: "image",
            };
          } catch (err) {
            console.error("Failed to import image:", err);
            return null;
          }
        }
      )
    );
    const imported = next.filter(Boolean);
    setImages((prev) => [...imported, ...prev]);
    const failed = files.length - imported.length;
    const successMessage = `已上傳 ${imported.length} 張照片到素材。點選素材後才會加入畫布或圖框。`;
    setExportError(failed ? `${imported.length ? successMessage : ""}${failed} 張無法讀取，請改用 JPG 或 PNG。` : successMessage);
    input.value = "";
  };

  const addText = () => {
    pushHistory();

    const item = {
      id: uid("text"),
      type: "text",
      text: "Your Story",
      x: 80,
      y: 80,
      width: 420,
      fontSize: 64,
      fontStyle: "bold",
      fontFamily: "Inter, system-ui, sans-serif",
      fill: "#ffffff",
      align: "left",
      opacity: 1,
      isTemplateManaged: false,
    };
    
    setElements((prev) => [...prev, item]);
    setLayerOrder((prev) => [...normalizeLayerOrder(prev, elements, templateSlots), { kind: "element", id: item.id }]);
    setSelectedId(item.id);
    setSelectedSlotId(null);

    if (isMobile) setMobileDrawerOpen(false);
  };

  const addFrame = () => {
    pushHistory();

    const frameW = Math.min(singleW * 0.72, canvasW * 0.42);
    const frameH = frameW * 1.25;
    const slot = createSlot({
      x: Math.max(32, canvasW / 2 - frameW / 2),
      y: Math.max(32, canvasH / 2 - frameH / 2),
      width: frameW,
      height: frameH,
      radius: 24,
      stroke: "#ffffff",
      strokeWidth: 8,
      fill: "rgba(255,255,255,0.08)",
      label: "自訂圖框",
    });

    setTemplateSlots((prev) => [...prev, slot]);
    setLayerOrder((prev) => [...normalizeLayerOrder(prev, elements, templateSlots), { kind: "slot", id: slot.id }]);
    setSelectedId(null);
    setSelectedSlotId(slot.id);
    if (isMobile) setMobileDrawerOpen(false);
  };

  const addSticker = (type) => {
    pushHistory();

    const base = {
      id: uid("sticker"),
      type: "sticker",
      stickerType: type,
      x: 120,
      y: 120,
      rotation: type === "tape" ? -8 : 0,
      opacity: 1,
      fill: type === "star" ? "#ffea73" : type === "circle" ? "#ffffff" : "#ead788",
      isTemplateManaged: false,
    };

    let item = base;
    if (type === "tape") item = { ...base, width: 180, height: 54 };
    if (type === "circle") item = { ...base, width: 90, height: 90 };
    if (type === "star") item = { ...base, width: 110, height: 110 };
    if (type === "heart") item = { ...base, width: 110, height: 100 };
    if (type === "diamond") item = { ...base, width: 100, height: 100 };
    if (type === "triangle") item = { ...base, width: 110, height: 100 };
    if (type === "spark") item = { ...base, width: 110, height: 110 };

    setElements((prev) => [...prev, item]);
    setLayerOrder((prev) => [...normalizeLayerOrder(prev, elements, templateSlots), { kind: "element", id: item.id }]);
    setSelectedId(item.id);
    setSelectedSlotId(null);
    if (isMobile) setMobileDrawerOpen(false);
  };

  const removeSelected = () => {
    pushHistory();

    if (selectedSlotId) {
      setTemplateSlots((prev) => prev.filter((slot) => slot.id !== selectedSlotId).map(slot =>
        selectedSlot?.swapLayer === "base" && slot.swapLayer === "overlay" && slot.swapGroup === selectedSlot.swapGroup && slot.swapSource === selectedSlot.swapSource
          ? detachSwapSlot(slot, prev) : slot
      ));
      setLayerOrder((prev) =>
        prev.filter((entry) => !(entry.kind === "slot" && entry.id === selectedSlotId))
      );
      setSelectedSlotId(null);
      return;
    }

    if (!selectedId) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setLayerOrder((prev) =>
      prev.filter((entry) => !(entry.kind === "element" && entry.id === selectedId))
    );
    setSelectedId(null);
  };

  const bringForward = () => {
    if (!selectedId) return;
    pushHistory();
    setLayerOrder(() => {
      const arr = [...visibleLayerOrder];
      const idx = arr.findIndex((entry) => entry.kind === "element" && entry.id === selectedId);
      if (idx < 0 || idx === arr.length - 1) return arr;
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  };

  const sendBackward = () => {
    if (!selectedId) return;
    pushHistory();
    setLayerOrder(() => {
      const arr = [...visibleLayerOrder];
      const idx = arr.findIndex((entry) => entry.kind === "element" && entry.id === selectedId);
      if (idx <= 0) return arr;
      [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
      return arr;
    });
  };

  const bringForwardSlot = () => {
    if (!selectedSlotId) return;
    pushHistory();
    setLayerOrder(() => {
      const arr = [...visibleLayerOrder];
      const idx = arr.findIndex((entry) => entry.kind === "slot" && entry.id === selectedSlotId);
      if (idx < 0 || idx === arr.length - 1) return arr;
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  };

  const sendBackwardSlot = () => {
    if (!selectedSlotId) return;
    pushHistory();
    setLayerOrder(() => {
      const arr = [...visibleLayerOrder];
      const idx = arr.findIndex((entry) => entry.kind === "slot" && entry.id === selectedSlotId);
      if (idx <= 0) return arr;
      [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
      return arr;
    });
  };

  const applyTemplate = (id) => {
    pushHistory();
    setTemplateId(id);
    setBackgroundMode("solid");
    setBgPrimary(DEFAULT_CANVAS_COLOR);
    setBgSecondary(DEFAULT_CANVAS_COLOR_2);

    if (id === "blank") {
      setTemplateSlots([]);
      setElements((prev) => prev.filter((el) => !el.isTemplateManaged));
      setLayerOrder((prev) =>
        normalizeLayerOrder(
          prev.filter((entry) => entry.kind !== "slot"),
          elements.filter((el) => !el.isTemplateManaged),
          []
        )
      );
      clearSelection();
      return;
    }

    const { slots: nextSlots, elements: nextManagedElements } = buildTemplateLayout(id, singleW, canvasH, slides);

    setTemplateSlots(nextSlots);
    setElements((prev) => [
      ...prev.filter((el) => !el.isTemplateManaged),
      ...nextManagedElements,
    ]);
    setLayerOrder((prev) => {
      const remainingElements = elements.filter((el) => !el.isTemplateManaged);
      const nextElements = [...remainingElements, ...nextManagedElements];
      const keptOrder = normalizeLayerOrder(prev, remainingElements, []);
      return [
        ...keptOrder,
        ...nextSlots.map((slot) => ({ kind: "slot", id: slot.id })),
        ...nextManagedElements.map((item) => ({ kind: "element", id: item.id })),
      ].filter((entry, index, arr) => {
        const key = `${entry.kind}:${entry.id}`;
        return arr.findIndex((candidate) => `${candidate.kind}:${candidate.id}` === key) === index;
      }).filter((entry) =>
        entry.kind === "slot"
          ? nextSlots.some((slot) => slot.id === entry.id)
          : nextElements.some((item) => item.id === entry.id)
      );
    });
    clearSelection();
  };

  const runExport = async (indices, pixelRatio) => {
    // Commit the clean render before reading pixels; RAF alone does not
    // guarantee that React and Konva's queued redraw have both completed.
    flushSync(() => {
      setIsExporting(true);
      setExportError("");
      setExportStatus("正在輸出正式圖片…");
    });
    try {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const stage = stageRef.current;
      if (!stage) throw new Error("Canvas unavailable");
      stage.draw();
      return indices.map(index => stage.toDataURL({
        x: index * singleW, y: 0, width: singleW, height: singleH, pixelRatio,
      }));
    } catch (error) {
      console.error("Export failed:", error);
      setExportError("輸出失敗，請重試或降低輸出畫質。");
      return [];
    } finally {
      flushSync(() => {
        setIsExporting(false);
        setExportStatus("");
      });
      stageRef.current?.draw();
    }
  };

  const exportSlices = (pixelRatio = 1) => runExport(Array.from({ length: slides }, (_, index) => index), pixelRatio);
  const exportSlice = async (index, pixelRatio = 1) => (await runExport([index], pixelRatio))[0] || null;

  const refreshPreviews = async ({ reveal = false } = {}) => {
    const data = await exportSlices(isMobile ? 0.32 : exportScale);
    if (!data.length) return;
    setPreviews(data);
    setPreviewsStale(false);
    if (reveal) setPreviewExpandSignal((value) => value + 1);
  };

  const handleOutput = async () => {
    if (isExporting) return;
    await refreshPreviews({ reveal: true });
    if (isMobile) {
      setMobileTab("preview");
      setMobileDrawerOpen(true);
    }
  };

  const downloadDataUrl = (dataUrl, filename) => {
    const a = document.createElement("a");
    const url = dataUrl.startsWith("data:") ? URL.createObjectURL(dataUrlToFile(dataUrl, filename)) : dataUrl;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (url !== dataUrl) setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const dataUrlToFile = (dataUrl, filename) => {
    const [meta, base64] = dataUrl.split(",");
    const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new File([bytes], filename, { type: mime });
  };

  const openSaveFallback = (dataUrl, filename) => {
    setSaveFallback({ src: dataUrl, filename });
  };

  const shareDataUrlToIOS = async (dataUrl, filename) => {
    try {
      const file = dataUrlToFile(dataUrl, filename);

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: "匯出的 carousel 圖片",
        });
        return;
      }

      openSaveFallback(dataUrl, filename);
    } catch (err) {
      console.error(err);
      openSaveFallback(dataUrl, filename);
    }
  };

  const downloadAll = async () => {
    const data = isMobile ? await exportSlices(exportScale) : previews;
    if (!data.length) return;
    try {
      const files = Object.fromEntries(data.map((src, index) => [
        `carousel_${String(index + 1).padStart(2, "0")}.png`,
        Uint8Array.from(atob(src.split(",")[1]), character => character.charCodeAt(0)),
      ]));
      const url = URL.createObjectURL(new Blob([zipSync(files, {level: 0})], {type: "application/zip"}));
      downloadDataUrl(url, "carousel.zip");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error("ZIP export failed:", error);
      setExportError("打包下載失敗，請改用單張下載。");
    }
  };

  const exportProject = () => {
    const data = compactSnapshotRefs({
      slides,
      ratioKey,
      backgroundMode,
      bgPrimary,
      bgSecondary,
      images,
      elements,
      templateSlots,
      layerOrder,
      templateId,
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, "scrl-lite-project.json");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const importProject = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        setSlides(data.slides || 3);
        setRatioKey(data.ratioKey || "4:5");
        setBackgroundMode(data.backgroundMode || "solid");
        setBgPrimary(data.bgPrimary || "#000000");
        setBgSecondary(data.bgSecondary || "#111827");
        const hydrated = hydrateSnapshotRefs(data);
        setImages(hydrated.images || []);
        setElements(hydrated.elements || []);
        setTemplateSlots(hydrated.templateSlots || []);
        setLayerOrder(normalizeLayerOrder(hydrated.layerOrder, hydrated.elements || [], hydrated.templateSlots || []));
        setTemplateId(hydrated.templateId || "blank");
        setSelectedId(null);
        setSelectedSlotId(null);
        setHistoryPast([]);
        setHistoryFuture([]);
      } catch {
        alert("JSON 專案檔讀取失敗");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        redo();
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        const editable = activeTag === "input" || activeTag === "textarea";
        if (!editable && (selectedId || selectedSlotId)) removeSelected();
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        const editable = activeTag === "input" || activeTag === "textarea" || activeTag === "select";
        if (!editable && (selectedId || selectedSlotId)) {
          e.preventDefault();
          const step = e.shiftKey ? 24 : 8;
          if (e.key === "ArrowUp") nudgeSelectedBox(0, -step);
          if (e.key === "ArrowDown") nudgeSelectedBox(0, step);
          if (e.key === "ArrowLeft") nudgeSelectedBox(-step, 0);
          if (e.key === "ArrowRight") nudgeSelectedBox(step, 0);
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, selectedSlotId, selectedItem, selectedSlot, historyPast, historyFuture]);

  const onWheelScaleSelected = (e) => {
    if (!(e.evt.ctrlKey || e.evt.metaKey)) return;
    if (!selectedItem) return;
    e.evt.preventDefault();

    const delta = e.evt.deltaY;
    const factor = delta > 0 ? 0.96 : 1.04;

    if (selectedItem.type === "image" || selectedItem.type === "sticker") {
      updateElement({
        ...selectedItem,
        width: Math.max(40, selectedItem.width * factor),
        height: Math.max(40, selectedItem.height * factor),
      });
    }

    if (selectedItem.type === "text") {
      updateElement({
        ...selectedItem,
        fontSize: Math.max(12, selectedItem.fontSize * factor),
      });
    }
  };

  const renderBackground = () => {
    if (backgroundMode === "solid") {
      return <Rect x={0} y={0} width={canvasW} height={canvasH} fill={bgPrimary} cornerRadius={40} listening={false} />;
    }

    return (
      <Rect
        x={0}
        y={0}
        width={canvasW}
        height={canvasH}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: canvasW, y: canvasH }}
        fillLinearGradientColorStops={createGradientStops(bgPrimary, bgSecondary)}
        cornerRadius={40}
        listening={false}
      />
    );
  };

  const drawable = elements.filter((el) => el.type !== "frameRect");

  const getDistance = (touches) => {
    const [a, b] = touches;
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getMidpoint = (touches) => {
    const [a, b] = touches;
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  };

  const getAngle = (touches) => {
    const [a, b] = touches;
    return Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * (180 / Math.PI);
  };

  const startViewportPan = (clientX, clientY) => {
    gestureRef.current.isPanning = true;
    gestureRef.current.startX = clientX;
    gestureRef.current.startY = clientY;
    gestureRef.current.startPanX = panRef.current.x;
    gestureRef.current.startPanY = panRef.current.y;
  };

  const handleViewportPointerDown = (e) => {
    const target = e.target;
    const isStageWrap = target.classList?.contains("canvas-stage-wrap");
    const isPanBg = target.classList?.contains("stage-pan-layer");
    const isScaleBox = target.classList?.contains("stage-scale-box");

    if (!(isStageWrap || isPanBg || isScaleBox)) return;

    startViewportPan(e.clientX, e.clientY);
  };

  const handleViewportPointerMove = (e) => {
    if (!gestureRef.current.isPanning) return;
    const dx = e.clientX - gestureRef.current.startX;
    const dy = e.clientY - gestureRef.current.startY;
    const next = clampPan(
      gestureRef.current.startPanX + dx,
      gestureRef.current.startPanY + dy,
      userZoom
    );
    applyPanPreview(next);
  };

  const handleViewportPointerUp = () => {
    if (gestureRef.current.isPanning) commitPanPreview();
    gestureRef.current.isPanning = false;
  };

  const handleViewportTouchStart = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      setViewportInteracting(true);
      const distance = getDistance(e.touches);
      const midpoint = getMidpoint(e.touches);
      const angle = getAngle(e.touches);

      gestureRef.current.pinchStartDistance = Math.max(1, distance);
      gestureRef.current.pinchStartAngle = angle;
      gestureRef.current.pinchStartZoom = userZoom;
      gestureRef.current.pinchStartPan = { ...panRef.current };
      gestureRef.current.pinchCenter = midpoint;
      gestureRef.current.isPanning = false;
      gestureRef.current.pinchLocked = true;
      setViewportInteracting(true);

      const hasSelectedTarget =
        !!selectedSlot ||
        !!(selectedItem && (selectedItem.type === "image" || selectedItem.type === "sticker"));

      // Selected photos follow the two-finger midpoint in canvas coordinates.
      if (hasSelectedTarget) {
        e.stopPropagation();
        pushHistory();
        gestureRef.current.pinchMode = "object";

        const start = selectedSlot || selectedItem;
        const rect = stageRef.current.container().getBoundingClientRect();
        gestureRef.current.pinchScale = displayScale;
        gestureRef.current.pinchPoint = {x: (midpoint.x - rect.left) / displayScale,
          y: (midpoint.y - rect.top) / displayScale};
        gestureRef.current.pinchTargetType = selectedSlot ? "slot" : "item";
        gestureRef.current.pinchTargetId = start.id;
        gestureRef.current.pinchStartObject = {...start};
        gestureRef.current.pinchLastObject = {...start};
        const node = selectableNodesRef.current.get(`${selectedSlot ? "slot" : "element"}:${start.id}`);
        node?.stopDrag();
        return;

      }

      // 只有完全沒選物件時，才允許 viewport pinch
      gestureRef.current.pinchTargetType = null;
      gestureRef.current.pinchTargetId = null;
      gestureRef.current.pinchMode = "viewport";
      gestureRef.current.pinchStartObject = null;
      return;
    }

    if (e.touches.length === 1) {
      const target = e.target;
      const isStageWrap = target.classList?.contains("canvas-stage-wrap");
      const isPanBg = target.classList?.contains("stage-pan-layer");
      const isScaleBox = target.classList?.contains("stage-scale-box");

      if (!(isStageWrap || isPanBg || isScaleBox)) {
        gestureRef.current.isPanning = false;
        return;
      }

      startViewportPan(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleViewportTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = getDistance(e.touches);
      const midpoint = getMidpoint(e.touches);
      const ratio = distance / gestureRef.current.pinchStartDistance;
      const currentAngle = getAngle(e.touches);
      const angleDelta = getShortestAngleDelta(currentAngle, gestureRef.current.pinchStartAngle);
      gestureRef.current.pinchLastRatio = ratio;
      gestureRef.current.pinchLastAngleDelta = angleDelta;

      const hasSelectedTarget =
        !!selectedSlot ||
        !!(selectedItem && (selectedItem.type === "image" || selectedItem.type === "sticker"));

      if (hasSelectedTarget) {
        e.preventDefault();
        e.stopPropagation();

        if (gestureRef.current.pinchMode === "object") {
          applySelectionPinch(ratio, angleDelta, midpoint);
          return;
        }

        return;
      }

      const nextZoom = clamp(gestureRef.current.pinchStartZoom * ratio, MIN_ZOOM, MAX_ZOOM);

      const oldScale = fitScale * gestureRef.current.pinchStartZoom;
      const newScale = fitScale * nextZoom;

      const contentX =
        (gestureRef.current.pinchCenter.x - gestureRef.current.pinchStartPan.x) / oldScale;
      const contentY =
        (gestureRef.current.pinchCenter.y - gestureRef.current.pinchStartPan.y) / oldScale;

      let nextPanX = midpoint.x - contentX * newScale;
      let nextPanY = midpoint.y - contentY * newScale;

      const clamped = clampPan(nextPanX, nextPanY, nextZoom);
      setUserZoom(nextZoom);
      setPan(clamped);
      return;
    }

    if (e.touches.length === 1 && gestureRef.current.isPanning) {
      e.preventDefault();
      const dx = e.touches[0].clientX - gestureRef.current.startX;
      const dy = e.touches[0].clientY - gestureRef.current.startY;
      const next = clampPan(
        gestureRef.current.startPanX + dx,
        gestureRef.current.startPanY + dy,
        userZoom
      );
      applyPanPreview(next);
    }
  };

  const handleViewportTouchEnd = () => {
    const gesture = gestureRef.current;
    if (gesture.pinchMode === "object" && gesture.pinchLastObject) {
      const next = finishPinch(gesture.pinchLastObject, gesture.pinchTargetType === "slot");
      if (gesture.pinchTargetType === "slot") updateSlot(next);
      else updateElement(next);
    }
    gesture.pinchLastObject = null;
    if (gestureRef.current.isPanning) commitPanPreview();
    gestureRef.current.isPanning = false;
    gestureRef.current.pinchMode = "viewport";
    gestureRef.current.pinchStartObject = null;
    gestureRef.current.pinchLastRatio = 1;
    gestureRef.current.pinchLastAngleDelta = 0;
    gestureRef.current.pinchTargetType = null;
    gestureRef.current.pinchTargetId = null;
    gestureRef.current.pinchLocked = false;
    setViewportInteracting(false);
  };

  const transformerAnchorSize = useMemo(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return 46;
    return 24;
  }, []);

  const projectPanelProject = {
    count: slides,
    ratio: ratioKey,
    backgroundMode,
    backgroundColor: bgPrimary,
    backgroundColor2: bgSecondary,
  };

  const setProjectPanelProject = (updater) => {
    const prev = {
      count: slides,
      ratio: ratioKey,
      backgroundMode,
      backgroundColor: bgPrimary,
      backgroundColor2: bgSecondary,
    };

    const next = typeof updater === "function" ? updater(prev) : updater;

    if (Object.keys(prev).some(key => prev[key] !== next[key])) pushHistory();
    if (next.count !== undefined) setSlides(next.count);
    if (next.ratio !== undefined) setRatioKey(next.ratio);
    if (next.backgroundMode !== undefined) setBackgroundMode(next.backgroundMode);
    if (next.backgroundColor !== undefined) setBgPrimary(next.backgroundColor);
    if (next.backgroundColor2 !== undefined) setBgSecondary(next.backgroundColor2);
  };

  const templateDescriptions = {
    blank: "從空白輪播開始",
    magazine: "封面照與標題留白",
    cover: "大型主視覺開場",
    film: "每張一格照片日記",
    split: "左文右圖說明",
    frame: "單張大圖白框",
    grid4: "四宮格拼貼",
    duo: "前後對照或比較",
    triptych: "三段式故事",
    polaroid: "生活感照片拼貼",
    quote: "語錄與人物照",
    product: "商品主圖與賣點",
    checker: "多圖作品集",
    "swap-square": "上下雙圖互換中央方形",
  };

  const projectPanelTemplates = useMemo(() => TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: templateDescriptions[t.id] || "",
    preview: buildTemplateLayout(t.id, singleW, canvasH, slides),
    previewWidth: canvasW,
    previewHeight: canvasH,
  })), [singleW, canvasH, slides]);

  const projectPanelStickers = STICKERS.map((st) => ({
    id: st.id,
    name: st.label,
    src:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
          <rect width="200" height="200" rx="28" fill="#111827"/>
          <text x="100" y="108" text-anchor="middle" font-size="28" fill="white" font-family="Arial">${st.label}</text>
        </svg>`
      ),
    stickerType: st.type,
  }));

  const handleUploadImages = () => fileRef.current?.click();
  const handleAddText = () => addText();
  const handleAddFrame = () => addFrame();
  const handleExportJson = () => exportProject();
  const handleImportJson = () => importRef.current?.click();
  const handleTemplateSelect = (id) => applyTemplate(id);

  const mobileSelectedActions = {
    hasSelection: !!selectedItem || !!selectedSlot,
    canReorder: !!selectedItem || !!selectedSlot,
    isCropSlot: !!selectedSlot?.imageSrc,
    fitLabel: selectedSlot?.imageSrc ? "單張4:5" : "做成4:5",
    spanLabel: selectedSlot ? "跨兩張輪播" : "跨兩張",
    rotateLabel: selectedSlot?.imageSrc ? "旋轉框內圖" : "旋轉90",
    onScaleDown: () => scaleSelectedBox(0.92),
    onScaleUp: () => scaleSelectedBox(1.08),
    onNudgeUp: () => nudgeSelectedBox(0, -8),
    onNudgeDown: () => nudgeSelectedBox(0, 8),
    onNudgeLeft: () => nudgeSelectedBox(-8, 0),
    onNudgeRight: () => nudgeSelectedBox(8, 0),
    onCropZoomOut: () => zoomSelectedSlot(-1),
    onCropZoomIn: () => zoomSelectedSlot(1),
    onCropUp: () => nudgeSelectedSlot(0, -1),
    onCropDown: () => nudgeSelectedSlot(0, 1),
    onCropLeft: () => nudgeSelectedSlot(-1, 0),
    onCropRight: () => nudgeSelectedSlot(1, 0),
    onFit45: setSelectedCrop45,
    onSpanTwoSlides: spanSelectedBoxAcrossTwoSlides,
    onRotate90: rotateSelectedBox90,
    onBringForward: selectedSlot ? bringForwardSlot : bringForward,
    onSendBackward: selectedSlot ? sendBackwardSlot : sendBackward,
    onDuplicate: duplicateSelected,
    onRemove: removeSelected,
  };
  const handleAddAssetToCanvas = (asset) => addImageToCanvas(asset);
  const handleAddStickerToCanvas = (sticker) => addSticker(sticker.stickerType || sticker.type);

  const repairSwapAlignment = () => {
    pushHistory();
    const layout = buildTemplateLayout("swap-square", singleW, canvasH, slides).slots;
    setTemplateSlots(previous => previous.map(slot => {
      const target = layout.find(candidate => candidate.swapGroup === slot.swapGroup && candidate.swapSource === slot.swapSource && candidate.swapLayer === slot.swapLayer);
      if (!target) return slot;
      return {...slot, x: target.x, y: target.y, width: target.width, height: target.height,
        rotation: 0, radius: 0, strokeWidth: 0, imageFitWidth: undefined, imageFitHeight: undefined};
    }));
    setPreviews([]);
    setPreviewsStale(true);
    setMobileDrawerOpen(false);
    clearSelection();
  };

  const projectPanelProps = {
    project: projectPanelProject,
    setProject: setProjectPanelProject,
    onUploadImages: handleUploadImages,
    onAddText: handleAddText,
    onAddFrame: handleAddFrame,
    onClearDraft: clearSavedDraft,
    onRepairSwap: repairSwapAlignment,
    onExportJson: handleExportJson,
    onImportJson: handleImportJson,
    assets: images,
    stickers: projectPanelStickers,
    templates: projectPanelTemplates,
    activeTemplateId: templateId,
    onTemplateSelect: handleTemplateSelect,
    onAddAssetToCanvas: handleAddAssetToCanvas,
    onAddStickerToCanvas: handleAddStickerToCanvas,
  };

  const previewPanelProps = {
    directDownload: !isMobile,
    previews: previews.map((src, idx) => ({
      id: `preview-${idx + 1}`,
      src,
      width: exportW,
      height: exportH,
    })),
    onDownloadOne: async (preview, index) => {
      const filename = `carousel_${String(index + 1).padStart(2, "0")}.png`;
      const fullSizeSrc = await exportSlice(index, exportScale);
      if (!fullSizeSrc) return;

      if (isMobile) {
        shareDataUrlToIOS(fullSizeSrc, filename);
      } else {
        downloadDataUrl(fullSizeSrc, filename);
      }
    },
    onSaveOne: isMobile
      ? async (preview, index) => {
          const filename = `carousel_${String(index + 1).padStart(2, "0")}.png`;
          const fullSizeSrc = await exportSlice(index, exportScale);
          if (fullSizeSrc) shareDataUrlToIOS(fullSizeSrc, filename);
        }
      : null,
    onDownloadAll: downloadAll,
    isBusy: isExporting,
    isStale: previewsStale,
    onRefresh: handleOutput,
    defaultCollapsed: !isMobile,
    expandSignal: previewExpandSignal,
  };

  const mobileDrawerProps = {
    open: mobileDrawerOpen,
    activeTab: mobileTab,
    onClose: () => setMobileDrawerOpen(false),
    projectPanelProps,
    previewPanelProps,
    assets: images,
    stickers: projectPanelStickers,
    templates: projectPanelTemplates,
    activeTemplateId: templateId,
    onTemplateSelect: handleTemplateSelect,
    onAddAssetToCanvas: handleAddAssetToCanvas,
    onAddStickerToCanvas: handleAddStickerToCanvas,
    inspectorProps: {
      hasSelection: !!selectedItem || !!selectedSlot,
      actions: mobileSelectedActions,
      onPickPhoto: () => setMobileTab("assets"),
      isSlot: !!selectedSlot,
      content: (
        <InspectorContent
          selectedItem={selectedItem}
          selectedSlot={selectedSlot}
          updateElement={updateElement}
          updateSlot={updateSlot}
          setShowGuides={setShowGuides}
          showGuides={showGuides}
        />
      ),
    },
  };

  return (
    <div className="app-shell">
      {!isMobile && (
        <aside className="sidebar left">
          <ProjectPanelUI {...projectPanelProps} />
        </aside>
      )}

      <main className="main" inert={isMobile && mobileDrawerOpen ? "" : undefined}>
        <div className="canvas-panel">
          <div className="canvas-toolbar">
            <div>
              <strong>IG貼文切圖工具</strong>
              <span className="sub">
                手機：選取照片後，雙指可同時縮放、移動及旋轉；框內照片保留圖框位置。
              </span>
            </div>

            <div className="project-status" role="status">{exportError || draftStatus}</div>
            <div className="toolbar-actions">
              <label className="export-quality-control">
                <span>輸出</span>
                <select
                  value={exportScale}
                  onChange={(e) => setExportScale(Number(e.target.value))}
                  disabled={isExporting}
                >
                  <option value={1}>標準 · {singleW}×{singleH}</option>
                  <option value={2}>高畫質 · {singleW * 2}×{singleH * 2}</option>
                </select>
              </label>

              {!isMobile && (
                <>
                  <button className="ghost" onClick={undo}>復原</button>
                  <button className="ghost" onClick={redo}>重做</button>
                  <button type="button" className="ghost danger" onClick={removeSelected}>刪除選取</button>

                  <button type="button" onClick={handleOutput}>輸出</button>
                </>
              )}

              {isMobile && (
                <>
                  <button className="ghost mobile-icon-btn" aria-label="復原" onClick={undo}>↶</button>
                  <button className="ghost mobile-icon-btn" aria-label="重做" onClick={redo}>↷</button>

                  <button onClick={handleOutput}>
                    輸出
                  </button>
                </>
              )}
            </div>
          </div>

          <div
            ref={containerRef}
            className="canvas-stage-wrap"
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={handleViewportPointerUp}
            onPointerCancel={handleViewportPointerUp}
            onTouchStartCapture={handleViewportTouchStart}
            onTouchMoveCapture={handleViewportTouchMove}
            onTouchEndCapture={handleViewportTouchEnd}
            onTouchCancelCapture={handleViewportTouchEnd}
            onDoubleClick={resetView}
          >
            {isMobile && !mobileDrawerOpen && (
              <nav className="canvas-page-nav" aria-label="輪播畫布導覽" onPointerDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
                <button type="button" onClick={() => showSlides(null)}>全部</button>
                <button type="button" onClick={() => showSlides(visibleSlideIndex)}>單張</button>
                <button type="button" aria-label="上一張" disabled={visibleSlideIndex === 0} onClick={() => showSlides(visibleSlideIndex - 1)}>上一張</button>
                <span aria-live="polite">{visibleSlideIndex + 1} / {slides}</span>
                <button type="button" aria-label="下一張" disabled={visibleSlideIndex === slides - 1} onClick={() => showSlides(visibleSlideIndex + 1)}>下一張</button>
              </nav>
            )}
            {isExporting && (
              <div className="export-status" role="status">
                {exportStatus || "正在輸出…"} · {exportW}×{exportH}
              </div>
            )}

            {!hasStartedProject && (
              <section className="start-guide">
                <div>
                  <strong>從這裡開始做一組 carousel</strong>
                  <p>先上傳圖片或套用模板，完成編輯後按輸出產生切圖。</p>
                </div>
                <div className="start-guide__actions">
                  <button type="button" onClick={handleUploadImages}>上傳圖片</button>
                  <button type="button" className="ghost" onClick={() => applyTemplate("frame")}>
                    圖框模板
                  </button>
                  <button type="button" className="ghost" onClick={() => applyTemplate("grid4")}>
                    四格拼貼
                  </button>
                </div>
              </section>
            )}

            {!isMobile && (selectedItem || selectedSlot) && (
              <div className="rotation-hud">
                {getSelectedTypeLabel(selectedItem, selectedSlot)} · {rotationDisplay}°
              </div>
            )}

            {isMobile && slides > mobileVisibleSlideCount && (
              <div className="mobile-canvas-scrollbar" aria-hidden="true">
                <div
                  ref={mobileScrollbarThumbRef}
                  className="mobile-canvas-scrollbar__thumb"
                  style={{
                    width: `${Math.max(28, (mobileVisibleSlideCount / slides) * 100)}%`,
                    left: `${(100 - Math.max(28, (mobileVisibleSlideCount / slides) * 100)) * mobileScrollProgress}%`,
                  }}
                />
              </div>
            )}

            <div
              ref={panLayerRef}
              className="stage-pan-layer"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
            >
              <div
                className="stage-scale-box"
                style={{ width: canvasW * displayScale, height: canvasH * displayScale }}
              >
                <div
                  className="stage-real-size"
                  style={{
                    width: canvasW,
                    height: canvasH,
                    transform: `scale(${displayScale})`,
                    transformOrigin: "top left",
                  }}
                >
                  <Stage
                    ref={stageRef}
                    width={canvasW}
                    height={canvasH}
	                    onMouseDown={(e) => {
	                      if (isInteractingRef.current) return;
	                      const clickedOnEmpty = e.target === e.target.getStage();
	                      if (clickedOnEmpty) {
	                        clearSelection();
	                        if (isMobile) startViewportPan(e.evt.clientX, e.evt.clientY);
	                      }
	                    }}
	                    onTouchStart={(e) => {
	                      if (isInteractingRef.current) return;
	                      const touchCount = e.evt?.touches?.length || 0;
	                      if (touchCount > 1) return;
	                      const clickedOnEmpty = e.target === e.target.getStage();
	                      if (clickedOnEmpty) {
	                        clearSelection();
	                        const touch = e.evt.touches?.[0];
	                        if (isMobile && touch) startViewportPan(touch.clientX, touch.clientY);
	                      }
	                    }}
                    onWheel={onWheelScaleSelected}
                  >
                    <Layer>
                      {renderBackground()}

                      {visibleLayerOrder.map((entry) => {
                        if (entry.kind === "slot") {
                          const slot = templateSlots.find((candidate) => candidate.id === entry.id);
                          if (!slot) return null;
                          return (
                            <TemplateSlot
                              key={`slot-${slot.id}`}
                              slot={slot}
                              sourceSlot={slot.swapLayer === "overlay" ? templateSlots.find(candidate =>
                                candidate.swapLayer === "base" && candidate.swapGroup === slot.swapGroup && candidate.swapSource === slot.swapSource
                              ) : null}
                              isSelected={!isExporting && slot.id === selectedSlotId}
                              onSelect={() => {
                                setSelectedSlotId(slot.id);
                                setSelectedId(null);
                              }}
                              onChange={updateSlot}
                              snapGuides={snapGuides}
                              canvasW={canvasW}
                              canvasH={canvasH}
                              transformerAnchorSize={transformerAnchorSize}
                              editing={!isExporting}
	                              onInteractionChange={setObjectInteracting}
                              pushHistory={pushHistory}
                              registerSelectableNode={registerSelectableNode}
                              onSnapChange={updateLiveGuides}
                            />
                          );
                        }

                        const item = elements.find((candidate) => candidate.id === entry.id);
                        if (!item || item.type === "frameRect") return null;

                        if (item.type === "image") {
                          return (
                            <DraggableImage
                              key={item.id}
                              item={item}
	                              isSelected={!isExporting && item.id === selectedId}
	                              onSelect={() => {
	                                setSelectedId(item.id);
	                                setSelectedSlotId(null);
	                              }}
                              onChange={updateElement}
                              snapGuides={snapGuides}
                              canvasW={canvasW}
                              canvasH={canvasH}
                              transformerAnchorSize={transformerAnchorSize}
                              editing={!isExporting}
                              keepRatioOnTransform={modifiers.shift || isMobile}
                              centeredScaling={modifiers.alt}
	                              onInteractionChange={setObjectInteracting}
                              pushHistory={pushHistory}
                              registerSelectableNode={registerSelectableNode}
                              onSnapChange={updateLiveGuides}
                            />
                          );
                        }

                        if (item.type === "text") {
                          return (
                            <DraggableText
                              key={item.id}
                              item={item}
	                              isSelected={!isExporting && item.id === selectedId}
	                              onSelect={() => {
	                                setSelectedId(item.id);
	                                setSelectedSlotId(null);
	                              }}
                              onChange={updateElement}
                              snapGuides={snapGuides}
                              canvasW={canvasW}
                              canvasH={canvasH}
                              transformerAnchorSize={transformerAnchorSize}
                              editing={!isExporting}
	                              onInteractionChange={setObjectInteracting}
                              pushHistory={pushHistory}
                              registerSelectableNode={registerSelectableNode}
                              onSnapChange={updateLiveGuides}
                            />
                          );
                        }

                        if (item.type === "sticker") {
                          return (
                            <StickerShape
                              key={item.id}
                              item={item}
	                              isSelected={!isExporting && item.id === selectedId}
	                              onSelect={() => {
	                                setSelectedId(item.id);
	                                setSelectedSlotId(null);
	                              }}
                              onChange={updateElement}
                              snapGuides={snapGuides}
                              canvasW={canvasW}
                              canvasH={canvasH}
                              transformerAnchorSize={transformerAnchorSize}
                              editing={!isExporting}
                              centeredScaling={modifiers.alt}
	                              onInteractionChange={setObjectInteracting}
                              pushHistory={pushHistory}
                              registerSelectableNode={registerSelectableNode}
                              onSnapChange={updateLiveGuides}
                            />
                          );
                        }

                        return null;
                      })}

                      {!isExporting &&
                        Array.from({ length: slides - 1 }).map((_, i) => (
                          <Line
                            key={`slice-${i}`}
                            points={[(i + 1) * singleW, 0, (i + 1) * singleW, canvasH]}
                            stroke="#f8fafc"
                            shadowColor="#172033"
                            shadowBlur={2 / displayScale}
                            dash={[7 / displayScale, 5 / displayScale]}
                            strokeWidth={1.5 / displayScale}
                            listening={false}
                          />
                        ))}

                      {!isExporting && showGuides && (
                        <>
                          {activeGuides.vertical.map((x, idx) => (
                            <React.Fragment key={`gv-${idx}`}>
                              <Line
                                points={[x, 0, x, canvasH]}
                                stroke={hexToRgba("#35f2a1", 0.22)}
                                strokeWidth={isMobile ? 6 : 10}
                              />
                              <Line
                                points={[x, 0, x, canvasH]}
                                stroke={hexToRgba("#35f2a1", 0.98)}
                                dash={[14, 8]}
                                strokeWidth={isMobile ? 2 : 3}
                              />
                            </React.Fragment>
                          ))}
                          {activeGuides.horizontal.map((y, idx) => (
                            <React.Fragment key={`gh-${idx}`}>
                              <Line
                                points={[0, y, canvasW, y]}
                                stroke={hexToRgba("#35f2a1", 0.22)}
                                strokeWidth={isMobile ? 6 : 10}
                              />
                              <Line
                                points={[0, y, canvasW, y]}
                                stroke={hexToRgba("#35f2a1", 0.98)}
                                dash={[14, 8]}
                                strokeWidth={isMobile ? 2 : 3}
                              />
                            </React.Fragment>
                          ))}
                        </>
                      )}

                      <SelectionTransformer
                        selectedNode={selectedNode}
                        selectedType={selectedNodeType}
                        editing={!isExporting}
                        transformerAnchorSize={transformerAnchorSize}
                        keepRatioOnTransform={modifiers.shift || isMobile}
                        centeredScaling={modifiers.alt}
                      />
                    </Layer>
                  </Stage>
                </div>
              </div>
            </div>
          </div>






        </div>
        {!isMobile && (
          <BottomAssetTray
            images={images}
            selectedSlot={selectedSlot}
            onPickImage={addImageToCanvas}
            persistent={false}
          />
        )}

        {isMobile && (
          <MobileBottomDock
            images={images}
            selectedSlot={selectedSlot}
            onPickImage={addImageToCanvas}
            activeTab={mobileTab}
            onTabChange={(tab) => {
              setMobileTab(tab);
              if (tab === "edit" && (selectedItem || selectedSlot)) {
                const target = selectedSlot || selectedItem;
                showSlides(clamp(Math.floor((target.x + target.width / 2) / singleW), 0, slides - 1));
              }
              setMobileDrawerOpen(tab !== "edit" || !(selectedItem || selectedSlot));
            }}
            actions={mobileSelectedActions}
            onOpenDetails={() => { setMobileTab("edit"); setMobileDrawerOpen(true); }}
            zoomPercent={Math.round((userZoom || 1) * 100)}
            hidden={mobileDrawerOpen}
            selectionLabel={selectedSlot ? selectedSlot.label || "圖框" : selectedItem ? selectedItem.text || "圖片或元素" : null}
            onClearSelection={clearSelection}
          />
        )}


      </main>

      {!isMobile && (
        <aside className="sidebar right">
          <DesktopInspectorPanel
            selectedItem={selectedItem}
            selectedSlot={selectedSlot}
            updateElement={updateElement}
            updateSlot={updateSlot}
            setShowGuides={setShowGuides}
            showGuides={showGuides}
            onBringForward={selectedSlot ? bringForwardSlot : bringForward}
            onSendBackward={selectedSlot ? sendBackwardSlot : sendBackward}
            onDuplicate={duplicateSelected}
            onRemove={removeSelected}
            onClearSelection={clearSelection}
            selectedActions={mobileSelectedActions}
          />
          <PreviewPanelUI {...previewPanelProps} />
        </aside>
      )}

      {isMobile && <MobileDrawerUI {...mobileDrawerProps} />}

      {isMobile && saveFallback && (
        <div className="mobile-save-sheet" role="dialog" aria-modal="true">
          <div className="mobile-save-sheet__head">
            <div>
              <strong>儲存圖片</strong>
              <span>長按圖片，或開啟圖片後用系統分享儲存。</span>
            </div>
            <button
              type="button"
              className="ghost"
              onClick={() => setSaveFallback(null)}
            >
              關閉
            </button>
          </div>

          <div className="mobile-save-sheet__image">
            <img src={saveFallback.src} alt="可儲存的切圖" />
          </div>

          <div className="mobile-save-sheet__actions">
            <a href={saveFallback.src} target="_blank" rel="noreferrer">
              開啟圖片
            </a>
            <button
              type="button"
              onClick={() => downloadDataUrl(saveFallback.src, saveFallback.filename)}
            >
              下載
            </button>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onUploadFiles} />
      <input ref={importRef} type="file" accept="application/json" hidden onChange={importProject} />
    </div>
  );
}
