// Wheel momentum moves between 90-degree detents; weak impulses return to the current face.
// Semi-implicit small steps keep the damped spring stable across frame rates.
export function stepDrum(state, seconds) {
  state.target ??= 0;
  let remaining = Math.min(.05, Math.max(0, seconds));
  while (remaining > 0) {
    const dt = Math.min(remaining, 1 / 120);
    state.velocity += (-14 * (state.angle - state.target) - 5.4 * state.velocity) * dt;
    state.angle += state.velocity * dt;
    // Crossing the midpoint commits to the adjacent face, not the old one.
    if (Math.abs(state.angle - state.target) > 45) {
      state.target += Math.sign(state.angle - state.target) * 90;
    }
    remaining -= dt;
  }
  if (Math.abs(state.angle - state.target) < .025 && Math.abs(state.velocity) < .06) {
    state.angle = state.target; state.velocity = 0;
  }
  return state;
}
export function pushDrum(state, delta) {
  state.velocity = Math.max(-480, Math.min(480, state.velocity - Math.max(-720, Math.min(720, delta)) * .75));
}

if (typeof document !== 'undefined') {
  const rotor = document.querySelector('.brand-drum__rotor');
  if (rotor) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const state = { angle:0, velocity:0, target:0 };
    let raf=0, last=0, touchY=null;
    const blocked = () => reduced.matches || document.hidden || document.body.classList.contains('intro-playing') || document.body.classList.contains('menu-open');
    const draw = now => {
      raf=0;
      if(document.hidden)return;
      stepDrum(state,last ? (now-last)/1000 : 1/60);
      last=now;
      rotor.style.transform=`rotateY(${state.angle}deg)`;
      if(state.angle!==state.target || state.velocity)raf=requestAnimationFrame(draw);
      else { last=0;rotor.style.willChange=''; }
    };
    const wake = () => {
      if(raf || document.hidden)return;
      last=0;rotor.style.willChange='transform';raf=requestAnimationFrame(draw);
    };
    const impulse = delta => { if(blocked())return;pushDrum(state,delta);wake(); };
    window.addEventListener('wheel',event=>{
      const unit=event.deltaMode===1 ? 16 : event.deltaMode===2 ? innerHeight : 1;
      impulse(event.deltaY*unit);
    },{passive:true});
    window.addEventListener('touchstart',event=>{touchY=event.touches[0]?.clientY ?? null;},{passive:true});
    window.addEventListener('touchmove',event=>{
      const next=event.touches[0]?.clientY;
      if(touchY!==null && next!==undefined)impulse((touchY-next)*2);
      touchY=next ?? null;
    },{passive:true});
    window.addEventListener('touchend',()=>{touchY=null;},{passive:true});
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;}
      else if(state.angle!==state.target || state.velocity)wake();
    });
    reduced.addEventListener('change',()=>{
      if(!reduced.matches)return;
      cancelAnimationFrame(raf);raf=0;last=0;state.target=Math.round(state.angle/90)*90;state.angle=state.target;state.velocity=0;
      rotor.style.transform=`rotateY(${state.angle}deg)`;rotor.style.willChange='';
    });
  }
}
