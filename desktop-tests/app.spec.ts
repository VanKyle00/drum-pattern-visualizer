import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
test("packaged app runs and exports using its bundled renderer and encoder", async () => {
  const executable = path.resolve("release/win-unpacked/Drum Canvas.exe");
  const app = await electron.launch({
    executablePath: executable,
    env: {
      ...process.env,
      DRUM_CANVAS_TEST: "1",
      DRUM_CANVAS_DATA: test.info().outputPath("profile"),
      FFMPEG_PATH: "",
      PATH: process.env.SystemRoot + "\\System32",
    },
  });
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Drum Canvas", exact: true }),
    ).toBeVisible();
    const prefs = await app.evaluate(({ BrowserWindow }) =>
      (
        BrowserWindow.getAllWindows()[0].webContents as unknown as {
          getLastWebPreferences(): {
            nodeIntegration: boolean;
            contextIsolation: boolean;
            sandbox: boolean;
          };
        }
      ).getLastWebPreferences(),
    );
    expect(prefs.nodeIntegration).toBe(false);
    expect(prefs.contextIsolation).toBe(true);
    expect(prefs.sandbox).toBe(true);
    const background = page.getByLabel("Canvas background color");
    const originalBackground = await background.inputValue();
    await background.fill("#123456");
    await page.getByRole("heading", { name: "Drum Canvas", exact: true }).click();
    await page.keyboard.press("Control+z");
    await expect(background).toHaveValue(originalBackground);
    await page.keyboard.press("Control+Shift+z");
    await expect(background).toHaveValue("#123456");
    await page
      .getByLabel("Upload MIDI")
      .setInputFiles(path.resolve("public/examples/broken-beat.mid"));
    await page.getByLabel("Canvas width").fill("320");
    await page.getByLabel("Canvas height").fill("568");
    await page.getByRole("button", { name: "Apply dimensions" }).click();
    await page
      .getByRole("button", { name: "Export video", exact: true })
      .click();
    await page.getByRole("button", { name: "Render MP4", exact: true }).click();
    await expect(page.getByRole("link", { name: "Download MP4" })).toBeVisible({
      timeout: 60000,
    });
    const target = test.info().outputPath("desktop-export.mp4");
    await app.evaluate(({ session }, file) => {
      session.defaultSession.once("will-download", (_event, item) =>
        item.setSavePath(file),
      );
    }, target);
    await page.getByRole("link", { name: "Download MP4" }).click();
    await expect
      .poll(async () => {
        try {
          return (await stat(target)).size;
        } catch {
          return 0;
        }
      })
      .toBeGreaterThan(1000);
    const info = JSON.parse(
      execFileSync(
        "ffprobe",
        ["-v", "quiet", "-show_streams", "-of", "json", target],
        { encoding: "utf8" },
      ),
    );
    expect(info.streams[0]).toMatchObject({
      codec_name: "h264",
      width: 320,
      height: 568,
    });
    await page.getByRole("button", { name: "Close export dialog" }).click();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].showInactive(),
    );
    await page.screenshot({ path: test.info().outputPath("desktop-app.png") });
    const projectPath = test.info().outputPath("saved.drum.json");
    await app.evaluate(({ session }, file) => {
      session.defaultSession.once("will-download", (_event, item) =>
        item.setSavePath(file),
      );
    }, projectPath);
    await page
      .getByRole("button", { name: "Save project", exact: true })
      .click();
    await expect
      .poll(async () => {
        try {
          return JSON.parse(await readFile(projectPath, "utf8")).canvas.width;
        } catch {
          return 0;
        }
      })
      .toBe(320);
  } finally {
    await app.close();
  }
});
