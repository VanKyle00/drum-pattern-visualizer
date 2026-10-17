# MIDI drum video editor

## Purpose

Create editable reactive drum visuals from uploaded MIDI patterns and export video files for further editing. Users arrange and style their own drum elements through a GUI. Default output is vertical 9:16.

## Proposed application

A local browser interface backed by a local rendering service. MIDI files and saved projects stay on the user's computer. This approach supports direct canvas editing and reliable offline video rendering without tying export speed or timing to live browser playback. A packaged desktop application can be considered separately; it is not required for the initial version.

## MIDI import and mapping

- Import Standard MIDI files, formats 0 and 1. Respect ticks per quarter note, tempo changes, note-on timing and velocity. Reject unsupported SMPTE timing and format 2 files with clear messages.
- List detected MIDI pitches with their numeric note number, display name, channel and hit count. Treat note-on events with zero velocity as note-offs, not hits.
- Users assign one or more pitches to each element, optionally filtering by MIDI channel. Allow the same pitch to drive multiple elements intentionally. Show unmapped notes without silently discarding them.
- Supply editable kick, snare and hi-hat starting elements and suggested General MIDI mappings; suggestions never override a saved user mapping.
- Numeric MIDI note number is authoritative. Default naming uses middle C = C4 (note 60), with a visible octave-label convention setting because different DAWs call the same pitch C3, C4 or C5. Always show the number alongside the name.
- Click a detected note to assign it to the selected element. A manual numeric-note field also supports mappings absent from the currently loaded file.

## Custom elements and layout

- Add, rename, duplicate and remove elements; each has an independent mapping and visual style.
- An editable-size canvas supports selection, dragging, resize handles and numeric position/size inputs. Store element centers as normalized x/y coordinates and sizes relative to the canvas's shorter edge so export matches the preview without distorting shapes.
- Per-element controls: circle, square, diamond or triangle; fill color; base size; hit expansion strength; decay duration; and optional hit particles/ripple. Velocity affects reaction strength.
- Elements remain visible between hits. Keep the base position fixed during playback so the arrangement remains editable.
- Include stack, center and diagonal starting layouts inspired by the previews. Applying a layout must preserve MIDI mappings and custom elements.
- Support layering controls, undo/redo, configurable solid background color and optional caption-area guides. Guides and editor handles never appear in export.

## Canvas dimensions

- Editable width and height in pixels, with an optional aspect-ratio lock and a swap-width/height action.
- Presets: portrait 1080 × 1920 (9:16), landscape 1920 × 1080 (16:9), square 1080 × 1080 (1:1), and portrait 1080 × 1350 (4:5). Default to 1080 × 1920; custom dimensions are equally supported.
- Accept even integer dimensions from 64 to 4096 pixels per side for the initial MP4 exporter. Show inline validation for unsupported values; do not silently round or crop dimensions.
- Resizing preserves normalized element centers and scales element sizes uniformly with the shorter edge. Circles remain circles and squares remain squares when the aspect ratio changes. Users can adjust the resulting composition using the layout controls.
- Canvas changes support undo/redo. The preview fits the available editor space without changing output dimensions. Save and restore canvas dimensions and the aspect-ratio lock with the project.
- Export at the exact canvas dimensions, showing those dimensions in the export dialog; avoid a separate conflicting resolution setting.

## Playback

- Play/pause and scrub the imported MIDI timeline. Show duration and current time.
- Use the MIDI tempo map by default. Initial version produces visual-only previews and videos; users add their original drum audio in their video editor.
- Provide an explicit export range and repeat count for short patterns. Default range follows the MIDI end-of-track duration; allow adjustment for trailing silence or intentional loop length.
- Animation state is a deterministic function of timestamp and MIDI events. Seeking backwards, repeated playback and export must produce matching frames.

## Video export

- Default: canvas dimensions (initially 1080 × 1920), 30 fps, H.264 MP4 with a solid background. Offer 60 fps; users set output resolution through canvas dimensions.
- Render frames offline with the same scene and animation rules as the preview, then encode locally with FFmpeg. Do not record the live preview or depend on real-time screen capture.
- Export UI shows destination, range, repeat count, resolution, frame rate, progress, cancellation and actionable failures. Export uses a snapshot of the project so ongoing editor changes cannot corrupt a running render.
- Write temporary output and publish the final file only after successful encoding. Cancellation cleans only the job's own temporary files. Do not overwrite existing exports without an explicit choice.
- Transparent video is deferred; the first version clearly labels exports as using a solid background.

## Save and reopen

Save a versioned project file containing the MIDI data, mapping, elements, styles, background, layout, canvas dimensions, aspect-ratio lock and export settings. Reopening must reproduce the scene without requiring the original MIDI file location. Validate imported projects and preserve the current project if loading fails.

## Implementation boundaries

Separate MIDI parsing/tempo conversion, project state, deterministic scene evaluation, canvas editing and video jobs. The editor and exporter consume the same scene evaluator. The local service binds to loopback and validates file sizes, settings and render job requests.

## Validation

Check tempo changes, simultaneous hits, velocity-zero note-ons, channel filtering, alternate octave labels, unmapped notes and multiple notes per element. Exercise adding/customizing/dragging/resizing elements and project round trips. Compare preview and export frames at chosen timestamps, inspect output resolution/frame rate/duration, and verify cancel/error behavior with a real short MP4 export.

Also verify custom canvas dimensions, presets, aspect-ratio locking, swapping dimensions, resize undo/redo, shape proportions after aspect-ratio changes, invalid dimensions and exact exported frame dimensions.

## Design choices for review

The requested features are MIDI upload, editable note-to-element mappings, custom elements, draggable layout, adjustable sizes/colors/shapes, editable canvas dimensions and video export. Proposed defaults are a local browser interface, visual-only export, solid-background MP4, and MIDI tempo-map timing. These defaults are open to revision before implementation.
