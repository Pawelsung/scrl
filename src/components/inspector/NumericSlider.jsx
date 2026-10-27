import React from "react";
import { Minus, Plus } from "lucide-react";
import { clamp } from "../../lib/editorUtils.js";

export function NumericSlider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  suffix = "",
}) {
  const numericValue = Number(value ?? min);
  const precision = String(step).includes(".") ? String(step).split(".")[1].length : 0;
  const displayValue = precision ? numericValue.toFixed(precision) : String(Math.round(numericValue));
  const clampValue = (next) => clamp(Number(next), Number(min), Number(max));
  const commit = (next) => onChange(clampValue(next));
  const nudge = (dir) => commit(numericValue + Number(step) * dir);
  const progress = ((numericValue - min) / (max - min || 1)) * 100;

  return (
    <div className="slider-field">
      <div className="slider-field__head">
        <span className="field__label">{label}</span>
        <output>
          {displayValue}
          {suffix}
        </output>
      </div>
      <div className="slider-field__control">
        <button type="button" onClick={() => nudge(-1)} aria-label={`${label}減少`}>
          <Minus size={14} aria-hidden="true" />
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numericValue}
          aria-label={label}
          style={{ "--progress": `${progress}%` }}
          onChange={(e) => commit(e.target.value)}
        />
        <button type="button" onClick={() => nudge(1)} aria-label={`${label}增加`}>
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
