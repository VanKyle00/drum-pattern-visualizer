# Desktop packaging

Goal: a local Windows x64 application that opens directly into Drum Canvas, with MIDI import, project files and MP4 export working without a terminal, Node installation or separately installed FFmpeg.

Implementation:
- Keep the existing editor and shared frame renderer.
- Wrap the editor in a sandboxed Electron window; use a hidden Electron window for export frames so no separate Chromium binary is shipped.
- Refactor the loopback server into a start/close service with an automatically allocated port for the desktop app; retain the current browser development commands.
- Bundle a Windows FFmpeg executable and its notices. Store render jobs in the user's application data directory.
- Use native file pickers and save dialogs. Remember window size/position and enforce a single running app instance.
- Build a per-user Windows installer and a portable executable. No administrator permissions or background service required.
- Verify existing tests plus launch and real export from the packaged app. Keep installer outputs out of source control; provide downloadable executables separately.

Packaging choices: Electron shares its runtime with rendering. The app is self-contained rather than a tiny shortcut into a separately running web server. Code signing is not configured.

## Build on Windows

Run `npm ci`, then `npm run desktop:dist` to generate installer and portable executables in `release/`. `npm run desktop:pack` builds an unpacked app for testing. `npm run desktop:dev` builds and opens the desktop wrapper from source. No separate Playwright Chromium download is needed for desktop rendering.

The staging app contains bundled application code, static UI assets, and notices; development dependencies are excluded. Electron and FFmpeg are the main contributors to package size. FFmpeg is distributed as a separate executable with its license and source/build links.

Version 1.1.0 outputs: installer 125,629,982 bytes; portable 125,393,622 bytes. The portable launcher was smoke-tested by connecting to its extracted application's editor. Playwright's Electron launcher cannot attach directly through the NSIS portable wrapper, so the complete automated export test targets the identical unpacked application. Installer installation has not been automated.

## Verification

`npm test` and `npm run test:e2e` cover the shared application. After packaging, `npm run test:desktop` launches the actual executable with Node and system FFmpeg removed from PATH. It checks renderer isolation, MIDI import, background undo/redo, custom dimensions, real H.264 MP4 rendering, and saving project JSON. A host-side ffprobe verifies the exported video. Test files and screenshots are written under `desktop-test-results/`.
