import { BrowserWindow } from "electron";
import type { RendererFactory } from "../server/renderer";
export const createDesktopRenderer: RendererFactory = async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  return {
    async prepare(origin, project) {
      await window.loadURL(origin + "/render.html");
      await window.webContents.executeJavaScript(
        "window.prepareProject(" + JSON.stringify(project) + ")",
      );
    },
    frame(seconds) {
      return window.webContents.executeJavaScript(
        "window.renderFrame(" + JSON.stringify(seconds) + ")",
      );
    },
    async close() {
      if (!window.isDestroyed()) window.destroy();
    },
  };
};
