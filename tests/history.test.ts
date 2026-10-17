import { it, expect } from "vitest";
import { createHistory } from "../src/editor/history";
import { defaultProject } from "../src/core/project";
it("undoes canvas edits and invalidates redo after a new branch", () => {
  const p = defaultProject(),
    h = createHistory(p),
    next = { ...p, canvas: { ...p.canvas, width: 1920, height: 1080 } };
  h.commit(next);
  expect(h.undo().canvas.width).toBe(1080);
  expect(h.redo().canvas.width).toBe(1920);
  h.undo();
  h.commit({ ...p, canvas: { ...p.canvas, width: 720 } });
  expect(h.redo().canvas.width).toBe(720);
});
