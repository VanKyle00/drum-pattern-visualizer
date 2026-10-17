import { useEffect,useMemo,useRef,useState } from 'react';
import { base64ToBytes,bytesToBase64,defaultProject,newElement,parseProject,serializeProject,type Project } from './core/project';
import { emptyMidi,parseMidiBytes } from './core/midi';
import { createHistory } from './editor/history';
import Canvas from './editor/Canvas';
import Inspector from './editor/Inspector';
import CanvasSettings from './editor/CanvasSettings';
import Timeline from './editor/Timeline';

export default function App(){
 const history=useRef(createHistory(defaultProject()));
 const [project,setProject]=useState(history.current.current()),[selected,setSelected]=useState<string|null>('kick');
 const [time,setTime]=useState(0),[playing,setPlaying]=useState(false),[guides,setGuides]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const file=useRef<HTMLInputElement>(null),projectFile=useRef<HTMLInputElement>(null),generation=useRef(0),current=useRef(project);
 current.current=project;
 const midi=useMemo(()=>project.midi?parseMidiBytes(base64ToBytes(project.midi.base64)):emptyMidi,[project.midi]);
 const commit=(p:Project)=>{history.current.commit(p);setProject(p);};
 const undo=()=>{setPlaying(false);setProject(history.current.undo());};
 const redo=()=>{setPlaying(false);setProject(history.current.redo());};
 useEffect(()=>{if(!project.elements.some(e=>e.id===selected))setSelected(project.elements[0]?.id||null);},[project.elements,selected]);
 useEffect(()=>{setPlaying(false);setTime(0);},[project.midi]);
 useEffect(()=>{if(!playing)return;let id=0,last=performance.now();function frame(now:number){const dt=(now-last)/1000;last=now;setTime(t=>midi.duration>0?(t+dt)%midi.duration:0);id=requestAnimationFrame(frame);}id=requestAnimationFrame(frame);return()=>cancelAnimationFrame(id);},[playing,midi.duration]);
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(['INPUT','SELECT','TEXTAREA'].includes(target.tagName))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();}if(e.code==='Space'&&midi.duration>0){e.preventDefault();setPlaying(v=>!v);}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[midi.duration]);
 async function importMidi(f:File){const ticket=++generation.current;try{if(f.size>10*1024*1024)throw new Error('Choose a MIDI file smaller than 10 MiB.');const bytes=new Uint8Array(await f.arrayBuffer()),parsed=parseMidiBytes(bytes);if(ticket!==generation.current)return;
  const p=current.current;commit({...p,midi:{name:f.name,base64:bytesToBase64(bytes)},export:{...p.export,start:0,end:parsed.duration}});setError('');setNotice(parsed.hits.length&&parsed.duration>0?'MIDI imported. Select an element to assign notes.':'This MIDI has no playable duration or note hits. Import another pattern to export video.');
 }catch(e){setError(e instanceof Error?e.message:'Could not import MIDI.');}}
 async function openProject(f:File){const ticket=++generation.current;try{if(f.size>20*1024*1024)throw new Error('Project is larger than 20 MiB.');const p=parseProject(await f.text());if(p.midi)parseMidiBytes(base64ToBytes(p.midi.base64));if(ticket!==generation.current)return;commit(p);setError('');setNotice('Project opened.');}catch(e){setError(e instanceof Error?e.message:'Unable to open project.');}}
 function save(){const blob=new Blob([serializeProject(project)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='drum-canvas.drum.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Project saved, including the MIDI pattern.');}
 function add(){if(project.elements.length>=128){setError('A project supports up to 128 elements.');return;}const el=newElement();commit({...project,elements:[...project.elements,el]});setSelected(el.id);}
 function duplicate(){const el=project.elements.find(e=>e.id===selected);if(!el||project.elements.length>=128)return;const copy={...el,id:crypto.randomUUID(),name:(el.name+' copy').slice(0,80),x:Math.min(1,el.x+.04),y:Math.min(1,el.y+.04)};commit({...project,elements:[...project.elements,copy]});setSelected(copy.id);}
 function layer(delta:number){const elements=[...project.elements],index=elements.findIndex(e=>e.id===selected),next=index+delta;if(index<0||next<0||next>=elements.length)return;[elements[index],elements[next]]=[elements[next],elements[index]];commit({...project,elements});}
 function layout(kind:string){const layouts:Record<string,number[][]>={stack:[[.5,.69],[.5,.46],[.5,.25]],center:[[.5,.58],[.28,.31],[.73,.28]],diagonal:[[.32,.69],[.51,.47],[.71,.26]]};const ids=['kick','snare','hat'];commit({...project,elements:project.elements.map(e=>{const n=ids.indexOf(e.id);return n<0?e:{...e,x:layouts[kind][n][0],y:layouts[kind][n][1]};})});}
 return <main>
  <header><div className="brand"><span className="brand-mark">◒</span><div><h1>Drum Canvas</h1><p>MIDI to motion</p></div></div><div className="header-actions"><button onClick={()=>projectFile.current?.click()}>Open project</button><button onClick={save}>Save project</button></div></header>
  <input className="file-input" type="file" ref={file} aria-label="Upload MIDI" accept=".mid,.midi" onChange={e=>{const f=e.target.files?.[0];if(f)void importMidi(f);e.target.value='';}}/>
  <input className="file-input" type="file" ref={projectFile} aria-label="Open project file" accept=".json,.drum" onChange={e=>{const f=e.target.files?.[0];if(f)void openProject(f);e.target.value='';}}/>
  {error&&<div className="banner error" role="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError('')}>×</button></div>}
  <div className="workspace">
   <aside className="left-panel"><div className="source"><h2>Pattern</h2><button className="upload" onClick={()=>file.current?.click()}>＋ Upload MIDI</button>{project.midi?<><strong className="file-name">{project.midi.name}</strong><p className="hint">{midi.hits.length} hits · {midi.duration.toFixed(2)} seconds</p></>:<p className="hint">Import a pattern, then map its notes to your shapes.</p>}</div>
    <div className="panel-section"><h2>Drum elements <small>{project.elements.length}</small></h2><div className="element-list">{project.elements.map(e=><button className={'element-row '+(selected===e.id?'selected':'')} key={e.id} onClick={()=>setSelected(e.id)}><span className={'element-symbol '+e.shape} style={{background:e.color}}/><span>{e.name}<small>{e.notes.length?e.notes.join(', '):'No notes assigned'}</small></span></button>)}</div><button className="wide" onClick={add} disabled={project.elements.length>=128}>Add element</button>
    <div className="two compact"><button disabled={!selected} onClick={duplicate}>Duplicate</button><button disabled={!selected} onClick={()=>commit({...project,elements:project.elements.filter(e=>e.id!==selected)})}>Remove</button></div>
    <div className="two compact"><button disabled={project.elements.findIndex(e=>e.id===selected)<=0} onClick={()=>layer(-1)}>Send backward</button><button disabled={!selected||project.elements.findIndex(e=>e.id===selected)===project.elements.length-1} onClick={()=>layer(1)}>Bring forward</button></div></div>
    <div className="panel-section"><CanvasSettings project={project} onChange={commit} guides={guides} onGuides={setGuides}/></div>
   </aside>
   <section className="stage-column"><div className="stage-toolbar"><div><button onClick={undo} disabled={!history.current.canUndo()}>Undo</button><button onClick={redo} disabled={!history.current.canRedo()}>Redo</button></div><span>{project.canvas.width} × {project.canvas.height}</span></div>
    <Canvas project={project} midi={midi} time={time} selected={selected} guides={guides} onSelect={setSelected} onCommit={commit} onPause={()=>setPlaying(false)}/>
    <div className="layout-bar"><span>Starting layout</span><button onClick={()=>layout('stack')}>Stack</button><button onClick={()=>layout('center')}>Center</button><button onClick={()=>layout('diagonal')}>Diagonal</button></div>
    <Timeline time={time} duration={midi.duration} playing={playing} onSeek={setTime} onPlayingChange={setPlaying}/>
    <div className="status" aria-live="polite">{notice||'Drag a shape to move it. Drag its corner handle to resize.'}</div>
   </section>
   <aside className="right-panel"><Inspector project={project} selected={selected} midi={midi} onChange={commit}/></aside>
  </div>
 </main>;
}
