# MIDI Drum Video Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a local GUI that imports MIDI, maps notes to customizable draggable elements, and exports videos at editable canvas dimensions.

**Architecture:** A TypeScript browser editor talks to a loopback Node service for offline rendering. A shared pure scene evaluator and Canvas renderer drive both browser preview and headless Chromium export; FFmpeg encodes the rendered frames. Projects embed their MIDI bytes and editable settings.

**Tech Stack:** Node.js, TypeScript, React, Vite, midi-file, Zod, Playwright, Vitest, FFmpeg. Resolve compatible versions and lock them during setup; use the installed FFmpeg executable rather than downloading another binary.

**Spec:** `docs/superpowers/specs/2026-10-17-drum-visualizer-design.md`

## Global Constraints

- Default output is vertical 9:16.
- Accept even integer dimensions from 64 to 4096 pixels per side for the initial MP4 exporter.
- Export at the exact canvas dimensions, showing those dimensions in the export dialog; avoid a separate conflicting resolution setting.
- Numeric MIDI note number is authoritative.
- Initial version produces visual-only previews and videos; users add their original drum audio in their video editor.
- Guides and editor handles never appear in export.
- Export uses a snapshot of the project so ongoing editor changes cannot corrupt a running render.
- Do not overwrite existing exports without an explicit choice.
- Windows is the initial development platform. Bind the service to loopback, use argument arrays for FFmpeg, and keep all temporary cleanup within a verified job directory.

## Review Focus

1. Corrupt or truncated MIDI must leave the current project intact (Task 2).
2. Zero-duration files and invalid export ranges must not create an endless or empty render job (Tasks 2 and 5).
3. Resizing a canvas during playback must not distort shapes or alter an in-progress export (Tasks 3–5).
4. Repeated imports must not erase custom mappings or reuse stale MIDI timing (Tasks 2 and 4).
5. Cancel, encoder failure and disk errors must leave no deceptively complete MP4 file (Task 5).

## File boundaries and contracts

```text
src/core/project.ts       project schema, defaults, validation, serialization
src/core/midi.ts          MIDI bytes to timed hits and detected pitches
src/core/scene.ts         deterministic scene evaluation
src/core/draw.ts          shared Canvas renderer without editor chrome
src/editor/history.ts    undo/redo transactions
src/editor/Canvas.tsx    canvas fit, selection, dragging and resize handles
src/editor/Inspector.tsx element style and mapping controls
src/editor/CanvasSettings.tsx canvas dimensions, presets and background
src/editor/Timeline.tsx  transport and scrubbing
src/editor/Export.tsx    render settings, progress, cancellation and download
src/App.tsx              project lifecycle and editor composition
src/main.tsx             application entry
src/styles.css           responsive editor styles
src/render.ts            headless render entry point
server/index.ts          loopback routes and production assets
server/jobs.ts           job lifecycle and encoder pipeline
tests/                   unit tests and generated MIDI fixtures
e2e/                     editor and export integration checks
README.md                install, launch, controls and limitations
```

Public contracts (schema validation must enforce these shapes and numeric bounds):

```ts
type Shape = 'circle' | 'square' | 'diamond' | 'triangle';
type Element = {
  id: string; name: string; notes: number[]; channel: number | null;
  x: number; y: number; size: number; shape: Shape; color: string;
  strength: number; decay: number; ripple: boolean; particles: boolean;
};
type ExportSettings = { start: number; end: number; repeats: number; fps: 30 | 60 };
type Project = {
  version: 1; midi: { name: string; base64: string } | null;
  canvas: { width: number; height: number; aspectLocked: boolean; background: string };
  octaveOffset: -1 | 0 | 1; elements: Element[]; export: ExportSettings;
};
type Hit = { seconds: number; note: number; channel: number; velocity: number };
type MidiData = {
  hits: Hit[]; duration: number;
  detected: { note: number; channel: number; count: number }[];
};
type Scene = {
  width: number; height: number; background: string;
  marks: { id: string; x: number; y: number; radius: number; shape: Shape;
    color: string; reaction: number; age: number; ripple: boolean; particles: boolean }[];
};
```

Positions are normalized in [0,1], size is a radius fraction of the shorter canvas edge, velocity is normalized in [0,1], MIDI channels are displayed and stored as 1–16. Element array order is paint order. Validate finite numbers; hex colors; notes 0–127; size 0.005–0.45; strength 0–2; decay 0.02–3 seconds; unique IDs; at most 128 elements. Bound MIDI upload to 10 MiB and project JSON to 20 MiB. Export repeats are integers 1–100 and resulting duration must be positive and at most ten minutes.

## Task 1: Project model and working application shell

**Files:** Create `package.json`, lockfile, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/core/project.ts`, `tests/project.test.ts`, `.gitignore`.

**Interfaces:** Produce `defaultProject(): Project`, `parseProject(json: string): Project`, `serializeProject(project: Project): string`, `validateCanvas(width: number, height: number): boolean`.

- [x] Set up scripts `dev`, `build`, `test`, `test:e2e`, `start`; use TypeScript checking plus Vite for build, Vitest for unit tests. Exclude node_modules, dist, test artifacts and render jobs from Git.
- [x] Write the model tests before implementation:
  ```ts
  expect(validateCanvas(1080, 1920)).toBe(true);
  expect(validateCanvas(1081, 1920)).toBe(false);
  expect(validateCanvas(4098, 1080)).toBe(false);
  const original = defaultProject();
  expect(parseProject(serializeProject(original))).toEqual(original);
  expect(() => parseProject('{"version":99}')).toThrow();
  ```
- [x] Run `npm test -- tests/project.test.ts`; confirm missing implementations fail, then implement the schema and defaults. Default elements are kick [36], snare [38,40], hi-hat [42,44,46], channel null, center-stage arrangement, 1080×1920 canvas and 30 fps.
- [x] Build an editor shell with element list left, preview center, inspector right and transport below. Use restrained dark editing surfaces, clear labels and a responsive stacked layout. Show meaningful empty-MIDI state and upload action.
- [x] Run `npm test -- tests/project.test.ts` and `npm run build`; commit the model and shell together.

## Task 2: MIDI import, tempo conversion and mappings

**Files:** Create `src/core/midi.ts`, `tests/midi.test.ts`, `tests/fixtures.ts`; modify `src/App.tsx`, `src/editor/Inspector.tsx`.

**Interfaces:** Produce `parseMidiBytes(bytes: Uint8Array): MidiData`, `noteLabel(note: number, octaveOffset: -1 | 0 | 1): string`. Consume `Project`, `Hit`, `MidiData` from Task 1. `noteLabel(60,0)` is C4; -1 displays C3; +1 displays C5.

- [x] Generate MIDI fixtures using midi-file's writer: format 0 with simultaneous hits, format 1 with a separate tempo track, velocity-zero note-on, end-of-track trailing silence, and invalid format/timing headers.
- [x] Write tests with exact expectations:
  ```ts
  // Fixture PPQ 480; 500000 us/quarter until tick 480, then 1000000.
  expect(parseMidiBytes(tempoFixture()).hits.map(h => h.seconds)).toEqual([0, .5, 1.5]);
  expect(noteLabel(60, -1)).toBe('C3');
  expect(noteLabel(60, 0)).toBe('C4');
  expect(parseMidiBytes(zeroVelocityFixture()).hits).toHaveLength(1);
  expect(() => parseMidiBytes(new Uint8Array([0,1,2]))).toThrow();
  ```
- [x] Run `npm test -- tests/midi.test.ts` and observe failure; implement absolute track ticks, stable global tempo ordering, default 500000 µs/quarter, tick-to-seconds integration and maximum end-of-track duration. Reject format 2 and SMPTE explicitly. Surface no-hit and zero-duration imports as readable non-exportable states.
- [x] Build detected-note rows with number, display name, channel and hit count; assignment adds a note to the selected element. Add manual note input and channel filter. Highlight notes unmatched by any element. Preserve all element settings on subsequent imports and replace parsed MIDI atomically only after success.
- [x] Run unit tests; add UI checks that corrupt import preserves the existing project and a second valid import preserves custom mappings while replacing note counts. Commit the import/mapping flow.

## Task 3: Shared animation and editable geometry

**Files:** Create `src/core/scene.ts`, `src/core/draw.ts`, `src/editor/Canvas.tsx`, `src/editor/history.ts`, `tests/scene.test.ts`, `tests/history.test.ts`.

**Interfaces:** Produce `evaluateScene(project: Project, midi: MidiData, seconds: number): Scene`, `drawScene(ctx: CanvasRenderingContext2D, scene: Scene): void`, `createHistory(initial: Project)` with `commit(next)`, `undo()`, `redo()`, `current()` methods. Consume Task 1/2 types.

- [x] Add failing deterministic geometry tests:
  ```ts
  const p = defaultProject(); const m = parseMidiBytes(singleKickFixture());
  expect(evaluateScene(p,m,.1)).toEqual(evaluateScene(p,m,.1));
  const resized = {...p, canvas:{...p.canvas,width:1920,height:1080}};
  expect(evaluateScene(p,m,.1).marks[0].radius)
    .toBe(evaluateScene(resized,m,.1).marks[0].radius);
  const history = createHistory(p); history.commit(resized);
  expect(history.undo()).toEqual(p); expect(history.redo()).toEqual(resized);
  ```
- [x] Run targeted tests; implement matched-hit lookup by note/channel. Use maximum decaying matched velocity (`velocity * exp(-age / decay)`) within a bounded decay window, base radius plus strength-scaled reaction, and deterministic particles with no random values per frame. No future hit may affect an earlier timestamp.
- [x] Draw circle, square, diamond and triangle plus optional ripple/particles in paint order. Clear and fill the canvas background every frame. Exclude editor guides and handles from `drawScene`.
- [x] Implement pointer capture, reverse paint-order hit testing, normalized drag coordinates and radius handles. Fit canvas into the preview viewport and account for letterboxing, CSS scaling and device pixel ratio. Commit one undo entry per drag, not per pointer move; pointer cancellation restores the starting geometry.
- [x] Run scene/history tests and browser checks for dragging at two preview sizes, backward seeking, shared notes and channel filtering. Commit scene and direct editing.

## Task 4: Full editor controls and project persistence

**Files:** Create `src/editor/CanvasSettings.tsx`, `src/editor/Timeline.tsx`, `e2e/editor.spec.ts`; modify `src/App.tsx`, `src/editor/Inspector.tsx`, `src/styles.css`.

**Interfaces:** Inspector and settings take `{project, onChange(next: Project)}`; transport takes `{time, duration, playing, onSeek(seconds), onPlayingChange(playing)}`. App owns history, selection, parsed MIDI and playhead; project serialization stays in Task 1.

- [x] Add browser acceptance checks before implementation:
  ```ts
  await page.getByRole('button',{name:'Add element',exact:true}).click();
  await page.getByLabel('Element name').fill('Clap');
  await page.getByLabel('Shape',{exact:true}).selectOption('triangle');
  await page.getByLabel('Canvas width').fill('1081');
  await expect(page.getByRole('alert')).toContainText('even');
  ```
- [x] Implement element rename, duplicate with new ID, remove, layer movement, note mapping, shape/color, numeric x/y/size, strength/decay and ripple/particle toggles. Keep selection valid after deletion and undo.
- [x] Implement custom canvas dimensions, four presets, aspect lock, width/height swap, background, caption guides and undo/redo. For locked edits derive the other dimension from the stored ratio; if either is invalid show the proposed values and do not apply silently rounded dimensions. Preserve normalized placement and shorter-edge sizing.
- [x] Add layout buttons for stack/center/diagonal; reposition the starter elements only, preserving all mappings/styles and custom elements. Provide play/pause, seconds display and scrubber based on MIDI duration. Pause on MIDI replacement and clamp seeking to the new duration.
- [x] Implement save/download and open-project file controls. Persist MIDI bytes inside JSON; parse schema and MIDI before replacing current state. Save/reload canvas settings and mapping; show file and parse errors inline.
- [x] Run `npm run test:e2e -- e2e/editor.spec.ts`; extend checks to duplicate/remove, save/reopen, presets, swap, undo and corrupt project recovery. Commit complete editor interaction.

## Task 5: Offline MP4 rendering and job controls

**Files:** Create `server/index.ts`, `server/jobs.ts`, `src/render.ts`, `render.html`, `src/editor/Export.tsx`, `tests/jobs.test.ts`, `e2e/export.spec.ts`; modify package/build configuration.

**Interfaces:** `POST /api/jobs` accepts `{project: Project}` and returns `{id}`. `GET /api/jobs/:id` returns `{id,status,completedFrames,totalFrames,error?}`. `DELETE /api/jobs/:id` cancels. `GET /api/jobs/:id/video` downloads completed output. Status values: queued, rendering, encoding, complete, cancelled, failed. Produce browser render entry `window.renderProjectFrame(project: Project, seconds: number): Promise<string>` returning a PNG data URL using Tasks 2/3.

- [x] Write boundary tests for odd dimensions, end<=start, nonfinite timestamps, duration limit, invalid repeat count and a second concurrent job. Return actionable 4xx responses before creating output directories. Limit to one active render initially.
- [x] Implement a same-origin local server on loopback with bounded JSON payloads, Origin/Host validation and a session token required on mutating routes; do not enable wildcard CORS. Serve built editor/render assets. Job IDs are server-generated; download endpoints resolve internal job paths only.
- [x] Launch Playwright Chromium for the render page. For frame index `i`, evaluate time with:
  ```ts
  const range = project.export.end - project.export.start;
  const frames = Math.ceil(range * project.export.repeats * project.export.fps);
  const seconds = project.export.start + (i / project.export.fps) % range;
  ```
  Each repeat restarts from the selected source range; effects follow source timeline at that time. Parse MIDI once per immutable export snapshot. Use a verified job-owned directory and stream PNG buffers with backpressure into FFmpeg stdin instead of retaining all frames in memory.
- [x] Encode with argument-array process spawning: image2pipe PNG input, chosen frame rate, libx264, yuv420p and faststart, writing a temporary MP4. Publish with a final rename only after exit code 0 and nonempty output. Track rendering frames separately from encoder finalization; drain stderr for concise actionable errors.
- [x] Implement cancellation by stopping frame generation, closing Chromium and terminating the encoder; cleanup must be idempotent and scoped to that job. On encoder/spawn/write failures mark failed, retain a readable reason and never expose partial output as complete. Use unique export filenames, browser save/download destination and no automatic overwrite.
- [x] Build export UI for range, repeats, 30/60 fps, read-only canvas dimensions, destination explanation, progress, cancel and download. Snapshot state on start. Disable export without usable MIDI or valid settings.
- [x] Test fake encoder failure/cancellation and run a real 320×568 two-second export. Use ffprobe to assert H.264, yuv420p, dimensions, frame rate and duration within one frame. Compare preview and headless PNGs at identical timestamps before encoding, then inspect decoded video visually. Verify editing during export does not change its dimensions. Commit exporter.

## Task 6: End-to-end delivery

**Files:** Create `README.md`; refine relevant UI files; update this plan's checkboxes.

**Interfaces:** `npm run dev` starts editor and local API; `npm run build` creates production client/server output; `npm start` serves the built application locally.

- [x] Document Node setup, dependency installation, Playwright Chromium installation, FFmpeg PATH requirement, launch commands, configurable note labels, project save/load and solid-background silent export behavior.
- [x] Run `npm test`, `npm run build`, and `npm run test:e2e`. Investigate failures before marking work complete; do not substitute mocked export tests for the real video test.
- [x] Inspect the GUI at desktop and narrow widths; exercise MIDI upload, custom element, note assignment, drag, resize, canvas orientation swap, save/reopen and export. Verify file chooser/download interaction on Windows and no editor chrome in the exported frames.
- [x] Run final diff checks and review the spec against implemented behavior. Commit documentation and fixes, launch the application, and provide the local URL and verified export result.

## Self-review

All spec sections map to Tasks 1–6. MIDI timing and mapping belong to Task 2; geometry and deterministic preview belong to Task 3; customization, canvas settings, playback and saved projects belong to Task 4; exact-resolution export and error/cancel behavior belong to Task 5. The five Review Focus conditions have targeted checks in their owning tasks. Transparent exports, audio synthesis and desktop packaging remain outside this version.
