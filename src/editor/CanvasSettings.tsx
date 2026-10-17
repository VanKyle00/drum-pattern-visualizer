import { useEffect, useState } from "react";
import { type Project, validateCanvas } from "../core/project";
export default function CanvasSettings({
  project,
  onChange,
  guides,
  onGuides,
}: {
  project: Project;
  onChange: (p: Project) => void;
  guides: boolean;
  onGuides: (v: boolean) => void;
}) {
  const [width, setWidth] = useState(String(project.canvas.width)),
    [height, setHeight] = useState(String(project.canvas.height)),
    [error, setError] = useState("");
  useEffect(() => {
    setWidth(String(project.canvas.width));
    setHeight(String(project.canvas.height));
    setError("");
  }, [project.canvas.width, project.canvas.height]);
  const apply = (w: number, h: number) => {
    if (!validateCanvas(w, h)) {
      setError("Use even whole pixels from 64 to 4096 on each side.");
      return;
    }
    setError("");
    onChange({
      ...project,
      canvas: { ...project.canvas, width: w, height: h },
    });
  };
  const presets = ["1080x1920", "1920x1080", "1080x1080", "1080x1350"],
    key = project.canvas.width + "x" + project.canvas.height;
  return (
    <>
      <h2>Canvas</h2>
      <label className="field">
        <span>Format</span>
        <select
          aria-label="Canvas preset"
          value={presets.includes(key) ? key : "custom"}
          onChange={(e) => {
            if (e.target.value !== "custom") {
              const [w, h] = e.target.value.split("x").map(Number);
              apply(w, h);
            }
          }}
        >
          <option value="custom">Custom dimensions</option>
          <option value="1080x1920">Portrait · 9:16</option>
          <option value="1920x1080">Landscape · 16:9</option>
          <option value="1080x1080">Square · 1:1</option>
          <option value="1080x1350">Portrait · 4:5</option>
        </select>
      </label>
      <div className="two">
        <label className="field">
          <span>
            Width <small>px</small>
          </span>
          <input
            aria-label="Canvas width"
            type="number"
            min={64}
            max={4096}
            step={2}
            value={width}
            onChange={(e) => {
              setWidth(e.target.value);
              if (project.canvas.aspectLocked)
                setHeight(
                  String(
                    (Number(e.target.value) * project.canvas.height) /
                      project.canvas.width,
                  ),
                );
            }}
          />
        </label>
        <label className="field">
          <span>
            Height <small>px</small>
          </span>
          <input
            aria-label="Canvas height"
            type="number"
            min={64}
            max={4096}
            step={2}
            value={height}
            onChange={(e) => {
              setHeight(e.target.value);
              if (project.canvas.aspectLocked)
                setWidth(
                  String(
                    (Number(e.target.value) * project.canvas.width) /
                      project.canvas.height,
                  ),
                );
            }}
          />
        </label>
      </div>
      <div className="checks">
        <label>
          <input
            type="checkbox"
            checked={project.canvas.aspectLocked}
            onChange={(e) =>
              onChange({
                ...project,
                canvas: { ...project.canvas, aspectLocked: e.target.checked },
              })
            }
          />{" "}
          Lock aspect ratio
        </label>
      </div>
      <div className="two">
        <button onClick={() => apply(Number(width), Number(height))}>
          Apply dimensions
        </button>
        <button
          onClick={() => apply(project.canvas.height, project.canvas.width)}
        >
          Swap dimensions
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <label className="field color-row">
        <span>Background</span>
        <input
          aria-label="Background color"
          type="color"
          value={project.canvas.background}
          onChange={(e) =>
            onChange({
              ...project,
              canvas: { ...project.canvas, background: e.target.value },
            })
          }
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={guides}
          onChange={(e) => onGuides(e.target.checked)}
        />{" "}
        Caption guides
      </label>
    </>
  );
}
