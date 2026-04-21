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
      <BottomAssetTray
        images={images}
        selectedSlot={selectedSlot}
        onPickImage={onPickImage}
        persistent={true}
        compact={true}
      />

      {(selectedActions?.hasSelection || onClearSelection) && (
        <div className="mobile-dock-actions">
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

      <MobileBottomBar
        activeTab={activeTab}
        onTabChange={onTabChange}
        zoomPercent={zoomPercent}
      />
    </div>
  );
}
