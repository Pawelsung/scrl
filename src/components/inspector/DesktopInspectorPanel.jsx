import React from "react";
import { InspectorContent } from "./InspectorContent";
import { SelectionQuickControls } from "./SelectionQuickControls";

export function DesktopInspectorPanel({
  selectedItem,
  selectedSlot,
  updateElement,
  updateSlot,
  setShowGuides,
  showGuides,
  onBringForward,
  onSendBackward,
  onDuplicate,
  onRemove,
  onClearSelection,
  selectedActions,
}) {
  const hasSelection = !!selectedItem || !!selectedSlot;

  return (
    <div className="panel">
      <h2>選取物件</h2>

      {hasSelection && (
        <>
          <div className="inspector-section">
            <div className="inspector-section__title">快速操作</div>
            <SelectionQuickControls actions={selectedActions} />
          </div>

          <div className="inspector-section">
            <div className="inspector-section__title">圖層與物件</div>
            <div className="desktop-layer-actions">
              <button className="ghost" onClick={onSendBackward}>下移</button>
              <button className="ghost" onClick={onBringForward}>上移</button>
              <button className="ghost" onClick={onDuplicate}>複製</button>
              <button className="ghost danger" onClick={onRemove}>刪除</button>
              <button className="ghost" onClick={onClearSelection}>取消</button>
            </div>
          </div>
        </>
      )}

      <InspectorContent
        selectedItem={selectedItem}
        selectedSlot={selectedSlot}
        updateElement={updateElement}
        updateSlot={updateSlot}
        setShowGuides={setShowGuides}
        showGuides={showGuides}
      />
    </div>
  );
}
