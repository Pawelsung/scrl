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
                4:5
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
              <button
                type="button"
                className="ghost"
                onClick={selectedActions.onUndo}
                disabled={!selectedActions.canUndo}
              >
                復原
              </button>
              <button
                type="button"
                className="ghost"
                onClick={selectedActions.onRedo}
                disabled={!selectedActions.canRedo}
              >
                重做
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
