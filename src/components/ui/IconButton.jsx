import React from "react";

export function IconButton({
  icon: Icon,
  label,
  showLabel = false,
  variant = "ghost",
  active = false,
  size = 18,
  className = "",
  ...rest
}) {
  const classes = [
    "icon-btn",
    `icon-btn--${variant}`,
    showLabel ? "icon-btn--labeled" : "",
    active ? "is-active" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={classes}
      aria-label={showLabel ? undefined : label}
      aria-pressed={active || undefined}
      title={label}
      {...rest}
    >
      <Icon size={size} strokeWidth={1.8} aria-hidden="true" />
      {showLabel && <span>{label}</span>}
    </button>
  );
}
