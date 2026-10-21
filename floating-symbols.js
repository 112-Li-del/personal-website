import Lenis from './assets/lenis/lenis.mjs';
// React Bits DepthText's layered CSS extrusion, adapted for decorative symbols.
// One shared clock adds drift and reversible scroll-driven exit trajectories.
const home = document.querySelector('.home');
const scene = document.querySelector('.home-stage');
const copy = document.querySelector('.hero-copy');
const backdrop = document.querySelector('.floating-symbols');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(hover: hover) and (pointer: fine)');
const symbols = [
  { text:'{', x:27, y:30, mx:18, my:29, roll:-22, rx:14, ry:-32, vx:-1, vy:-1, face:'#555d6b', size:1.08, launch:.06, finish:.75, approach:680, curve:-.06 },
  { text:'/', x:64, y:32, mx:79, my:30, roll:18, rx:-20, ry:32, vx:1, vy:-1, face:'#8390a5', size:.83, launch:.23, finish:1, approach:570, curve:.08 },
  { text:'#', x:36, y:68, mx:24, my:67, roll:20, rx:22, ry:-25, vx:-1, vy:1, face:'#4a6186', size:.82, launch:.14, finish:.9, approach:730, curve:.05 },
  { text:'>', x:76, y:65, mx:80, my:67, roll:18, rx:-20, ry:-30, vx:1, vy:1, face:'#6e7787', size:1, launch:0, finish:.62, approach:760, curve:-.08 }
].map((spec,index) => {
  const root = document.createElement('span');
  root.className = 'floating-symbol';
  root.style.setProperty('--symbol-face',spec.face);
  const depth = document.createElement('span');
  depth.className = 'depth-text';
  const stage = document.createElement('span');
  stage.className = 'depth-text__stage';
  const layers = 28;
  for(let i=layers;i>=1;i--){
    const layer = document.createElement('span');
    layer.className = 'depth-text__layer' + (i===layers?' depth-text__back':'');
    layer.textContent = spec.text;
    const mix = Math.round((1-(i/layers)**2)*72+4);
    layer.style.color = `color-mix(in srgb, color-mix(in srgb, ${spec.face} ${mix}%, #080c14) 92%, black)`;
    layer.style.transform = `translateZ(calc(var(--symbol-depth) * ${-i}px))`;
    stage.append(layer);
  }
  const face = document.createElement('span');
  face.className = 'depth-text__face';
  face.textContent = spec.text;
  stage.append(face);depth.append(stage);root.append(depth);backdrop.append(root);
  return {...spec,root,stage,index};
});
let width=innerWidth,height=innerHeight,travel=1,top=0,raf=0,visible=true,last=0,elapsed=0;
const pointer={x:0,y:0},current={x:0,y:0};
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
function resize(){
  width=Math.max(1,scene.clientWidth);height=Math.max(1,scene.clientHeight);
  top=home.getBoundingClientRect().top+scrollY;
  travel=Math.max(1,home.offsetHeight-height);
  const mobile=width<=600;
  for(const s of symbols){
    s.root.style.setProperty('--symbol-x',`${mobile?s.mx:s.x}%`);
    s.root.style.setProperty('--symbol-y',`${mobile?s.my:s.y}%`);
    s.root.style.setProperty('--symbol-size',`${Math.max(mobile?76:125,Math.min(220,width*.135))*s.size}px`);
    s.root.style.setProperty('--symbol-depth',String(mobile ? 1.0 : 1.65));
  }
  wake();
}
function draw(now){
  raf=0;
  const dt=last?Math.min((now-last)/1000,.05):0;last=now;
  const paused=document.hidden||document.body.classList.contains('intro-playing');
  if(paused)return;
  if(!reduced.matches)elapsed+=dt;
  const p=clamp((scrollY-top)/travel);
  // Extend the flight without slowing the established text fade timeline.
  const textTravel=reduced.matches?travel:height*(width<=600?1.3:1.6);
  const textProgress=clamp((scrollY-top)/textTravel);
  home.dataset.progress=String(textProgress);
  const alpha=1-smooth((textProgress-.06)/.76);
  copy.style.opacity=reduced.matches?String(alpha):'1';
  document.querySelector('.eyebrow').style.opacity=String(1-smooth(textProgress/.32));
  copy.querySelectorAll('.copy-word').forEach((word,i,all)=>{
    word.style.opacity=String(1-smooth((textProgress-(.07+i/Math.max(1,all.length-1)*.55))/.25));
  });
  copy.style.transform=`translate3d(0,${reduced.matches?0:-32*textProgress}px,0)`;
  copy.style.pointerEvents=alpha<.03?'none':'';
  current.x+=(pointer.x-current.x)*.06;current.y+=(pointer.y-current.y)*.06;
  for(const s of symbols){
    const t=elapsed*.65+s.index*1.7;
    // Every glyph has its own launch window and depth trajectory. Parent
    // perspective projects both its size and its position toward the viewer.
    const flight=clamp((p-s.launch)/(s.finish-s.launch));
    const exit=Math.pow(flight,3.2);
    const gather=Math.sin(flight*Math.PI);
    const bend=gather*s.curve*.3;
    const originX=(width<=600?s.mx:s.x)/100-.5;
    const originY=(width<=600?s.my:s.y)/100-.5;
    const drift=reduced.matches?0:Math.sin(t*1.1)*10;
    const dx=reduced.matches?0:width*(-originX*.45*gather+s.vx*.32*exit+bend);
    const dy=reduced.matches?0:height*(-originY*.45*gather+s.vy*.28*exit+bend*.5);
    const dz=reduced.matches?0:s.approach*Math.pow(flight,1.15);
    s.root.style.transform=`translate(-50%,-50%) translate3d(${dx}px,${dy}px,${dz}px)`;
    s.root.dataset.flight=String(flight);
    s.root.dataset.depth=String(dz);
    s.root.style.opacity=reduced.matches?String(alpha):'1';
    const rx=s.rx+(reduced.matches?0:Math.cos(t)*4-current.y*7+exit*(s.index%2?180:-150));
    const ry=s.ry+(reduced.matches?0:Math.sin(t*.8)*6+current.x*10+exit*(s.index%2?-300:280));
    const roll=s.roll+(reduced.matches?0:Math.sin(t*.7)*3+s.vx*exit*210);
    s.stage.style.transform=`translateY(${drift}px) rotateZ(${roll}deg) rotateX(${rx}deg) rotateY(${ry}deg)`;
  }
  if(visible&&!reduced.matches)raf=requestAnimationFrame(draw);
}
function wake(){if(!raf&&!document.hidden){last=0;raf=requestAnimationFrame(draw);}}
addEventListener('scroll',wake,{passive:true});
addEventListener('resize',resize,{passive:true});
new ResizeObserver(resize).observe(scene);
addEventListener('pointermove',event=>{
  if(!fine.matches||reduced.matches)return;
  pointer.x=(event.clientX/width-.5)*2;pointer.y=(event.clientY/height-.5)*2;
},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else wake();});
new MutationObserver(wake).observe(document.body,{attributes:true,attributeFilter:['class']});
new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)wake();else{cancelAnimationFrame(raf);raf=0;}},{threshold:0}).observe(home);
reduced.addEventListener('change',wake);
resize();

// Keep real document scrolling, keyboard navigation and touch gestures intact.
// Lenis smooths only the wheel on desktop; all visuals follow its actual scroll position.
let lenis;
function configureScroll(){
  lenis?.destroy();
  lenis=undefined;
  if(!reduced.matches)lenis=new Lenis({duration:1.35,wheelMultiplier:.72,smoothWheel:true,syncTouch:false,autoRaf:true,anchors:true});
  syncIntro();
}
function syncIntro(){
  if(document.body.classList.contains('intro-playing')||document.body.classList.contains('menu-open'))lenis?.stop();
  else lenis?.start();
  wake();
}
const description=document.querySelector('.hero-description');
const descriptionText=description.textContent;
description.setAttribute('aria-label',descriptionText);
description.replaceChildren();
descriptionText.split(/(\s+)/).forEach(word=>{
  if(!word.trim()){description.append(document.createTextNode(word));return;}
  const span=document.createElement('span');span.className='copy-word';span.textContent=word;span.setAttribute('aria-hidden','true');description.append(span);
});
new MutationObserver(syncIntro).observe(document.body,{attributes:true,attributeFilter:['class']});
reduced.addEventListener('change',configureScroll);
configureScroll();

addEventListener('portfolio:navigate',()=>{lenis?.resize();lenis?.scrollTo(0,{immediate:true,force:true});resize();});
