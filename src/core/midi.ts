import { parseMidi, type MidiEvent } from 'midi-file';
import { MAX_MIDI_BYTES } from './project';
export type Hit={seconds:number;note:number;channel:number;velocity:number};
export type MidiData={hits:Hit[];duration:number;detected:{note:number;channel:number;count:number}[]};
export const emptyMidi:MidiData={hits:[],duration:0,detected:[]};
export function noteLabel(note:number,offset:-1|0|1){return ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][note%12]+(Math.floor(note/12)-1+offset);}
export function parseMidiBytes(bytes:Uint8Array):MidiData{
 if(bytes.length>MAX_MIDI_BYTES)throw new Error('MIDI file exceeds 10 MiB.');
 if(bytes.length<14)throw new Error('This is not a complete MIDI file.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const text=(i:number)=>String.fromCharCode(...bytes.subarray(i,i+4));
 if(text(0)!=='MThd'||view.getUint32(4)!==6)throw new Error('Invalid MIDI header.');
 const format=view.getUint16(8),tracks=view.getUint16(10),division=view.getUint16(12);
 if(format===2)throw new Error('MIDI format 2 is not supported. Export format 0 or 1.');
 if(format>1||tracks<1||(format===0&&tracks!==1))throw new Error('Invalid MIDI format or track count.');
 if(division&0x8000)throw new Error('SMPTE MIDI timing is not supported. Export with beat-based timing.');
 if(division===0)throw new Error('MIDI timing resolution must be positive.');
 let offset=14;
 for(let i=0;i<tracks;i++){if(offset+8>bytes.length||text(offset)!=='MTrk')throw new Error('Missing or corrupt MIDI track.');
   const length=view.getUint32(offset+4);offset+=8+length;if(offset>bytes.length)throw new Error('MIDI track is truncated.');}
 let midi;try{midi=parseMidi(bytes);}catch{throw new Error('Unable to read MIDI events. The file may be damaged.');}
 const events:{tick:number;event:MidiEvent;order:number}[]=[];let order=0,maxTick=0;
 for(const track of midi.tracks){let tick=0;for(const event of track){tick+=event.deltaTime;
   if(!Number.isSafeInteger(tick)||tick<0)throw new Error('Invalid MIDI event timing.');
   events.push({tick,event,order:order++});if(event.type==='endOfTrack')break;}
   maxTick=Math.max(maxTick,tick);}
 if(events.length>500000)throw new Error('MIDI contains too many events (maximum 500,000).');
 events.sort((a,b)=>a.tick-b.tick||a.order-b.order);
 const hits:Hit[]=[];let tick=0,seconds=0,tempo=500000;
 for(const item of events){seconds+=(item.tick-tick)/division*tempo/1e6;tick=item.tick;const e=item.event;
   if(e.type==='setTempo'){if(e.microsecondsPerBeat<=0)throw new Error('Invalid MIDI tempo.');tempo=e.microsecondsPerBeat;}
   if(e.type==='noteOn'&&e.velocity>0){if(e.noteNumber>127||e.velocity>127)throw new Error('Invalid MIDI note or velocity.');hits.push({seconds,note:e.noteNumber,channel:e.channel+1,velocity:e.velocity/127});}
 }
 const duration=seconds+(maxTick-tick)/division*tempo/1e6;
 if(!Number.isFinite(duration)||duration>86400)throw new Error('MIDI timeline must be less than 24 hours.');
 const counts=new Map<string,{note:number;channel:number;count:number}>();
 for(const h of hits){const key=h.note+':'+h.channel;const row=counts.get(key)||{note:h.note,channel:h.channel,count:0};row.count++;counts.set(key,row);}
 return {hits,duration,detected:[...counts.values()].sort((a,b)=>a.note-b.note||a.channel-b.channel)};
}
