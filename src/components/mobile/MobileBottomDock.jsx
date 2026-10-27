import React from "react";
import MobileBottomBar from "./MobileBottomBar";
import BottomAssetTray from "./BottomAssetTray";

export default function MobileBottomDock({
  images = [],
  selectedSlot,
  onPickImage,
  activeTab,
  onTabChange,
  zoomPercent,
  hidden = false,
  selectionLabel,
  actions,
  onOpenDetails,
  onClearSelection,
}) {
  if (hidden) return null;

  return (
    <div className="mobile-bottom-dock">
      {selectionLabel ? (
        <div className="mobile-photo-controls" role="region" aria-label="浮動照片編輯">
        <div className="mobile-selection-summary">
          <span>已選取 · {selectionLabel}</span>
          <button type="button" className="ghost" onClick={onOpenDetails}>更多</button>
          <button type="button" className="ghost" onClick={onClearSelection}>完成</button>
        </div>
        <div className="mobile-photo-controls__buttons">
          <button type="button" aria-label="縮小照片" onClick={actions?.isCropSlot ? actions.onCropZoomOut : actions?.onScaleDown}>−</button>
          <button type="button" aria-label="照片向左" onClick={actions?.isCropSlot ? actions.onCropLeft : actions?.onNudgeLeft}>←</button>
          <button type="button" aria-label="照片向上" onClick={actions?.isCropSlot ? actions.onCropUp : actions?.onNudgeUp}>↑</button>
          <button type="button" aria-label="照片向下" onClick={actions?.isCropSlot ? actions.onCropDown : actions?.onNudgeDown}>↓</button>
          <button type="button" aria-label="照片向右" onClick={actions?.isCropSlot ? actions.onCropRight : actions?.onNudgeRight}>→</button>
          <button type="button" aria-label="放大照片" onClick={actions?.isCropSlot ? actions.onCropZoomIn : actions?.onScaleUp}>＋</button>
        </div>
        <div className="mobile-photo-controls__hint">雙指可同時縮放、移動與旋轉照片</div>
        </div>
      ) : <BottomAssetTray
        images={images}
        selectedSlot={selectedSlot}
        onPickImage={onPickImage}
        persistent={true}
        compact={true}
      />}

      <MobileBottomBar
        activeTab={activeTab}
        onTabChange={onTabChange}
        zoomPercent={zoomPercent}
      />
    </div>
  );
}
