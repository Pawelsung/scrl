import React from "react";
import TemplatePreview from "../TemplatePreview";

export default function TemplatePanel({ templates, activeTemplateId, onSelect }) {
  return (
    <div className="panel-body">
      <p className="panel-intro">套用後會重新排版，照片素材會保留。</p>
      <div className="template-grid">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            className={`template-card ${activeTemplateId === template.id ? "is-active" : ""}`}
            aria-pressed={activeTemplateId === template.id}
            onClick={() => onSelect(template.id)}
          >
            <span className="template-card__preview">
              <TemplatePreview template={template} />
            </span>
            <span className="template-card__name">{template.name}</span>
            {template.description && <span className="template-card__desc">{template.description}</span>}
          </button>
        ))}
      </div>
      {activeTemplateId === "swap-square" && (
        <div className="callout">
          <strong>使用方式</strong>
          <span>先點上方主圖框選第一張照片，再選第二張；中央方形會自動交叉置換。</span>
        </div>
      )}
    </div>
  );
}
