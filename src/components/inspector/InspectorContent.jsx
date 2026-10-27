import React from "react";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { NumericSlider } from "./NumericSlider";
import { Segmented } from "../ui/Segmented";
import { ColorField, Field, Section } from "../ui/Field";
import { FONT_OPTIONS } from "../../constants/editor.js";

const FONT_STYLE_OPTIONS = [
  { value: "normal", label: "一般" },
  { value: "bold", label: "粗體" },
  { value: "italic", label: "斜體" },
];

const ALIGN_OPTIONS = [
  { value: "left", label: "靠左", icon: AlignLeft },
  { value: "center", label: "置中", icon: AlignCenter },
  { value: "right", label: "靠右", icon: AlignRight },
];

// Type-specific properties of the current selection.
export function InspectorContent({ selectedItem, selectedSlot, updateElement, updateSlot }) {
  if (selectedSlot) {
    return (
      <>
        {selectedSlot.imageSrc && (
          <Section title="框內照片">
            <NumericSlider
              label="縮放"
              min={1}
              max={3}
              step={0.01}
              value={selectedSlot.imageZoom || 1}
              onChange={(value) => updateSlot({ ...selectedSlot, imageZoom: value })}
            />
            <NumericSlider
              label="左右"
              min={-500}
              max={500}
              value={selectedSlot.imageOffsetX || 0}
              onChange={(value) => updateSlot({ ...selectedSlot, imageOffsetX: value })}
            />
            <NumericSlider
              label="上下"
              min={-500}
              max={500}
              value={selectedSlot.imageOffsetY || 0}
              onChange={(value) => updateSlot({ ...selectedSlot, imageOffsetY: value })}
            />
            <button
              type="button"
              className="btn btn--small btn--block"
              onClick={() =>
                updateSlot({
                  ...selectedSlot,
                  imageSrc: null,
                  imageName: null,
                  imageOffsetX: 0,
                  imageOffsetY: 0,
                  imageZoom: 1,
                  imageRotation: 0,
                })
              }
            >
              移除框內照片
            </button>
          </Section>
        )}

        <Section title="外框">
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
          <ColorField
            label="框線顏色"
            value={selectedSlot.stroke || "#ffffff"}
            onChange={(stroke) => updateSlot({ ...selectedSlot, stroke })}
          />
        </Section>
      </>
    );
  }

  if (selectedItem?.type === "image") {
    return (
      <Section title="外觀">
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
          label="不透明度"
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
        <ColorField
          label="邊框顏色"
          value={selectedItem.borderColor || "#ffffff"}
          onChange={(borderColor) => updateElement({ ...selectedItem, borderColor })}
        />
      </Section>
    );
  }

  if (selectedItem?.type === "text") {
    return (
      <Section title="文字">
        <Field label="內容">
          <textarea
            rows="3"
            value={selectedItem.text}
            onChange={(e) => updateElement({ ...selectedItem, text: e.target.value })}
          />
        </Field>
        <Field label="字體">
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
        </Field>
        <NumericSlider
          label="字級"
          min={16}
          max={180}
          value={selectedItem.fontSize}
          onChange={(value) => updateElement({ ...selectedItem, fontSize: value })}
        />
        <div className="field-pair">
          <Segmented
            label="字型樣式"
            options={FONT_STYLE_OPTIONS}
            value={selectedItem.fontStyle || "normal"}
            onChange={(fontStyle) => updateElement({ ...selectedItem, fontStyle })}
          />
          <Segmented
            label="對齊"
            options={ALIGN_OPTIONS}
            value={selectedItem.align || "left"}
            onChange={(align) => updateElement({ ...selectedItem, align })}
          />
        </div>
        <ColorField
          label="文字顏色"
          value={selectedItem.fill || "#111111"}
          onChange={(fill) => updateElement({ ...selectedItem, fill })}
        />
      </Section>
    );
  }

  if (selectedItem?.type === "sticker") {
    return (
      <Section title="貼紙">
        <ColorField
          label="顏色"
          value={selectedItem.fill || "#ffffff"}
          onChange={(fill) => updateElement({ ...selectedItem, fill })}
        />
        <NumericSlider
          label="不透明度"
          min={0.1}
          max={1}
          step={0.01}
          value={selectedItem.opacity ?? 1}
          onChange={(value) => updateElement({ ...selectedItem, opacity: value })}
        />
      </Section>
    );
  }

  return null;
}
