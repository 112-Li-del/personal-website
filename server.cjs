const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.png': 'image/png', '.riv':'application/octet-stream', '.wasm':'application/wasm', '.txt':'text/plain; charset=utf-8' };
const files = new Set(['index.html','navigation.js','navigation.css','micro-slats.js','style.css','app.js','cursor-grid.js','tech-text.js','split-text.js','assets/gsap/gsap.min.js','assets/gsap/SplitText.min.js','assets/gsap/LICENSE.txt','floating-symbols.js','letter-glitch.js','assets/lenis/lenis.mjs','assets/lenis/LICENSE.txt','character.js','assets/character-parts.png','assets/profile-head.png',
  'assets/rive/skins-demo.riv','assets/rive/rive.js','assets/rive/rive.wasm','assets/rive/RUNTIME-LICENSE.txt']);
http.createServer((req,res) => {
  const requested = new URL(req.url,'http://localhost').pathname;
  const route=requested.replace(/\/$/,'')||'/';
  const routes=new Set(['/','/about','/work','/achievement','/contact']);
  if(requested!=='/' && requested.endsWith('/') && routes.has(route)){res.writeHead(302,{Location:route});res.end();return;}
  const file = routes.has(route) ? 'index.html' : requested.slice(1);
  const oglAsset = /^assets\/ogl\/src\/[A-Za-z0-9_/-]+\.js$/.test(file) && !file.split('/').includes('..');
  if (!files.has(file) && !oglAsset) { res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}); res.end('页面不存在，请返回首页。'); return; }
  fs.readFile(path.join(root,file),(err,data) => {
    if(err) { res.writeHead(500); res.end('Unable to read file'); return; }
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'});res.end(data);
  });
}).listen(Number(process.env.PORT || 4187),'127.0.0.1',() => console.log(`Local: http://127.0.0.1:${process.env.PORT || 4187}`));
