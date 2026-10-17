import { useEffect,useRef,useState } from 'react';
import type { Project } from '../core/project';
import type { MidiData } from '../core/midi';
import { evaluateScene } from '../core/scene';
import { drawScene,shapePath } from '../core/draw';
type Props={project:Project;midi:MidiData;time:number;selected:string|null;guides:boolean;onSelect:(id:string|null)=>void;onCommit:(p:Project)=>void;onPause:()=>void};
export default function Canvas({project,midi,time,selected,guides,onSelect,onCommit,onPause}:Props){
 const canvas=useRef<HTMLCanvasElement>(null),box=useRef<HTMLDivElement>(null);
 const [fit,setFit]=useState({width:300,height:534}),[draft,setDraft]=useState<Project|null>(null);
 const drag=useRef<{id:string;start:Project;mode:'move'|'size';dx:number;dy:number;radiusRatio:number;latest:Project}|null>(null);
 const shown=draft||project;
 useEffect(()=>{const ob=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;const s=Math.min((width-48)/project.canvas.width,(height-48)/project.canvas.height);setFit({width:Math.max(1,project.canvas.width*s),height:Math.max(1,project.canvas.height*s)});});ob.observe(box.current!);return()=>ob.disconnect();},[project.canvas.width,project.canvas.height]);
 useEffect(()=>{const el=canvas.current!;const d=devicePixelRatio||1;el.width=Math.round(fit.width*d);el.height=Math.round(fit.height*d);
 const ctx=el.getContext('2d')!;const s=fit.width/shown.canvas.width;ctx.setTransform(s*d,0,0,s*d,0,0);
 const scene=evaluateScene(shown,midi,time);drawScene(ctx,scene);
 if(guides){ctx.fillStyle='#ffffff12';ctx.fillRect(0,0,scene.width,scene.height*.13);ctx.fillRect(0,scene.height*.84,scene.width,scene.height*.16);ctx.strokeStyle='#ffffff40';ctx.lineWidth=1/s;ctx.setLineDash([4/s,4/s]);ctx.strokeRect(0,scene.height*.13,scene.width,scene.height*.71);ctx.setLineDash([]);}
 const mark=scene.marks.find(m=>m.id===selected);if(mark){const pad=7/s;ctx.strokeStyle='#ffffff';ctx.lineWidth=1.3/s;ctx.setLineDash([4/s,3/s]);ctx.strokeRect(mark.x-mark.radius-pad,mark.y-mark.radius-pad,2*(mark.radius+pad),2*(mark.radius+pad));ctx.setLineDash([]);ctx.fillStyle='#ffffff';ctx.fillRect(mark.x+mark.radius+pad-5/s,mark.y+mark.radius+pad-5/s,10/s,10/s);}
 },[shown,midi,time,selected,guides,fit]);
 const point=(ev:React.PointerEvent<HTMLCanvasElement>)=>{const rect=ev.currentTarget.getBoundingClientRect();return{x:(ev.clientX-rect.left)/rect.width*project.canvas.width,y:(ev.clientY-rect.top)/rect.height*project.canvas.height,s:rect.width/project.canvas.width};};
 return <div className="canvas-viewport" ref={box}><canvas aria-label="Drum layout canvas" ref={canvas} style={{width:fit.width,height:fit.height}} onPointerDown={ev=>{
   const p=point(ev),scene=evaluateScene(project,midi,time),current=scene.marks.find(m=>m.id===selected);let id:string|undefined,mode:'move'|'size'='move';
   if(current&&Math.abs(p.x-current.x-current.radius-7/p.s)<15/p.s&&Math.abs(p.y-current.y-current.radius-7/p.s)<15/p.s){id=current.id;mode='size';}
   else {const ctx=canvas.current!.getContext('2d')!;ctx.save();ctx.setTransform(1,0,0,1,0,0);for(const m of [...scene.marks].reverse()){shapePath(ctx,m.x,m.y,m.radius,m.shape);if(ctx.isPointInPath(p.x,p.y)){id=m.id;break;}}ctx.restore();}
   onSelect(id||null);if(!id)return;onPause();const e=project.elements.find(e=>e.id===id)!,m=scene.marks.find(m=>m.id===id)!;
   drag.current={id,start:project,latest:project,mode,dx:p.x-e.x*project.canvas.width,dy:p.y-e.y*project.canvas.height,radiusRatio:m.radius/(e.size*Math.min(scene.width,scene.height))};ev.currentTarget.setPointerCapture(ev.pointerId);
 }} onPointerMove={ev=>{const state=drag.current;if(!state)return;const p=point(ev),e=state.start.elements.find(e=>e.id===state.id)!,{width,height}=project.canvas;
 const updated=state.mode==='move'?{...e,x:Math.max(0,Math.min(1,(p.x-state.dx)/width)),y:Math.max(0,Math.min(1,(p.y-state.dy)/height))}:{...e,size:Math.max(.005,Math.min(.45,(Math.max(p.x-e.x*width,p.y-e.y*height)-7/p.s)/Math.min(width,height)/state.radiusRatio))};
 state.latest={...state.start,elements:state.start.elements.map(el=>el.id===state.id?updated:el)};setDraft(state.latest);
 }} onPointerUp={ev=>{const state=drag.current;if(!state)return;drag.current=null;setDraft(null);onCommit(state.latest);if(ev.currentTarget.hasPointerCapture(ev.pointerId))ev.currentTarget.releasePointerCapture(ev.pointerId);}} onPointerCancel={()=>{drag.current=null;setDraft(null);}} /></div>;
}
