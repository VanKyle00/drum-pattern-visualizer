import { it, expect } from "vitest";
import { defaultProject } from "../src/core/project";
import { evaluateScene } from "../src/core/scene";
import { parseMidiBytes } from "../src/core/midi";
import { singleKickFixture } from "./fixtures";
const m = parseMidiBytes(singleKickFixture());
it("reacts only to matched past hits and decays when seeking", () => {
  const p = defaultProject();
  const atHit = evaluateScene(p, m, 0).marks[0];
  expect(atHit.radius).toBeCloseTo(257.04);
  expect(atHit.reaction).toBe(1);
  expect(evaluateScene(p, m, 0.12).marks[0].reaction).toBeCloseTo(Math.exp(-1));
  expect(evaluateScene(p, m, -0.01).marks[0].reaction).toBe(0);
  expect(evaluateScene(p, m, 0).marks[1].reaction).toBe(0);
  p.elements[0].channel = 1;
  expect(evaluateScene(p, m, 0).marks[0].reaction).toBe(0);
});
it("preserves shape proportions and normalized centers across aspect changes", () => {
  const p = defaultProject();
  p.canvas.width = 1920;
  p.canvas.height = 1080;
  const s = evaluateScene(p, m, 0);
  expect(s.marks[0].radius).toBeCloseTo(257.04);
  expect(s.marks[0].x).toBe(960);
  expect(s.marks[0].y).toBeCloseTo(626.4);
  expect(evaluateScene(p, m, 0.1)).toEqual(evaluateScene(p, m, 0.1));
});
it("supports multiple pitches per element and shared pitches across elements", () => {
  const p = defaultProject();
  p.elements[1].notes = [35, 36];
  expect(evaluateScene(p, m, 0).marks[1].reaction).toBe(1);
});
