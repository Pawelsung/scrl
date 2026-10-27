import React from "react";

// A schematic of the same geometry used when applying this template.
export default function TemplatePreview({ template }) {
  const { preview, previewWidth, previewHeight } = template;
  if (!preview) return null;
  return (
    <svg className="template-layout-preview" viewBox={`0 0 ${previewWidth} ${previewHeight}`} role="img" aria-label={`${template.name}版型示意`}>
      <rect width={previewWidth} height={previewHeight} fill="#d9dde3" />
      {preview.slots.map(slot => (
        <rect key={slot.id} x={slot.x} y={slot.y} width={slot.width} height={slot.height}
          rx={slot.radius || 0} transform={`rotate(${slot.rotation || 0} ${slot.x} ${slot.y})`}
          fill={slot.swapLayer === "overlay" ? "#e4b77d" : "#8296b0"}
          stroke={slot.stroke || "#f8fafc"} strokeWidth={Math.max(3, slot.strokeWidth || 0)} />
      ))}
      {preview.elements.filter(item => item.type === "text").map(item => (
        <text key={item.id} x={item.x} y={item.y + item.fontSize} fontSize={item.fontSize} fill={item.fill || "#172033"}>
          {(item.text || "").split("\n").map((line, index) => <tspan key={index} x={item.x} dy={index ? item.fontSize * 1.15 : 0}>{line}</tspan>)}
        </text>
      ))}
    </svg>
  );
}
