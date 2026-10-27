import React, { useEffect, useRef } from "react";
import TemplatePreview from "../TemplatePreview";
import ProjectPanel from "../panels/ProjectPanel";
import PreviewPanel from "../panels/PreviewPanel";

export default function MobileDrawer({
  open,
  activeTab,
  onClose,

  projectPanelProps,
  previewPanelProps,

  assets = [],
  stickers = [],
  templates = [],
  activeTemplateId,
  onTemplateSelect,
  onAddAssetToCanvas,
  onAddStickerToCanvas,
  inspectorProps,
}) {
  const drawerRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const drawer = drawerRef.current;
    drawer?.querySelector("button")?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const controls = [...drawer.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      requestAnimationFrame(() => {
        if (previousFocus?.isConnected) previousFocus.focus();
        else document.querySelector('.mobile-bottom-bar button.active')?.focus();
      });
    };
  }, [open]);
  return (
    <>
      <div
        className={`mobile-drawer-backdrop ${open ? "show" : ""}`}
        onClick={onClose}
      />

      <div ref={drawerRef} aria-modal={open ? "true" : undefined} className={`mobile-drawer ${open ? "show" : ""}`} aria-hidden={!open} inert={open ? undefined : ""} role="dialog" aria-label="編輯面板">
        <div className="mobile-drawer-handle" />
        <div className="mobile-drawer-head">
          <strong>
            {activeTab === "project" && "專案"}
            {activeTab === "assets" && "素材"}
            {activeTab === "templates" && "模板"}
            {activeTab === "edit" && "編輯"}
            {activeTab === "preview" && "輸出"}
          </strong>

          <button type="button" className="ghost mobile-close-btn" onClick={onClose}>
            關閉
          </button>
        </div>

        <div className="mobile-drawer-body">
          {activeTab === "project" && (
            <ProjectPanel
              {...projectPanelProps}
              panelClassName="panel in-drawer"
              settingsOnly
              assets={assets}
              stickers={stickers}
              templates={templates}
              activeTemplateId={activeTemplateId}
              onTemplateSelect={onTemplateSelect}
              onAddAssetToCanvas={onAddAssetToCanvas}
              onAddStickerToCanvas={onAddStickerToCanvas}
            />
          )}

          {activeTab === "assets" && (
            <section className="panel in-drawer">
              <h2>素材</h2>
              <button type="button" onClick={projectPanelProps.onUploadImages}>上傳圖片</button>
              {assets.length ? (
                <div className="asset-grid">
                  {assets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      className="asset-btn"
                      onClick={() => onAddAssetToCanvas(asset)}
                    >
                      <img src={asset.thumbSrc || asset.src} alt={asset.name || "asset"} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="hint-card">先上傳圖片，再加入畫布。</div>
              )}

              <div style={{ height: 16 }} />

              <h2>元素</h2>
              <div className="button-row asset-tool-row">
                <button type="button" className="ghost" onClick={projectPanelProps.onAddFrame}>
                  新增圖框
                </button>
                <button type="button" className="ghost" onClick={projectPanelProps.onAddText}>
                  新增文字
                </button>
              </div>
              {stickers.length ? (
                <div className="asset-grid">
                  {stickers.map((sticker) => (
                    <button
                      key={sticker.id}
                      type="button"
                      className="asset-btn"
                      onClick={() => onAddStickerToCanvas(sticker)}
                    >
                      <img src={sticker.src} alt={sticker.name || "sticker"} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="hint-card">目前還沒有貼紙素材。</div>
              )}
            </section>
          )}

          {activeTab === "templates" && (
            <section className="panel in-drawer">
              <h2>模板</h2>
              <div className="template-grid">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={`template-btn ${
                      activeTemplateId === template.id ? "active" : ""
                    }`}
                    onClick={() => onTemplateSelect(template.id)}
                  >
                    <TemplatePreview template={template} />
                    <strong>{template.name}</strong>
                    {template.description ? (
                      <div className="sub" style={{ marginTop: 4 }}>
                        {template.description}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
              {activeTemplateId === "swap-square" && (
                <div className="hint-card swap-template-guide">
                  <strong>使用方式</strong>
                  <span>點上方主圖框選第一張，再選第二張；兩個中央方形會自動交叉置換。</span>
                </div>
              )}
            </section>
          )}

          {activeTab === "preview" && (
            <PreviewPanel {...previewPanelProps} />
          )}

          {activeTab === "edit" && (
            <section className="panel in-drawer">
              <h2>選取物件</h2>
              {inspectorProps?.hasSelection ? (
                <>
                  {inspectorProps.isSlot && <button type="button" onClick={inspectorProps.onPickPhoto}>選擇／更換照片</button>}
                  <div className="mobile-edit-tools" aria-label="圖框與物件操作">
                    <strong>圖框與物件</strong>
                    <div>
                      <button type="button" className="ghost" onClick={inspectorProps.actions.onScaleDown}>縮小物件</button>
                      <button type="button" className="ghost" onClick={inspectorProps.actions.onScaleUp}>放大物件</button>
                      <button type="button" className="ghost" onClick={inspectorProps.actions.onNudgeUp}>往上移</button>
                      <button type="button" className="ghost" onClick={inspectorProps.actions.onNudgeDown}>往下移</button>
                      <button type="button" className="ghost" onClick={inspectorProps.actions.onNudgeLeft}>往左移</button>
                      <button type="button" className="ghost" onClick={inspectorProps.actions.onNudgeRight}>往右移</button>
                      <button type="button" className="ghost" onClick={inspectorProps.actions.onRotate90}>旋轉 90°</button>
                      <button type="button" className="ghost" onClick={inspectorProps.actions.onFit45}>設為 4:5</button>
                      <button type="button" className="ghost" onClick={inspectorProps.actions.onSpanTwoSlides}>跨兩張</button>
                      <button type="button" className="ghost" onClick={inspectorProps.actions.onBringForward}>圖層往前</button>
                      <button type="button" className="ghost" onClick={inspectorProps.actions.onSendBackward}>圖層往後</button>
                      <button type="button" className="ghost" onClick={inspectorProps.actions.onDuplicate}>複製物件</button>
                    </div>
                  </div>
                  {inspectorProps.content}
                  <button type="button" className="ghost danger" onClick={inspectorProps.actions.onRemove}>刪除選取物件</button>
                </>
              ) : (
                <div className="hint-card">先點選畫布上的圖片、文字、貼紙或圖框，再回到這裡編輯細節。</div>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
