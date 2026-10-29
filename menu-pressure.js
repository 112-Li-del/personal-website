// Native adaptation of the user-supplied React Bits TextPressure helpers.
const RIPPLE_LIFE = 1.3;
const MAX_RIPPLES = 6;
const WAVE_PERIOD = 3.2;
const PULSE_PERIOD = 2.8;
const PULSE_DEPTH = 0.42;

const dist = (a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const clamp01 = value => Math.min(1, Math.max(0, value));

const getIdlePressure = (mode, position, clock, spread) => {
  if (mode === 'wave') {
    const crest = 0.5 + 0.5 * Math.cos(Math.PI * 2 * (position / spread - clock / WAVE_PERIOD));
    return crest * crest;
  }
  if (mode === 'pulse') {
    const lag = Math.abs(position - 0.5) * 0.4;
    const breath = 0.5 - 0.5 * Math.cos(Math.PI * 2 * (clock / PULSE_PERIOD - lag));
    return PULSE_DEPTH * breath * breath * (3 - 2 * breath);
  }
  return 0;
};

const getRipplePressure = (ripples, point, now, span) => {
  const band = Math.max(span * 0.14, 32);
  let total = 0;
  for (const ripple of ripples) {
    const age = (now - ripple.start) / 1000;
    if (age <= 0 || age >= RIPPLE_LIFE) continue;
    const offset = (dist(ripple, point) - age * span * 1.25) / band;
    if (offset <= -1 || offset >= 1) continue;
    const fade = 1 - age / RIPPLE_LIFE;
    const swell = (1 - offset * offset) ** 2 * fade * fade * Math.min(1, age / 0.06);
    total = 1 - (1 - total) * (1 - swell);
  }
  return total;
};


export function createPressureRow(label){
 const row=document.createElement('span');row.className='sm-pressure-row';
 for(const char of label){const letter=document.createElement('span');letter.className='sm-pressure-char';const ink=document.createElement('span');ink.className='sm-pressure-ink';ink.textContent=char;letter.append(ink);row.append(letter);}return row;
}
export function initMenuPressure(container){
 const inner=container.querySelector('.sm-toggle-textInner');
 inner.replaceChildren(...[...inner.children].map(row=>createPressureRow(row.textContent)));
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const cursor={x:0,y:0,seen:false},mouse={x:0,y:0},ripples=[];
 let raf=0,last=0,clock=0,engage=0;
 const pressures=new WeakMap();
 const wake=()=>{if(!raf&&!document.hidden)raf=requestAnimationFrame(tick);};
 const tick=now=>{
  raf=0;if(document.hidden||document.body.classList.contains('intro-playing')){last=0;return;}
  const elapsed=last?Math.min(now-last,64):1000/60;last=now;
  const follow=1-Math.exp(-elapsed/250);
  mouse.x+=(cursor.x-mouse.x)*follow;mouse.y+=(cursor.y-mouse.y)*follow;
  const box=container.getBoundingClientRect();
  const inside=cursor.seen&&cursor.x>=box.left&&cursor.x<=box.right&&cursor.y>=box.top&&cursor.y<=box.bottom;
  const present=inside?1:0;engage+=(present-engage)*(1-Math.exp(-elapsed/320));clock+=elapsed/1000;
  while(ripples.length&&now-ripples[0].start>RIPPLE_LIFE*1000)ripples.shift();
  // The row is a fixed rectangle. A passing pressure wave redistributes its
  // width between letters, so a swelling letter pushes its neighbours aside.
  const rows=[...inner.children].map(row=>({row,chars:[...row.children]}));
  for(const {chars} of rows){
   chars.forEach((letter,index)=>{
    const position=(index+.5)/chars.length;
    const point={x:box.left+box.width*position,y:box.top+box.height/2};
    let pressure=clamp01(1-dist(mouse,point)/Math.max(box.width*.65,1));
    const resting=getIdlePressure('wave',position,clock*.85,1.25);
    pressure=resting+(pressure-resting)*engage;
    if(ripples.length){const swell=getRipplePressure(ripples,point,now,box.width);pressure=1-(1-pressure)*(1-swell);}
    const previous=pressures.get(letter)??pressure;
    pressure=reduced.matches?.45:previous+(pressure-previous)*(1-Math.exp(-elapsed/145));
    pressures.set(letter,pressure);
    letter.style.flexGrow=String(.58+pressure*1.35);
    const ink=letter.firstElementChild;
    ink.style.fontVariationSettings=`'wght' ${Math.round(380+500*pressure)}, 'wdth' ${(35+116*pressure).toFixed(1)}, 'slnt' 0, 'opsz' 26`;
   });
  }
  // Measure after distributing all slots; fit the ink without moving the outer
  // word or competing with GSAP's vertical Menu / Close rolling stack.
  const fits=rows.flatMap(({chars})=>chars.map(letter=>({ink:letter.firstElementChild,slot:letter.clientWidth,natural:letter.firstElementChild.offsetWidth})));
  for(const {ink,slot,natural} of fits){
   ink.style.transform=`scaleX(${Math.max(.1,slot/Math.max(1,natural)).toFixed(4)})`;
  }
  if(!reduced.matches)raf=requestAnimationFrame(tick);else last=0;
 };
 window.addEventListener('pointermove',event=>{cursor.x=event.clientX;cursor.y=event.clientY;cursor.seen=true;wake();},{passive:true});
 document.documentElement.addEventListener('pointerleave',()=>{cursor.seen=false;wake();},{passive:true});
 container.addEventListener('pointerdown',event=>{if(reduced.matches)return;if(ripples.length>=MAX_RIPPLES)ripples.shift();ripples.push({x:event.clientX,y:event.clientY,start:performance.now()});wake();},{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;}else wake();});
 new MutationObserver(wake).observe(document.body,{attributes:true,attributeFilter:['class']});
 reduced.addEventListener('change',wake);document.fonts?.ready.then(wake);wake();
}
