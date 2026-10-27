import React from "react";
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

  return (
    <label className="field field--slider">
      <span className="field__label-row">
        <span>{label}</span>
        <output>
          {displayValue}
          {suffix}
        </output>
      </span>
      <div className="slider-stepper">
        <button type="button" className="slider-stepper__button" onClick={() => nudge(-1)} aria-label={`${label} 減少`}>
          -
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numericValue}
          onChange={(e) => commit(e.target.value)}
        />
        <button type="button" className="slider-stepper__button" onClick={() => nudge(1)} aria-label={`${label} 增加`}>
          +
        </button>
      </div>
    </label>
  );
}
