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
  selectedActions,
  onClearSelection,
}) {
  if (hidden) return null;

  return (
    <div className="mobile-bottom-dock">
      {(selectedActions?.hasSelection || onClearSelection) && (
        <div className="mobile-dock-actions">
          {selectedActions?.isCropSlot && (
            <>
              <button type="button" className="ghost" onClick={selectedActions.onCropZoomOut}>
                圖-
              </button>
              <button type="button" className="ghost" onClick={selectedActions.onCropZoomIn}>
                圖+
              </button>
              <button type="button" className="ghost" onClick={selectedActions.onCropUp}>
                圖↑
              </button>
              <button type="button" className="ghost" onClick={selectedActions.onCropLeft}>
                圖←
              </button>
              <button type="button" className="ghost" onClick={selectedActions.onCropDown}>
                圖↓
              </button>
              <button type="button" className="ghost" onClick={selectedActions.onCropRight}>
                圖→
              </button>
            </>
          )}

          {selectedActions?.hasSelection && (
            <>
              <button type="button" className="ghost" onClick={selectedActions.onScaleDown}>
                -
              </button>
              <button type="button" className="ghost" onClick={selectedActions.onScaleUp}>
                +
              </button>
              <button type="button" className="ghost" onClick={selectedActions.onNudgeUp}>
                ↑
              </button>
              <button type="button" className="ghost" onClick={selectedActions.onNudgeLeft}>
                ←
              </button>
              <button type="button" className="ghost" onClick={selectedActions.onNudgeDown}>
                ↓
              </button>
              <button type="button" className="ghost" onClick={selectedActions.onNudgeRight}>
                →
              </button>
              <button type="button" className="ghost" onClick={selectedActions.onFit45}>
                4:5裁切
              </button>
              <button type="button" className="ghost" onClick={selectedActions.onSpanTwoSlides}>
                跨兩張
              </button>
              <button type="button" className="ghost" onClick={selectedActions.onRotate90}>
                旋轉90
              </button>
            </>
          )}

          {selectedActions?.hasSelection && selectedActions.canReorder && (
            <>
              <button type="button" className="ghost" onClick={selectedActions.onSendBackward}>
                下移
              </button>
              <button type="button" className="ghost" onClick={selectedActions.onBringForward}>
                上移
              </button>
              {selectedActions.onDuplicate && (
                <button type="button" className="ghost" onClick={selectedActions.onDuplicate}>
                  複製
                </button>
              )}
              <button type="button" className="ghost danger" onClick={selectedActions.onRemove}>
                刪除
              </button>
            </>
          )}

          {selectedActions?.hasSelection && (
            <button type="button" className="ghost" onClick={onClearSelection}>
              取消
            </button>
          )}
        </div>
      )}

      <BottomAssetTray
        images={images}
        selectedSlot={selectedSlot}
        onPickImage={onPickImage}
        persistent={true}
        compact={true}
      />

      <MobileBottomBar
        activeTab={activeTab}
        onTabChange={onTabChange}
        zoomPercent={zoomPercent}
      />
    </div>
  );
}
