import { base64ToBytes, projectSchema, type Project } from "./core/project";
import { parseMidiBytes, emptyMidi, type MidiData } from "./core/midi";
import { evaluateScene } from "./core/scene";
import { drawScene } from "./core/draw";
declare global {
  interface Window {
    prepareProject: (project: Project) => void;
    renderFrame: (seconds: number) => string;
  }
}
let project: Project, midi: MidiData;
const canvas = document.getElementById("frame") as HTMLCanvasElement;
window.prepareProject = (input: Project) => {
  project = projectSchema.parse(input);
  midi = project.midi
    ? parseMidiBytes(base64ToBytes(project.midi.base64))
    : emptyMidi;
  canvas.width = project.canvas.width;
  canvas.height = project.canvas.height;
};
window.renderFrame = (seconds: number) => {
  if (!project || !Number.isFinite(seconds))
    throw new Error("Renderer needs a project and finite timestamp.");
  drawScene(canvas.getContext("2d")!, evaluateScene(project, midi, seconds));
  return canvas.toDataURL("image/png");
};
