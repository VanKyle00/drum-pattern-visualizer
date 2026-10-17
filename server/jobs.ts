import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, rename, stat, rm } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "@playwright/test";
import {
  base64ToBytes,
  projectSchema,
  type Project,
  type ExportSettings,
} from "../src/core/project";
import { parseMidiBytes } from "../src/core/midi";

export function frameTime(settings: ExportSettings, i: number) {
  return (
    settings.start + ((i / settings.fps) % (settings.end - settings.start))
  );
}
export function validateExport(input: unknown) {
  const project = projectSchema.parse(input);
  if (!project.midi) throw new Error("Import MIDI before exporting.");
  const midi = parseMidiBytes(base64ToBytes(project.midi.base64)),
    s = project.export;
  if (!midi.hits.length || midi.duration <= 0)
    throw new Error("The MIDI must contain note hits and a positive duration.");
  if (s.end <= s.start || s.start >= midi.duration)
    throw new Error(
      "Choose an end after the start, with the start inside the MIDI timeline.",
    );
  const duration = (s.end - s.start) * s.repeats;
  if (duration > 600)
    throw new Error(
      "Export duration cannot exceed 10 minutes. Shorten the range or reduce repeats.",
    );
  return { project, totalFrames: Math.ceil(duration * s.fps) };
}
export type JobStatus =
  "queued" | "rendering" | "encoding" | "complete" | "cancelled" | "failed";
export type JobInfo = {
  id: string;
  status: JobStatus;
  completedFrames: number;
  totalFrames: number;
  error?: string;
};
type Job = JobInfo & {
  directory: string;
  output: string;
  cancelled: boolean;
  process?: ChildProcessWithoutNullStreams;
  browser?: Browser;
  finished?: Promise<void>;
};
export class Jobs {
  private jobs = new Map<string, Job>();
  constructor(
    private root: string,
    private origin: string,
    private ffmpeg = process.env.FFMPEG_PATH || "ffmpeg",
  ) {}
  get(id: string): JobInfo | undefined {
    const j = this.jobs.get(id);
    if (!j) return;
    return {
      id: j.id,
      status: j.status,
      completedFrames: j.completedFrames,
      totalFrames: j.totalFrames,
      ...(j.error ? { error: j.error } : {}),
    };
  }
  output(id: string) {
    const j = this.jobs.get(id);
    return j?.status === "complete" ? j.output : undefined;
  }
  create(input: unknown) {
    if (
      [...this.jobs.values()].some((j) =>
        ["queued", "rendering", "encoding"].includes(j.status),
      )
    )
      throw new Error("Another export is running. Wait for it or cancel it.");
    const { project, totalFrames } = validateExport(input),
      id = randomUUID(),
      directory = path.resolve(this.root, id);
    const job: Job = {
      id,
      directory,
      output: path.join(directory, "video.mp4"),
      status: "queued",
      completedFrames: 0,
      totalFrames,
      cancelled: false,
    };
    this.jobs.set(id, job);
    job.finished = this.run(job, project);
    return this.get(id)!;
  }
  async cancel(id: string) {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (!["queued", "rendering", "encoding"].includes(job.status)) return true;
    job.cancelled = true;
    job.process?.kill();
    await job.browser?.close().catch(() => {});
    await job.finished;
    return true;
  }
  async close() {
    await Promise.all([...this.jobs.keys()].map((id) => this.cancel(id)));
  }
  private async run(job: Job, project: Project) {
    let encoderClosed: Promise<number | null> | undefined;
    let encoderError: Error | undefined,
      stderr = "";
    const cancelled = () => {
      if (job.cancelled) throw new Error("Export cancelled.");
    };
    try {
      await mkdir(job.directory, { recursive: true });
      cancelled();
      job.browser = await chromium.launch({ headless: true });
      cancelled();
      const page = await job.browser.newPage();
      await page.goto(this.origin + "/render.html");
      await page.waitForFunction(
        () => typeof window.prepareProject === "function",
      );
      await page.evaluate((p) => window.prepareProject(p), project);
      cancelled();
      const temporary = path.join(job.directory, "partial.mp4");
      const encoder = spawn(
        this.ffmpeg,
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-f",
          "image2pipe",
          "-vcodec",
          "png",
          "-framerate",
          String(project.export.fps),
          "-i",
          "pipe:0",
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "18",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          "-y",
          temporary,
        ],
        { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
      );
      job.process = encoder;
      encoder.on("error", (e) => {
        encoderError ??= e;
      });
      encoder.stdin.on("error", (e) => {
        encoderError ??= e;
      });
      encoder.stderr.on("data", (data) => {
        stderr = (stderr + data.toString()).slice(-3000);
      });
      encoder.stdout.resume();
      encoderClosed = new Promise((resolve) => encoder.once("close", resolve));
      await new Promise<void>((resolve, reject) => {
        encoder.once("spawn", () => resolve());
        encoder.once("error", reject);
      });
      job.status = "rendering";
      for (let i = 0; i < job.totalFrames; i++) {
        cancelled();
        if (encoderError) throw encoderError;
        if (encoder.exitCode !== null)
          throw new Error(stderr || "Video encoder exited early.");
        const data = await page.evaluate(
          (t) => window.renderFrame(t),
          frameTime(project.export, i),
        );
        cancelled();
        const buffer = Buffer.from(data.slice(data.indexOf(",") + 1), "base64");
        await new Promise<void>((resolve, reject) =>
          encoder.stdin.write(buffer, (error) =>
            error ? reject(error) : resolve(),
          ),
        );
        job.completedFrames = i + 1;
      }
      encoder.stdin.end();
      job.status = "encoding";
      const code = await encoderClosed;
      cancelled();
      if (encoderError) throw encoderError;
      if (code !== 0)
        throw new Error(stderr || "Video encoder did not finish successfully.");
      if ((await stat(temporary)).size === 0)
        throw new Error("Video encoder produced an empty file.");
      await rename(temporary, job.output);
      cancelled();
      job.status = "complete";
    } catch (error) {
      job.process?.kill();
      if (encoderClosed) await encoderClosed;
      job.status = job.cancelled ? "cancelled" : "failed";
      if (!job.cancelled)
        job.error =
          error instanceof Error
            ? error.message.includes("ENOENT")
              ? "FFmpeg was not found. Install FFmpeg and add it to PATH, then restart the app."
              : error.message
            : "Export failed.";
      // Only this server-created UUID job directory can be removed.
      const relative = path.relative(path.resolve(this.root), job.directory);
      if (relative === job.id && !relative.startsWith(".."))
        await rm(job.directory, { recursive: true, force: true }).catch(
          () => {},
        );
    } finally {
      await job.browser?.close().catch(() => {});
      job.browser = undefined;
      job.process = undefined;
    }
  }
}
