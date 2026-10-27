import React, { useEffect, useRef } from "react";
import { Rect, Group, Line } from "react-konva";
import { clampDraggedPositionForRotatedBox, getSnapResultForRotatedBox, hexToRgba, normalizeRotation } from "../../lib/editorUtils.js";

export function StickerShape({
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
