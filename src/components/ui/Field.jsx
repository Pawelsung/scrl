import React from "react";

export function Field({ label, children, inline = false }) {
  return (
    <label className={`field ${inline ? "field--inline" : ""}`}>
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}

export function ColorField({ label, value, onChange, disabled = false }) {
  return (
    <label className={`color-field ${disabled ? "is-disabled" : ""}`}>
      <input type="color" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      <span className="color-field__meta">
        <span className="field__label">{label}</span>
        <span className="color-field__hex">{value.toUpperCase()}</span>
      </span>
    </label>
  );
}

export function Section({ title, action, children }) {
  return (
    <section className="section">
      {(title || action) && (
        <div className="section__head">
          {title && <h3>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
