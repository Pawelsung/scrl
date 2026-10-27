import React from "react";
import TemplatePreview from "../TemplatePreview";

export default function ProjectPanel({
  panelClassName = "panel",
  settingsOnly = false,
  project,
  setProject,
  onUploadImages,
  onAddText,
  onAddFrame,
  onExportJson,
  onClearDraft,
  onRepairSwap,
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

      <div className="workflow-steps" aria-label="建議工作流程">
        <span>選模板</span>
        <span>上傳圖片</span>
        <span>填入圖框</span>
        <span>輸出下載</span>
      </div>

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

      <div className="project-file-options">
        {activeTemplateId === "swap-square" && (
          <button type="button" className="ghost" onClick={onRepairSwap}>修復置換對齊（保留照片）</button>
        )}
        <button type="button" className="ghost danger" onClick={onClearDraft}>清除所有資料</button>
        <div className="sub">清除本瀏覽器的照片素材、畫布與草稿。</div>
      </div>
      <div className="panel-section-divider" />

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

      {!settingsOnly && <>
      <div className="panel-section-divider" />

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
          <span>先點上方主圖框選第一張照片，再選第二張；中央方形會自動交叉置換並同步更新。</span>
        </div>
      )}

      <div className="panel-section-divider" />

      <h2>素材</h2>
      <div className="button-row asset-tool-row">
        <button type="button" onClick={onUploadImages}>
          上傳圖片
        </button>
      </div>
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
              <img src={asset.thumbSrc || asset.src} alt={asset.name || "asset"} />
            </button>
          ))}
        </div>
      ) : (
        <div className="hint-card">先上傳圖片，再把縮圖加入畫布。</div>
      )}

      <div className="panel-section-divider" />

      <h2>元素</h2>
      <div className="button-row asset-tool-row">
        <button type="button" className="ghost" onClick={onAddFrame}>
          新增圖框
        </button>
        <button type="button" className="ghost" onClick={onAddText}>
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
              title={sticker.name || "sticker"}
            >
              <img src={sticker.src} alt={sticker.name || "sticker"} />
            </button>
          ))}
        </div>
      ) : (
        <div className="hint-card">目前還沒有貼紙素材。</div>
      )}
      </>}
    </section>
  );
}
