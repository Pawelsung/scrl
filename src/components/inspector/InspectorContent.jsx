import React from "react";
import { NumericSlider } from "./NumericSlider";
import { FONT_OPTIONS } from "../../constants/editor.js";

export function InspectorContent({
  selectedItem,
  selectedSlot,
  updateElement,
  updateSlot,
  setShowGuides,
  showGuides,
}) {
  const guidesButton = (
    <div className="inspector-section">
      <div className="inspector-section__title">輔助</div>
      <div className="button-row">
        <button className="ghost" onClick={() => setShowGuides((v) => !v)}>
          {showGuides ? "隱藏參考線" : "顯示參考線"}
        </button>
      </div>
    </div>
  );

  if (!selectedItem && !selectedSlot) {
    return (
      <div className="hint-card">
        先選模板、上傳圖片，再點圖框填入。選取畫布物件後，這裡會顯示對應工具。
      </div>
    );
  }

  if (selectedSlot) {
    return (
      <>
        <div className="hint-card" style={{ marginBottom: 12 }}>
          <strong>{selectedSlot.imageSrc ? "已選取裁切框" : "已選取模板圖框"}</strong>
          <div style={{ marginTop: 8, color: "#9ba8bb" }}>
            {selectedSlot.imageName
              ? `已放入：${selectedSlot.imageName}。畫面只會輸出遮罩框內的範圍，可調整框內圖片縮放與位置。`
              : "目前尚未放圖，先點選這個圖框，再到素材區點圖片即可填入。"}
          </div>
        </div>

        <div className="inspector-section">
          <div className="inspector-section__title">外框</div>
          <NumericSlider
            label="圓角"
            min={0}
            max={120}
            value={selectedSlot.radius || 0}
            onChange={(value) => updateSlot({ ...selectedSlot, radius: value })}
          />

          <NumericSlider
            label="框線粗細"
            min={0}
            max={30}
            value={selectedSlot.strokeWidth || 0}
            onChange={(value) => updateSlot({ ...selectedSlot, strokeWidth: value })}
          />

          <label className="field">
            <span>框線顏色</span>
            <input
              type="color"
              value={selectedSlot.stroke || "#ffffff"}
              onChange={(e) => updateSlot({ ...selectedSlot, stroke: e.target.value })}
            />
          </label>
        </div>

        {selectedSlot.imageSrc && (
          <div className="inspector-section">
            <div className="inspector-section__title">框內圖片</div>
            <NumericSlider
              label="框內圖片縮放"
              min={1}
              max={3}
              step={0.01}
              value={selectedSlot.imageZoom || 1}
              onChange={(value) => updateSlot({ ...selectedSlot, imageZoom: value })}
            />

            <NumericSlider
              label="框內圖片左右"
              min={-500}
              max={500}
              value={selectedSlot.imageOffsetX || 0}
              onChange={(value) => updateSlot({ ...selectedSlot, imageOffsetX: value })}
            />

            <NumericSlider
              label="框內圖片上下"
              min={-500}
              max={500}
              value={selectedSlot.imageOffsetY || 0}
              onChange={(value) => updateSlot({ ...selectedSlot, imageOffsetY: value })}
            />

            <div className="button-row">
              <button
                className="ghost"
                onClick={() => {
                  setShowGuides((v) => v);
                  updateSlot({
                    ...selectedSlot,
                    imageSrc: null,
                    imageName: null,
                    imageOffsetX: 0,
                    imageOffsetY: 0,
                    imageZoom: 1,
                    imageRotation: 0,
                  });
                }}
              >
                清空圖框圖片
              </button>
            </div>
          </div>
        )}

        {guidesButton}
      </>
    );
  }

  return (
    <>
      {selectedItem?.type === "image" && (
        <div className="inspector-section">
          <div className="inspector-section__title">圖片外觀</div>
          <NumericSlider
            label="圓角"
            min={0}
            max={120}
            value={selectedItem.radius || 0}
            onChange={(value) => updateElement({ ...selectedItem, radius: value })}
          />
          <NumericSlider
            label="陰影"
            min={0}
            max={40}
            value={selectedItem.shadow || 0}
            onChange={(value) => updateElement({ ...selectedItem, shadow: value })}
          />
          <NumericSlider
            label="透明度"
            min={0.1}
            max={1}
            step={0.01}
            value={selectedItem.opacity ?? 1}
            onChange={(value) => updateElement({ ...selectedItem, opacity: value })}
          />
          <NumericSlider
            label="邊框粗細"
            min={0}
            max={20}
            value={selectedItem.borderWidth || 0}
            onChange={(value) => updateElement({ ...selectedItem, borderWidth: value })}
          />
          <label className="field">
            <span>邊框顏色</span>
            <input
              type="color"
              value={selectedItem.borderColor || "#ffffff"}
              onChange={(e) => updateElement({ ...selectedItem, borderColor: e.target.value })}
            />
          </label>
        </div>
      )}

      {selectedItem?.type === "text" && (
        <div className="inspector-section">
          <div className="inspector-section__title">文字</div>
          <label className="field">
            <span>文字內容</span>
            <textarea
              rows="4"
              value={selectedItem.text}
              onChange={(e) => updateElement({ ...selectedItem, text: e.target.value })}
            />
          </label>
          <NumericSlider
            label="字體大小"
            min={16}
            max={180}
            value={selectedItem.fontSize}
            onChange={(value) => updateElement({ ...selectedItem, fontSize: value })}
          />
          <label className="field">
            <span>字體</span>
            <select
              value={selectedItem.fontFamily || "Inter, system-ui, sans-serif"}
              onChange={(e) => updateElement({ ...selectedItem, fontFamily: e.target.value })}
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.label} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>顏色</span>
            <input
              type="color"
              value={selectedItem.fill || "#111111"}
              onChange={(e) => updateElement({ ...selectedItem, fill: e.target.value })}
            />
          </label>
          <label className="field">
            <span>字重</span>
            <select
              value={selectedItem.fontStyle || "normal"}
              onChange={(e) => updateElement({ ...selectedItem, fontStyle: e.target.value })}
            >
              <option value="normal">normal</option>
              <option value="bold">bold</option>
              <option value="italic">italic</option>
            </select>
          </label>
          <label className="field">
            <span>對齊</span>
            <select
              value={selectedItem.align || "left"}
              onChange={(e) => updateElement({ ...selectedItem, align: e.target.value })}
            >
              <option value="left">left</option>
              <option value="center">center</option>
              <option value="right">right</option>
            </select>
          </label>
        </div>
      )}

      {selectedItem?.type === "sticker" && (
        <div className="inspector-section">
          <div className="inspector-section__title">貼紙</div>
          <label className="field">
            <span>顏色</span>
            <input
              type="color"
              value={selectedItem.fill || "#ffffff"}
              onChange={(e) => updateElement({ ...selectedItem, fill: e.target.value })}
            />
          </label>
          <NumericSlider
            label="透明度"
            min={0.1}
            max={1}
            step={0.01}
            value={selectedItem.opacity ?? 1}
            onChange={(value) => updateElement({ ...selectedItem, opacity: value })}
          />
        </div>
      )}

      {guidesButton}
    </>
  );
}
