const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>x*x*(3-2*x);
function knee(hip,ankle){
  const dx=ankle.x-hip.x,dy=ankle.y-hip.y;
  const distance=Math.min(Math.hypot(dx,dy),183.99),upper=92,lower=92;
  const theta=Math.atan2(dy,dx)-Math.acos((upper*upper+distance*distance-lower*lower)/(2*upper*distance));
  return {x:hip.x+Math.cos(theta)*upper,y:hip.y+Math.sin(theta)*upper};
}

// Restored pre-Stick-Motion character and illustrated part registration.
export function characterPose({activeTime=0,moving=false,effort=0,finishProgress=0}={}) {
  const phase=(activeTime/760)%1;
  const bob=Math.sin(phase*4*Math.PI)*1.5;
  const load=moving?effort:0;
  const hip={x:250-load*3,y:391+bob};
  function leg(offset){
    const p=(phase+offset)%1,stance=.64;
    const u=clamp((p-stance)/(1-stance));
    const x=p<stance?32-64*p/stance:-32+64*ease(u);
    const lift=p<stance?0:28*Math.sin(u*Math.PI);
    const ankle={x:250+x*(1-finishProgress),y:565-lift*(1-finishProgress)};
    return {ankle,knee:knee(hip,ankle),lift,planted:p<stance};
  }
  return {hip,left:leg(0),right:leg(.5),headAngle:moving?(-2+effort*9): -7,
    expression:moving?(effort>.48?'strain':'neutral'):'breathe',load,bob};
}

export function createCharacter(root){
  root.innerHTML='<canvas class="character-art" width="512" height="640" aria-hidden="true"></canvas>';
  const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d',{alpha:true}),atlas=new Image();
  const part={neutral:[25,45,405,383],strain:[484,70,388,354],breathe:[885,45,357,380],
    torso:[1230,105,544,342],shorts:[48,485,414,355],thigh:[600,485,210,350],shin:[996,480,168,363],shoe:[1333,637,384,188]};
  let lastState={};
  function sprite(name,x,y,w,h){ctx.drawImage(atlas,...part[name],x,y,w,h);}
  function bone(name,a,b){
    const anchors=name==='thigh'?[[670,505],[747,799],.32]:[[1108,499],[1055,816],.31];
    const [s0,s1,widthScale]=anchors,dx=s1[0]-s0[0],dy=s1[1]-s0[1];
    const sourceAngle=Math.atan2(dy,dx),targetAngle=Math.atan2(b.y-a.y,b.x-a.x);
    const lengthScale=Math.hypot(b.x-a.x,b.y-a.y)/Math.hypot(dx,dy);
    ctx.save();ctx.translate(a.x,a.y);ctx.rotate(targetAngle);
    const radius=name==='thigh'?15:12;
    ctx.beginPath();ctx.rect(-5,-radius,Math.hypot(b.x-a.x,b.y-a.y)+10,radius*2);ctx.clip();
    ctx.scale(lengthScale,widthScale);ctx.rotate(-sourceAngle);ctx.translate(-s0[0],-s0[1]);
    ctx.beginPath();ctx.rect(...part[name]);ctx.clip();ctx.drawImage(atlas,0,0);ctx.restore();
  }
  function drawLeg(leg,hip,far){
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    for(const [a,b,width] of [[hip,leg.knee,35],[leg.knee,leg.ankle,29]]){
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
      ctx.strokeStyle='#242321';ctx.lineWidth=width;ctx.stroke();
      ctx.strokeStyle=far?'#deddd7':'#f1f0eb';ctx.lineWidth=width-5;ctx.stroke();
    }
    bone('thigh',hip,leg.knee);bone('shin',leg.knee,leg.ankle);
    ctx.beginPath();ctx.fillStyle=far?'#deddd7':'#f1f0eb';ctx.arc(leg.knee.x,leg.knee.y,11,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(leg.ankle.x,leg.ankle.y);ctx.rotate(-leg.lift/28*.18);
    sprite('shoe',-25,-5,78,38);ctx.restore();ctx.restore();
  }
  function update(state){
    lastState=state;const p=characterPose(state);
    root.dataset.leftFoot=p.left.ankle.x.toFixed(2);root.dataset.rightFoot=p.right.ankle.x.toFixed(2);
    root.dataset.leadingLeg=p.left.ankle.x>p.right.ankle.x?'left':'right';
    root.dataset.liftedFoot=String(Math.max(p.left.lift,p.right.lift)>10);
    root.dataset.expression=p.expression;root.dataset.headAngle=String(p.headAngle);
    root.dataset.joints=JSON.stringify({hip:p.hip,left:p.left,right:p.right,neck:{x:304,y:193}});
    if(!atlas.complete||!atlas.naturalWidth)return;
    ctx.clearRect(0,0,512,640);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    drawLeg(p.right,p.hip,true);drawLeg(p.left,p.hip,false);
    sprite('shorts',185,326+p.bob,140,116);
    ctx.save();ctx.translate(474,224);ctx.rotate(p.load*.012);ctx.translate(-474,-224);
    ctx.save();ctx.beginPath();
    const outline=[[1230,399],[1320,237],[1426,108],[1502,140],[1560,189],[1700,180],[1738,101],[1774,100],[1774,270],[1565,309],[1490,270],[1448,447],[1337,452]];
    outline.forEach(([x,y],i)=>{const px=180+(x-1230)/544*300,py=170+(y-105)/342*190;i?ctx.lineTo(px,py):ctx.moveTo(px,py);});
    ctx.closePath();ctx.clip();sprite('torso',180,170,300,190);ctx.restore();
    ctx.beginPath();ctx.moveTo(286,181);ctx.lineTo(310,176);ctx.lineTo(328,203);ctx.lineTo(297,209);ctx.closePath();
    ctx.fillStyle='#f1f0eb';ctx.fill();
    const neck={neutral:[194,419],strain:[659,417],breathe:[1062,414]}[p.expression];
    const box=part[p.expression];
    ctx.save();ctx.translate(304,193);ctx.rotate(p.headAngle*Math.PI/180);
    sprite(p.expression,-(neck[0]-box[0])/box[2]*132,-(neck[1]-box[1])/box[3]*124,132,124);
    ctx.restore();ctx.restore();return p;
  }
  atlas.onload=()=>update(lastState);atlas.src='./assets/character-parts.png';
  return {update};
}
