// The hero owns its exit; the profile is normal document flow, not a second fixed title.
const section=document.querySelector('.profile-section');
const home=document.querySelector('.home');
const stage=document.querySelector('.home-stage');
const badge=document.querySelector('.profile-badge');
const host=document.querySelector('.lanyard-host');
const flipButton=document.querySelector('.badge-flip');
const windows=[...section.querySelectorAll('[data-reveal]')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const smooth=v=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
let raf=0,loading=null,lanyard=null,rays=null,revealed=false,revealedAt=0,revealTimer=0;
flipButton.disabled=true;
function prepare(){
  if(loading)return loading;
  loading=Promise.all([
    import('./lanyard.js').then(({initLanyard})=>{
      lanyard=initLanyard(host,{frontImage:'/assets/lanyard-avatar.png',cardColor:'#122445',strapColor:'#254a84',size:.58,strapLength:.42,strapWidth:.65,cornerRadius:.25,finish:'glossy',metal:'silver',damping:.62,elasticity:.45,breeze:.12,intro:false});
      flipButton.disabled=!lanyard;
      badge.classList.toggle('is-interactive',!!lanyard);
    }).catch(error=>console.warn('Interactive badge unavailable; showing portrait.',error)),
    import('./light-rays.js').then(({initLightRays})=>{
      rays=initLightRays(section.querySelector('.profile-light'),{raysOrigin:'top-center',raysColor:'#122445',raysSpeed:1,lightSpread:.5,rayLength:3,glow:.6,haze:.25,followMouse:true,mouseInfluence:.1,maxDevicePixelRatio:1.5});
    }).catch(error=>console.warn('Light rays unavailable.',error))
  ]).then(wake);
  return loading;
}
function update(){
  raf=0;
  const isHome=document.body.dataset.page==='home';
  const intro=document.body.classList.contains('intro-playing');
  const blocked=document.hidden||document.body.classList.contains('menu-open');
  const viewport=Math.max(1,stage.clientHeight||innerHeight);
  const homeRect=home.getBoundingClientRect();
  const travel=reduced.matches?Math.max(1,home.offsetHeight-viewport):viewport*(stage.clientWidth<=600?1.3:1.6);
  const progress=-homeRect.top/travel;
  // Last hero glyph ends at .895; reserve a clear gap before any incoming ink.
  const reveal=smooth((progress-.94)/.16);
  const allowed=isHome&&!intro&&reveal>0;
  section.style.opacity=String(isHome&&!intro?reveal:0);
  section.dataset.visible=String(allowed);
  section.inert=!allowed;
  section.setAttribute('aria-hidden',String(!allowed));
  const rect=section.getBoundingClientRect();
  const badgeRect=host.getBoundingClientRect();
  if(isHome&&!intro&&rect.top<innerHeight+450&&rect.bottom>0)prepare();
  const badgeInView=badgeRect.top<innerHeight&&badgeRect.bottom>0;
  if(allowed&&badgeRect.top<innerHeight*.7&&badgeRect.bottom>0&&!revealed&&loading){
    loading.then(()=>{
      if(revealed||section.inert)return;
      revealed=true;revealedAt=performance.now();badge.classList.add('is-visible');
      lanyard?.reveal();clearTimeout(revealTimer);revealTimer=setTimeout(wake,reduced.matches?0:450);wake();
    });
  }
  if(progress<.7&&revealed){revealed=false;badge.classList.remove('is-visible');windows.forEach(w=>w.classList.remove('is-visible'));}
  if(revealed&&(reduced.matches||performance.now()-revealedAt>400)){
    windows.forEach(window=>{const box=window.getBoundingClientRect();if(box.top<innerHeight*.94)window.classList.add('is-visible');});
  }
  lanyard?.setActive(allowed&&revealed&&badgeInView&&!blocked);
  rays?.setActive(allowed&&rect.top<innerHeight&&rect.bottom>0&&!blocked);
}
function wake(){if(!raf)raf=requestAnimationFrame(update);}
flipButton.addEventListener('click',()=>lanyard?.flip());
addEventListener('scroll',wake,{passive:true});addEventListener('resize',wake,{passive:true});
addEventListener('portfolio:navigate',wake);
document.addEventListener('visibilitychange',wake);
new MutationObserver(wake).observe(document.body,{attributes:true,attributeFilter:['class','data-page']});
new ResizeObserver(wake).observe(section);
reduced.addEventListener('change',wake);
wake();
