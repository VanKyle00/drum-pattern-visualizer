import { useState } from 'react';
import { defaultProject } from './core/project';
export default function App(){const [project]=useState(defaultProject());return <main><header><h1>Drum Canvas</h1><span>MIDI to motion</span></header><div className="workspace"><aside><h2>Drum elements</h2>{project.elements.map(e=><p key={e.id}>{e.name}</p>)}</aside><section className="stage"><p>Upload a MIDI pattern to bring your canvas to life.</p></section><aside><h2>Appearance</h2><p>Select an element to edit its shape and motion.</p></aside></div></main>;}
