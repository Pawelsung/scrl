import React, { useEffect, useRef } from "react";
import { Transformer } from "react-konva";
import { ROTATION_SNAPS } from "../../lib/pinchTransform.js";

export function SelectionTransformer({
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
