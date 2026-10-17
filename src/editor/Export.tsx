import { useEffect, useRef, useState } from "react";
import type { Project } from "../core/project";
import type { JobInfo } from "../../server/jobs";
import { NumberField } from "./Fields";
export default function Export({
  project,
  onChange,
  hasHits,
}: {
  project: Project;
  onChange: (p: Project) => void;
  hasHits: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [job, setJob] = useState<JobInfo | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [snapshot, setSnapshot] = useState("");
  const active =
    job && ["queued", "rendering", "encoding"].includes(job.status);
  const settings = project.export,
    duration = (settings.end - settings.start) * settings.repeats;
  const valid = hasHits && duration > 0 && duration <= 600;
  async function api(url: string, method = "GET", body?: unknown) {
    const session = await fetch("/api/session").then((r) => r.json());
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": session.token,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error || "Could not contact the local rendering service.",
      );
    return result;
  }
  useEffect(() => {
    if (!active || !job) return;
    let disposed = false,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch("/api/jobs/" + job.id);
        const next = await response.json();
        if (response.status === 404) {
          if (!disposed)
            setJob({
              ...job,
              status: "failed",
              error:
                "The render service no longer has this job. Render again to create a new video.",
            });
          return;
        }
        if (!response.ok) throw new Error(next.error);
        if (!disposed) {
          setJob(next);
          setError("");
        }
      } catch (e) {
        if (!disposed)
          setError(e instanceof Error ? e.message : "Progress is unavailable.");
      }
      if (!disposed) timer = setTimeout(poll, 500);
    };
    timer = setTimeout(poll, 250);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [job?.id, !!active]);
  async function render() {
    setError("");
    setBusy(true);
    try {
      const next = await api("/api/jobs", "POST", { project });
      setJob(next);
      setSnapshot(
        project.canvas.width +
          " × " +
          project.canvas.height +
          " · " +
          settings.fps +
          " fps · " +
          duration.toFixed(2) +
          " s",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!job) return;
    setBusy(true);
    try {
      const latest = await api("/api/jobs/" + job.id, "DELETE");
      setJob(latest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="primary" onClick={() => dialog.current?.showModal()}>
        Export video
      </button>
      <dialog
        ref={dialog}
        className="export-dialog"
        aria-labelledby="export-title"
      >
        <div className="dialog-heading">
          <div>
            <h2 id="export-title">Export video</h2>
            <p>H.264 MP4 · Solid background · No audio</p>
          </div>
          <button
            aria-label="Close export dialog"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <div className="export-size">
          {active
            ? snapshot
            : project.canvas.width + " × " + project.canvas.height + " pixels"}
        </div>
        <fieldset disabled={!!active || busy}>
          <div className="two">
            <NumberField
              label="Range start"
              suffix="seconds"
              value={settings.start}
              min={0}
              step={0.01}
              onChange={(n) =>
                onChange({ ...project, export: { ...settings, start: n } })
              }
            />
            <NumberField
              label="Range end"
              suffix="seconds"
              value={settings.end}
              min={0}
              step={0.01}
              onChange={(n) =>
                onChange({ ...project, export: { ...settings, end: n } })
              }
            />
          </div>
          <div className="two">
            <NumberField
              label="Repeat count"
              value={settings.repeats}
              min={1}
              max={100}
              step={1}
              onChange={(n) => {
                if (Number.isInteger(n))
                  onChange({ ...project, export: { ...settings, repeats: n } });
              }}
            />
            <label className="field">
              <span>Frame rate</span>
              <select
                aria-label="Frame rate"
                value={settings.fps}
                onChange={(e) =>
                  onChange({
                    ...project,
                    export: {
                      ...settings,
                      fps: Number(e.target.value) as 30 | 60,
                    },
                  })
                }
              >
                <option value="30">30 fps</option>
                <option value="60">60 fps</option>
              </select>
            </label>
          </div>
        </fieldset>
        <p className="hint">
          Destination: your browser’s download folder or Save As location. Each
          export gets a unique filename.
        </p>
        {!hasHits && (
          <p className="hint">
            Upload a MIDI pattern with note hits to export.
          </p>
        )}
        {hasHits && !valid && (
          <p className="error" role="alert">
            Choose a positive range and total duration of up to 10 minutes.
          </p>
        )}
        {job && (
          <div className="job-progress" aria-live="polite">
            {job.status === "complete" && (
              <small>Completed video: {snapshot}</small>
            )}
            <strong>
              {job.status === "complete"
                ? "Video ready"
                : job.status === "cancelled"
                  ? "Export cancelled"
                  : job.status === "failed"
                    ? "Export failed"
                    : job.status === "encoding"
                      ? "Finalizing MP4…"
                      : "Rendering frames…"}
            </strong>
            {!!active && (
              <>
                <progress value={job.completedFrames} max={job.totalFrames} />
                <small>
                  {job.completedFrames} / {job.totalFrames} frames
                </small>
              </>
            )}
            {job.error && (
              <p className="error" role="alert">
                {job.error}
              </p>
            )}
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          {active ? (
            <button disabled={busy} onClick={() => void cancel()}>
              Cancel export
            </button>
          ) : (
            <button
              className="primary"
              disabled={!valid || busy}
              onClick={() => void render()}
            >
              {busy ? "Starting…" : "Render MP4"}
            </button>
          )}
          {job?.status === "complete" && (
            <a
              className="download"
              href={"/api/jobs/" + job.id + "/video"}
              download
            >
              Download MP4
            </a>
          )}
        </div>
      </dialog>
    </>
  );
}
