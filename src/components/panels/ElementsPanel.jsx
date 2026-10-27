import React from "react";
import { Circle, Diamond, Frame, Heart, RectangleHorizontal, Sparkle, Star, Triangle, Type } from "lucide-react";

const STICKER_ICONS = {
  tape: RectangleHorizontal,
  star: Star,
  circle: Circle,
  heart: Heart,
  diamond: Diamond,
  triangle: Triangle,
  spark: Sparkle,
};

export default function ElementsPanel({ stickers, onAddText, onAddFrame, onAddSticker }) {
  return (
    <div className="panel-body">
      <div className="tile-row">
        <button type="button" className="tile" onClick={onAddText}>
          <Type size={22} strokeWidth={1.8} aria-hidden="true" />
          <span>文字</span>
        </button>
        <button type="button" className="tile" onClick={onAddFrame}>
          <Frame size={22} strokeWidth={1.8} aria-hidden="true" />
          <span>圖框</span>
        </button>
      </div>

      <h3 className="panel-subtitle">貼紙</h3>
      <div className="sticker-grid">
        {stickers.map((sticker) => {
          const Icon = STICKER_ICONS[sticker.stickerType] || Star;
          return (
            <button key={sticker.id} type="button" className="sticker-tile" onClick={() => onAddSticker(sticker)}>
              <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
              <span>{sticker.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
