import { createCharacter } from './character.js';
const intro = document.querySelector('.intro');
const main = document.querySelector('main');
const curtain = document.querySelector('.curtain');
const pusher = document.querySelector('.pusher');
const greeting = document.querySelector('.greeting');
const language = document.querySelector('.language-name');
const progressFill = document.querySelector('.progress-fill');
const status = document.querySelector('#intro-status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const character = createCharacter(pusher);

// One clock drives the figure and curtain. Greetings use only the portion of
// that clock spent pushing after the curtain crosses the screen center.
const beats = [
  { start: 0, end: 160, from: 0, to: 0 },
  { start: 160, end: 1310, from: 0, to: 1/3 },
  { start: 1310, end: 1460, from: 1/3, to: 1/3 },
  { start: 1460, end: 2610, from: 1/3, to: 2/3 },
  { start: 2610, end: 2760, from: 2/3, to: 2/3 },
  { start: 2760, end: 3910, from: 2/3, to: 1 },
];
const greetings = [
  { text: 'Hello', label: 'ENGLISH', lang: 'en' },
  { text: 'Bonjour', label: 'FRANÇAIS', lang: 'fr' },
  { text: 'Hola', label: 'ESPAÑOL', lang: 'es' },
  { text: 'Ciao', label: 'ITALIANO', lang: 'it' },
  { text: 'Olá', label: 'PORTUGUÊS', lang: 'pt' },
  { text: 'Hallo', label: 'DEUTSCH', lang: 'de' },
  { text: 'Hallå', label: 'SVENSKA', lang: 'sv' },
  { text: 'Merhaba', label: 'TÜRKÇE', lang: 'tr' },
  { text: 'こんにちは', label: '日本語', lang: 'ja' },
  { text: '안녕하세요', label: '한국어', lang: 'ko' },
  { text: 'مرحبًا', label: 'العربية', lang: 'ar' },
  { text: '你好', label: '中文', lang: 'zh-CN' },
];
const greetingInterval = 150;
let frame = 0;
let hideTimer = 0;
let started = 0;
let active = false;
let currentWord = '';
let trigger = null;
let viewWidth = innerWidth;
let figureWidth = 0;
let revealStartsAt = 0;

function openingAt(p) {
  return p;
}

function measure() {
  viewWidth = innerWidth;
  figureWidth = pusher.getBoundingClientRect().width;
  revealStartsAt = 0;
  const beat = beats.find(b => b.to !== b.from && openingAt(b.to) >= .5);
  // Invert the same easing used by the curtain, including on mobile.
  let low = 0, high = 1;
  for (let i=0; i<30; i++) {
    const mid = (low+high)/2;
    if (openingAt(beat.from+(beat.to-beat.from)*mid*mid*(3-2*mid)) < .5) low=mid;
    else high=mid;
  }
  revealStartsAt = beat.start + high*(beat.end-beat.start);
}

function greetingTime(ms) {
  return beats.reduce((total,b) => b.from === b.to ? total :
    total + Math.max(0,Math.min(ms,b.end)-Math.max(revealStartsAt,b.start)),0);
}
function activePushTime(ms) {
  return beats.reduce((total,b) => b.from === b.to ? total :
    total + Math.max(0,Math.min(ms,b.end)-b.start),0);
}
addEventListener('resize', measure);

function render(ms) {
  const beat = beats.find(b => ms <= b.end) || beats.at(-1);
  const raw = Math.max(0, Math.min(1, (ms-beat.start)/(beat.end-beat.start)));
  const eased = raw*raw*(3-2*raw);
  const p = beat.from + (beat.to-beat.from)*eased;
  const finalPush = ms >= 2760;
  const exitRaw = Math.max(0, Math.min(1, (ms-2760)/1800));
  const moving = finalPush ? exitRaw > 0 && exitRaw < 1 : beat.from !== beat.to && raw > 0 && raw < 1;
  // One uninterrupted curve for the last third and the entire walk offscreen.
  const edge = finalPush
    ? viewWidth*2/3 + (viewWidth/3+figureWidth*474/512)*exitRaw*exitRaw*(3-2*exitRaw)
    : viewWidth*openingAt(p);
  const exiting = moving && edge >= viewWidth;
  curtain.style.transform = `translate3d(${edge}px,0,0)`;
  // Keep the original artwork's palms against the curtain edge.
  pusher.style.transform = `translate3d(${edge-figureWidth*474/512}px,-50%,0)`;
  pusher.style.opacity = '1';
  character.update({activeTime:activePushTime(Math.min(ms,3910))+Math.max(0,Math.min(ms,4560)-3910),
    moving,effort:moving?Math.sin((finalPush?exitRaw:raw)*Math.PI)**2:0});
  const word = greetings[Math.min(greetings.length-1,Math.floor(greetingTime(ms)/greetingInterval))];
  if (word.text !== currentWord) {
    greeting.textContent = currentWord = word.text;
    language.textContent = word.label;
    greeting.lang = word.lang;
  }
  progressFill.style.transform = `scaleX(${Math.min(1,edge/viewWidth)})`;
  intro.dataset.phase = exiting ? 'exiting' : ms >= 3910 ? 'greeting' : moving ? 'pushing' : 'resting';
  intro.dataset.greeting = currentWord;
}

function finish({ skipped = false } = {}) {
  if (!active) return;
  active = false;
  cancelAnimationFrame(frame);
  intro.dataset.phase = 'complete';
  intro.classList.add('leaving');
  document.body.classList.remove('intro-playing');
  main.inert = false;
  status.textContent = '你好，欢迎来到我的作品集';
  if (skipped || trigger) (trigger || document.querySelector('.replay')).focus({ preventScroll: true });
  hideTimer = setTimeout(() => { intro.hidden = true; }, reducedMotion.matches ? 0 : 650);
}

function tick(now) {
  if (!active) return;
  const elapsed = now-started;
  render(elapsed);
  if (elapsed >= 4710) { finish(); return; }
  frame = requestAnimationFrame(tick);
}

function play(event) {
  cancelAnimationFrame(frame);
  clearTimeout(hideTimer);
  trigger = event?.currentTarget || null;
  currentWord = '';
  intro.hidden = false;
  intro.classList.remove('leaving');
  document.body.classList.add('intro-playing');
  main.inert = true;
  active = true;
  measure();
  status.textContent = '正在播放开场动画';
  started = performance.now();
  if (reducedMotion.matches) { render(3910); finish(); return; }
  render(0);
  if (trigger) document.querySelector('.skip-intro').focus({ preventScroll: true });
  frame = requestAnimationFrame(tick);
}

document.querySelectorAll('.replay').forEach(button => button.addEventListener('click',play));
document.querySelector('.skip-intro').addEventListener('click',() => finish({ skipped: true }));
addEventListener('keydown', event => { if (event.key === 'Escape' && active) finish({ skipped: true }); });
reducedMotion.addEventListener('change', () => { if (active && reducedMotion.matches) finish(); });
play();
