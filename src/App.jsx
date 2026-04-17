import React, { useEffect, useMemo, useRef, useState } from "react";
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

  const minLeft = -EDGE_OVERDRAG;
  const maxRight = canvasW + EDGE_OVERDRAG;
  const minTop = -EDGE_OVERDRAG;
  const maxBottom = canvasH + EDGE_OVERDRAG;

  if (geo.left < minLeft) {
    nextX += minLeft - geo.left;
  }
  if (geo.right > maxRight) {
    nextX -= geo.right - maxRight;
  }
  if (geo.top < minTop) {
    nextY += minTop - geo.top;
  }
  if (geo.bottom > maxBottom) {
    nextY -= geo.bottom - maxBottom;
  }

  return { x: nextX, y: nextY };
}

function getShortestAngleDelta(current, start) {
  let delta = current - start;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
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
}) {
  const image = useImage(item.src);
  const shapeRef = useRef(null);
  const trRef = useRef(null);
  const rafRef = useRef(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    if (editing && isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, editing, keepRatioOnTransform, centeredScaling]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const scheduleChange = (next) => {
    pendingRef.current = next;
    if (rafRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingRef.current) onChange(pendingRef.current);
    });
  };

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

                scheduleChange({
                  ...item,
                  x: nextPos.x,
                  y: nextPos.y,
                  rotation: normalizeRotation(node.rotation()),
                  snapV: snapped.vertical,
                  snapH: snapped.horizontal,
                });
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
      {editing && isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio={keepRatioOnTransform}
          centeredScaling={centeredScaling}
          shiftBehavior="default"
          rotationSnaps={ROTATION_SNAPS}
          rotationSnapTolerance={6}
          anchorSize={transformerAnchorSize}
          borderStroke="#7db2ff"
          anchorStroke="#7db2ff"
          anchorFill="#0b0f17"
          enabledAnchors={[
            "top-left",
            "top-center",
            "top-right",
            "middle-left",
            "middle-right",
            "bottom-left",
            "bottom-center",
            "bottom-right",
          ]}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 40 || newBox.height < 40) return oldBox;
            return newBox;
          }}
        />
      )}
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
}) {
  const textRef = useRef(null);
  const trRef = useRef(null);
  const rafRef = useRef(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    if (editing && isSelected && trRef.current && textRef.current) {
      trRef.current.nodes([textRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, editing]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const scheduleChange = (next) => {
    pendingRef.current = next;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingRef.current) onChange(pendingRef.current);
    });
  };

  return (
    <>
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

                scheduleChange({
                  ...item,
                  x: nextPos.x,
                  y: nextPos.y,
                  rotation: normalizeRotation(node.rotation()),
                  snapV: snapped.vertical,
                  snapH: snapped.horizontal,
                });
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
      {editing && isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          rotationSnaps={ROTATION_SNAPS}
          rotationSnapTolerance={6}
          anchorSize={transformerAnchorSize}
          borderStroke="#7db2ff"
          anchorStroke="#7db2ff"
          anchorFill="#0b0f17"
          enabledAnchors={["middle-left", "middle-right"]}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 120) return oldBox;
            return newBox;
          }}
        />
      )}
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
}) {
  const groupRef = useRef(null);
  const trRef = useRef(null);
  const rafRef = useRef(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    if (editing && isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, editing, centeredScaling]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const scheduleChange = (next) => {
    pendingRef.current = next;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingRef.current) onChange(pendingRef.current);
    });
  };

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

                scheduleChange({
                  ...item,
                  x: nextPos.x,
                  y: nextPos.y,
                  rotation: normalizeRotation(node.rotation()),
                  snapV: snapped.vertical,
                  snapH: snapped.horizontal,
                });
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
      </Group>
      {editing && isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio={false}
          centeredScaling={centeredScaling}
          rotationSnaps={ROTATION_SNAPS}
          rotationSnapTolerance={6}
          anchorSize={transformerAnchorSize}
          borderStroke="#7db2ff"
          anchorStroke="#7db2ff"
          anchorFill="#0b0f17"
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
        />
      )}
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
}) {
  const groupRef = useRef(null);
  const trRef = useRef(null);
  const image = useImage(slot.imageSrc);
  const rafRef = useRef(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    if (editing && isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [editing, isSelected]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const scheduleChange = (next) => {
    pendingRef.current = next;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingRef.current) onChange(pendingRef.current);
    });
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={slot.x}
        y={slot.y}
        rotation={slot.rotation || 0}
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

                scheduleChange({
                  ...slot,
                  x: nextPos.x,
                  y: nextPos.y,
                  rotation: normalizeRotation(node.rotation()),
                  snapV: snapped.vertical,
                  snapH: snapped.horizontal,
                });
              }
            : undefined
        }
        onDragEnd={
          editing
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
          editing
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

        {!slot.imageSrc && (
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

        <Rect
          width={slot.width}
          height={slot.height}
          cornerRadius={slot.radius || 0}
          stroke={isSelected ? "#7db2ff" : slot.stroke || "#ffffff"}
          strokeWidth={isSelected ? Math.max(3, (slot.strokeWidth || 4) + 1) : slot.strokeWidth || 4}
        />
      </Group>

      {editing && isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio={false}
          rotationSnaps={ROTATION_SNAPS}
          rotationSnapTolerance={6}
          anchorSize={transformerAnchorSize}
          borderStroke="#7db2ff"
          anchorStroke="#7db2ff"
          anchorFill="#0b0f17"
          enabledAnchors={[
            "top-left",
            "top-center",
            "top-right",
            "middle-left",
            "middle-right",
            "bottom-left",
            "bottom-center",
            "bottom-right",
          ]}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 80 || newBox.height < 80) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
}

function DesktopProjectPanel({
  slides,
  setSlides,
  ratioKey,
  setRatioKey,
  fileRef,
  addText,
  exportProject,
  importRef,
}) {
  return (
    <div className="panel">
      <h2>專案</h2>

      <label className="field">
        <span>輪播張數</span>
        <input
          type="range"
          min="2"
          max="10"
          value={slides}
          onChange={(e) => setSlides(Number(e.target.value))}
        />
        <strong>{slides} 張</strong>
      </label>

      <label className="field">
        <span>比例</span>
        <select value={ratioKey} onChange={(e) => setRatioKey(e.target.value)}>
          {Object.keys(RATIOS).map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
      </label>

      <div className="button-row">
        <button onClick={() => fileRef.current?.click()}>上傳圖片</button>
        <button className="ghost" onClick={addText}>
          新增文字
        </button>
      </div>

      <div className="button-row">
        <button className="ghost" onClick={exportProject}>
          匯出 JSON
        </button>
        <button className="ghost" onClick={() => importRef.current?.click()}>
          匯入 JSON
        </button>
      </div>
    </div>
  );
}

function DesktopAssetsPanel({ images, addImageToCanvas }) {
  return (
    <div className="panel">
      <h2>素材</h2>
      <div className="asset-grid">
        {images.length === 0 && <div className="hint-card">先上傳圖片，再點縮圖加入畫布。</div>}
        {images.map((img) => (
          <button
            key={img.id}
            className="asset-btn"
            onClick={() => addImageToCanvas(img)}
            title={img.name}
          >
            <img src={img.src} alt={img.name} />
          </button>
        ))}
      </div>
    </div>
  );
}

function DesktopStickerPanel({ addSticker }) {
  return (
    <div className="panel">
      <h2>貼紙</h2>
      <div className="template-grid compact">
        {STICKERS.map((st) => (
          <button key={st.id} className="template-btn" onClick={() => addSticker(st.type)}>
            {st.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DesktopBackgroundPanel({
  backgroundMode,
  setBackgroundMode,
  bgPrimary,
  setBgPrimary,
  bgSecondary,
  setBgSecondary,
}) {
  return (
    <div className="panel">
      <h2>背景</h2>
      <label className="field">
        <span>模式</span>
        <select value={backgroundMode} onChange={(e) => setBackgroundMode(e.target.value)}>
          <option value="solid">純色</option>
          <option value="gradient">漸層</option>
        </select>
      </label>

      <div className="color-row">
        <label>
          主色
          <input type="color" value={bgPrimary} onChange={(e) => setBgPrimary(e.target.value)} />
        </label>
        <label>
          副色
          <input type="color" value={bgSecondary} onChange={(e) => setBgSecondary(e.target.value)} />
        </label>
      </div>
    </div>
  );
}

function DesktopTemplatePanel({ templateId, applyTemplate }) {
  return (
    <div className="panel">
      <h2>模板</h2>
      <div className="template-grid">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            className={`template-btn ${templateId === t.id ? "active" : ""}`}
            onClick={() => applyTemplate(t.id)}
          >
            {t.name}
          </button>
        ))}
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
    return <div className="hint-card">點一下畫布中的圖片、文字、貼紙或模板圖框。</div>;
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
}) {
  return (
    <div className="panel">
      <h2>選取物件</h2>
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

function PreviewPanel({ previews, downloadDataUrl, downloadAll, shareDataUrlToIOS }) {
  return (
    <div className="preview-panel">
      <div className="preview-head">
        <h2>切圖預覽</h2>
        <p>先檢查每張接縫，再手動上傳到 IG。</p>
      </div>

      <div className="preview-grid">
        {previews.length === 0 && <div className="hint-card">目前還沒有預覽圖。</div>}

        {previews.map((src, idx) => (
          <div key={idx} className="preview-card">
            <img src={src} alt={`preview-${idx + 1}`} />
            <div className="preview-actions">
              <button
                onClick={() =>
                  downloadDataUrl(src, `carousel_${String(idx + 1).padStart(2, "0")}.png`)
                }
              >
                下載 #{idx + 1}
              </button>

              <button
                className="ghost"
                onClick={() =>
                  shareDataUrlToIOS(src, `carousel_${String(idx + 1).padStart(2, "0")}.png`)
                }
              >
                分享 / 存到相簿
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="download-all-row">
        <button onClick={downloadAll}>全部下載</button>
      </div>
    </div>
  );
}

function MobileQuickBar({
  selectedItem,
  selectedSlot,
  onDuplicate,
  onBringForward,
  onSendBackward,
  onDelete,
  onOpenAssets,
  onOpenInspector,
  onSlotNudge,
  onSlotZoom,
  onSlotClear,
}) {
  if (!selectedItem && !selectedSlot) return null;

  if (selectedSlot) {
    return (
      <div className="mobile-quick-bar">
        <div className="mobile-selection-chip">已選取：模板圖框</div>
        <div className="mobile-slot-actions-grid">
          <button onClick={onOpenAssets}>填圖</button>
          <button className="ghost" onClick={onSlotClear}>清空</button>
          <button className="ghost" onClick={() => onSlotZoom(1)}>放大</button>
          <button className="ghost" onClick={() => onSlotZoom(-1)}>縮小</button>
          <button className="ghost" onClick={() => onSlotNudge(0, -1)}>上移</button>
          <button className="ghost" onClick={() => onSlotNudge(0, 1)}>下移</button>
          <button className="ghost" onClick={() => onSlotNudge(-1, 0)}>左移</button>
          <button className="ghost" onClick={() => onSlotNudge(1, 0)}>右移</button>
          <button className="ghost" onClick={onOpenInspector}>進階</button>
          <button className="danger" onClick={onDelete}>刪除圖框</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-quick-bar">
      <div className="mobile-selection-chip">
        已選取：{getSelectedTypeLabel(selectedItem, null)}
      </div>
      <div className="mobile-quick-actions">
        <button className="ghost" onClick={onSendBackward}>下移</button>
        <button className="ghost" onClick={onBringForward}>上移</button>
        <button className="ghost" onClick={onDuplicate}>複製</button>
        <button className="ghost" onClick={onOpenInspector}>進階</button>
        <button className="danger" onClick={onDelete}>刪除</button>
      </div>
    </div>
  );
}

function MobileDrawer({
  panel,
  open,
  onClose,
  images,
  addImageToCanvas,
  slides,
  setSlides,
  ratioKey,
  setRatioKey,
  fileRef,
  addText,
  exportProject,
  importRef,
  backgroundMode,
  setBackgroundMode,
  bgPrimary,
  setBgPrimary,
  bgSecondary,
  setBgSecondary,
  templateId,
  applyTemplate,
  selectedItem,
  selectedSlot,
  updateElement,
  updateSlot,
  showGuides,
  setShowGuides,
  previews,
  downloadDataUrl,
  downloadAll,
  addSticker,
  shareDataUrlToIOS,
}) {
  return (
    <>
      <div className={`mobile-drawer-backdrop ${open ? "show" : ""}`} onClick={onClose} />
      <div className={`mobile-drawer ${open ? "show" : ""}`}>
        <div className="mobile-drawer-handle" />
        <div className="mobile-drawer-head">
          <strong>
            {panel === "assets" && "素材"}
            {panel === "style" && "樣式 / 模板 / 專案"}
            {panel === "inspector" && "進階設定"}
            {panel === "preview" && "預覽與下載"}
          </strong>
          <button className="ghost mobile-close-btn" onClick={onClose}>
            關閉
          </button>
        </div>

        <div className="mobile-drawer-body">
          {panel === "assets" && (
            <>
              <div className="panel in-drawer">
                <h2>素材</h2>
                <div className="button-row">
                  <button onClick={() => fileRef.current?.click()}>上傳圖片</button>
                  <button className="ghost" onClick={addText}>
                    新增文字
                  </button>
                </div>
              </div>

              <div className="panel in-drawer">
                <h2>素材庫</h2>
                <div className="asset-grid">
                  {images.length === 0 && <div className="hint-card">先上傳圖片，再點縮圖加入畫布。</div>}
                  {images.map((img) => (
                    <button
                      key={img.id}
                      className="asset-btn"
                      onClick={() => addImageToCanvas(img)}
                      title={img.name}
                    >
                      <img src={img.src} alt={img.name} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="panel in-drawer">
                <h2>貼紙</h2>
                <div className="template-grid compact">
                  {STICKERS.map((st) => (
                    <button key={st.id} className="template-btn" onClick={() => addSticker(st.type)}>
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {panel === "style" && (
            <>
              <div className="panel in-drawer">
                <h2>背景</h2>

                <label className="field">
                  <span>模式</span>
                  <select value={backgroundMode} onChange={(e) => setBackgroundMode(e.target.value)}>
                    <option value="solid">純色</option>
                    <option value="gradient">漸層</option>
                  </select>
                </label>

                <div className="color-row">
                  <label>
                    主色
                    <input
                      type="color"
                      value={bgPrimary}
                      onChange={(e) => setBgPrimary(e.target.value)}
                    />
                  </label>
                  <label>
                    副色
                    <input
                      type="color"
                      value={bgSecondary}
                      onChange={(e) => setBgSecondary(e.target.value)}
                    />
                  </label>
                </div>
              </div>

              <div className="panel in-drawer">
                <h2>模板</h2>
                <div className="template-grid">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      className={`template-btn ${templateId === t.id ? "active" : ""}`}
                      onClick={() => applyTemplate(t.id)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="panel in-drawer">
                <h2>專案</h2>
                <label className="field">
                  <span>輪播張數</span>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    value={slides}
                    onChange={(e) => setSlides(Number(e.target.value))}
                  />
                  <strong>{slides} 張</strong>
                </label>

                <label className="field">
                  <span>比例</span>
                  <select value={ratioKey} onChange={(e) => setRatioKey(e.target.value)}>
                    {Object.keys(RATIOS).map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="button-row">
                  <button className="ghost" onClick={exportProject}>
                    匯出 JSON
                  </button>
                  <button className="ghost" onClick={() => importRef.current?.click()}>
                    匯入 JSON
                  </button>
                </div>
              </div>
            </>
          )}

          {panel === "inspector" && (
            <div className="panel in-drawer">
              <h2>進階設定</h2>
              <InspectorContent
                selectedItem={selectedItem}
                selectedSlot={selectedSlot}
                updateElement={updateElement}
                updateSlot={updateSlot}
                setShowGuides={setShowGuides}
                showGuides={showGuides}
              />
            </div>
          )}

          {panel === "preview" && (
            <PreviewPanel
              previews={previews}
              downloadDataUrl={downloadDataUrl}
              downloadAll={downloadAll}
              shareDataUrlToIOS={shareDataUrlToIOS}
            />
          )}
        </div>
      </div>
    </>
  );
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

  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);
  const historyLockRef = useRef(false);

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );
  const [mobilePanel, setMobilePanel] = useState("assets");
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const fileRef = useRef(null);
  const importRef = useRef(null);

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
  });

  const singleW = RATIOS[ratioKey].w;
  const singleH = RATIOS[ratioKey].h;
  const canvasW = singleW * slides;
  const canvasH = singleH;

  const selectedItem = elements.find((el) => el.id === selectedId) || null;
  const selectedSlot = templateSlots.find((slot) => slot.id === selectedSlotId) || null;

  const captureSnapshot = () => ({
    slides,
    ratioKey,
    backgroundMode,
    bgPrimary,
    bgSecondary,
    images,
    elements,
    templateSlots,
    templateId,
  });

  const applySnapshot = (snap) => {
    setSlides(snap.slides);
    setRatioKey(snap.ratioKey);
    setBackgroundMode(snap.backgroundMode);
    setBgPrimary(snap.bgPrimary);
    setBgSecondary(snap.bgSecondary);
    setImages(snap.images);
    setElements(snap.elements);
    setTemplateSlots(snap.templateSlots);
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
    if (!isMobile && mobilePanelOpen) {
      setMobilePanelOpen(false);
    }
  }, [isMobile, mobilePanelOpen]);

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
    const usableW = Math.max(260, containerSize.w - pad);
    const usableH = Math.max(220, containerSize.h - pad);
    return Math.min(usableW / canvasW, usableH / canvasH, 1);
  }, [containerSize, canvasW, canvasH, isMobile]);

  const displayScale = fitScale * userZoom;

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
    setSelectedSlotId(null);
  };

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

  const applyPinchToSelectedObject = (ratio, angleDelta) => {
    if (selectedSlot) {
      const start = gestureRef.current.pinchStartObject;
      if (!start) return;

      updateSlot({
        ...selectedSlot,
        imageZoom: clamp(start.imageZoom * ratio, 1, 3),
        rotation: normalizeRotation(start.rotation + angleDelta),
      });
      return;
    }

    if (selectedItem && (selectedItem.type === "image" || selectedItem.type === "sticker")) {
      const start = gestureRef.current.pinchStartObject;
      if (!start) return;

      updateElement({
        ...selectedItem,
        width: Math.max(40, start.width * ratio),
        height: Math.max(40, start.height * ratio),
        rotation: normalizeRotation(start.rotation + angleDelta),
      });
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
      if (isMobile) setMobilePanel("inspector");
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
    setSelectedId(item.id);
    setSelectedSlotId(null);
    if (isMobile) setMobilePanel("inspector");
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
                });
              };
              img.src = reader.result;
            };
            reader.readAsDataURL(file);
          })
      )
    );
    setImages((prev) => [...next, ...prev]);
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
    setSelectedId(item.id);
    setSelectedSlotId(null);

    if (isMobile) setMobilePanel("inspector");
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

    setElements((prev) => [...prev, item]);
    setSelectedId(item.id);
    setSelectedSlotId(null);
    if (isMobile) setMobilePanel("inspector");
  };

  const removeSelected = () => {
    pushHistory();

    if (selectedSlotId) {
      setTemplateSlots((prev) => prev.filter((slot) => slot.id !== selectedSlotId));
      setSelectedSlotId(null);
      return;
    }

    if (!selectedId) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };

  const bringForward = () => {
    if (!selectedId) return;
    pushHistory();
    setElements((prev) => {
      const idx = prev.findIndex((el) => el.id === selectedId);
      if (idx < 0 || idx === prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  };

  const sendBackward = () => {
    if (!selectedId) return;
    pushHistory();
    setElements((prev) => {
      const idx = prev.findIndex((el) => el.id === selectedId);
      if (idx <= 0) return prev;
      const arr = [...prev];
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

    setTemplateSlots(nextSlots);
    setElements((prev) => [
      ...prev.filter((el) => !el.isTemplateManaged),
      ...nextManagedElements,
    ]);
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

  const refreshPreviews = async () => {
    const data = await exportSlices(isMobile ? 0.32 : 0.45);
    setPreviews(data);
  };

  useEffect(() => {
    if (isInteracting) return;

    const timer = setTimeout(() => {
      refreshPreviews();
    }, 320);

    return () => clearTimeout(timer);
  }, [
    elements,
    templateSlots,
    slides,
    ratioKey,
    bgPrimary,
    bgSecondary,
    backgroundMode,
    isInteracting,
  ]);

  const downloadDataUrl = (dataUrl, filename) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const dataUrlToBlob = async (dataUrl) => {
  const res = await fetch(dataUrl);
  return await res.blob();
};

  const shareDataUrlToIOS = async (dataUrl, filename) => {
    try {
      const blob = await dataUrlToBlob(dataUrl);
      const file = new File([blob], filename, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: "匯出的 carousel 圖片",
        });
        return;
      }

      downloadDataUrl(dataUrl, filename);
    } catch (err) {
      console.error(err);
      downloadDataUrl(dataUrl, filename);
    }
  };

  const downloadAll = async () => {
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

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, selectedSlotId, selectedItem, historyPast, historyFuture]);

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
      return <Rect x={0} y={0} width={canvasW} height={canvasH} fill={bgPrimary} cornerRadius={40} />;
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

  const handleViewportPointerDown = (e) => {
    const target = e.target;
    const isStageWrap = target.classList?.contains("canvas-stage-wrap");
    const isPanBg = target.classList?.contains("stage-pan-layer");
    const isScaleBox = target.classList?.contains("stage-scale-box");

    if (!(isStageWrap || isPanBg || isScaleBox)) return;

    gestureRef.current.isPanning = true;
    gestureRef.current.startX = e.clientX;
    gestureRef.current.startY = e.clientY;
    gestureRef.current.startPanX = pan.x;
    gestureRef.current.startPanY = pan.y;
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
    setPan(next);
  };

  const handleViewportPointerUp = () => {
    gestureRef.current.isPanning = false;
  };

  const handleViewportTouchStart = (e) => {
    if (e.touches.length === 2) {
      const distance = getDistance(e.touches);
      const midpoint = getMidpoint(e.touches);
      const angle = getAngle(e.touches);

      gestureRef.current.pinchStartDistance = distance;
      gestureRef.current.pinchStartAngle = angle;
      gestureRef.current.pinchStartZoom = userZoom;
      gestureRef.current.pinchStartPan = { ...pan };
      gestureRef.current.pinchCenter = midpoint;
      gestureRef.current.isPanning = false;
      setIsInteracting(true);

      if (canPinchSelectedObject) {
        pushHistory();
        gestureRef.current.pinchMode = "object";

        if (selectedSlot) {
          gestureRef.current.pinchStartObject = {
            imageZoom: selectedSlot.imageZoom || 1,
            rotation: selectedSlot.rotation || 0,
          };
        } else if (selectedItem) {
          gestureRef.current.pinchStartObject = {
            width: selectedItem.width,
            height: selectedItem.height,
            rotation: selectedItem.rotation || 0,
          };
        }
      } else {
        gestureRef.current.pinchMode = "viewport";
        gestureRef.current.pinchStartObject = null;
      }
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

      gestureRef.current.isPanning = true;
      gestureRef.current.startX = e.touches[0].clientX;
      gestureRef.current.startY = e.touches[0].clientY;
      gestureRef.current.startPanX = pan.x;
      gestureRef.current.startPanY = pan.y;
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

      if (gestureRef.current.pinchMode === "object") {
        applyPinchToSelectedObject(ratio, angleDelta);
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
      setPan(next);
    }
  };

  const handleViewportTouchEnd = () => {
    gestureRef.current.isPanning = false;
    gestureRef.current.pinchMode = "viewport";
    gestureRef.current.pinchStartObject = null;
    setIsInteracting(false);
  };

  const transformerAnchorSize = useMemo(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return 46;
    return 24;
  }, []);

  const openMobilePanel = (panel) => {
    setMobilePanel(panel);
    setMobilePanelOpen(true);
  };

  const closeMobilePanel = () => {
    setMobilePanelOpen(false);
  };

  return (
    <div className="app-shell">
      {!isMobile && (
        <aside className="sidebar left">
          <DesktopProjectPanel
            slides={slides}
            setSlides={setSlides}
            ratioKey={ratioKey}
            setRatioKey={setRatioKey}
            fileRef={fileRef}
            addText={addText}
            exportProject={exportProject}
            importRef={importRef}
          />
          <DesktopAssetsPanel images={images} addImageToCanvas={addImageToCanvas} />
          <DesktopStickerPanel addSticker={addSticker} />
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
                  <button className="ghost danger" onClick={removeSelected}>刪除選取</button>
                  <button onClick={refreshPreviews}>更新預覽</button>
                </>
              )}

              {isMobile && (
                <>
                  <button className="ghost" onClick={undo}>上一步</button>
                  <button className="ghost" onClick={redo}>下一步</button>
                  <button className="ghost danger" onClick={removeSelected}>刪除</button>
                  <button onClick={() => openMobilePanel("preview")}>預覽</button>
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
            onTouchStart={handleViewportTouchStart}
            onTouchMove={handleViewportTouchMove}
            onTouchEnd={handleViewportTouchEnd}
            onTouchCancel={handleViewportTouchEnd}
            onDoubleClick={resetView}
          >
            {(selectedItem || selectedSlot) && (
              <div className="rotation-hud">
                {getSelectedTypeLabel(selectedItem, selectedSlot)} · {rotationDisplay}°
              </div>
            )}

            <div
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
                      const clickedOnEmpty = e.target === e.target.getStage();
                      if (clickedOnEmpty) clearSelection();
                    }}
                    onTouchStart={(e) => {
                      const clickedOnEmpty = e.target === e.target.getStage();
                      if (clickedOnEmpty) clearSelection();
                    }}
                    onWheel={onWheelScaleSelected}
                  >
                    <Layer>
                      {renderBackground()}

                      {drawable.map((item) => {
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
                              onInteractionChange={setIsInteracting}
                              pushHistory={pushHistory}
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
                              onInteractionChange={setIsInteracting}
                              pushHistory={pushHistory}
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
                              onInteractionChange={setIsInteracting}
                              pushHistory={pushHistory}
                            />
                          );
                        }

                        return null;
                      })}

                      {templateSlots.map((slot) => (
                        <TemplateSlot
                          key={slot.id}
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
                          onInteractionChange={setIsInteracting}
                          pushHistory={pushHistory}
                        />
                      ))}

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

                      {!isExporting && showGuides && (
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
                    </Layer>
                  </Stage>
                </div>
              </div>
            </div>
          </div>

          {isMobile && (
            <MobileQuickBar
              selectedItem={selectedItem}
              selectedSlot={selectedSlot}
              onDuplicate={duplicateSelected}
              onBringForward={bringForward}
              onSendBackward={sendBackward}
              onDelete={removeSelected}
              onOpenAssets={() => openMobilePanel("assets")}
              onOpenInspector={() => openMobilePanel("inspector")}
              onSlotNudge={nudgeSelectedSlot}
              onSlotZoom={zoomSelectedSlot}
              onSlotClear={() => {
                pushHistory();
                clearSelectedSlotImage();
              }}
            />
          )}

          <div className="mobile-bottom-bar">
            <button onClick={zoomOut}>－</button>
            <button onClick={zoomIn}>＋</button>
            <button onClick={fitToScreen}>Fit</button>
            <button onClick={zoom100}>100%</button>
            <div className="mobile-zoom-readout">{Math.round(displayScale * 100)}%</div>
          </div>

          {isMobile && (
            <div className="mobile-tabbar">
              <button
                className={mobilePanel === "assets" ? "active" : ""}
                onClick={() => openMobilePanel("assets")}
              >
                素材
              </button>
              <button
                className={mobilePanel === "style" ? "active" : ""}
                onClick={() => openMobilePanel("style")}
              >
                樣式
              </button>
              <button
                className={mobilePanel === "inspector" ? "active" : ""}
                onClick={() => openMobilePanel("inspector")}
              >
                物件
              </button>
              <button
                className={mobilePanel === "preview" ? "active" : ""}
                onClick={() => openMobilePanel("preview")}
              >
                預覽
              </button>
            </div>
          )}
        </div>

        {!isMobile && (
          <PreviewPanel
            previews={previews}
            downloadDataUrl={downloadDataUrl}
            downloadAll={downloadAll}
            shareDataUrlToIOS={shareDataUrlToIOS}
          />
        )}
      </main>

      {!isMobile && (
        <aside className="sidebar right">
          <DesktopBackgroundPanel
            backgroundMode={backgroundMode}
            setBackgroundMode={setBackgroundMode}
            bgPrimary={bgPrimary}
            setBgPrimary={setBgPrimary}
            bgSecondary={bgSecondary}
            setBgSecondary={setBgSecondary}
          />
          <DesktopTemplatePanel templateId={templateId} applyTemplate={applyTemplate} />
          <DesktopInspectorPanel
            selectedItem={selectedItem}
            selectedSlot={selectedSlot}
            updateElement={updateElement}
            updateSlot={updateSlot}
            setShowGuides={setShowGuides}
            showGuides={showGuides}
          />
        </aside>
      )}

      {isMobile && (
        <MobileDrawer
          panel={mobilePanel}
          open={mobilePanelOpen}
          onClose={closeMobilePanel}
          images={images}
          addImageToCanvas={addImageToCanvas}
          slides={slides}
          setSlides={setSlides}
          ratioKey={ratioKey}
          setRatioKey={setRatioKey}
          fileRef={fileRef}
          addText={addText}
          exportProject={exportProject}
          importRef={importRef}
          backgroundMode={backgroundMode}
          setBackgroundMode={setBackgroundMode}
          bgPrimary={bgPrimary}
          setBgPrimary={setBgPrimary}
          bgSecondary={bgSecondary}
          setBgSecondary={setBgSecondary}
          templateId={templateId}
          applyTemplate={applyTemplate}
          selectedItem={selectedItem}
          selectedSlot={selectedSlot}
          updateElement={updateElement}
          updateSlot={updateSlot}
          showGuides={showGuides}
          setShowGuides={setShowGuides}
          previews={previews}
          downloadDataUrl={downloadDataUrl}
          downloadAll={downloadAll}
          shareDataUrlToIOS={shareDataUrlToIOS}
          addSticker={addSticker}
        />
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onUploadFiles} />
      <input ref={importRef} type="file" accept="application/json" hidden onChange={importProject} />
    </div>
  );
}