import express from "express";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { Jobs } from "./jobs";
import type { RendererFactory } from "./renderer";
export type ServerOptions = {
  assets: string;
  jobsRoot: string;
  port?: number;
  ffmpeg?: string;
  rendererFactory?: RendererFactory;
  dev?: boolean;
};
export async function startServer(options: ServerOptions) {
  let port = options.port ?? 0,
    origin = "";
  let jobs!: Jobs;
  let closeDev: (() => Promise<void>) | undefined;
  const app = express(),
    http = createServer(app),
    token = randomBytes(32).toString("hex");
  app.use((req, res, next) => {
    const host = req.headers.host;
    if (host !== "127.0.0.1:" + port && host !== "localhost:" + port) {
      res.status(403).json({ error: "This app only accepts local requests." });
      return;
    }
    const requestOrigin = req.headers.origin;
    if (
      requestOrigin &&
      requestOrigin !== origin &&
      requestOrigin !== "http://localhost:" + port
    ) {
      res.status(403).json({ error: "Cross-origin requests are not allowed." });
      return;
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers["x-session-token"] !== token
    ) {
      res
        .status(403)
        .json({ error: "Session expired. Reload the editor and retry." });
      return;
    }
    next();
  });
  app.use(express.json({ limit: "20mb" }));
  app.get("/api/session", (_req, res) => res.json({ token }));
  app.post("/api/jobs", (req, res) => {
    try {
      const job = jobs.create(req.body?.project);
      res.status(202).json(job);
    } catch (e) {
      res
        .status(400)
        .json({ error: e instanceof Error ? e.message : "Invalid export." });
    }
  });
  app.get("/api/jobs/:id", (req, res) => {
    const job = jobs.get(String(req.params.id));
    if (!job) {
      res.status(404).json({ error: "Export not found." });
      return;
    }
    res.json(job);
  });
  app.delete("/api/jobs/:id", async (req, res) => {
    const id = String(req.params.id);
    const found = await jobs.cancel(id);
    res
      .status(found ? 200 : 404)
      .json(found ? jobs.get(id) : { error: "Export not found." });
  });
  app.get("/api/jobs/:id/video", (req, res) => {
    const id = String(req.params.id),
      output = jobs.output(id);
    if (!output) {
      res.status(404).json({ error: "The video is not ready." });
      return;
    }
    res.download(output, "drum-canvas-" + id.slice(0, 8) + ".mp4", {
      dotfiles: "allow",
    });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Unknown API route." }),
  );
  if (options.dev) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true, hmr: { server: http } },
      appType: "spa",
    });
    app.use(vite.middlewares);
    closeDev = () => vite.close();
  } else {
    app.use(express.static(options.assets));
    app.get("/", (_req, res) =>
      res.sendFile(path.join(options.assets, "index.html")),
    );
  }
  app.use(
    (
      error: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(400).json({ error: error.message });
    },
  );
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(port, "127.0.0.1", () => {
      const address = http.address();
      if (!address || typeof address === "string") {
        reject(new Error("Local server has no address."));
        return;
      }
      port = address.port;
      origin = "http://127.0.0.1:" + port;
      jobs = new Jobs(
        options.jobsRoot,
        origin,
        options.ffmpeg,
        options.rendererFactory,
      );
      http.off("error", reject);
      resolve();
    });
  });
  return {
    origin,
    jobs,
    async close() {
      await jobs.close();
      await closeDev?.();
      await new Promise<void>((resolve, reject) =>
        http.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
