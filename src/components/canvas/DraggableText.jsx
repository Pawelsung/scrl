import React, { useEffect, useRef } from "react";
import { Rect, Text } from "react-konva";
import { clampDraggedPositionForRotatedBox, getSnapResultForRotatedBox, normalizeRotation } from "../../lib/editorUtils.js";

export function DraggableText({
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
