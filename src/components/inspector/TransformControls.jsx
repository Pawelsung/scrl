import React from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Columns2, Crop, Minus, Plus, RotateCw } from "lucide-react";
import { IconButton } from "../ui/IconButton";

// Position, size and quick-layout buttons. For a filled frame these move the
// photo inside the frame instead of the frame itself.
export function NudgePad({ actions, compact = false }) {
  const crop = actions.isCropSlot;
  return (
    <div className={`nudge-pad ${compact ? "nudge-pad--compact" : ""}`}>
      <IconButton icon={Minus} label={crop ? "照片縮小" : "縮小"} onClick={crop ? actions.onCropZoomOut : actions.onScaleDown} />
      <IconButton icon={ArrowLeft} label="往左" onClick={crop ? actions.onCropLeft : actions.onNudgeLeft} />
      <IconButton icon={ArrowUp} label="往上" onClick={crop ? actions.onCropUp : actions.onNudgeUp} />
      <IconButton icon={ArrowDown} label="往下" onClick={crop ? actions.onCropDown : actions.onNudgeDown} />
      <IconButton icon={ArrowRight} label="往右" onClick={crop ? actions.onCropRight : actions.onNudgeRight} />
      <IconButton icon={Plus} label={crop ? "照片放大" : "放大"} onClick={crop ? actions.onCropZoomIn : actions.onScaleUp} />
    </div>
  );
}

export function QuickLayoutActions({ actions }) {
  return (
    <div className="quick-actions">
      <IconButton icon={RotateCw} label={actions.rotateLabel} showLabel onClick={actions.onRotate90} />
      <IconButton icon={Crop} label={actions.fitLabel} showLabel onClick={actions.onFit45} />
      <IconButton icon={Columns2} label={actions.spanLabel} showLabel onClick={actions.onSpanTwoSlides} />
    </div>
  );
}
