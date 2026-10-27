import React, { useEffect, useState } from "react";

export default function PreviewPanel({
  previews,
  directDownload = false,
  onDownloadOne,
  onSaveOne,
  onDownloadAll,
  isBusy = false,
  isStale = false,
  onRefresh,
  defaultCollapsed = false,
  expandSignal = 0,
}) {
  const [downloadUrls, setDownloadUrls] = useState([]);
  const previewSources = JSON.stringify(previews.map(preview => preview.src));
  useEffect(() => {
    if (!directDownload) { setDownloadUrls([]); return; }
    const urls = JSON.parse(previewSources).map(src => {
      const [meta, encoded] = src.split(",");
      const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
      return URL.createObjectURL(new Blob([bytes], {type: meta.match(/data:([^;]+)/)?.[1] || "image/png"}));
    });
    setDownloadUrls(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [previewSources, directDownload]);
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
          {isStale && previews.length > 0 && (
            <div className="hint-card" role="status">
              畫布已變更，請更新預覽後下載。
              <button type="button" onClick={onRefresh} disabled={isBusy}>更新預覽</button>
            </div>
          )}
          <div className="preview-grid">
            {previews.length ? (
              previews.map((preview, index) => (
                <article key={preview.id || index} className="preview-card">
                  <img
                    src={preview.src}
                    alt={`輸出切圖 ${index + 1}`}
                    loading="eager"
                    width={preview.width}
                    height={preview.height}
                    style={{ height: "auto", aspectRatio: `${preview.width || 1080} / ${preview.height || 1350}`, objectFit: "contain" }}
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
                        disabled={isBusy || isStale}
                        onClick={() => onSaveOne(preview, index)}
                      >
                        存到相簿
                      </button>
                    )}
                    {directDownload && !isBusy && !isStale && downloadUrls[index] ? (
                      <a className="preview-download" href={downloadUrls[index]} download={`carousel_${String(index + 1).padStart(2, "0")}.png`}>下載這張</a>
                    ) : <button
                      type="button"
                      disabled={isBusy || isStale || directDownload}
                      onClick={() => onDownloadOne(preview, index)}
	                    >
	                      下載這張
	                    </button>}
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
              disabled={!previews.length || isBusy || isStale}
            >
              {isBusy ? "處理中…" : "全部下載 ZIP"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
