import express from "express";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Jobs } from "./jobs";
const root = fileURLToPath(new URL("../", import.meta.url)),
  port = Number(process.env.PORT || 4173),
  origin = "http://127.0.0.1:" + port;
const app = express(),
  http = createServer(app),
  token = randomBytes(32).toString("hex");
const jobs = new Jobs(path.join(root, ".render-jobs"), origin);
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
  const found = await jobs.cancel(String(req.params.id));
  res.status(found ? 200 : 404).json({ cancelled: found });
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
if (process.argv.includes("--dev")) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true, hmr: { server: http } },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(root, "dist")));
  app.get("/", (_req, res) => res.sendFile(path.join(root, "dist/index.html")));
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
http.listen(port, "127.0.0.1", () =>
  console.log("Drum Canvas ready at " + origin),
);
async function shutdown() {
  await jobs.close();
  http.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
