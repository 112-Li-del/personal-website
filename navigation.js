// Five real URL entries; navigation keeps the homepage's canvases mounted.
const routes={
  '/':{page:'home',title:'Home'},'/about':{page:'about',title:'About'},
  '/work':{page:'work',title:'Work'},'/achievement':{page:'achievement',title:'Achievement'},
  '/contact':{page:'contact',title:'Contact'}
};
const main=document.querySelector('main');
const chrome=document.querySelector('.site-chrome');
const panel=document.querySelector('.staggered-menu-panel');
const toggle=document.querySelector('.sm-toggle');
const brand=document.querySelector('.site-brand');
const layers=[...document.querySelectorAll('.sm-prelayer')];
const labels=[...panel.querySelectorAll('.sm-panel-itemLabel')];
const links=[...panel.querySelectorAll('.sm-panel-item')];
const socials=[...panel.querySelectorAll('.sm-socials-title,.sm-socials-link')];
const shade=document.querySelector('.menu-shade');
const icon=document.querySelector('.sm-icon');
const text=document.querySelector('.sm-toggle-textInner');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let open=false,animation,gsap;
function routePath(){return location.pathname.replace(/\/$/,'')||'/';}
function renderRoute(focus=false){
  const path=routePath(),route=routes[path]||routes['/'];
  document.querySelectorAll('.route-page[data-page]').forEach(page=>{page.hidden=page.dataset.page!==route.page;});
  document.body.dataset.page=route.page;
  document.title=`${route.title} · 李咏欣`;
  document.querySelectorAll('[data-route]').forEach(link=>{
    if(link.getAttribute('href')===path)link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  window.scrollTo({top:0,behavior:'instant'});
  dispatchEvent(new Event('resize'));
  dispatchEvent(new Event('portfolio:navigate'));
  if(focus){
    const heading=document.querySelector(`.route-page[data-page="${route.page}"] h1`);
    heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});
  }
}
renderRoute();

function animateLabel(opening){
  const from=opening?'Menu':'Close',to=opening?'Close':'Menu';
  const sequence=[from,to,from,to,to];
  text.replaceChildren(...sequence.map(label=>{const span=document.createElement('span');span.textContent=label;return span;}));
  gsap.killTweensOf(text);gsap.set(text,{yPercent:0});
  gsap.to(text,{yPercent:-80,duration:reduced.matches?0:.85,ease:'power4.out'});
}
function setOpen(next,{restoreFocus=true}={}){
  if(open===next)return;
  open=next;animation?.kill();
  gsap.killTweensOf([toggle,icon,shade]);
  chrome.dataset.open=String(open);
  panel.inert=!open;panel.setAttribute('aria-hidden',String(!open));
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'关闭菜单':'打开菜单');
  brand.inert=open;
  if(open){
    chrome.setAttribute('role','dialog');chrome.setAttribute('aria-modal','true');chrome.setAttribute('aria-label','主菜单');
    main.inert=true;document.body.classList.add('menu-open');
    const duration=reduced.matches?0:1;
    animation=gsap.timeline({onComplete:()=>{if(open)links[0]?.focus({preventScroll:true});}});
    gsap.set(labels,{yPercent:140,rotate:10});gsap.set(links,{'--sm-num-opacity':0});
    gsap.set(socials,{y:25,opacity:0});gsap.set(panel,{visibility:'visible'});
    layers.forEach((layer,i)=>animation.fromTo(layer,{xPercent:100},{xPercent:0,duration:.5*duration,ease:'power4.out'},i*.07*duration));
    animation.fromTo(panel,{xPercent:100},{xPercent:0,duration:.65*duration,ease:'power4.out'},.15*duration)
      .to(labels,{yPercent:0,rotate:0,duration:duration,ease:'power4.out',stagger:.1*duration},.25*duration)
      .to(links,{'--sm-num-opacity':1,duration:.6*duration,stagger:.08*duration},.35*duration)
      .to(socials,{y:0,opacity:1,duration:.55*duration,stagger:.08*duration,ease:'power3.out'},.4*duration);
  }else{
    chrome.removeAttribute('role');chrome.removeAttribute('aria-modal');chrome.removeAttribute('aria-label');
    document.body.classList.remove('menu-open');
    main.inert=document.body.classList.contains('intro-playing');
    // Retain visibility until the closing layers have moved out.
    gsap.set(panel,{visibility:'visible'});
    animation=gsap.to([...layers,panel],{xPercent:100,duration:reduced.matches?0:.32,ease:'power3.in',
      onComplete:()=>{if(!open)gsap.set(panel,{visibility:'hidden'});}});
    if(restoreFocus)toggle.focus({preventScroll:true});
  }
  gsap.to(shade,{opacity:open?1:0,duration:reduced.matches?0:.3});
  gsap.to(icon,{rotate:open?225:0,duration:reduced.matches?0:open?.8:.35,ease:'power4.out'});
  gsap.to(toggle,{color:open?'#ffffff':'#3b82f6',duration:reduced.matches?0:.3,delay:open?.18:0});
  animateLabel(open);
}
// Load the official UMD runtime as a classic script.
await new Promise((resolve,reject)=>{
  if(window.gsap){resolve();return;}
  const script=document.createElement('script');script.src='/assets/gsap/gsap.min.js';
  script.onload=resolve;script.onerror=reject;document.head.append(script);
});
gsap=window.gsap;
gsap.set([...layers,panel],{x:0,xPercent:100});
toggle.addEventListener('click',()=>setOpen(!open));
shade.addEventListener('click',()=>setOpen(false));
document.addEventListener('keydown',event=>{
  if(!open)return;
  if(event.key==='Escape'){event.preventDefault();setOpen(false);return;}
  if(event.key==='Tab'){
    const focusable=[toggle,...panel.querySelectorAll('a[href]')];
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
document.addEventListener('click',event=>{
  const link=event.target.closest('a[data-route]');
  if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const url=new URL(link.href,location.href);
  if(url.origin!==location.origin||!routes[url.pathname])return;
  event.preventDefault();
  if(open)setOpen(false,{restoreFocus:false});
  if(routePath()!==url.pathname)history.pushState({},'',url.pathname);
  renderRoute(true);
});
addEventListener('popstate',()=>{if(open)setOpen(false,{restoreFocus:false});renderRoute(true);});
reduced.addEventListener('change',()=>{if(open)setOpen(false);});
