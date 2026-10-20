import {createCharacter} from './character.js';
const intro=document.querySelector('.intro'),main=document.querySelector('main');
const cover=document.querySelector('.cover-scene'),actor=document.querySelector('.pusher');
const rope=document.querySelector('.pull-rope'),fill=document.querySelector('.progress-fill');
const status=document.querySelector('#intro-status'),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const greeting=document.querySelector('.greeting'),greetingAnchor=document.querySelector('.greeting-anchor');
const language=document.querySelector('.language-name'),meta=document.querySelector('.intro-meta');
const greetings=[
  ['Hello','ENGLISH','en'],['Bonjour','FRANÇAIS','fr'],['Hola','ESPAÑOL','es'],
  ['Ciao','ITALIANO','it'],['Olá','PORTUGUÊS','pt'],['Hallo','DEUTSCH','de'],
  ['Hallå','SVENSKA','sv'],['Merhaba','TÜRKÇE','tr'],['こんにちは','日本語','ja'],
  ['안녕하세요','한국어','ko'],['مرحبًا','العربية','ar'],['你好','中文','zh-CN']
];
cover.inert=true;
const character=createCharacter(actor);
const LEAD=600,PULL=6200,HOLD=350,TOTAL=LEAD+PULL+HOLD;
let frame=0,hideTimer=0,started=0,active=false,trigger=null,loaded=false;
const clamp=x=>Math.max(0,Math.min(1,x));
// Gentle acceleration, a long steady pull, then gentle deceleration.
export function pullProgress(t){
  const u=clamp(t),r=.14;
  if(u<r)return u*u/(2*r*(1-r));
  if(u>1-r)return 1-(1-u)**2/(2*r*(1-r));
  return (u-r/2)/(1-r);
}
function render(ms){
  const w=innerWidth,aw=actor.getBoundingClientRect().width;
  const p=pullProgress((ms-LEAD)/PULL),edge=w*p;
  const entry=clamp(ms/LEAD),lead=entry*entry*(3-2*entry);
  const actorX=edge+28-(1-lead)*(aw+48);
  cover.style.transform=`translate3d(${edge-w}px,0,0)`;
  // Move the paper, but keep the greeting at the viewport center. The moving
  // paper's overflow clips it until the leading edge crosses the center.
  greetingAnchor.style.left=`${w*1.5-edge}px`;
  meta.style.transform=`translateX(${w-edge}px)`;
  const word=greetings[Math.min(greetings.length-1,Math.floor(Math.max(0,ms-(LEAD+PULL/2))/150))];
  greeting.textContent=word[0];greeting.lang=word[2];language.textContent=word[1];
  intro.dataset.greeting=word[0];
  actor.style.transform=`translate3d(${actorX}px,-50%,0)`;
  actor.style.opacity='1';
  // Waist tether preserves the supplied animation without reposing its arms.
  rope.style.left=`${edge}px`;rope.style.width=`${Math.max(0,actorX+aw*.48-edge)}px`;
  rope.style.opacity=ms>LEAD*.65&&p<1?'1':'0';
  fill.style.transform=`scaleX(${p})`;
  intro.dataset.phase=ms<LEAD?'entering':p<1?'pulling':'cover';
  intro.dataset.progress=p.toFixed(4);
  if(ms>=LEAD+PULL)character.pause();
}
function finish({skipped=false}={}){
  if(!active)return;active=false;cancelAnimationFrame(frame);character.pause();
  intro.classList.add('leaving');document.body.classList.remove('intro-playing');main.inert=false;
  status.textContent='你好，欢迎来到我的作品集';
  if(skipped||trigger)(trigger||document.querySelector('main .replay')).focus({preventScroll:true});
  hideTimer=setTimeout(()=>{intro.hidden=true;},reducedMotion.matches?0:450);
}
function tick(now){
  if(!active)return;const ms=now-started;render(ms);
  if(ms>=TOTAL){finish();return;}frame=requestAnimationFrame(tick);
}
function play(event){
  cancelAnimationFrame(frame);clearTimeout(hideTimer);trigger=event?.currentTarget||null;
  window.scrollTo({top:0,behavior:'instant'});
  intro.hidden=false;intro.classList.remove('leaving');document.body.classList.add('intro-playing');main.inert=true;active=true;
  status.textContent='正在播放人物拉出多语言问候页的动画';render(0);
  if(reducedMotion.matches){finish();return;}
  if(!loaded)return;
  started=performance.now();character.start();frame=requestAnimationFrame(tick);
}
document.querySelectorAll('main .replay').forEach(button=>button.addEventListener('click',play));
document.querySelector('.skip-intro').addEventListener('click',()=>finish({skipped:true}));
addEventListener('keydown',event=>{if(event.key==='Escape'&&active)finish({skipped:true});});
reducedMotion.addEventListener('change',()=>{if(active&&reducedMotion.matches)finish();});
addEventListener('resize',()=>character.resize());
play();
character.ready.then(()=>{loaded=true;if(active){started=performance.now();character.start();frame=requestAnimationFrame(tick);}else character.pause();})
  .catch(()=>{status.textContent='动画未能加载，已显示正文';finish();});
// Do not trap content if an asset fails to initialize.
setTimeout(()=>{if(!loaded&&active)finish();},12000);
