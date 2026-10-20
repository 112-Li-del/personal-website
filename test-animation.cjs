const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(reduced=false){
  const nodes=new Map(),timers=new Map();let frame,timerId=0;
  const node=key=>{if(!nodes.has(key)){const classes=new Set();nodes.set(key,{style:{},dataset:{},hidden:false,inert:false,textContent:'',offsetWidth:800,
    classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v)},setAttribute(name,value){this[name]=value;},focus(){},addEventListener(){}});}return nodes.get(key);};
  const context=vm.createContext({document:{querySelector:node,querySelectorAll:()=>[],body:node('body')},
    window:{scrollTo(){}},createCursorGrid:()=>({start(){node('grid').running=true;},stop(){node('grid').running=false;}}),performance:{now:()=>0},matchMedia:()=>({matches:reduced,addEventListener(){}}),addEventListener(){},
    requestAnimationFrame(cb){frame=cb;return 1;},cancelAnimationFrame(){},
    setTimeout(cb){timers.set(++timerId,cb);return timerId;},clearTimeout(id){timers.delete(id);}});
  vm.runInContext(fs.readFileSync('app.js','utf8').replace(/^import .*\r?\n/,''),context);
  return {node,run:s=>vm.runInContext(s,context),advance:ms=>frame(ms),flush(){for(const cb of timers.values())cb();timers.clear();}};
}
const app=harness();assert.equal(app.node('main').inert,true);
assert.equal(app.node('grid').running,true,'Grid starts with the loader');
assert.equal(app.node('.loading-count').textContent,'0');
let previousValue=-1,previousFill=-1;
for(let ms=0;ms<=2650;ms+=5){
  app.run(`render(${ms})`);const value=Number(app.node('.loading-count').textContent);
  const fill=Number(app.node('.loading-fill').style.transform.match(/\((.+)\)/)[1]);
  assert.ok(value>=previousValue&&value<=100&&fill>=previousFill&&fill<=1,'Counter and progress advance together without overshoot');
  assert.equal(Number(app.node('.loading-progress')['aria-valuenow']),value);
  if(ms<2150)assert.ok(value<100,'Only finish counting when the final Chinese greeting begins');
  previousValue=value;previousFill=fill;
}
app.run('render(2150)');assert.equal(app.node('.loading-count').textContent,'100');assert.equal(app.node('.loading-fill').style.transform,'scaleX(1)');
assert.ok(app.run('countEase(.5)')>.5,'Use the supplied easeOut pacing');
const seen=[];for(let ms=0;ms<=2650;ms+=10){app.run(`render(${ms})`);const word=app.node('.greeting-text').textContent;if(seen.at(-1)!==word)seen.push(word);}
assert.deepEqual(seen,['Hello','Bonjour','Hola','Ciao','Olá','Hallo','Hallå','Merhaba','こんにちは','안녕하세요','مرحبًا','你好']);
app.run('render(649)');assert.equal(app.node('.greeting-text').textContent,'Hello');
app.run('render(650)');assert.equal(app.node('.greeting-text').textContent,'Bonjour');
app.run('render(2150)');assert.equal(app.node('.greeting-text').textContent,'你好');
app.advance(2650);assert.equal(app.node('main').inert,false);assert.equal(app.node('.intro').classList.contains('leaving'),true);
assert.equal(app.node('grid').running,false,'Grid stops when the loader exits');
app.flush();assert.equal(app.node('.intro').hidden,true);
app.run('play()');assert.equal(app.node('.intro').hidden,false);assert.equal(app.node('.greeting-text').textContent,'Hello');assert.equal(app.node('main').inert,true);
assert.equal(app.node('.loading-count').textContent,'0','Replay resets the count');
app.run('finish({skipped:true})');app.run('play()');app.flush();assert.equal(app.node('.intro').hidden,false,'Replay cancels stale hide timer');
app.run('finish({skipped:true})');app.flush();assert.equal(app.node('main').inert,false);
const reduced=harness(true);assert.equal(reduced.node('.intro').hidden,true);assert.equal(reduced.node('main').inert,false);
const html=fs.readFileSync('index.html','utf8');assert.ok(!html.includes('rive.js')&&!html.includes('pull-rope')&&!html.includes('class="pusher"'),'Loader has no character or animation-runtime dependency');
assert.ok(!html.includes('class="skip-intro"')&&!html.includes('class="replay"'),'Removed skip and replay controls');
console.log('PASS: all 12 languages, timing, final Chinese hold, upward exit state, skip, replay cancellation, reduced motion and no Rive dependency.');
