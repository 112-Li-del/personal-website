const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness(width = 1280, reduced = false) {
  const elements = new Map();
  const node = key => {
    if (!elements.has(key)) elements.set(key, {
      style: {}, dataset: {}, hidden: false, inert: false, textContent: '', offsetWidth: 500,
      querySelector: selector => node(selector), classList: { add() {}, remove() {} }, setAttribute(name,value) { this[name] = value; },
      getBoundingClientRect() { return {width: width < 600 ? 220 : Math.min(450,Math.max(250,width*.32))}; },
      addEventListener() {}, focus() {},
    });
    return elements.get(key);
  };
  let nextFrame;
  const context = vm.createContext({
    document: { querySelector: node, querySelectorAll: () => [], getElementById: node, body: node('body') },
    matchMedia: () => ({ matches: reduced, addEventListener() {} }), innerWidth: width,
    addEventListener() {}, performance: {now: () => 0},
    requestAnimationFrame(callback) { nextFrame = callback; return 1; }, cancelAnimationFrame() {},
    setTimeout(callback) { callback(); return 1; }, clearTimeout() {},
  });
  vm.runInContext(fs.readFileSync('character.js','utf8').replaceAll('export function','function'),context);
  vm.runInContext('let capturedCharacterState; createCharacter = () => ({update(state) {capturedCharacterState=state;}})',context);
  vm.runInContext(fs.readFileSync('app.js','utf8').replace(/^import .*;\r?\n/,''),context);
  return { node, run(code) { return vm.runInContext(code,context); }, advance(ms) { nextFrame(ms); } };
}

for (const width of [375,1280]) {
  const app = harness(width);
  const first=app.run('characterPose({activeTime:0,moving:true,effort:1})');
  const half=app.run('characterPose({activeTime:380,moving:true,effort:1})');
  assert.ok(first.left.ankle.x>first.right.ankle.x && half.left.ankle.x<half.right.ankle.x,'Left and right feet MUST exchange front/back order');
  assert.ok(Math.abs(first.left.ankle.x-first.right.ankle.x)<=64,'Keep stride compact');
  const strain=app.run('characterPose({activeTime:100,moving:true,effort:1})');
  const rest=app.run('characterPose({activeTime:100,moving:false,effort:0})');
  assert.equal(strain.expression,'strain');assert.equal(rest.expression,'breathe');
  assert.notEqual(strain.headAngle,rest.headAngle,'Head must visibly tilt with effort');
  const pausedA=app.run('characterPose({activeTime:1150,moving:false})');
  const pausedB=app.run('characterPose({activeTime:1150,moving:false})');
  assert.equal(pausedA.left.ankle.x,pausedB.left.ankle.x);  const curtainAt = ms => { app.run(`render(${ms})`); return app.node('.curtain').style.transform; };
  for (const [ms, fraction] of [[0,0],[1310,1/3],[2610,2/3]]) {
    const x = Number(curtainAt(ms).match(/\(([\d.]+)/)[1]);
    assert.ok(Math.abs(x-width*fraction)<.001,'Each push must reveal exactly one third of the viewport');
  }
  assert.equal(curtainAt(1320),curtainAt(1450),'First pause holds at one third');
  assert.equal(curtainAt(2620),curtainAt(2750),'Second pause holds at two thirds');
  assert.equal(app.run('beats.filter(b => b.from !== b.to).length'),3,'Exactly three pushes');
  const seen = [];
  for (let ms=0; ms<=3910; ms+=10) {
    app.run(`render(${ms})`);
    const word = app.node('.greeting').textContent;
    if (seen.at(-1) !== word) seen.push(word);
    assert.equal(app.node('.greeting').style.transform,undefined,'Text must never move or scale with the curtain');
  }
  assert.deepEqual(seen,['Hello','Bonjour','Hola','Ciao','Olá','Hallo','Hallå','Merhaba','こんにちは','안녕하세요','مرحبًا','你好']);
  app.run('render(revealStartsAt+149)');
  assert.equal(app.node('.greeting').textContent,'Hello','Keep original word until revealed plus 150ms of pushing');
  app.run('render(revealStartsAt+151)');
  assert.equal(app.node('.greeting').textContent,'Bonjour','Use Dennis’s 150ms cadence');
  for (const [from,to] of [[0,150],[1311,1459],[2611,2759]]) {
    app.run(`render(${from})`);
    const word = app.node('.greeting').textContent;
    app.run(`render(${to})`);
    assert.equal(app.node('.greeting').textContent,word,'Greeting must freeze during every rest');
  }
  app.run('render(3910)');
  const position = Number(app.node('.curtain').style.transform.match(/\(([\d.]+)/)[1]);
  assert.ok(position >= width,'Curtain must fully leave viewport');
  const finalX=ms=>{app.run(`render(${ms})`);return Number(app.node('.curtain').style.transform.match(/\(([\d.]+)/)[1]);};
  const before=finalX(3910)-finalX(3909),after=finalX(3911)-finalX(3910);
  assert.ok(before>.05&&after>.05,'Last push must not stop at the old exit boundary');
  assert.ok(Math.abs(before-after)<.01,'Final push and exit share continuous velocity');
  app.run('render(4200)');
  assert.equal(app.node('.pusher').style.opacity,'1','Character walks out without fading');
  assert.equal(app.node('.intro').dataset.phase,'exiting');
  assert.ok(app.run('capturedCharacterState.moving'),'Leg animation continues during exit');
  app.run('render(4560)');
  const actorLeft=Number(app.node('.pusher').style.transform.match(/\(([\d.]+)/)[1]);
  assert.ok(actorLeft>=width-.001,'Entire character canvas leaves the right edge before transition');
  assert.equal(app.node('.greeting').textContent,'你好','Final greeting stays visible while character exits');
  app.advance(4710);
  assert.equal(app.node('main').inert,false,'Content must be interactive after animation');
  assert.equal(app.node('.intro').hidden,true);
  app.run('play()');
  assert.equal(app.node('main').inert,true);
  assert.equal(app.node('.greeting').textContent,'Hello','Replay resets the greeting');
  app.run('finish({skipped:true})');
  assert.equal(app.node('main').inert,false,'Skip unlocks content');
}
const reduced = harness(375,true);
assert.equal(reduced.node('.intro').hidden,true,'Reduced motion bypasses moving intro');
assert.equal(reduced.node('main').inert,false);
console.log('PASS: 375/1280px restored illustrated character pose, leg alternation, compact stride, continuous exit, languages, replay, skip, reduced motion.');

