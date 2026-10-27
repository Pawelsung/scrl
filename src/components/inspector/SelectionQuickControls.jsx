import React from "react";

export function SelectionQuickControls({ actions, compact = false }) {
  if (!actions?.hasSelection) return null;

  return (
    <div className={`selection-quick-controls ${compact ? "compact" : ""}`}>
      <div className="desktop-object-pad">
        <div className="desktop-object-pad__head">物件控制</div>
        <div className="desktop-object-pad__grid">
          <button type="button" className="ghost" onClick={actions.onScaleDown}>縮小</button>
          <button type="button" className="ghost" onClick={actions.onNudgeUp}>↑</button>
          <button type="button" className="ghost" onClick={actions.onScaleUp}>放大</button>
          <button type="button" className="ghost" onClick={actions.onNudgeLeft}>←</button>
          <button type="button" className="ghost" onClick={actions.onRotate90}>旋轉 90°</button>
          <button type="button" className="ghost" onClick={actions.onNudgeRight}>→</button>
          <button type="button" className="ghost" onClick={actions.onFit45}>4:5</button>
          <button type="button" className="ghost" onClick={actions.onNudgeDown}>↓</button>
          <button type="button" className="ghost" onClick={actions.onSpanTwoSlides}>跨兩張</button>
        </div>
      </div>
    </div>
  );
}
