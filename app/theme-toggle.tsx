'use client';
import {useEffect,useState} from 'react';
import {Sun,Moon} from 'lucide-react';
export default function ThemeToggle(){
 const [theme,setTheme]=useState('light');
 useEffect(()=>{let saved:string|null=null;try{saved=localStorage.getItem('fund-desk-theme');}catch{}const selected=saved==='dark'||saved==='light'?saved:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';setTheme(selected);document.documentElement.classList.toggle('dark',selected==='dark');},[]);
 function change(value:string){setTheme(value);document.documentElement.classList.toggle('dark',value==='dark');try{localStorage.setItem('fund-desk-theme',value);}catch{}}
 return <div className="theme-toggle" role="group" aria-label="Dashboard appearance"><button type="button" aria-pressed={theme==='light'} onClick={()=>change('light')}><Sun size={16}/><span>Light</span></button><button type="button" aria-pressed={theme==='dark'} onClick={()=>change('dark')}><Moon size={16}/><span>Dark</span></button></div>;
}
