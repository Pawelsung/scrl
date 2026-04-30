import React from "react";
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
  return (
    <>
      <div
        className={`mobile-drawer-backdrop ${open ? "show" : ""}`}
        onClick={onClose}
      />

      <div className={`mobile-drawer ${open ? "show" : ""}`}>
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
                    <strong>{template.name}</strong>
                    {template.description ? (
                      <div className="sub" style={{ marginTop: 4 }}>
                        {template.description}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeTab === "preview" && (
            <PreviewPanel {...previewPanelProps} />
          )}

          {activeTab === "edit" && (
            <section className="panel in-drawer">
              <h2>選取物件</h2>
              {inspectorProps?.hasSelection ? (
                inspectorProps.content
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
