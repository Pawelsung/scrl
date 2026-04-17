import React from "react";

export default function ProjectPanel({
  panelClassName = "panel",
  project,
  setProject,
  onUploadImages,
  onAddText,
  onExportJson,
  onImportJson,
  assets,
  stickers,
  templates,
  activeTemplateId,
  onTemplateSelect,
  onAddAssetToCanvas,
  onAddStickerToCanvas,
}) {
  return (
    <section className={panelClassName}>
      <h2>專案</h2>

      <label className="field">
        <span>輪播張數</span>
        <input
          type="range"
          min={2}
          max={10}
          step={1}
          value={project.count}
          onChange={(e) =>
            setProject((prev) => ({ ...prev, count: Number(e.target.value) }))
          }
        />
        <div className="sub">{project.count} 張</div>
      </label>

      <label className="field">
        <span>比例</span>
        <select
          value={project.ratio}
          onChange={(e) =>
            setProject((prev) => ({ ...prev, ratio: e.target.value }))
          }
        >
          <option value="4:5">4:5</option>
          <option value="1:1">1:1</option>
          <option value="9:16">9:16</option>
          <option value="16:9">16:9</option>
        </select>
      </label>

      <div className="button-row">
        <button type="button" onClick={onUploadImages}>
          上傳圖片
        </button>
        <button type="button" className="ghost" onClick={onAddText}>
          新增文字
        </button>
        <button type="button" className="ghost" onClick={onExportJson}>
          匯出 JSON
        </button>
        <button type="button" className="ghost" onClick={onImportJson}>
          匯入 JSON
        </button>
      </div>

      <div style={{ height: 16 }} />

      <h2>背景</h2>

      <label className="field">
        <span>模式</span>
        <select
          value={project.backgroundMode}
          onChange={(e) =>
            setProject((prev) => ({
              ...prev,
              backgroundMode: e.target.value,
            }))
          }
        >
          <option value="solid">純色</option>
          <option value="gradient">漸層</option>
        </select>
      </label>

      <div className="color-row">
        <label>
          <span>主色</span>
          <input
            type="color"
            value={project.backgroundColor}
            onChange={(e) =>
              setProject((prev) => ({
                ...prev,
                backgroundColor: e.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>副色</span>
          <input
            type="color"
            value={project.backgroundColor2}
            onChange={(e) =>
              setProject((prev) => ({
                ...prev,
                backgroundColor2: e.target.value,
              }))
            }
            disabled={project.backgroundMode !== "gradient"}
          />
        </label>
      </div>

      <div style={{ height: 16 }} />

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

      <div style={{ height: 16 }} />

      <h2>素材</h2>
      {assets.length ? (
        <div className="asset-grid">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              className="asset-btn"
              onClick={() => onAddAssetToCanvas(asset)}
              title={asset.name || "asset"}
            >
              <img src={asset.src} alt={asset.name || "asset"} />
            </button>
          ))}
        </div>
      ) : (
        <div className="hint-card">先上傳圖片，再把縮圖加入畫布。</div>
      )}

      <div style={{ height: 16 }} />

      <h2>貼紙</h2>
      {stickers.length ? (
        <div className="asset-grid">
          {stickers.map((sticker) => (
            <button
              key={sticker.id}
              type="button"
              className="asset-btn"
              onClick={() => onAddStickerToCanvas(sticker)}
              title={sticker.name || "sticker"}
            >
              <img src={sticker.src} alt={sticker.name || "sticker"} />
            </button>
          ))}
        </div>
      ) : (
        <div className="hint-card">目前還沒有貼紙素材。</div>
      )}
    </section>
  );
}
