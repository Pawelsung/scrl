import React, { useEffect, useState } from "react";
import { Download, Loader2, RefreshCw, Share } from "lucide-react";
import { Segmented } from "../ui/Segmented";
import { sliceFilename } from "../../lib/exportImage.js";

export default function ExportPanel({
  previews,
  directDownload = false,
  onDownloadOne,
  onSaveOne,
  onDownloadAll,
  isBusy = false,
  isStale = false,
  onRefresh,
  exportScale,
  onExportScaleChange,
  qualityOptions,
}) {
  // Desktop downloads go through ready-made object URLs so the click itself
  // triggers the download without waiting on a re-render.
  const [downloadUrls, setDownloadUrls] = useState([]);
  const previewSources = previews.map((preview) => preview.src).join("|");
  useEffect(() => {
    if (!directDownload || !previewSources) {
      setDownloadUrls([]);
      return undefined;
    }
    let cancelled = false;
    let urls = [];
    Promise.all(previews.map((preview) => fetch(preview.src).then((response) => response.blob()))).then((blobs) => {
      if (cancelled) return;
      urls = blobs.map((blob) => URL.createObjectURL(blob));
      setDownloadUrls(urls);
    });
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
    // previewSources captures every change to the preview images.
  }, [previewSources, directDownload]);

  const canDownload = previews.length > 0 && !isBusy && !isStale;

  return (
    <div className="export-panel">
      <div className="export-panel__options">
        <Segmented
          label="輸出畫質"
          options={qualityOptions}
          value={exportScale}
          onChange={onExportScaleChange}
        />
      </div>

      {isStale && previews.length > 0 && (
        <div className="callout callout--warning" role="status">
          <span>畫布有變更，請更新預覽再下載。</span>
          <button type="button" className="btn btn--small" onClick={onRefresh} disabled={isBusy}>
            <RefreshCw size={14} aria-hidden="true" />
            更新
          </button>
        </div>
      )}

      {previews.length ? (
        <div className="export-grid">
          {previews.map((preview, index) => (
            <figure key={preview.id} className="export-card">
              <div className="export-card__image" style={{ aspectRatio: `${preview.width} / ${preview.height}` }}>
                <img src={preview.src} alt={`第 ${index + 1} 張`} decoding="async" />
                <span className="export-card__badge">{index + 1}</span>
              </div>
              <figcaption className="export-card__actions">
                {onSaveOne && (
                  <button type="button" className="btn btn--small" disabled={!canDownload} onClick={() => onSaveOne(preview, index)}>
                    <Share size={14} aria-hidden="true" />
                    存到相簿
                  </button>
                )}
                {directDownload && canDownload && downloadUrls[index] ? (
                  <a className="btn btn--small" href={downloadUrls[index]} download={sliceFilename(index)}>
                    <Download size={14} aria-hidden="true" />
                    下載
                  </a>
                ) : (
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={!canDownload}
                    onClick={() => onDownloadOne(preview, index)}
                  >
                    <Download size={14} aria-hidden="true" />
                    下載
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          {isBusy ? <Loader2 className="spin" size={24} aria-hidden="true" /> : null}
          <span>{isBusy ? "切圖產生中…" : "按「輸出」產生切圖預覽。"}</span>
        </div>
      )}

      <div className="export-panel__footer">
        <button type="button" className="btn btn--primary btn--block" onClick={onDownloadAll} disabled={!canDownload}>
          {isBusy ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
          {isBusy ? "處理中…" : `全部下載（ZIP · ${previews.length} 張）`}
        </button>
      </div>
    </div>
  );
}
