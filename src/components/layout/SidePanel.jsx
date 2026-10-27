import React from "react";

// Desktop left column: an icon rail that switches the panel beside it.
export default function SidePanel({ tabs, activeTab, onTabChange, children }) {
  const active = tabs.find((tab) => tab.key === activeTab) || tabs[0];
  return (
    <aside className="side-panel">
      <nav className="rail" aria-label="工具">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={`rail__item ${key === active.key ? "is-active" : ""}`}
            aria-current={key === active.key ? "page" : undefined}
            onClick={() => onTabChange(key)}
          >
            <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <section className="side-panel__content" aria-label={active.label}>
        <header className="side-panel__head">
          <h2>{active.label}</h2>
        </header>
        <div className="side-panel__scroll">{children}</div>
      </section>
    </aside>
  );
}
