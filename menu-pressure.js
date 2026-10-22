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
    return crest;
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
 for(const char of label){const letter=document.createElement('span');letter.textContent=char;letter.className='sm-pressure-char';row.append(letter);}return row;
}
export function initMenuPressure(container){
 const inner=container.querySelector('.sm-toggle-textInner');
 inner.replaceChildren(...[...inner.children].map(row=>createPressureRow(row.textContent)));
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const cursor={x:0,y:0,seen:false},mouse={x:0,y:0},ripples=[];
 let raf=0,last=0,clock=0,engage=0;
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
  for(const row of inner.children){
   const chars=[...row.children];
   chars.forEach((letter,index)=>{
    const point={x:box.left+box.width*(index+.5)/chars.length,y:box.top+box.height/2};
    let pressure=clamp01(1-dist(mouse,point)/Math.max(box.width*.5,1));
    const resting=getIdlePressure('wave',(index+.5)/chars.length,clock,1);
    pressure=resting+(pressure-resting)*engage;
    if(ripples.length){const swell=getRipplePressure(ripples,point,now,box.width);pressure=1-(1-pressure)*(1-swell);}
    if(reduced.matches)pressure=.35;
    // Keep the silhouette upright and legible; width and weight flow within the slot.
    const width=90+42*pressure;
    letter.style.fontVariationSettings=`'wght' ${Math.round(580+220*pressure)}, 'wdth' ${width.toFixed(1)}, 'slnt' 0, 'opsz' 20`;
    letter.style.transform=`scaleY(${(.97+.06*pressure).toFixed(3)})`;
   });
   // Fit the continuous word, not separate letter cells, to the invisible rectangle.
   const natural=row.offsetWidth;
   row.style.transform=`scaleX(${box.width/Math.max(1,natural)})`;
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
