# Implementation verification

The editor is implemented on branch `codex/drum-video-editor`.

## Verified behavior

- 14 unit tests pass: project validation/round trips, MIDI format and tempo handling, octave labels, note/channel matching, deterministic geometry, undo/redo and export bounds.
- 10 browser tests pass: MIDI upload, custom elements, note assignment, dragging and resizing, canvas presets and aspect locking, project reopening, corrupt import recovery, real MP4 downloads, cancellation, concurrent-job rejection, encoder/disk errors and export-state recovery.
- TypeScript checking and the Vite production build pass.
- A separate production-build smoke test exported a 1080 × 1920 H.264 video at 60 fps, with duration 1.000 seconds and no browser page errors. The decoded first frame was visually inspected.
- Desktop and 390-pixel-wide editor screenshots were inspected; controls and canvas fit without horizontal overflow.

## Review

An independent reviewer was requested, but its invocation failed because of the account usage limit. A local author review covered the planned failure modes instead. This is not an independent review.

The final review found and fixed stale export dimensions, fractional repeat values displaying without being applied, missing-job recovery after a service restart, and cancellation racing with completion. Regression checks pass. No known blocking findings remain.

## Implementation decisions

- Windows-native ledger bookkeeping replaced Bash helper scripts; task records were maintained manually.
- Mapping and direct-editing browser checks were integrated with the complete editor, rather than maintaining separate intermediate browser setups.
- The render page receives a project snapshot once and then accepts timestamps, avoiding repeated MIDI transfer for every frame.
- The production server runs checked TypeScript through `tsx`; the build bundles the browser assets. Normal installation includes the runtime tooling required by `npm start`.

## Current scope

Exports use a solid background and contain no audio. Save projects before closing or refreshing; there is no autosave. Download links expire on server restart, while rendered files remain in `.render-jobs`.
