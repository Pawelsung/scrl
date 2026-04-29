import React, { useMemo, useState } from "react";

const THUMB_STRIDE = 86;
const VISIBLE_BUFFER = 8;

export default function BottomAssetTray({
  images = [],
  selectedSlot,
  onPickImage,
  persistent = false,
}) {
  const [scrollLeft, setScrollLeft] = useState(0);
  const virtual = useMemo(() => {
    if (images.length <= 36) {
      return { before: 0, after: 0, items: images };
    }

    const start = Math.max(0, Math.floor(scrollLeft / THUMB_STRIDE) - VISIBLE_BUFFER);
    const end = Math.min(images.length, start + 32);
    return {
      before: start * THUMB_STRIDE,
      after: Math.max(0, (images.length - end) * THUMB_STRIDE),
      items: images.slice(start, end),
    };
  }, [images, scrollLeft]);

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

      <div className="bottom-asset-tray__rail" onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}>
        {images.length === 0 ? (
          <div className="bottom-asset-tray__empty">先上傳圖片，這裡會顯示素材預覽。</div>
        ) : (
          <>
            {virtual.before > 0 && (
              <span className="bottom-asset-tray__spacer" style={{ width: virtual.before }} />
            )}
            {virtual.items.map((img) => (
              <button
                key={img.id}
                type="button"
                className="bottom-asset-tray__thumb"
                onClick={() => onPickImage(img)}
                title={img.name || "image"}
              >
                <img src={img.thumbSrc || img.src} alt={img.name || "image"} loading="lazy" />
              </button>
            ))}
            {virtual.after > 0 && (
              <span className="bottom-asset-tray__spacer" style={{ width: virtual.after }} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
