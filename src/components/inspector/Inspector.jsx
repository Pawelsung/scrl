import React from "react";
import { BringToFront, Copy, ImagePlus, SendToBack, Trash2, X } from "lucide-react";
import { IconButton } from "../ui/IconButton";
import { Section } from "../ui/Field";
import { InspectorContent } from "./InspectorContent";
import { NudgePad, QuickLayoutActions } from "./TransformControls";
import CanvasSettings from "../panels/CanvasSettings";

export default function Inspector({
  selectedItem,
  selectedSlot,
  selectionLabel,
  rotation,
  actions,
  updateElement,
  updateSlot,
  onPickPhoto,
  onClearSelection,
  project,
  setProject,
  showGuides,
  onToggleGuides,
}) {
  const hasSelection = !!selectedItem || !!selectedSlot;

  if (!hasSelection) {
    return (
      <aside className="inspector" aria-label="畫布設定">
        <header className="inspector__head">
          <h2>畫布</h2>
        </header>
        <div className="inspector__scroll">
          <CanvasSettings project={project} setProject={setProject} />
          <div className="panel-body">
            <label className="switch-row">
              <span>拖曳時顯示對齊參考線</span>
              <input type="checkbox" role="switch" checked={showGuides} onChange={onToggleGuides} />
            </label>
            <div className="shortcut-list" aria-label="鍵盤快捷鍵">
              <span><kbd>⌘</kbd><kbd>Z</kbd> 復原</span>
              <span><kbd>⌘</kbd><kbd>D</kbd> 複製</span>
              <span><kbd>←</kbd><kbd>→</kbd> 微調位置</span>
              <span><kbd>Del</kbd> 刪除</span>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="inspector" aria-label="選取物件設定">
      <header className="inspector__head">
        <div className="inspector__title">
          <h2>{selectionLabel}</h2>
          <span>旋轉 {rotation}°</span>
        </div>
        <IconButton icon={X} label="取消選取（Esc）" onClick={onClearSelection} />
      </header>

      <div className="inspector__toolbar">
        <IconButton icon={BringToFront} label="上移一層" onClick={actions.onBringForward} />
        <IconButton icon={SendToBack} label="下移一層" onClick={actions.onSendBackward} />
        <IconButton icon={Copy} label="複製（⌘D）" onClick={actions.onDuplicate} />
        <span className="toolbar-spacer" />
        <IconButton icon={Trash2} label="刪除" variant="danger" onClick={actions.onRemove} />
      </div>

      <div className="inspector__scroll">
        {selectedSlot && (
          <div className="panel-body">
            <button type="button" className="btn btn--primary btn--block" onClick={onPickPhoto}>
              <ImagePlus size={18} aria-hidden="true" />
              {selectedSlot.imageSrc ? "更換照片" : "選擇照片放進圖框"}
            </button>
          </div>
        )}

        <Section title={actions.isCropSlot ? "調整框內照片" : "位置與大小"}>
          <NudgePad actions={actions} />
          <QuickLayoutActions actions={actions} />
        </Section>

        <InspectorContent
          selectedItem={selectedItem}
          selectedSlot={selectedSlot}
          updateElement={updateElement}
          updateSlot={updateSlot}
        />
      </div>
    </aside>
  );
}
