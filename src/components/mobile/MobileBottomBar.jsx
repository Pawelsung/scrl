import React from "react";

const ITEMS = [
  { key: "project", label: "專案" },
  { key: "assets", label: "素材" },
  { key: "templates", label: "模板" },
  { key: "edit", label: "編輯" },
];

export default function MobileBottomBar({
  activeTab,
  onTabChange,
  zoomPercent,
}) {
  return (
    <div className="mobile-bottom-bar">
      {ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={activeTab === item.key ? "active" : ""}
          onClick={() => onTabChange(item.key)}
        >
          {item.label}
        </button>
      ))}

      <div className="mobile-zoom-readout">
        縮放 {typeof zoomPercent === "number" ? `${zoomPercent}%` : "100%"}
      </div>
    </div>
  );
}
