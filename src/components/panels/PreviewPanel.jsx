import React, { useEffect, useState } from "react";

export default function PreviewPanel({
  previews,
  onDownloadOne,
  onSaveOne,
  onDownloadAll,
  isBusy = false,
  defaultCollapsed = false,
  expandSignal = 0,
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    if (expandSignal) setCollapsed(false);
  }, [expandSignal]);

  return (
    <section className={`preview-panel ${collapsed ? "collapsed" : ""}`}>
      <div className="preview-head">
        <div>
          <h2>輸出切圖</h2>
          <p>按輸出後產生最新切圖，再下載或存到手機。</p>
        </div>

        <button
          type="button"
          className="ghost"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? "展開" : "收合"}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="preview-grid">
            {previews.length ? (
              previews.map((preview, index) => (
                <article key={preview.id || index} className="preview-card">
                  <img
                    src={preview.src}
                    alt={`輸出切圖 ${index + 1}`}
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
                    {onSaveOne && (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => onSaveOne(preview, index)}
                      >
                        存到相簿
                      </button>
                    )}
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
                {isBusy ? "切圖生成中…" : "按輸出後，最新切圖會顯示在這裡。"}
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
        </>
      )}
    </section>
  );
}
