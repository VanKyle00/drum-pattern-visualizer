import { useEffect, useState } from "react";
import type { Project, DrumElement, Shape } from "../core/project";
import type { MidiData } from "../core/midi";
import { noteLabel } from "../core/midi";
import { NumberField } from "./Fields";
type Props = {
  project: Project;
  selected: string | null;
  midi: MidiData;
  onChange: (p: Project) => void;
};
export default function Inspector({
  project,
  selected,
  midi,
  onChange,
}: Props) {
  const el = project.elements.find((e) => e.id === selected),
    [note, setNote] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    setName(el?.name || "");
    setError("");
  }, [el?.id, el?.name]);
  if (!el)
    return (
      <div className="empty-small">
        Select a drum on the canvas or add an element to customize it.
      </div>
    );
  const update = (patch: Partial<DrumElement>) =>
    onChange({
      ...project,
      elements: project.elements.map((e) =>
        e.id === el.id ? { ...e, ...patch } : e,
      ),
    });
  function assign(n: number) {
    if (!Number.isInteger(n) || n < 0 || n > 127) {
      setError("Choose a MIDI note from 0 to 127.");
      return;
    }
    setError("");
    update({ notes: [...new Set([...el!.notes, n])].sort((a, b) => a - b) });
    setNote("");
  }
  return (
    <>
      <h2>Element properties</h2>
      <label className="field">
        <span>Name</span>
        <input
          aria-label="Element name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim()) update({ name: name.trim() });
            else setName(el.name);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </label>
      <div className="two">
        <label className="field">
          <span>Shape</span>
          <select
            aria-label="Shape"
            value={el.shape}
            onChange={(e) => update({ shape: e.target.value as Shape })}
          >
            {["circle", "square", "diamond", "triangle"].map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Color</span>
          <input
            type="color"
            aria-label="Element color"
            value={el.color}
            onChange={(e) => update({ color: e.target.value })}
          />
        </label>
      </div>
      <div className="two">
        <NumberField
          label="X position"
          value={Math.round(el.x * 1000) / 10}
          suffix="%"
          min={0}
          max={100}
          step={0.1}
          onChange={(n) => update({ x: n / 100 })}
        />
        <NumberField
          label="Y position"
          value={Math.round(el.y * 1000) / 10}
          suffix="%"
          min={0}
          max={100}
          step={0.1}
          onChange={(n) => update({ y: n / 100 })}
        />
      </div>
      <NumberField
        label="Size"
        suffix="% of short edge"
        value={Math.round(el.size * 1000) / 10}
        min={0.5}
        max={45}
        step={0.5}
        onChange={(n) => update({ size: n / 100 })}
      />
      <h3>Hit reaction</h3>
      <div className="two">
        <NumberField
          label="Expansion"
          value={el.strength}
          min={0}
          max={2}
          step={0.1}
          onChange={(n) => update({ strength: n })}
        />
        <NumberField
          label="Decay"
          suffix="seconds"
          value={el.decay}
          min={0.02}
          max={3}
          step={0.01}
          onChange={(n) => update({ decay: n })}
        />
      </div>
      <div className="checks">
        <label>
          <input
            type="checkbox"
            checked={el.ripple}
            onChange={(e) => update({ ripple: e.target.checked })}
          />{" "}
          Ripple
        </label>
        <label>
          <input
            type="checkbox"
            checked={el.particles}
            onChange={(e) => update({ particles: e.target.checked })}
          />{" "}
          Particles
        </label>
      </div>
      <h3>MIDI mapping</h3>
      <label className="field">
        <span>Channel</span>
        <select
          aria-label="MIDI channel"
          value={el.channel ?? "all"}
          onChange={(e) =>
            update({
              channel: e.target.value === "all" ? null : Number(e.target.value),
            })
          }
        >
          <option value="all">All channels</option>
          {Array.from({ length: 16 }, (_, i) => (
            <option value={i + 1} key={i}>
              {i + 1}
            </option>
          ))}
        </select>
      </label>
      <div className="chips">
        {el.notes.map((n) => (
          <button
            key={n}
            className="chip"
            aria-label={"Remove note " + n}
            onClick={() => update({ notes: el.notes.filter((v) => v !== n) })}
          >
            {noteLabel(n, project.octaveOffset)} <small>{n}</small> ×
          </button>
        ))}
      </div>
      <div className="inline">
        <input
          aria-label="MIDI note number"
          type="number"
          min={0}
          max={127}
          placeholder="Note 0–127"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && note !== "") assign(Number(note));
          }}
        />
        <button
          onClick={() => note !== "" && assign(Number(note))}
          aria-label="Assign note"
        >
          Assign
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <label className="field">
        <span>Octave labels</span>
        <select
          aria-label="Octave convention"
          value={project.octaveOffset}
          onChange={(e) =>
            onChange({
              ...project,
              octaveOffset: Number(e.target.value) as -1 | 0 | 1,
            })
          }
        >
          <option value="-1">Note 60 = C3</option>
          <option value="0">Note 60 = C4</option>
          <option value="1">Note 60 = C5</option>
        </select>
      </label>
      <h3>
        Detected notes <small>Click to assign</small>
      </h3>
      <div className="detected">
        {midi.detected.length === 0 ? (
          <p className="hint">Import MIDI to see notes here.</p>
        ) : (
          midi.detected.map((row) => {
            const mapped = project.elements.some(
              (e) =>
                e.notes.includes(row.note) &&
                (e.channel === null || e.channel === row.channel),
            );
            return (
              <button
                key={row.note + ":" + row.channel}
                onClick={() => assign(row.note)}
                aria-label={
                  "Assign detected note " + row.note + " channel " + row.channel
                }
              >
                <span>
                  {noteLabel(row.note, project.octaveOffset)}{" "}
                  <small>{row.note}</small>
                </span>
                <small>
                  Ch {row.channel} · {row.count} hits {!mapped && "· Unmapped"}
                </small>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
