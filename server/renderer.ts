import type { Project } from "../src/core/project";
export interface FrameRenderer {
  prepare(origin: string, project: Project): Promise<void>;
  frame(seconds: number): Promise<string>;
  close(): Promise<void>;
}
export type RendererFactory = () => Promise<FrameRenderer>;
// Only the browser/server edition loads Playwright. Desktop supplies Electron.
export const createBrowserRenderer: RendererFactory = async () => {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    return {
      async prepare(origin, project) {
        await page.goto(origin + "/render.html");
        await page.waitForFunction(
          () => typeof window.prepareProject === "function",
        );
        await page.evaluate((p) => window.prepareProject(p), project);
      },
      frame: (seconds) => page.evaluate((t) => window.renderFrame(t), seconds),
      close: () => browser.close(),
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
};
