import { z } from "zod";

export const MAX_MIDI_BYTES = 10 * 1024 * 1024;
const dimension = z
  .number()
  .int()
  .min(64)
  .max(4096)
  .refine((n) => n % 2 === 0, "Use even pixel dimensions.");
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const elementSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(80),
  notes: z.array(z.number().int().min(0).max(127)).max(128),
  channel: z.number().int().min(1).max(16).nullable(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  size: z.number().min(0.005).max(0.45),
  shape: z.enum(["circle", "square", "diamond", "triangle"]),
  color,
  strength: z.number().min(0).max(2),
  decay: z.number().min(0.02).max(3),
  ripple: z.boolean(),
  particles: z.boolean(),
});
export const projectSchema = z.object({
  version: z.literal(1),
  midi: z
    .object({
      name: z.string().max(255),
      base64: z
        .string()
        .max(Math.ceil(MAX_MIDI_BYTES / 3) * 4)
        .regex(
          /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
        ),
    })
    .nullable(),
  canvas: z.object({
    width: dimension,
    height: dimension,
    aspectLocked: z.boolean(),
    background: color,
  }),
  octaveOffset: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  elements: z
    .array(elementSchema)
    .max(128)
    .refine(
      (es) => new Set(es.map((e) => e.id)).size === es.length,
      "Element IDs must be unique.",
    ),
  export: z.object({
    start: z.number().min(0),
    end: z.number().min(0),
    repeats: z.number().int().min(1).max(100),
    fps: z.union([z.literal(30), z.literal(60)]),
  }),
});
export type Project = z.infer<typeof projectSchema>;
export type DrumElement = z.infer<typeof elementSchema>;
export type Shape = DrumElement["shape"];
export type ExportSettings = Project["export"];
export function newElement(name = "Custom drum"): DrumElement {
  return {
    id: crypto.randomUUID(),
    name,
    notes: [],
    channel: null,
    x: 0.5,
    y: 0.5,
    size: 0.08,
    shape: "circle",
    color: "#ab9df2",
    strength: 0.4,
    decay: 0.12,
    ripple: true,
    particles: false,
  };
}
export function defaultProject(): Project {
  const kick = {
    ...newElement("Kick"),
    id: "kick",
    notes: [36],
    x: 0.5,
    y: 0.58,
    size: 0.17,
    color: "#f29182",
  };
  const snare = {
    ...newElement("Snare"),
    id: "snare",
    notes: [38, 40],
    x: 0.28,
    y: 0.31,
    size: 0.075,
    shape: "square" as const,
    color: "#82b8ee",
  };
  const hat = {
    ...newElement("Hi-hat"),
    id: "hat",
    notes: [42, 44, 46],
    x: 0.73,
    y: 0.28,
    size: 0.06,
    shape: "diamond" as const,
    color: "#f1d083",
    decay: 0.06,
  };
  return {
    version: 1,
    midi: null,
    canvas: {
      width: 1080,
      height: 1920,
      aspectLocked: false,
      background: "#111923",
    },
    octaveOffset: 0,
    elements: [kick, snare, hat],
    export: { start: 0, end: 0, repeats: 1, fps: 30 },
  };
}
export function validateCanvas(width: number, height: number) {
  return (
    dimension.safeParse(width).success && dimension.safeParse(height).success
  );
}
export function parseProject(json: string): Project {
  if (json.length > 20 * 1024 * 1024)
    throw new Error("Project is larger than 20 MiB.");
  return projectSchema.parse(JSON.parse(json));
}
export function serializeProject(p: Project) {
  return JSON.stringify(projectSchema.parse(p), null, 2);
}
export function bytesToBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
export function base64ToBytes(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
