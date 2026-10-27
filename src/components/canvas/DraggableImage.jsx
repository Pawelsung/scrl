import React, { useEffect, useRef } from "react";
import { Image as KonvaImage } from "react-konva";
import { useImage } from "../../hooks/useImage.js";
import { clampDraggedPositionForRotatedBox, getSnapResultForRotatedBox, normalizeRotation } from "../../lib/editorUtils.js";

export function DraggableImage({
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
