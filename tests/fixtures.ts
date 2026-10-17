import { writeMidi, type MidiEvent } from "midi-file";
export function midiFixture(
  events: MidiEvent[],
  format: 0 | 1 | 2 = 0,
  division = 480,
) {
  return Uint8Array.from(
    writeMidi({
      header: { format, numTracks: 1, ticksPerBeat: division },
      tracks: [events],
    }),
  );
}
export function tempoFixture() {
  return Uint8Array.from(
    writeMidi({
      header: { format: 1, numTracks: 2, ticksPerBeat: 480 },
      tracks: [
        [
          { deltaTime: 0, type: "setTempo", microsecondsPerBeat: 500000 },
          { deltaTime: 480, type: "setTempo", microsecondsPerBeat: 1000000 },
          { deltaTime: 960, type: "endOfTrack" },
        ],
        [
          {
            deltaTime: 0,
            type: "noteOn",
            channel: 9,
            noteNumber: 36,
            velocity: 127,
          },
          {
            deltaTime: 480,
            type: "noteOn",
            channel: 9,
            noteNumber: 38,
            velocity: 80,
          },
          {
            deltaTime: 480,
            type: "noteOn",
            channel: 9,
            noteNumber: 42,
            velocity: 60,
          },
          { deltaTime: 480, type: "endOfTrack" },
        ],
      ],
    }),
  );
}
export function singleKickFixture() {
  return midiFixture([
    { deltaTime: 0, type: "noteOn", channel: 9, noteNumber: 36, velocity: 127 },
    { deltaTime: 1920, type: "endOfTrack" },
  ]);
}
export function zeroVelocityFixture() {
  return midiFixture([
    { deltaTime: 0, type: "noteOn", channel: 9, noteNumber: 36, velocity: 100 },
    { deltaTime: 120, type: "noteOn", channel: 9, noteNumber: 36, velocity: 0 },
    { deltaTime: 360, type: "endOfTrack" },
  ]);
}
export function demoFixture() {
  const events: MidiEvent[] = [];
  let last = 0;
  for (let step = 0; step < 16; step++) {
    for (const [note, steps] of [
      [36, [0, 3, 7, 10]],
      [38, [4, 12, 15]],
      [42, [0, 2, 4, 6, 8, 10, 12, 14, 15]],
    ] as [number, number[]][]) {
      if (steps.includes(step)) {
        events.push({
          deltaTime: step * 120 - last,
          type: "noteOn",
          channel: 9,
          noteNumber: note,
          velocity: step % 4 === 0 ? 112 : 85,
        });
        last = step * 120;
      }
    }
  }
  events.push({ deltaTime: 1920 - last, type: "endOfTrack" });
  return midiFixture(events);
}
