import {createCursorGrid} from './cursor-grid.js';
const intro=document.querySelector('.intro'),main=document.querySelector('main');
const cursorGrid=createCursorGrid(intro,document.querySelector('.cursor-grid-canvas'));
const greeting=document.querySelector('.greeting-text'),status=document.querySelector('#intro-status');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const progress=document.querySelector('.loading-progress'),count=document.querySelector('.loading-count'),progressFill=document.querySelector('.loading-fill');
const greetings=[
  ['Hello','en'],['Bonjour','fr'],['Hola','es'],['Ciao','it'],['Olá','pt'],['Hallo','de'],
  ['Hallå','sv'],['Merhaba','tr'],['こんにちは','ja'],['안녕하세요','ko'],['مرحبًا','ar'],['你好','zh-CN']
];
const FIRST_HOLD=650,INTERVAL=150,LAST_HOLD=500;
const TOTAL=FIRST_HOLD+(greetings.length-2)*INTERVAL+LAST_HOLD;
let frame=0,hideTimer=0,started=0,active=false,trigger=null;
// Adapt the supplied React Bits CountUp's easeOut cubic-bezier(.33,1,.68,1)
// to the site's existing animation clock, shared by the number and the bar.
function countEase(progress){
  const x=Math.max(0,Math.min(1,progress));
  if(x===0||x===1)return x;
  let low=0,high=1;
  for(let i=0;i<18;i++){
    const t=(low+high)/2,inv=1-t;
    const bx=3*inv*inv*t*.33+3*inv*t*t*.68+t*t*t;
    if(bx<x)low=t;else high=t;
  }
  return 1-(1-(low+high)/2)**3;
}
function render(ms){
  const index=ms<FIRST_HOLD?0:Math.min(greetings.length-1,1+Math.floor((ms-FIRST_HOLD)/INTERVAL));
  const [text,lang]=greetings[index];
  greeting.textContent=text;greeting.lang=lang;intro.dataset.greeting=text;
  const p=countEase(ms/(TOTAL-LAST_HOLD)),value=p>=1?100:Math.min(99,Math.floor(p*100));
  count.textContent=String(value);progress.setAttribute('aria-valuenow',String(value));
  progressFill.style.transform=`scaleX(${p})`;
}
function finish({skipped=false}={}){
  if(!active)return;active=false;cancelAnimationFrame(frame);
  cursorGrid.stop();
  render(TOTAL);
  intro.classList.add('leaving');intro.dataset.phase='leaving';
  document.body.classList.remove('intro-playing');main.inert=false;
  status.textContent='你好，欢迎来到我的作品集';
  if(skipped||trigger)(trigger||document.querySelector('main .replay')).focus({preventScroll:true});
  const hide=()=>{intro.hidden=true;intro.dataset.phase='complete';};
  if(reducedMotion.matches)hide();else hideTimer=setTimeout(hide,850);
}
function tick(now){
  if(!active)return;const elapsed=now-started;render(elapsed);
  if(elapsed>=TOTAL){finish();return;}frame=requestAnimationFrame(tick);
}
function play(event){
  cancelAnimationFrame(frame);clearTimeout(hideTimer);trigger=event?.currentTarget||null;
  window.scrollTo({top:0,behavior:'instant'});
  intro.hidden=false;intro.classList.remove('leaving');intro.dataset.phase='greetings';
  document.body.classList.add('intro-playing');main.inert=true;active=true;
  status.textContent='正在播放多语言问候开场';render(0);
  if(reducedMotion.matches){render(TOTAL);finish();return;}
  cursorGrid.start();
  // Establish the initial transform before replaying the exit transition.
  void intro.offsetWidth;
  started=performance.now();frame=requestAnimationFrame(tick);
}
document.querySelectorAll('main .replay').forEach(button=>button.addEventListener('click',play));
document.querySelector('.skip-intro').addEventListener('click',()=>finish({skipped:true}));
addEventListener('keydown',event=>{if(event.key==='Escape'&&active)finish({skipped:true});});
reducedMotion.addEventListener('change',()=>{if(active&&reducedMotion.matches)finish();});
play();


