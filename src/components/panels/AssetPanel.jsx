import React from "react";
import { ImagePlus } from "lucide-react";

export default function AssetPanel({ assets, selectedSlot, onUpload, onPick }) {
  return (
    <div className="panel-body">
      <button type="button" className="btn btn--primary btn--block" onClick={onUpload}>
        <ImagePlus size={18} strokeWidth={1.8} aria-hidden="true" />
        上傳照片
      </button>

      <div className={`callout ${selectedSlot ? "callout--accent" : ""}`} role="status">
        {selectedSlot
          ? selectedSlot.imageSrc ? "點照片替換選取圖框裡的照片" : "點照片放進選取的圖框"
          : "點照片會加入目前這一張；先選圖框，就會放進圖框。"}
      </div>

      {assets.length ? (
        <div className="asset-grid">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              className="asset-thumb"
              onClick={() => onPick(asset)}
              title={asset.name || "照片"}
            >
              <img src={asset.thumbSrc || asset.src} alt={asset.name || "照片"} loading="lazy" />
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="empty-drop" onClick={onUpload}>
          <ImagePlus size={28} strokeWidth={1.5} aria-hidden="true" />
          <strong>還沒有照片</strong>
          <span>可一次選多張，照片只存在這台裝置。</span>
        </button>
      )}
    </div>
  );
}
