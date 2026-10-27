import React, { useEffect, useRef } from "react";
import { Rect, Text, Group, Image as KonvaImage } from "react-konva";
import { getSlotImageTransform } from "../../lib/slotImageTransform.js";
import { useImage } from "../../hooks/useImage.js";
import { clampDraggedPositionForRotatedBox, getSlotFrameStrokeWidth, getSnapResultForRotatedBox, normalizeRotation, roundedRectPath } from "../../lib/editorUtils.js";

export function TemplateSlot({
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
