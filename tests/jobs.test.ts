import { it, expect } from "vitest";
import { validateExport, frameTime } from "../server/jobs";
import { defaultProject, bytesToBase64 } from "../src/core/project";
import { singleKickFixture } from "./fixtures";
const project = () => {
  const p = defaultProject();
  p.midi = { name: "kick.mid", base64: bytesToBase64(singleKickFixture()) };
  p.export.end = 2;
  return p;
};
it("rejects impossible export ranges and unbounded render requests", () => {
  for (const patch of [
    { end: 0 },
    { start: 2, end: 1 },
    { end: 601 },
    { repeats: 101 },
    { start: NaN },
    { fps: 25 },
  ]) {
    const p = project();
    Object.assign(p.export, patch);
    expect(() => validateExport(p)).toThrow();
  }
  const p = project();
  p.canvas.width = 321;
  expect(() => validateExport(p)).toThrow();
  expect(() => validateExport(defaultProject())).toThrow(/MIDI/);
});
it("snapshots valid exports and computes repeat frames without realtime drift", () => {
  const p = project();
  const result = validateExport(p);
  p.canvas.width = 720;
  expect(result.project.canvas.width).toBe(1080);
  expect(result.totalFrames).toBe(60);
  expect(frameTime({ start: 0.5, end: 1.5, repeats: 2, fps: 30 }, 30)).toBe(
    0.5,
  );
  expect(frameTime({ start: 0, end: 2, repeats: 1, fps: 60 }, 30)).toBe(0.5);
});
