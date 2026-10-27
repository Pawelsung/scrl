import React from "react";
import { Minus, Plus } from "lucide-react";
import { Segmented } from "../ui/Segmented";
import { ColorField, Section } from "../ui/Field";

const RATIO_OPTIONS = [
  { value: "4:5", label: "4:5" },
  { value: "1:1", label: "1:1" },
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
];

const MIN_SLIDES = 2;
const MAX_SLIDES = 10;

export default function CanvasSettings({ project, setProject }) {
  const update = (patch) => setProject((prev) => ({ ...prev, ...patch }));

  return (
    <div className="panel-body">
      <Section title="輪播張數">
        <div className="stepper">
          <button
            type="button"
            aria-label="減少一張"
            disabled={project.count <= MIN_SLIDES}
            onClick={() => update({ count: project.count - 1 })}
          >
            <Minus size={16} aria-hidden="true" />
          </button>
          <output aria-live="polite">{project.count} 張</output>
          <button
            type="button"
            aria-label="增加一張"
            disabled={project.count >= MAX_SLIDES}
            onClick={() => update({ count: project.count + 1 })}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
      </Section>

      <Section title="比例">
        <Segmented label="比例" options={RATIO_OPTIONS} value={project.ratio} onChange={(ratio) => update({ ratio })} />
      </Section>

      <Section title="背景">
        <Segmented
          label="背景模式"
          options={[{ value: "solid", label: "純色" }, { value: "gradient", label: "漸層" }]}
          value={project.backgroundMode}
          onChange={(backgroundMode) => update({ backgroundMode })}
        />
        <div className="color-row">
          <ColorField label="主色" value={project.backgroundColor} onChange={(backgroundColor) => update({ backgroundColor })} />
          {project.backgroundMode === "gradient" && (
            <ColorField label="副色" value={project.backgroundColor2} onChange={(backgroundColor2) => update({ backgroundColor2 })} />
          )}
        </div>
      </Section>
    </div>
  );
}
