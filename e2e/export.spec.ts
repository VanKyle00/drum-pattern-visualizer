import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { defaultProject, bytesToBase64 } from "../src/core/project";
import { singleKickFixture } from "../tests/fixtures";
import { Jobs } from "../server/jobs";
test("exports a real MP4 at the requested dimensions and rejects cross-origin writes", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const token = await request
    .get("/api/session")
    .then((r) => r.json())
    .then((r) => r.token);
  const p = defaultProject();
  p.canvas.width = 320;
  p.canvas.height = 568;
  p.midi = { name: "kick.mid", base64: bytesToBase64(singleKickFixture()) };
  p.export.end = 2;
  const blocked = await request.post("/api/jobs", {
    headers: { Origin: "https://example.com", "X-Session-Token": token },
    data: { project: p },
  });
  expect(blocked.status()).toBe(403);
  const response = await request.post("/api/jobs", {
    headers: { "X-Session-Token": token },
    data: { project: p },
  });
  expect(response.status()).toBe(202);
  const { id } = await response.json();
  await expect
    .poll(
      async () => {
        const job = await request.get("/api/jobs/" + id).then((r) => r.json());
        if (job.status === "failed") throw new Error(job.error);
        return job.status;
      },
      { timeout: 60000 },
    )
    .toBe("complete");
  const video = await request.get("/api/jobs/" + id + "/video");
  expect(video.status(), video.ok() ? "" : await video.text()).toBe(200);
  const path = test.info().outputPath("verified-export.mp4");
  const { writeFile } = await import("node:fs/promises");
  await writeFile(path, await video.body());
  const info = JSON.parse(
    execFileSync(
      "ffprobe",
      ["-v", "quiet", "-show_streams", "-show_format", "-of", "json", path],
      { encoding: "utf8" },
    ),
  );
  expect(info.streams[0]).toMatchObject({
    codec_name: "h264",
    width: 320,
    height: 568,
    pix_fmt: "yuv420p",
    r_frame_rate: "30/1",
  });
  expect(Number(info.format.duration)).toBeCloseTo(2, 1);
});
test("exports from the GUI while preserving the project snapshot", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Upload MIDI")
    .setInputFiles({
      name: "kick.mid",
      mimeType: "audio/midi",
      buffer: Buffer.from(singleKickFixture()),
    });
  await page.getByLabel("Canvas width").fill("320");
  await page.getByLabel("Canvas height").fill("568");
  await page.getByRole("button", { name: "Apply dimensions" }).click();
  await page.getByRole("button", { name: "Export video", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("320 × 568");
  await page.getByRole("button", { name: "Render MP4", exact: true }).click();
  await expect(page.getByRole("link", { name: "Download MP4" })).toBeVisible({
    timeout: 60000,
  });
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download MP4" }).click();
  expect((await pending).suggestedFilename()).toMatch(/\.mp4$/);
});
test("cancels a render without publishing partial output and rejects concurrent jobs", async ({
  request,
}) => {
  const { token } = await request.get("/api/session").then((r) => r.json());
  const p = defaultProject();
  p.midi = { name: "kick.mid", base64: bytesToBase64(singleKickFixture()) };
  p.export.end = 2;
  p.export.repeats = 100;
  const headers = { "X-Session-Token": token };
  const { id } = await request
    .post("/api/jobs", { headers, data: { project: p } })
    .then((r) => r.json());
  const concurrent = await request.post("/api/jobs", {
    headers,
    data: { project: p },
  });
  expect(concurrent.status()).toBe(400);
  await expect
    .poll(
      async () =>
        (await request.get("/api/jobs/" + id).then((r) => r.json())).status,
    )
    .toBe("rendering");
  expect((await request.delete("/api/jobs/" + id, { headers })).status()).toBe(
    200,
  );
  expect(
    (await request.get("/api/jobs/" + id).then((r) => r.json())).status,
  ).toBe("cancelled");
  expect((await request.get("/api/jobs/" + id + "/video")).status()).toBe(404);
});
test("reports missing encoder and disk errors without exposing a partial video", async () => {
  const jobs = new Jobs(
    test.info().outputPath("missing-encoder"),
    "http://127.0.0.1:4173",
    "definitely-missing-encoder-executable",
  );
  const p = defaultProject();
  p.midi = { name: "kick.mid", base64: bytesToBase64(singleKickFixture()) };
  p.export.end = 2;
  const j = jobs.create(p);
  await expect
    .poll(() => jobs.get(j.id)?.status, { timeout: 20000 })
    .toBe("failed");
  expect(jobs.get(j.id)?.error).toContain("FFmpeg was not found");
  expect(jobs.output(j.id)).toBeUndefined();
  await jobs.close();
  const { writeFile } = await import("node:fs/promises");
  const blocked = test.info().outputPath("not-a-directory");
  await writeFile(blocked, "occupied");
  const diskJobs = new Jobs(blocked, "http://127.0.0.1:4173");
  const d = diskJobs.create(p);
  await expect.poll(() => diskJobs.get(d.id)?.status).toBe("failed");
  expect(diskJobs.output(d.id)).toBeUndefined();
  await diskJobs.close();
});
test("uses identical preview and export drawing at the same timestamps", async ({
  page,
}) => {
  await page.goto("/render.html");
  const p = defaultProject();
  p.canvas.width = 320;
  p.canvas.height = 568;
  p.midi = { name: "kick.mid", base64: bytesToBase64(singleKickFixture()) };
  const equal = await page.evaluate(async (project) => {
    window.prepareProject(project);
    const draw = await import("/src/core/draw.ts" as string);
    const scene = await import("/src/core/scene.ts" as string);
    const midi = await import("/src/core/midi.ts" as string);
    const projectModule = await import("/src/core/project.ts" as string);
    const parsed = midi.parseMidiBytes(
      projectModule.base64ToBytes(project.midi!.base64),
    );
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 568;
    return [0, 0.12, 1.5].every((t) => {
      draw.drawScene(
        canvas.getContext("2d"),
        scene.evaluateScene(project, parsed, t),
      );
      return canvas.toDataURL() === window.renderFrame(t);
    });
  }, p);
  expect(equal).toBe(true);
});
