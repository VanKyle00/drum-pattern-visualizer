import { describe, it, expect } from 'vitest';
import { defaultProject, parseProject, serializeProject, validateCanvas } from '../src/core/project';
describe('project validation', () => {
  it('rejects dimensions that cannot produce the promised video format', () => {
    expect(validateCanvas(1080,1920)).toBe(true);
    for (const w of [63,1081,4098,NaN,Infinity]) expect(validateCanvas(w,1920)).toBe(false);
  });
  it('round trips customized geometry and MIDI data', () => {
    const p=defaultProject(); p.canvas.width=1920;p.canvas.height=1080;
    p.elements[0].notes=[35,36];p.elements[0].name='Low drum';p.octaveOffset=-1;
    expect(parseProject(serializeProject(p))).toEqual(p);
  });
  it('rejects unknown versions, invalid notes, duplicate IDs and nonfinite values', () => {
    const p=defaultProject();
    expect(()=>parseProject('{"version":99}')).toThrow();
    p.elements[0].notes=[128];expect(()=>parseProject(JSON.stringify(p))).toThrow();
    p.elements[0].notes=[36];p.elements[1].id=p.elements[0].id;
    expect(()=>parseProject(JSON.stringify(p))).toThrow();
    p.elements[1].id='other';p.elements[0].x=NaN;
    expect(()=>parseProject(JSON.stringify(p))).toThrow();
  });
});
