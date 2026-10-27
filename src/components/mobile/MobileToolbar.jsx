import React from "react";
import { BringToFront, Check, Copy, ImagePlus, SendToBack, SlidersHorizontal, Trash2 } from "lucide-react";
import { NudgePad } from "../inspector/TransformControls";

function ToolButton({ icon: Icon, label, onClick, danger = false, active = false }) {
  return (
    <button
      type="button"
      className={`tool-btn ${danger ? "tool-btn--danger" : ""} ${active ? "is-active" : ""}`}
      onClick={onClick}
    >
      <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

// Bottom toolbar that follows the selection: creation tools when nothing is
// selected, editing tools for the selected object otherwise.
export default function MobileToolbar({
  tools,
  activeTool,
  onOpenTool,
  selectionLabel,
  isSlot,
  hasSlotPhoto,
  actions,
  onPickPhoto,
  onOpenEdit,
  onClearSelection,
}) {
  if (!selectionLabel) {
    return (
      <nav className="mobile-toolbar" aria-label="工具">
        <div className="mobile-toolbar__tools">
          {tools.map(({ key, label, icon }) => (
            <ToolButton key={key} icon={icon} label={label} active={activeTool === key} onClick={() => onOpenTool(key)} />
          ))}
        </div>
      </nav>
    );
  }

  return (
    <div className="mobile-toolbar mobile-toolbar--selection" role="region" aria-label="編輯選取物件">
      <div className="mobile-toolbar__selection">
        <span className="selection-chip">
          <span className="selection-chip__dot" aria-hidden="true" />
          {selectionLabel}
        </span>
        <span className="mobile-toolbar__hint">{actions.isCropSlot ? "雙指可調整框內照片" : "雙指可縮放、旋轉"}</span>
        <button type="button" className="btn btn--small btn--primary" onClick={onClearSelection}>
          <Check size={16} aria-hidden="true" />
          完成
        </button>
      </div>
      <NudgePad actions={actions} compact />
      <div className="mobile-toolbar__tools">
        {isSlot && <ToolButton icon={ImagePlus} label={hasSlotPhoto ? "換照片" : "放照片"} onClick={onPickPhoto} />}
        <ToolButton icon={SlidersHorizontal} label="調整" onClick={onOpenEdit} />
        <ToolButton icon={BringToFront} label="上移" onClick={actions.onBringForward} />
        <ToolButton icon={SendToBack} label="下移" onClick={actions.onSendBackward} />
        <ToolButton icon={Copy} label="複製" onClick={actions.onDuplicate} />
        <ToolButton icon={Trash2} label="刪除" danger onClick={actions.onRemove} />
      </div>
    </div>
  );
}
