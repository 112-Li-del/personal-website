// React Bits SplitText, adapted to this vanilla site using its GSAP SplitText
// dependency. Defaults: rise, 50 ms stagger, 1.25 s, power3.out, hover lift.
// UMD distributions must run as classic scripts, outside module strict mode.
function loadScript(src){
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=src;
    script.onload=resolve;script.onerror=reject;document.head.append(script);
  });
}
await loadScript('./assets/gsap/gsap.min.js');
await loadScript('./assets/gsap/SplitText.min.js');

const {gsap,SplitText}=window;
gsap.registerPlugin(SplitText);
await document.fonts.ready;
const title=document.querySelector('#home-title');
const home=document.querySelector('.home');
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const fine=matchMedia('(hover: hover) and (pointer: fine)');
const pieces=[];
const splits=[...title.querySelectorAll('.hero-line-label')].map(line=>{
  const split=new SplitText(line,{type:'chars',tag:'span',charsClass:'split-char',aria:'auto',reduceWhiteSpace:false});
  pieces.push(...split.chars);return split;
});
const inks=pieces.map(char=>{
  const ink=document.createElement('span');ink.className='split-ink';
  ink.textContent=char.textContent;char.replaceChildren(ink);return ink;
});
title.classList.add('split-ready');
const word=title.querySelector('.gradient-text');
const palette=['#3b82f6','#162e58','#ffffff'];
let timeline,raf=0,last=0,time=0,visible=true,introActive=false;
const pointer={x:0,y:0,inside:false};
const springs=pieces.map(()=>({y:0,v:0}));
let centers=[];
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};

function measure(){
  const rect=title.getBoundingClientRect();
  centers=pieces.map((char,i)=>{
    const r=char.getBoundingClientRect();
    return {x:r.left+r.width/2-rect.left,y:r.top+r.height/2-rect.top-springs[i].y};
  });
  if(word){
    const rect=word.getBoundingClientRect();
    word.querySelectorAll('.split-ink').forEach(ink=>{
      ink.style.backgroundSize=`${rect.width}px 100%`;
      ink.style.backgroundPosition=`${-(ink.getBoundingClientRect().left-rect.left)}px 0`;
    });
  }
}
function intro(){
  timeline?.kill();
  introActive=true;
  pointer.inside=false;
  for(let i=0;i<pieces.length;i++){
    springs[i].y=0;springs[i].v=0;pieces[i].style.translate='';
  }
  gsap.set(pieces,{opacity:0,y:40});
  if(document.body.classList.contains('intro-playing'))return;
  if(reduce.matches){gsap.set(pieces,{opacity:1,y:0});introActive=false;measure();wake();return;}
  timeline=gsap.to(pieces,{opacity:1,y:0,duration:1.25,stagger:.05,ease:'power3.out',delay:.12,
    onComplete(){introActive=false;gsap.set(pieces,{clearProps:'transform,opacity'});measure();}});
  wake();
}
function paintGradient(){
  if(!word)return;
  const spin=time/5.5*Math.PI*2;
  const blobs=palette.map((color,i)=>{
    const rate=.55+((i*.618)%1)*.5;
    const x=50+44*Math.sin(spin*rate+i*2.1);
    const y=50+40*Math.sin(spin*(rate*.83+.21)+i*1.3);
    return `radial-gradient(ellipse 58% 150% at ${x.toFixed(2)}% ${y.toFixed(2)}%,${color} 0%,transparent 100%)`;
  });
  word.style.setProperty('--gt-gradient',`${blobs.join(',')},linear-gradient(90deg,${palette.join(',')})`);
}
function tick(now){
  raf=0;
  if(document.hidden || document.body.classList.contains('intro-playing'))return;
  const dt=last?Math.min(.032,(now-last)/1000):.016;last=now;
  if(!reduce.matches)time+=dt;
  const progress=Number(home.dataset.progress)||0;
  const em=parseFloat(getComputedStyle(title).fontSize);
  for(let i=0;i<pieces.length;i++){
    const start=.035+i/Math.max(1,pieces.length-1)*.64;
    inks[i].style.setProperty('--scroll-alpha',String(1-smooth((progress-start)/.22)));
    let target=0;
    if(pointer.inside && !introActive && fine.matches && !reduce.matches && centers[i]){
      const dx=(centers[i].x-pointer.x)/(em*1.15);
      const dy=(centers[i].y-pointer.y)/(em*1.61);
      target=-em*.2*Math.exp(-(dx*dx+dy*dy)*.5);
    }
    const spring=springs[i];
    spring.v+=(180*(target-spring.y)-19*spring.v)*dt;
    spring.y+=spring.v*dt;
    if(Math.abs(target-spring.y)<.02 && Math.abs(spring.v)<.05){spring.y=target;spring.v=0;}
    pieces[i].style.translate=Math.abs(spring.y)>.01?`0 ${spring.y.toFixed(2)}px`:'';
  }
  paintGradient();
  if(visible && !reduce.matches)raf=requestAnimationFrame(tick);
}
function wake(){if(!raf && !document.hidden){last=0;raf=requestAnimationFrame(tick);}}
function locate(e){const r=title.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top;}
title.addEventListener('pointerenter',e=>{measure();locate(e);pointer.inside=true;wake();},{passive:true});
title.addEventListener('pointermove',e=>{locate(e);pointer.inside=true;wake();},{passive:true});
title.addEventListener('pointerleave',()=>{pointer.inside=false;wake();},{passive:true});
addEventListener('scroll',wake,{passive:true});
addEventListener('resize',()=>{measure();wake();},{passive:true});
new ResizeObserver(()=>{measure();wake();}).observe(title);
new IntersectionObserver(([entry])=>{
  visible=entry.isIntersecting;
  if(visible)wake();else{cancelAnimationFrame(raf);raf=0;}
}).observe(home);
new MutationObserver(intro).observe(document.body,{attributes:true,attributeFilter:['class']});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else wake();});
reduce.addEventListener('change',intro);
measure();intro();paintGradient();
