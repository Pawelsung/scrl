import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3;
const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];
const SLOT_NUDGE = 24;
const SLOT_ZOOM_STEP = 0.08;
const STORAGE_KEY = "scrl_draft_v1";

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

function getSelectedTypeLabel(item, slot) {
  if (slot) return "模板圖框";
  if (!item) return "";
  if (item.type === "image") return "圖片";
  if (item.type === "text") return "文字";
  if (item.type === "sticker") return "貼紙";
  return "物件";
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

function snapRotationAngle(angle, snaps = ROTATION_SNAPS, tolerance = 12) {
  const normalized = normalizeRotation(angle);
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
        x={slot.x}
        y={slot.y}
        rotation={slot.rotation || 0}
        draggable={editing && interactive}
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

            {image && (
              <KonvaImage
                image={image}
                {...getCoverPlacement(
                  image.width,
                  image.height,
                  slot.width,
                  slot.height,
                  slot.imageZoom || 1,
                  slot.imageOffsetX || 0,
                  slot.imageOffsetY || 0
                )}
              />
            )}
          </Group>
        )}

        {showPlaceholder && !slot.imageSrc && (
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
            strokeWidth={isSelected ? Math.max(3, (slot.strokeWidth || 4) + 1) : slot.strokeWidth || 4}
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
      <div className="quick-control-group">
        <button type="button" className="ghost" onClick={actions.onScaleDown}>-</button>
        <button type="button" className="ghost" onClick={actions.onScaleUp}>+</button>
        <button type="button" className="ghost" onClick={actions.onRotate90}>旋轉90</button>
      </div>

      <div className="quick-control-group nudge">
        <button type="button" className="ghost" onClick={actions.onNudgeUp}>↑</button>
        <button type="button" className="ghost" onClick={actions.onNudgeLeft}>←</button>
        <button type="button" className="ghost" onClick={actions.onNudgeDown}>↓</button>
        <button type="button" className="ghost" onClick={actions.onNudgeRight}>→</button>
      </div>

      <div className="quick-control-group">
        <button type="button" className="ghost" onClick={actions.onFit45}>4:5</button>
        <button type="button" className="ghost" onClick={actions.onSpanTwoSlides}>跨兩張</button>
      </div>
    </div>
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
  if (!selectedItem && !selectedSlot) {
    return <div className="hint-card">點一下畫布中的圖片、文字、貼紙或模板圖框。若想操作畫布本身，請先按「取消選取」。</div>;
  }

  if (selectedSlot) {
    return (
      <>
        <div className="hint-card" style={{ marginBottom: 12 }}>
          <strong>已選取模板圖框</strong>
          <div style={{ marginTop: 8, color: "#9ba8bb" }}>
            {selectedSlot.imageName
              ? `已放入：${selectedSlot.imageName}`
              : "目前尚未放圖，先點選這個圖框，再到素材區點圖片即可填入。"}
          </div>
        </div>

        <label className="field">
          <span>圓角</span>
          <input
            type="range"
            min="0"
            max="120"
            value={selectedSlot.radius || 0}
            onChange={(e) => updateSlot({ ...selectedSlot, radius: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span>框線粗細</span>
          <input
            type="range"
            min="0"
            max="30"
            value={selectedSlot.strokeWidth || 0}
            onChange={(e) => updateSlot({ ...selectedSlot, strokeWidth: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span>框線顏色</span>
          <input
            type="color"
            value={selectedSlot.stroke || "#ffffff"}
            onChange={(e) => updateSlot({ ...selectedSlot, stroke: e.target.value })}
          />
        </label>

        {selectedSlot.imageSrc && (
          <>
            <label className="field">
              <span>框內縮放</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={selectedSlot.imageZoom || 1}
                onChange={(e) =>
                  updateSlot({ ...selectedSlot, imageZoom: Number(e.target.value) })
                }
              />
            </label>

            <label className="field">
              <span>水平位移</span>
              <input
                type="range"
                min="-500"
                max="500"
                value={selectedSlot.imageOffsetX || 0}
                onChange={(e) =>
                  updateSlot({ ...selectedSlot, imageOffsetX: Number(e.target.value) })
                }
              />
            </label>

            <label className="field">
              <span>垂直位移</span>
              <input
                type="range"
                min="-500"
                max="500"
                value={selectedSlot.imageOffsetY || 0}
                onChange={(e) =>
                  updateSlot({ ...selectedSlot, imageOffsetY: Number(e.target.value) })
                }
              />
            </label>

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
                  });
                }}
              >
                清空圖框圖片
              </button>
            </div>
          </>
        )}

        <div className="button-row">
          <button className="ghost" onClick={() => setShowGuides((v) => !v)}>
            {showGuides ? "隱藏參考線" : "顯示參考線"}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {selectedItem?.type === "image" && (
        <>
          <label className="field">
            <span>圓角</span>
            <input
              type="range"
              min="0"
              max="120"
              value={selectedItem.radius || 0}
              onChange={(e) => updateElement({ ...selectedItem, radius: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>陰影</span>
            <input
              type="range"
              min="0"
              max="40"
              value={selectedItem.shadow || 0}
              onChange={(e) => updateElement({ ...selectedItem, shadow: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>透明度</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.01"
              value={selectedItem.opacity ?? 1}
              onChange={(e) => updateElement({ ...selectedItem, opacity: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>邊框粗細</span>
            <input
              type="range"
              min="0"
              max="20"
              value={selectedItem.borderWidth || 0}
              onChange={(e) =>
                updateElement({ ...selectedItem, borderWidth: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            <span>邊框顏色</span>
            <input
              type="color"
              value={selectedItem.borderColor || "#ffffff"}
              onChange={(e) => updateElement({ ...selectedItem, borderColor: e.target.value })}
            />
          </label>
        </>
      )}

      {selectedItem?.type === "text" && (
        <>
          <label className="field">
            <span>文字內容</span>
            <textarea
              rows="4"
              value={selectedItem.text}
              onChange={(e) => updateElement({ ...selectedItem, text: e.target.value })}
            />
          </label>
          <label className="field">
            <span>字體大小</span>
            <input
              type="range"
              min="16"
              max="180"
              value={selectedItem.fontSize}
              onChange={(e) => updateElement({ ...selectedItem, fontSize: Number(e.target.value) })}
            />
          </label>
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
        </>
      )}

      {selectedItem?.type === "sticker" && (
        <>
          <label className="field">
            <span>顏色</span>
            <input
              type="color"
              value={selectedItem.fill || "#ffffff"}
              onChange={(e) => updateElement({ ...selectedItem, fill: e.target.value })}
            />
          </label>
          <label className="field">
            <span>透明度</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.01"
              value={selectedItem.opacity ?? 1}
              onChange={(e) => updateElement({ ...selectedItem, opacity: Number(e.target.value) })}
            />
          </label>
        </>
      )}

      <div className="button-row">
        <button className="ghost" onClick={() => setShowGuides((v) => !v)}>
          {showGuides ? "隱藏參考線" : "顯示參考線"}
        </button>
      </div>
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
          <SelectionQuickControls actions={selectedActions} />
          <div className="desktop-layer-actions">
            <button className="ghost" onClick={onSendBackward}>下移</button>
            <button className="ghost" onClick={onBringForward}>上移</button>
            {!!selectedItem && <button className="ghost" onClick={onDuplicate}>複製</button>}
            <button className="ghost danger" onClick={onRemove}>刪除</button>
            <button className="ghost" onClick={onClearSelection}>取消</button>
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




export default function App() {
  const [slides, setSlides] = useState(3);
  const [ratioKey, setRatioKey] = useState("4:5");
  const [backgroundMode, setBackgroundMode] = useState("solid");
  const [bgPrimary, setBgPrimary] = useState("#ffffff");
  const [bgSecondary, setBgSecondary] = useState("#f3f4f6");
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
  const selectableNodesRef = useRef(new Map());
  const [selectableNodeRevision, setSelectableNodeRevision] = useState(0);

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

  const selectedItem = elements.find((el) => el.id === selectedId) || null;
  const selectedSlot = templateSlots.find((slot) => slot.id === selectedSlotId) || null;
  const registerSelectableNode = useCallback((kind, id, node) => {
    const key = `${kind}:${id}`;
    if (node) {
      selectableNodesRef.current.set(key, node);
    } else {
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
    if (selectedSlot) return selectableNodesRef.current.get(`slot:${selectedSlot.id}`) || null;
    if (selectedItem) return selectableNodesRef.current.get(`element:${selectedItem.id}`) || null;
    return null;
  }, [selectedItem, selectedSlot, selectableNodeRevision]);
  const selectedNodeType = selectedSlot ? "slot" : selectedItem?.type || null;
  const visibleLayerOrder = useMemo(
    () => normalizeLayerOrder(layerOrder, elements, templateSlots),
    [layerOrder, elements, templateSlots]
  );

  const captureSnapshot = () => ({
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

  const applySnapshot = (snap) => {
    setSlides(snap.slides);
    setRatioKey(snap.ratioKey);
    setBackgroundMode(snap.backgroundMode);
    setBgPrimary(snap.bgPrimary);
    setBgSecondary(snap.bgSecondary);
    setImages(snap.images);
    setElements(snap.elements || []);
    setTemplateSlots(snap.templateSlots || []);
    setLayerOrder(normalizeLayerOrder(snap.layerOrder, snap.elements || [], snap.templateSlots || []));
    setTemplateId(snap.templateId);
    setSelectedId(null);
    setSelectedSlotId(null);
  };

  const pushHistory = () => {
    if (historyLockRef.current) return;
    const snap = captureSnapshot();
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

    autosaveTimerRef.current = setTimeout(() => {
      try {
        const payload = {
          savedAt: Date.now(),
          snapshot: captureSnapshot(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (err) {
        console.error("Failed to save draft:", err);
      }
    }, isMobile ? 1400 : 900);

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
    const ok = window.confirm("要清除目前草稿與畫布內容嗎？");
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
    setBgPrimary("#ffffff");
    setBgSecondary("#f3f4f6");
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

      const current = captureSnapshot();
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

      const current = captureSnapshot();
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
    const onResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ w: rect.width, h: rect.height });
      }
      setIsMobile(window.innerWidth <= 768);
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
    const usableH = Math.max(220, containerSize.h - pad);
    return Math.min(usableW / fitWidth, usableH / canvasH, 1);
  }, [containerSize, canvasW, canvasH, isMobile, singleW, slides]);

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
    const viewportH = containerSize.h;
    const pad = isMobile ? 10 : 24;

    const horizontalSlack = Math.max(0, viewportW - scaledW - pad * 2);
    const verticalSlack = Math.max(0, viewportH - scaledH - pad * 2);

    const minX = scaledW + pad * 2 <= viewportW ? pad + horizontalSlack / 2 : viewportW - scaledW - pad;
    const maxX = scaledW + pad * 2 <= viewportW ? pad + horizontalSlack / 2 : pad;

    const minY = scaledH + pad * 2 <= viewportH ? pad + verticalSlack / 2 : viewportH - scaledH - pad;
    const maxY = scaledH + pad * 2 <= viewportH ? pad + verticalSlack / 2 : pad;

    return {
      x: clamp(nextX, Math.min(minX, maxX), Math.max(minX, maxX)),
      y: clamp(nextY, Math.min(minY, maxY), Math.max(minY, maxY)),
    };
  };

  useEffect(() => {
    setPan((prev) => clampPan(prev.x, prev.y, userZoom));
  }, [fitScale, containerSize.w, containerSize.h, isMobile, userZoom]);

  const resetView = () => {
    setUserZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const clearSelection = () => {
    setSelectedId(null);
    setSelectedSlotId(null);  };

  const duplicateSelected = () => {
    if (!selectedItem) return;
    pushHistory();
    const clone = {
      ...selectedItem,
      id: uid(selectedItem.type),
      x: selectedItem.x + 32,
      y: selectedItem.y + 32,
      isTemplateManaged: false,
    };
    setElements((prev) => [...prev, clone]);
    setLayerOrder((prev) => [...normalizeLayerOrder(prev, elements, templateSlots), { kind: "element", id: clone.id }]);
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
    const target = selectedSlot || selectedItem;
    if (!target) return { vertical: [], horizontal: [] };
    return {
      vertical: target.snapV != null ? [target.snapV] : [],
      horizontal: target.snapH != null ? [target.snapH] : [],
    };
  }, [selectedItem, selectedSlot]);

  const updateElement = (next) => {
    setElements((prev) => prev.map((el) => (el.id === next.id ? next : el)));
  };

  const updateSlot = (next) => {
    setTemplateSlots((prev) => prev.map((slot) => (slot.id === next.id ? next : slot)));
  };

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
    updateSelectedBox((target) => ({
      ...target,
      x: (target.x || 0) + dx,
      y: (target.y || 0) + dy,
    }));
  };

  const scaleSelectedBox = (factor) => {
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

  const spanSelectedBoxAcrossTwoSlides = () => {
    updateSelectedBox((target) => {
      const nextWidth = singleW * 2;
      const nextHeight = singleH;
      const rotation = target.rotation || 0;
      const currentHeight = target.height || target.fontSize * 1.6 || nextHeight;
      const center = getRotatedGeometry(
        target.x || 0,
        target.y || 0,
        target.width || nextWidth,
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
    });
  };

  const applyPinchToSelectedSlot = (ratio, angleDelta) => {
    const start = gestureRef.current.pinchStartObject;
    const targetId = gestureRef.current.pinchTargetId;
    if (!start || !targetId) return;

    const node = selectableNodesRef.current.get(`slot:${targetId}`);
    if (!node) return;
    node.scale({ x: ratio, y: ratio });
    node.rotation(normalizeRotation(start.rotation + angleDelta));
    node.getLayer()?.batchDraw();
  };

  const applyPinchToSelectedObject = (ratio, angleDelta) => {
    if (selectedItem && (selectedItem.type === "image" || selectedItem.type === "sticker")) {
      const start = gestureRef.current.pinchStartObject;
      if (!start) return;

      const node = selectableNodesRef.current.get(`element:${selectedItem.id}`);
      if (!node) return;
      node.scale({ x: ratio, y: ratio });
      node.rotation(normalizeRotation(start.rotation + angleDelta));
      node.getLayer()?.batchDraw();
    }
  };

  const canPinchSelectedObject =
    !!selectedSlot || !!(selectedItem && (selectedItem.type === "image" || selectedItem.type === "sticker"));


  const addImageToCanvas = (img) => {
    pushHistory();

    if (selectedSlotId) {
      setTemplateSlots((prev) =>
        prev.map((slot) =>
          slot.id === selectedSlotId
            ? {
                ...slot,
                imageSrc: img.src,
                imageName: img.name,
                imageOffsetX: 0,
                imageOffsetY: 0,
                imageZoom: 1,
              }
            : slot
        )
      );
      if (isMobile) setMobileDrawerOpen(false);
      return;
    }

    const maxH = canvasH * 0.72;
    const ratio = img.width / img.height || 1;
    const targetH = maxH;
    const targetW = targetH * ratio;

    const item = {
      id: uid("img"),
      type: "image",
      src: img.src,
      x: Math.max(20, canvasW / 2 - targetW / 2),
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
    if (isMobile) setMobileDrawerOpen(false);
  };

  const onUploadFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    const next = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const img = new window.Image();
              img.onload = () => {
                resolve({
                  id: uid("asset"),
                  name: file.name,
                  src: reader.result,
                  width: img.width,
                  height: img.height,
                  mediaType: "image",
                });
              };
              img.onerror = () => resolve(null);
              img.src = reader.result;
            };
            reader.readAsDataURL(file);
          })
      )
    );
    setImages((prev) => [...next.filter(Boolean), ...prev]);
    e.target.value = "";
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
      setTemplateSlots((prev) => prev.filter((slot) => slot.id !== selectedSlotId));
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

    const nextSlots = [];
    const nextManagedElements = [];

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
        fill: "#ffffff",
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
          fill: "#ffffff",
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
          fill: "#d1d5db",
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
        fill: "#ffffff",
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
          fill: "#ffffff",
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
          fill: "#d1d5db",
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
        fill: "#ffffff",
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
        fill: "#ffffff",
        align: "left",
        opacity: 1,
        isTemplateManaged: true,
      });
    }

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

  const exportSlices = async (pixelRatio = 1) => {
    setIsExporting(true);
    const previousSelected = selectedId;
    const previousSelectedSlot = selectedSlotId;
    setSelectedId(null);
    setSelectedSlotId(null);

    await new Promise((r) => setTimeout(r, 50));

    const stage = stageRef.current;
    if (!stage) {
      setIsExporting(false);
      return [];
    }

    const list = [];
    for (let i = 0; i < slides; i++) {
      const dataUrl = stage.toDataURL({
        x: i * singleW,
        y: 0,
        width: singleW,
        height: singleH,
        pixelRatio,
      });
      list.push(dataUrl);
    }

    setIsExporting(false);
    setSelectedId(previousSelected);
    setSelectedSlotId(previousSelectedSlot);
    return list;
  };

  const exportSlice = async (index, pixelRatio = 1) => {
    setIsExporting(true);
    const previousSelected = selectedId;
    const previousSelectedSlot = selectedSlotId;
    setSelectedId(null);
    setSelectedSlotId(null);

    await new Promise((r) => setTimeout(r, 50));

    const stage = stageRef.current;
    if (!stage) {
      setIsExporting(false);
      setSelectedId(previousSelected);
      setSelectedSlotId(previousSelectedSlot);
      return null;
    }

    const dataUrl = stage.toDataURL({
      x: index * singleW,
      y: 0,
      width: singleW,
      height: singleH,
      pixelRatio,
    });

    setIsExporting(false);
    setSelectedId(previousSelected);
    setSelectedSlotId(previousSelectedSlot);
    return dataUrl;
  };

  const refreshPreviews = async ({ reveal = false } = {}) => {
    const data = await exportSlices(isMobile ? 0.32 : 0.45);
    setPreviews(data);
    if (reveal) setPreviewExpandSignal((value) => value + 1);
  };

  useEffect(() => {
    if (isMobile) return;
    if (isInteractingRef.current) return;

    const timer = setTimeout(() => {
      refreshPreviews();
    }, 500);

    return () => clearTimeout(timer);
  }, [
    elements,
    templateSlots,
    layerOrder,
    slides,
    ratioKey,
    bgPrimary,
    bgSecondary,
    backgroundMode,
    isInteracting,
    isMobile,
  ]);

  const downloadDataUrl = (dataUrl, filename) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
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
    const stage = stageRef.current;
    if (!stage) return;
    const data = await exportSlices();
    data.forEach((src, idx) => {
      setTimeout(() => {
        downloadDataUrl(src, `carousel_${String(idx + 1).padStart(2, "0")}.png`);
      }, idx * 140);
    });
  };

  const exportProject = () => {
    const data = {
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
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, "scrl-lite-project.json");
    URL.revokeObjectURL(url);
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
        setImages(data.images || []);
        setElements(data.elements || []);
        setTemplateSlots(data.templateSlots || []);
        setLayerOrder(normalizeLayerOrder(data.layerOrder, data.elements || [], data.templateSlots || []));
        setTemplateId(data.templateId || "blank");
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

      gestureRef.current.pinchStartDistance = distance;
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

      // 規則：
      // 1) 有選取物件時，完全禁止 viewport pinch
      // 2) 只有雙指都命中被選物件，才允許 object pinch
      // 3) 否則直接 blocked，什麼都不做
      if (hasSelectedTarget) {
        pushHistory();
        gestureRef.current.pinchMode = "object";

        if (selectedSlot) {
          gestureRef.current.pinchTargetType = "slot";
          gestureRef.current.pinchTargetId = selectedSlot.id;
          gestureRef.current.pinchStartObject = {
            width: selectedSlot.width,
            height: selectedSlot.height,
            rotation: selectedSlot.rotation || 0,
          };
          gestureRef.current.pinchCenter = midpoint;
          return;
        }

        if (selectedItem && (selectedItem.type === "image" || selectedItem.type === "sticker")) {
          gestureRef.current.pinchTargetType = "item";
          gestureRef.current.pinchTargetId = selectedItem.id;
          gestureRef.current.pinchStartObject = {
            width: selectedItem.width,
            height: selectedItem.height,
            rotation: selectedItem.rotation || 0,
          };
          return;
        }

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

        if (gestureRef.current.pinchMode === "object") {
          if (gestureRef.current.pinchTargetType === "slot") {
            applyPinchToSelectedSlot(ratio, angleDelta);
            return;
          }

          if (gestureRef.current.pinchTargetType === "item") {
            applyPinchToSelectedObject(ratio, angleDelta);
            return;
          }
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
    if (gestureRef.current.pinchMode === "object") {
      const start = gestureRef.current.pinchStartObject;
      const ratio = gestureRef.current.pinchLastRatio || 1;
      const angleDelta = gestureRef.current.pinchLastAngleDelta || 0;

      if (selectedSlot) {
        const node = selectableNodesRef.current.get(`slot:${selectedSlot.id}`);
        node?.scale({ x: 1, y: 1 });
        updateSlot({
          ...selectedSlot,
          width: Math.max(80, (start?.width || selectedSlot.width) * ratio),
          height: Math.max(80, (start?.height || selectedSlot.height) * ratio),
          rotation: snapRotationAngle(normalizeRotation((start?.rotation || 0) + angleDelta)),
        });
      } else if (selectedItem && (selectedItem.type === "image" || selectedItem.type === "sticker")) {
        const node = selectableNodesRef.current.get(`element:${selectedItem.id}`);
        node?.scale({ x: 1, y: 1 });
        updateElement({
          ...selectedItem,
          width: Math.max(40, (start?.width || selectedItem.width) * ratio),
          height: Math.max(40, (start?.height || selectedItem.height) * ratio),
          rotation: snapRotationAngle(normalizeRotation((start?.rotation || 0) + angleDelta)),
        });
      }
    }

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

    if (next.count !== undefined) setSlides(next.count);
    if (next.ratio !== undefined) setRatioKey(next.ratio);
    if (next.backgroundMode !== undefined) setBackgroundMode(next.backgroundMode);
    if (next.backgroundColor !== undefined) setBgPrimary(next.backgroundColor);
    if (next.backgroundColor2 !== undefined) setBgSecondary(next.backgroundColor2);
  };

  const projectPanelTemplates = TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: "",
  }));

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
  const handleExportJson = () => exportProject();
  const handleImportJson = () => importRef.current?.click();
  const handleTemplateSelect = (id) => applyTemplate(id);

  const mobileSelectedActions = {
    hasSelection: !!selectedItem || !!selectedSlot,
    canReorder: !!selectedItem || !!selectedSlot,
    onScaleDown: () => scaleSelectedBox(0.92),
    onScaleUp: () => scaleSelectedBox(1.08),
    onNudgeUp: () => nudgeSelectedBox(0, -8),
    onNudgeDown: () => nudgeSelectedBox(0, 8),
    onNudgeLeft: () => nudgeSelectedBox(-8, 0),
    onNudgeRight: () => nudgeSelectedBox(8, 0),
    onFit45: () => setSelectedBoxAspect(4, 5),
    onSpanTwoSlides: spanSelectedBoxAcrossTwoSlides,
    onRotate90: rotateSelectedBox90,
    onUndo: undo,
    onRedo: redo,
    canUndo: historyPast.length > 0,
    canRedo: historyFuture.length > 0,
    onBringForward: selectedSlot ? bringForwardSlot : bringForward,
    onSendBackward: selectedSlot ? sendBackwardSlot : sendBackward,
    onDuplicate: duplicateSelected,
    onRemove: removeSelected,
  };
  const handleAddAssetToCanvas = (asset) => addImageToCanvas(asset);
  const handleAddStickerToCanvas = (sticker) => addSticker(sticker.stickerType || sticker.type);

  const projectPanelProps = {
    project: projectPanelProject,
    setProject: setProjectPanelProject,
    onUploadImages: handleUploadImages,
    onAddText: handleAddText,
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
    previews: previews.map((src, idx) => ({
      id: `preview-${idx + 1}`,
      src,
    })),
    onDownloadOne: async (preview, index) => {
      const filename = `carousel_${String(index + 1).padStart(2, "0")}.png`;
      const fullSizeSrc = await exportSlice(index);
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
          const fullSizeSrc = await exportSlice(index);
          if (fullSizeSrc) shareDataUrlToIOS(fullSizeSrc, filename);
        }
      : null,
    onDownloadAll: downloadAll,
    isBusy: isExporting,
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
  };

  return (
    <div className="app-shell">
      {!isMobile && (
        <aside className="sidebar left">
          <ProjectPanelUI {...projectPanelProps} />
        </aside>
      )}

      <main className="main">
        <div className="canvas-panel">
          <div className="canvas-toolbar">
            <div>
              <strong>SCRL Lite</strong>
              <span className="sub">
                手機：選到圖片 / 貼紙 / 圖框後，雙指 pinch 會縮放物件；空白處雙指 pinch 才縮放畫布
              </span>
            </div>

            <div className="toolbar-actions">
              {!isMobile && (
                <>
                  <button className="ghost" onClick={undo}>上一步</button>
                  <button className="ghost" onClick={redo}>下一步</button>
                  <button type="button" className="ghost danger" onClick={removeSelected}>刪除選取</button>
                  <button type="button" className="ghost" onClick={clearSavedDraft}>清除草稿</button>
                  <button type="button" onClick={() => refreshPreviews({ reveal: true })}>更新預覽</button>
                </>
              )}

              {isMobile && (
                <>
                  <button className="ghost" onClick={undo}>上一步</button>
                  <button className="ghost" onClick={redo}>下一步</button>
                  <button type="button" className="ghost" onClick={clearSelection}>取消</button>
                  <button type="button" className="ghost danger" onClick={removeSelected}>刪除</button>
                  <button type="button" className="ghost" onClick={clearSavedDraft}>清稿</button>
                  <button onClick={() => {
                    refreshPreviews({ reveal: true });
                    setMobileTab("preview");
                    setMobileDrawerOpen(true);
                  }}>
                    預覽
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
            {(selectedItem || selectedSlot) && (
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
                              isSelected={slot.id === selectedSlotId}
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
	                              isSelected={item.id === selectedId}
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
                            />
                          );
                        }

                        if (item.type === "text") {
                          return (
                            <DraggableText
                              key={item.id}
                              item={item}
	                              isSelected={item.id === selectedId}
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
                            />
                          );
                        }

                        if (item.type === "sticker") {
                          return (
                            <StickerShape
                              key={item.id}
                              item={item}
	                              isSelected={item.id === selectedId}
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
                            />
                          );
                        }

                        return null;
                      })}

                      {!isExporting &&
                        showGuides &&
                        Array.from({ length: slides - 1 }).map((_, i) => (
                          <Line
                            key={`slice-${i}`}
                            points={[(i + 1) * singleW, 0, (i + 1) * singleW, canvasH]}
                            stroke={hexToRgba("#6ba4ff", 0.9)}
                            dash={[18, 14]}
                            strokeWidth={3}
                          />
                        ))}

                      {!isMobile && !isExporting && showGuides && (
                        <>
                          {activeGuides.vertical.map((x, idx) => (
                            <React.Fragment key={`gv-${idx}`}>
                              <Line
                                points={[x, 0, x, canvasH]}
                                stroke={hexToRgba("#35f2a1", 0.22)}
                                strokeWidth={10}
                              />
                              <Line
                                points={[x, 0, x, canvasH]}
                                stroke={hexToRgba("#35f2a1", 0.98)}
                                dash={[14, 8]}
                                strokeWidth={3}
                              />
                            </React.Fragment>
                          ))}
                          {activeGuides.horizontal.map((y, idx) => (
                            <React.Fragment key={`gh-${idx}`}>
                              <Line
                                points={[0, y, canvasW, y]}
                                stroke={hexToRgba("#35f2a1", 0.22)}
                                strokeWidth={10}
                              />
                              <Line
                                points={[0, y, canvasW, y]}
                                stroke={hexToRgba("#35f2a1", 0.98)}
                                dash={[14, 8]}
                                strokeWidth={3}
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
              if (tab === "preview") refreshPreviews({ reveal: true });
              setMobileTab(tab);
              setMobileDrawerOpen(true);
            }}
            zoomPercent={Math.round((userZoom || 1) * 100)}
            hidden={mobileDrawerOpen}
            selectedActions={mobileSelectedActions}
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
