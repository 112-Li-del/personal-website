// Original Skins Demo by JcToon, CC BY 4.0. See assets/rive/ATTRIBUTION.md.
// This small adapter targets the pinned 2.40.1 runtime and its original head bone.
export function headPlacement(m,length,layout,crop){
  const v=Math.min((layout.maxX-layout.minX)/1000,(layout.maxY-layout.minY)/1000);
  const ox=layout.minX+((layout.maxX-layout.minX)-1000*v)/2;
  const oy=layout.minY+((layout.maxY-layout.minY)-1000*v)/2;
  const s=Math.min(480/crop.w,640/crop.h),dx=(480-crop.w*s)/2,dy=(640-crop.h*s)/2;
  const point=(x,y)=>({x:dx+(ox+x*v-crop.x)*s,y:dy+(oy+y*v-crop.y)*s});
  return {neck:point(m.tx,m.ty),center:point(m.tx+m.xx*length/2,m.ty+m.xy*length/2),
    radius:length*.55*Math.hypot(m.xx,m.xy)*v*s,angle:Math.atan2(m.xy,m.xx)+Math.PI/2};
}
export function createCharacter(root){
  root.innerHTML='<canvas class="character-art" width="480" height="640" aria-hidden="true"></canvas>';
  const output=root.querySelector('canvas'),ctx=output.getContext('2d');
  const portrait=new Image();
  const portraitReady=new Promise((resolve,reject)=>{portrait.onload=resolve;portrait.onerror=()=>reject(new Error('Portrait load failed'));});
  portrait.src='./assets/profile-head.png';
  const source=document.createElement('canvas');source.width=source.height=1024;
  // Rive observes CSS size and skips drawing a detached, zero-size canvas.
  source.style.cssText='position:absolute;left:0;top:0;width:1024px;height:1024px;opacity:0;pointer-events:none';
  source.setAttribute('aria-hidden','true');root.append(source);
  const foreground=document.createElement('canvas');foreground.width=foreground.height=1024;
  const fg=foreground.getContext('2d',{willReadFrequently:true});
  let instance,copyFrame=0,crop=null,playing=false,requested=true,readyResolve,readyReject,zoomed=false,zoomWait=0,readyDone=false,zoomLayout=null;
  const animationReady=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
  const ready=Promise.all([animationReady,portraitReady]);
  const resize=()=>{};
  function findCrop(){
    const {data}=fg.getImageData(0,0,1024,1024);
    let x0=1024,y0=1024,x1=0,y1=0;
    for(let y=0;y<1024;y+=2)for(let x=0;x<1024;x+=2){
      if(data[(y*1024+x)*4+3]>24){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    }
    if(x1<=x0||y1<=y0)return null;
    const margin=Math.max(x1-x0,y1-y0)*.25;
    return {x:Math.max(0,x0-margin),y:Math.max(0,y0-margin),w:x1-x0+margin*2,h:y1-y0+margin*2};
  }
  function copy(){
    if(!playing)return;
    if(source.width!==1024||source.height!==1024)instance.resizeDrawingSurfaceToCanvas(1);
    // Re-showing a hidden canvas makes Rive reset its viewport bounds.
    if(zoomLayout&&instance.layout.maxX!==zoomLayout.maxX)instance.layout=zoomLayout;
    fg.clearRect(0,0,1024,1024);fg.drawImage(source,0,0);
    const pixels=fg.getImageData(0,0,1024,1024),data=pixels.data;
    if(data[3]>240){
      const bg=[data[0],data[1],data[2]];root.dataset.background=bg.join(',');
      for(let i=0;i<data.length;i+=4){
        const delta=Math.max(Math.abs(data[i]-bg[0]),Math.abs(data[i+1]-bg[1]),Math.abs(data[i+2]-bg[2]));
        if(delta<35)data[i+3]=Math.round(data[i+3]*clampAlpha((delta-5)/30));
      }
      fg.putImageData(pixels,0,0);
    }
    if(zoomWait>0){zoomWait--;}
    else if(!crop){
      crop=findCrop();
      if(crop&&!zoomed){
        // Render vectors at their actual display resolution instead of enlarging
        // the tiny figure inside the original 1000px artboard.
        const s=Math.min(1024/crop.w,1024/crop.h);
        const x=(1024-crop.w*s)/2-crop.x*s,y=(1024-crop.h*s)/2-crop.y*s;
        zoomLayout=new rive.Layout({fit:rive.Fit.Contain,minX:x,minY:y,maxX:x+1024*s,maxY:y+1024*s});
        instance.layout=zoomLayout;
        zoomed=true;zoomWait=3;crop=null;
      }else if(crop){
        root.dataset.crop=JSON.stringify(crop);
        if(!readyDone){readyDone=true;root.dataset.ready='true';readyResolve();}
      }
    }
    ctx.clearRect(0,0,480,640);
    if(crop){
      const scale=Math.min(480/crop.w,640/crop.h);
      const w=crop.w*scale,h=crop.h*scale;
      ctx.drawImage(foreground,crop.x,crop.y,crop.w,crop.h,(480-w)/2,(640-h)/2,w,h);
      if(portrait.complete&&portrait.naturalWidth){
        const bone=instance.artboard.bone('head'),matrix=bone.worldTransform();
        const anchor=headPlacement(matrix,bone.length,instance.layout,crop);matrix.delete();
        root.dataset.headAnchor=JSON.stringify(anchor);
        // Remove only the original circular head. Body and its Rive animation remain intact.
        ctx.save();ctx.globalCompositeOperation='destination-out';ctx.beginPath();
        ctx.arc(anchor.center.x,anchor.center.y,anchor.radius+2,0,Math.PI*2);ctx.fill();ctx.restore();
        ctx.save();ctx.translate(anchor.neck.x,anchor.neck.y);ctx.rotate(anchor.angle);
        const r=anchor.radius;
        ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,r*.22);ctx.lineTo(0,-r*.12);
        ctx.strokeStyle='#171719';ctx.lineWidth=r*.55+2;ctx.stroke();
        ctx.strokeStyle='#f4f3ef';ctx.lineWidth=r*.55;ctx.stroke();
        const size=r*3.5;
        ctx.drawImage(portrait,-size*.51,-size*.89,size,size);
        ctx.restore();
      }
    }
    copyFrame=requestAnimationFrame(copy);
  }
  function clampAlpha(x){return Math.max(0,Math.min(1,x));}
  function start(){
    requested=true;
    if(!instance)return;
    instance.play(instance.stateMachineNames.length?instance.stateMachineNames:instance.animationNames[0]);
    if(!playing){playing=true;copy();}
  }
  function pause(){requested=false;playing=false;cancelAnimationFrame(copyFrame);instance?.pause();}
  try{
    rive.RuntimeLoader.setWasmUrl('./assets/rive/rive.wasm');
    instance=new rive.Rive({src:'./assets/rive/skins-demo.riv',canvas:source,autoplay:true,stateMachines:'Motion',
      artboard:'Skin Demo',shouldDisableRiveListeners:true,enableRiveAssetCDN:false,
      layout:new rive.Layout({fit:rive.Fit.Contain,alignment:rive.Alignment.Center}),
      onLoad:()=>{
        if(!requested){readyResolve();return;}
        start();
        root.dataset.metadata=JSON.stringify({animations:instance.animationNames,machines:instance.stateMachineNames,bounds:instance.bounds,
          inputs:instance.stateMachineNames.map(name=>({name,inputs:(instance.stateMachineInputs(name)||[]).map(i=>({name:i.name,type:i.type,value:i.value}))}))});
        for(const machine of instance.stateMachineNames){
          for(const input of instance.stateMachineInputs(machine)||[]){
            if(input.name==='Bouncing'&&input.type===rive.StateMachineInputType.Boolean)input.value=true;
          }
        }
      },onLoadError:()=>{root.dataset.ready='error';readyReject(new Error('Rive load failed'));}});
  }catch(error){readyReject(error);}
  return {ready,start,pause,resize};
}
