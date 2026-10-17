import { useEffect,useState } from 'react';
export function NumberField({label,value,onChange,min,max,step=1,suffix}:{label:string;value:number;onChange:(n:number)=>void;min?:number;max?:number;step?:number;suffix?:string}){
 const [text,setText]=useState(String(value));useEffect(()=>setText(String(value)),[value]);
 function commit(){const n=Number(text);if(text.trim()&&Number.isFinite(n)&&(min===undefined||n>=min)&&(max===undefined||n<=max))onChange(n);else setText(String(value));}
 return <label className="field"><span>{label}{suffix&&<small>{suffix}</small>}</span><input type="number" aria-label={label} value={text} min={min} max={max} step={step} onChange={e=>setText(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>;
}
