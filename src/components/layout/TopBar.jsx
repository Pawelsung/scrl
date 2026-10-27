import React from "react";
import { Check, CircleAlert, Download, Loader2, Redo2, Undo2 } from "lucide-react";
import { IconButton } from "../ui/IconButton";

function SaveStatus({ status }) {
  if (!status) return null;
  const failed = status.includes("失敗");
  const pending = status.includes("待儲存");
  const Icon = failed ? CircleAlert : pending ? Loader2 : Check;
  return (
    <span className={`save-status ${failed ? "is-error" : ""}`} role="status" title={status}>
      <Icon size={14} className={pending ? "spin" : ""} aria-hidden="true" />
      <span className="save-status__text">{failed ? "儲存失敗" : pending ? "儲存中" : "已儲存"}</span>
    </span>
  );
}

export default function TopBar({ draftStatus, canUndo, canRedo, onUndo, onRedo, onExport, isExporting }) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="brand-mark" aria-hidden="true">S</span>
        <span className="brand-name">scrl</span>
        <SaveStatus status={draftStatus} />
      </div>

      <div className="topbar__history">
        <IconButton icon={Undo2} label="復原（⌘Z）" onClick={onUndo} disabled={!canUndo} />
        <IconButton icon={Redo2} label="重做（⌘⇧Z）" onClick={onRedo} disabled={!canRedo} />
      </div>

      <button type="button" className="btn btn--primary topbar__export" onClick={onExport} disabled={isExporting}>
        {isExporting ? <Loader2 size={18} className="spin" aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
        輸出
      </button>
    </header>
  );
}
