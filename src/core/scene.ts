import type { Project,Shape } from './project';
import type { MidiData,Hit } from './midi';
export type Scene={width:number;height:number;background:string;marks:{id:string;x:number;y:number;radius:number;shape:Shape;color:string;reaction:number;age:number;ripple:boolean;particles:boolean}[]};
const indexes=new WeakMap<MidiData,Map<number,Hit[]>>();
function index(midi:MidiData){let result=indexes.get(midi);if(!result){result=new Map();for(const h of midi.hits){const row=result.get(h.note)||[];row.push(h);result.set(h.note,row);}indexes.set(midi,result);}return result;}
export function evaluateScene(project:Project,midi:MidiData,seconds:number):Scene{
 const {width,height,background}=project.canvas,byNote=index(midi);
 return {width,height,background,marks:project.elements.map(e=>{
   let reaction=0,age=999;
   for(const note of e.notes){const hits=byNote.get(note)||[];let lo=0,hi=hits.length;
     while(lo<hi){const mid=(lo+hi)>>>1;if(hits[mid].seconds<=seconds)lo=mid+1;else hi=mid;}
     for(let i=lo-1;i>=0;i--){const h=hits[i],a=seconds-h.seconds;if(a>e.decay*8)break;if(e.channel!==null&&e.channel!==h.channel)continue;
       const v=h.velocity*Math.exp(-a/e.decay);if(v>reaction){reaction=v;age=a/e.decay;}}
   }
   return {id:e.id,x:e.x*width,y:e.y*height,radius:e.size*Math.min(width,height)*(1+reaction*e.strength),shape:e.shape,color:e.color,reaction,age,ripple:e.ripple,particles:e.particles};
 })};
}
