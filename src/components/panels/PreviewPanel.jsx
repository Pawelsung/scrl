import React from "react";

export default function PreviewPanel({
  previews,
  onDownloadOne,
  onDownloadAll,
  isBusy = false,
}) {
  return (
    <section className="preview-panel">
      <div className="preview-head">
        <h2>切圖預覽</h2>
        <p>先檢查每張接縫，再手動上傳到 IG。</p>
      </div>

      <div className="preview-grid">
        {previews.length ? (
          previews.map((preview, index) => (
            <article key={preview.id || index} className="preview-card">
              <img
                src={preview.src}
                alt={`預覽 ${index + 1}`}
                loading="lazy"
                decoding="async"
              />

              <div className="sub">
                第 {index + 1} 張
                {preview.width && preview.height
                  ? ` · ${preview.width}×${preview.height}`
                  : ""}
              </div>

              <div className="preview-actions">
                <button
                  type="button"
                  onClick={() => onDownloadOne(preview, index)}
                >
                  下載這張
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="hint-card">
            {isBusy ? "預覽生成中…" : "目前還沒有預覽。"}
          </div>
        )}
      </div>

      <div className="download-all-row">
        <button
          type="button"
          onClick={onDownloadAll}
          disabled={!previews.length || isBusy}
        >
          {isBusy ? "處理中…" : "全部下載"}
        </button>
      </div>
    </section>
  );
}
