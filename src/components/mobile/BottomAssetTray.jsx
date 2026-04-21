import React from "react";

export default function BottomAssetTray({
  images = [],
  selectedSlot,
  onPickImage,
  persistent = false,
}) {
  return (
    <div
      className={
        persistent
          ? "bottom-asset-tray bottom-asset-tray--persistent"
          : "bottom-asset-tray bottom-asset-tray--inline"
      }
    >
      <div className="bottom-asset-tray__head">
        <div className="bottom-asset-tray__title">
          <strong>素材</strong>
          <span>
            {selectedSlot
              ? `已選圖框：${selectedSlot.label || "目前圖框"}`
              : "未選圖框時，點圖片會直接加入畫布"}
          </span>
        </div>
      </div>

      <div className="bottom-asset-tray__rail">
        {images.length === 0 ? (
          <div className="bottom-asset-tray__empty">先上傳圖片，這裡會顯示素材預覽。</div>
        ) : (
          images.map((img) => (
            <button
              key={img.id}
              type="button"
              className="bottom-asset-tray__thumb"
              onClick={() => onPickImage(img)}
              title={img.name || "image"}
            >
              <img src={img.src} alt={img.name || "image"} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
