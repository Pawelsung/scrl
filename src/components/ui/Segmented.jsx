import React from "react";

export function Segmented({ label, options, value, onChange }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => (
        <button
          key={optionValue}
          type="button"
          role="radio"
          aria-checked={value === optionValue}
          className={value === optionValue ? "is-active" : ""}
          onClick={() => onChange(optionValue)}
          title={optionLabel}
        >
          {Icon ? <Icon size={16} strokeWidth={1.8} aria-hidden="true" /> : null}
          {Icon ? <span className="sr-only">{optionLabel}</span> : optionLabel}
        </button>
      ))}
    </div>
  );
}
