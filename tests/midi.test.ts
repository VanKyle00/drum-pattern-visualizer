import { it, expect } from "vitest";
import { parseMidiBytes, noteLabel } from "../src/core/midi";
import {
  tempoFixture,
  zeroVelocityFixture,
  midiFixture,
  singleKickFixture,
} from "./fixtures";
it("integrates tempo changes across tracks and preserves trailing silence", () => {
  const m = parseMidiBytes(tempoFixture());
  expect(m.hits.map((h) => h.seconds)).toEqual([0, 0.5, 1.5]);
  expect(m.duration).toBe(2.5);
  expect(m.detected[0]).toEqual({ note: 36, channel: 10, count: 1 });
});
it("uses explicit octave convention without changing MIDI pitch", () => {
  expect(noteLabel(60, 0)).toBe("C4");
  expect(noteLabel(60, -1)).toBe("C3");
  expect(noteLabel(60, 1)).toBe("C5");
});
it("does not turn velocity-zero note-ons into visual hits", () =>
  expect(parseMidiBytes(zeroVelocityFixture()).hits).toHaveLength(1));
it("rejects corrupt, truncated and unsupported MIDI", () => {
  expect(() => parseMidiBytes(new Uint8Array([0, 1, 2]))).toThrow();
  expect(() => parseMidiBytes(singleKickFixture().slice(0, -2))).toThrow();
  expect(() =>
    parseMidiBytes(midiFixture([{ deltaTime: 0, type: "endOfTrack" }], 2)),
  ).toThrow(/format 2/i);
  const smpte = singleKickFixture();
  smpte[12] = 0xe7;
  smpte[13] = 40;
  expect(() => parseMidiBytes(smpte)).toThrow(/SMPTE/i);
});
it("can represent an empty MIDI without manufacturing duration or hits", () => {
  const m = parseMidiBytes(midiFixture([{ deltaTime: 0, type: "endOfTrack" }]));
  expect(m.duration).toBe(0);
  expect(m.hits).toEqual([]);
});
