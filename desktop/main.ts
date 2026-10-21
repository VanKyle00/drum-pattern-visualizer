import { app, BrowserWindow, dialog, Menu, screen, session } from "electron";
import path from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { startServer } from "../server/service";
import { createDesktopRenderer } from "./renderer";

app.setName("Drum Canvas");
app.setAppUserModelId("com.vankyle.drumcanvas");
if (process.env.DRUM_CANVAS_DATA) {
  mkdirSync(process.env.DRUM_CANVAS_DATA, { recursive: true });
  app.setPath("userData", process.env.DRUM_CANVAS_DATA);
}
let window: BrowserWindow | undefined;
let server: Awaited<ReturnType<typeof startServer>> | undefined;
let quitting = false;
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app.on("before-quit", (event) => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    void server
      ?.close()
      .catch(() => {})
      .finally(() => app.quit());
    if (!server) app.quit();
  });
  app
    .whenReady()
    .then(async () => {
      const data = app.getPath("userData");
      server = await startServer({
        assets: path.join(app.getAppPath(), "dist"),
        jobsRoot: path.join(data, "render-jobs"),
        ffmpeg: app.isPackaged
          ? path.join(process.resourcesPath, "ffmpeg", "ffmpeg.exe")
          : path.resolve(
              app.getAppPath(),
              "..",
              "..",
              "node_modules",
              "ffmpeg-static",
              "ffmpeg.exe",
            ),
        rendererFactory: createDesktopRenderer,
        port: 0,
      });
      const area = screen.getPrimaryDisplay().workArea;
      let bounds: { width: number; height: number; x?: number; y?: number } = {
        width: Math.min(1440, area.width),
        height: Math.min(960, area.height),
      };
      try {
        const saved = JSON.parse(
          readFileSync(path.join(data, "window.json"), "utf8"),
        );
        if (
          [saved.width, saved.height, saved.x, saved.y].every(
            Number.isFinite,
          ) &&
          saved.width >= 900 &&
          saved.height >= 600 &&
          screen
            .getAllDisplays()
            .some(
              (d) =>
                saved.x < d.workArea.x + d.workArea.width &&
                saved.y < d.workArea.y + d.workArea.height &&
                saved.x + saved.width > d.workArea.x &&
                saved.y + saved.height > d.workArea.y,
            )
        )
          bounds = saved;
      } catch {}
      window = new BrowserWindow({
        ...bounds,
        minWidth: 900,
        minHeight: 600,
        title: "Drum Canvas",
        backgroundColor: "#182333",
        show: false,
        autoHideMenuBar: true,
        icon: path.join(app.getAppPath(), "icon.png"),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (event, url) => {
        if (new URL(url).origin !== server!.origin) event.preventDefault();
      });
      window.on("page-title-updated", (event) => {
        event.preventDefault();
        window?.setTitle("Drum Canvas");
      });
      window.on("close", () => {
        if (window && !window.isDestroyed()) {
          try {
            writeFileSync(
              path.join(data, "window.json"),
              JSON.stringify(window.getNormalBounds()),
            );
          } catch {}
        }
      });
      window.on("closed", () => {
        window = undefined;
        if (!quitting) app.quit();
      });
      session.defaultSession.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      );
      session.defaultSession.on("will-download", (_event, item) => {
        item.setSaveDialogOptions({
          title: item.getFilename().endsWith(".mp4")
            ? "Save video"
            : "Save project",
          defaultPath: path.join(app.getPath("downloads"), item.getFilename()),
        });
      });
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          {
            label: "File",
            submenu: [{ label: "Quit Drum Canvas", role: "quit" }],
          },
          {
            label: "Edit",
            submenu: [
              { role: "cut" },
              { role: "copy" },
              { role: "paste" },
              { role: "selectAll" },
            ],
          },
          {
            label: "View",
            submenu: [
              { role: "resetZoom" },
              { role: "zoomIn" },
              { role: "zoomOut" },
              { type: "separator" },
              { role: "togglefullscreen" },
            ],
          },
          {
            label: "Help",
            submenu: [
              {
                label: "About Drum Canvas",
                click: () => {
                  void dialog.showMessageBox(window!, {
                    type: "info",
                    title: "Drum Canvas",
                    message: "Drum Canvas " + app.getVersion(),
                    detail:
                      "Local MIDI-to-video editor. Your patterns and projects stay on this computer.",
                  });
                },
              },
            ],
          },
        ]),
      );
      await window.loadURL(server.origin);
      if (process.env.DRUM_CANVAS_TEST !== "1") window.show();
    })
    .catch((error) => {
      dialog.showErrorBox(
        "Drum Canvas could not start",
        error instanceof Error ? error.message : String(error),
      );
      app.quit();
    });
}
