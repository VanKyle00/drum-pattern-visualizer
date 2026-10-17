import type { Project } from "../core/project";
export function createHistory(initial: Project) {
  let past: Project[] = [],
    present = initial,
    future: Project[] = [];
  return {
    current: () => present,
    commit(next: Project) {
      if (next === present) return present;
      past.push(present);
      if (past.length > 80) past.shift();
      present = next;
      future = [];
      return present;
    },
    undo() {
      if (past.length) {
        future.push(present);
        present = past.pop()!;
      }
      return present;
    },
    redo() {
      if (future.length) {
        past.push(present);
        present = future.pop()!;
      }
      return present;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}
