// Star Sea Express — a night regrade of "Up in the Cloud Sea".
//
// Original artwork: Tianxiu (Tyson) Zhou, "Up in the Cloud Sea" (2024),
//   http://people.tamu.edu/~choutianxius/csce646/pr01/index.html
//   adapted from mdb's ShaderToy "Traveling in the Cloud" Ndc3zl.
// Kept from the original: the 11-band fbm cloud sea, the vector-rasterised
// train/bridge/wheels/smoke, the foreground motion-blur pass and the vignette.
// Changed here: warm sunset -> the site's navy/steel-blue theme, a twinkling
// starfield + milky band, and a uReveal uniform so each depth band, then the
// train, then the foreground clouds fade in as the visitor scrolls.
// Blue-noise texture: assets/star-sea/blue-noise.bin (the 1024x1024 red
// channel of the original PNG, as raw R8 bytes). See NOTICE.txt beside it.

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
void main(){ gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float uReveal;
uniform sampler2D iChannel0;
out vec4 fragColor;

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 x){
  vec2 f = fract(x);
  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  vec2 p = floor(x);
  float a = texture(iChannel0, (p+vec2(0.0,0.0))/1024.0).x;
  float b = texture(iChannel0, (p+vec2(1.0,0.0))/1024.0).x;
  float c = texture(iChannel0, (p+vec2(0.0,1.0))/1024.0).x;
  float d = texture(iChannel0, (p+vec2(1.0,1.0))/1024.0).x;
  return a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y;
}

float fbm(vec2 x, int detail){
  float a = 0.0, b = 1.0, t = 0.0;
  for(int i = 0; i < detail; i++){
    a += b*noise(x);
    t += b;
    b *= 0.7;
    x *= 2.0;
  }
  return a/t;
}

float fbm2(vec2 x, int detail){
  float a = 0.0, b = 1.0, t = 0.0;
  for(int i = 0; i < detail; i++){
    a += b*noise(x);
    t += b;
    b *= 0.9;
    x *= 2.0;
  }
  return a/t;
}

float box(vec2 uv, float x1, float x2, float y1, float y2){
  return (uv.x > x1 && uv.x < x2 && uv.y > y1 && uv.y < y2) ? 1.0 : 0.0;
}

// Twinkling stars. Three densities are added in skyColor; the foreground
// sparkle pass in main() reuses this so points keep glittering over the clouds.
float starLayer(vec2 uv, float t, float scale, float threshold){
  vec2 g = uv * scale;
  vec2 id = floor(g), f = fract(g) - 0.5;
  float r = hash21(id);
  if(r < threshold) return 0.0;
  vec2 off = (vec2(hash21(id+3.1), hash21(id+7.7)) - 0.5) * 0.7;
  vec2 q = f - off;
  float d = length(q);
  float tw = 0.42 + 0.58 * sin(t * (0.8 + r*2.7) + r*37.0);
  float core = smoothstep(0.075, 0.0, d);
  float halo = smoothstep(0.30, 0.0, d) * 0.16;
  float ray = 0.0;
  if(r > 0.994){
    ray = (smoothstep(0.014, 0.0, abs(q.x)) * smoothstep(0.32, 0.0, abs(q.y))
         + smoothstep(0.014, 0.0, abs(q.y)) * smoothstep(0.32, 0.0, abs(q.x))) * 0.30;
  }
  return (core + halo + ray) * tw;
}

vec3 skyColor(vec2 uv, float t){
  float y = clamp(uv.y, 0.0, 1.5);
  vec3 low  = vec3(0.042, 0.078, 0.160);
  vec3 mid  = vec3(0.020, 0.040, 0.092);
  vec3 top  = vec3(0.008, 0.015, 0.038);
  vec3 c = mix(low, mid, smoothstep(0.15, 0.65, y));
  c = mix(c, top, smoothstep(0.65, 1.35, y));
  float bandY = (uv.y - 0.92 - 0.16*sin(uv.x*1.1 + 0.4)) / 0.26;
  c += vec3(0.055, 0.085, 0.170) * exp(-bandY*bandY);
  float s = starLayer(uv, t, 46.0, 0.938)
          + starLayer(uv + 17.3, t, 84.0, 0.960) * 0.75
          + starLayer(uv + 51.7, t, 138.0, 0.976) * 0.48;
  c += vec3(0.82, 0.90, 1.0) * s * 1.45 * smoothstep(0.10, 0.62, y) * smoothstep(0.0, 0.42, uReveal);
  return c;
}

// Map every original sunset colour onto the site's navy/steel/frost ramp by
// luminance, so the original band-to-band contrast survives recolouring.
vec3 nightGrade(vec3 warm){
  float l = dot(warm, vec3(0.299, 0.587, 0.114));
  vec3 deep  = vec3(0.038, 0.065, 0.125);
  vec3 steel = vec3(0.078, 0.140, 0.262);
  vec3 azure = vec3(0.170, 0.300, 0.520);
  vec3 frost = vec3(0.470, 0.620, 0.840);
  vec3 c = mix(deep, steel, smoothstep(0.18, 0.52, l));
  c = mix(c, azure, smoothstep(0.52, 0.80, l));
  c = mix(c, frost, smoothstep(0.80, 1.02, l));
  return c;
}

// Distant bands (large midlevel) surface first, near bands last.
float layerFade(float midlevel){
  float order = clamp((1.05 - midlevel) / 1.20, 0.0, 1.0);
  float start = 0.03 + order * 0.60;
  return smoothstep(start, start + 0.30, uReveal);
}

#define dot2(v) dot(v, v)
#define layer(dh, v) if (uv.y < h + midlevel - (dh)) { float fade = layerFade(midlevel); return vec4(mix(skyColor(uv, iTime), nightGrade(v), fade), 1.0); }

vec4 foreground(vec2 uv, float t){
  float midlevel, h, disp, dist;
  vec2 uv2;
  uv.y -= 0.2;
  midlevel = -0.1;
  disp = 1.7;
  dist = 1.0;
  uv2 = uv + vec2(t/dist + 40.0, 0.0);
  h = (fbm(uv2, 6) - 0.5)*disp;
  layer(0.12, vec3(0.43, 0.32, 0.31));
  layer(0.08, vec3(0.55, 0.42, 0.41));
  layer(0.04, vec3(0.66, 0.42, 0.40));
  layer(0.0,  vec3(0.77, 0.48, 0.46));

  midlevel = 0.05;
  disp = 1.7;
  dist = 2.0;
  uv2 = uv + vec2(t/dist + 38.0, 0.0);
  h = (fbm(uv2, 6) - 0.5)*disp;
  layer(0.10, vec3(0.95, 0.66, 0.48));
  layer(0.04, vec3(0.98, 0.76, 0.64));
  layer(0.0,  vec3(0.95, 0.80, 0.77));
  return vec4(skyColor(uv, iTime), 0.0);
}

vec4 background(vec2 uv, float t){
  float midlevel, h, disp, dist;
  vec2 uv2;

  midlevel = 0.3;  disp = 0.9;  dist = 10.0;
  uv2 = uv + vec2(t/dist + 32.5, 0.0); h = (fbm(uv2, 6) - 0.5)*disp;
  layer(0.14, vec3(0.48, 0.19, 0.20));
  layer(0.10, vec3(0.68, 0.28, 0.19));
  layer(0.07, vec3(0.88, 0.38, 0.24));
  layer(0.0,  vec3(0.95, 0.45, 0.30));

  midlevel = 0.35; disp = 1.0;  dist = 15.0;
  uv2 = uv + vec2(t/dist + 30.0, 0.0); h = (fbm(uv2, 6) - 0.5)*disp;
  layer(0.04, vec3(0.98, 0.76, 0.64));
  layer(0.0,  vec3(0.95, 0.80, 0.77));

  midlevel = 0.35; disp = 3.5;  dist = 20.0;
  uv2 = uv + vec2(t/dist + 27.5, 0.0); h = (fbm(uv2, 6) - 0.5)*disp;
  layer(0.12, vec3(0.43, 0.32, 0.31));
  layer(0.08, vec3(0.55, 0.42, 0.41));
  layer(0.04, vec3(0.66, 0.42, 0.40));
  layer(0.0,  vec3(0.77, 0.48, 0.46));

  midlevel = 0.45; disp = 2.0;  dist = 25.0;
  uv2 = uv + vec2(t/dist + 23.0, 0.0); h = (fbm(uv2, 6) - 0.5)*disp;
  layer(0.04, vec3(0.98, 0.57, 0.36));
  layer(0.0,  vec3(1.00, 0.62, 0.44));

  midlevel = 0.5;  disp = 2.3;  dist = 30.0;
  uv2 = uv + vec2(t/dist + 20.5, 0.0); h = (fbm(uv2, 6) - 0.5)*disp;
  layer(0.12, vec3(0.41, 0.27, 0.27));
  layer(0.08, vec3(0.53, 0.35, 0.32));
  layer(0.04, vec3(0.80, 0.24, 0.17));
  layer(0.0,  vec3(0.99, 0.29, 0.20));

  midlevel = 0.5;  disp = 2.5;  dist = 35.0;
  uv2 = uv + vec2(t/dist + 18.0, 0.0); h = (fbm(uv2, 6) - 0.5)*disp;
  layer(0.10, vec3(0.88, 0.38, 0.24));
  layer(0.05, vec3(0.98, 0.42, 0.28));
  layer(0.0,  vec3(1.00, 0.48, 0.35));

  midlevel = 0.6;  disp = 2.0;  dist = 40.0;
  uv2 = uv + vec2(t/dist + 18.0, 0.0); h = (fbm(uv2, 6) - 0.5)*disp;
  layer(0.10, vec3(0.95, 0.66, 0.48));
  layer(0.0,  vec3(1.00, 0.76, 0.60));

  midlevel = 0.75; disp = 3.5;  dist = 45.0;
  uv2 = uv + vec2(t/dist + 15.5, 0.0); h = (fbm(uv2, 6) - 0.5)*disp;
  layer(0.20, vec3(1.00, 0.55, 0.33));
  layer(0.15, vec3(0.98, 0.50, 0.24));
  layer(0.10, vec3(0.90, 0.55, 0.40));
  layer(0.0,  vec3(1.00, 0.62, 0.44));

  midlevel = 0.7;  disp = 2.7;  dist = 50.0;
  uv2 = uv + vec2(t/dist + 12.0, 0.0); h = (fbm(uv2, 6) - 0.5)*disp;
  layer(0.04, vec3(0.73, 0.36, 0.30));
  layer(0.0,  vec3(0.80, 0.40, 0.34));

  midlevel = 0.8;  disp = 2.7;  dist = 60.0;
  uv2 = uv + vec2(t/dist + 9.5, 0.0); h = (fbm(uv2, 6) - 0.5)*disp;
  layer(0.10, vec3(0.93, 0.58, 0.35));
  layer(0.0,  vec3(1.00, 0.76, 0.60));

  midlevel = 0.9;  disp = 3.0;  dist = 70.0;
  uv2 = uv + vec2(t/dist + 7.0, 0.0); h = (fbm(uv2, 6) - 0.5)*disp;
  layer(0.10, vec3(0.56, 0.25, 0.22));
  layer(0.05, vec3(0.60, 0.30, 0.27));
  layer(0.0,  vec3(0.74, 0.35, 0.30));

  midlevel = 1.0;  disp = 5.0;  dist = 100.0;
  uv2 = uv + vec2(t/dist + 3.5, 0.0); h = (fbm(uv2, 6) - 0.5)*disp;
  layer(0.10, vec3(0.92, 0.85, 0.82));
  layer(0.0,  vec3(1.00, 0.94, 0.91));

  return vec4(skyColor(uv, iTime), 1.0);
}

vec3 genRaster(vec2 uv){
  float t = sin(1.2 * iTime) + 4.0 * iTime;
  vec3 col = background(uv, t).rgb;

  vec4 fg = vec4(0.0);
  const int n = 3;
  if(uv.y < 0.5)
    for(int i = 0; i < n; i++)
      fg += foreground(uv, t + 4.0*float(i)/float(n)/60.0) / float(n);

  float trainA = smoothstep(0.52, 0.88, uReveal);
  float k;
  uv.y -= 0.2;
  vec2 uv2 = fract(uv*9.0);
  float wagon = 1.0;
  wagon *= 1.0 - step(0.45, uv.x);
  wagon *= 1.0 - step(0.115, uv.y);
  wagon *= step(0.103, uv.y);
  wagon *= step(0.05, 1.0 - abs(uv2.x*2.0 - 1.0));

  float join = 1.0;
  join *= 1.0 - step(0.45, uv.x);
  join *= 1.0 - step(0.11, uv.y);
  join *= step(0.107, uv.y);

  float roof = 1.0;
  roof *= 1.0 - step(0.45, uv.x);
  roof *= 1.0 - step(0.117, uv.y);
  roof *= step(0.11, uv.y);
  roof *= step(0.15, 1.0 - abs(uv2.x*2.0 - 1.0));

  float loco     = box(uv, 0.45, 0.5, 0.103, 0.112);
  float chem1    = box(uv, 0.49, 0.495, 0.103, 0.12);
  float chem2    = box(uv, 0.488, 0.496, 0.12, 0.123);
  float locoRoof = box(uv, 0.443, 0.47, 0.11, 0.117);

  float wheel = 1.0 - step(0.00004, dot2(uv - vec2(0.457, 0.106)));
  wheel += 1.0 - step(0.00002, dot2(uv - vec2(0.487, 0.105)));
  wheel += 1.0 - step(0.00002, dot2(uv - vec2(0.497, 0.105)));
  if(uv.x < 0.45 && uv.y > 0.025 && uv.y < 0.2){
    wheel += 1.0 - step(0.002, dot2(uv2 - vec2(0.2, 0.95)));
    wheel += 1.0 - step(0.002, dot2(uv2 - vec2(0.8, 0.95)));
  }

  vec3 ink    = vec3(0.026, 0.044, 0.092);
  vec3 steel  = vec3(0.075, 0.145, 0.290);
  vec3 locoInk= vec3(0.065, 0.120, 0.245);
  col = mix(col, ink,        join * trainA);
  col = mix(col, steel,      wagon * trainA);
  col = mix(col, ink,        roof * trainA);
  col = mix(col, locoInk,    loco * trainA);
  col = mix(col, locoInk,    chem1 * trainA);
  col = mix(col, ink,        locoRoof * trainA);
  col = mix(col, ink,        clamp(chem2 + wheel, 0.0, 1.0) * trainA);

  // Warm cabin windows make the night train read as a train.
  float windows = step(0.06, fract(uv.x*54.0)) * (1.0 - step(0.13, fract(uv.x*54.0)));
  windows *= (1.0 - step(0.45, uv.x)) * step(0.104, uv.y) * (1.0 - step(0.112, uv.y));
  col = mix(col, vec3(0.95, 0.78, 0.48), windows * 0.85 * trainA);

  // Locomotive smoke, cooled to a moonlit haze.
  uv2 = uv + vec2(t/5.0 + 3.5, 0.0);
  uv2.x -= t/5.0*0.2;
  float h = fbm2(uv2, 6) - 0.55;
  if(uv.x < 0.49){
    float x = -uv.x + 0.49;
    float y = abs(uv.y + h*0.4 - 0.16*sqrt(x) - 0.12) - 0.8*x*exp(-x*10.0);
    if(y < 0.0)   col = mix(col, vec3(0.52, 0.64, 0.86), trainA * 0.72);
    if(y < -0.02) col = mix(col, vec3(0.38, 0.50, 0.74), trainA * 0.72);
  }

  // Bridge.
  uv2 = uv + vec2(t/5.0 + 32.5, 0.0);
  uv2.x = fract(uv2.x*3.0);
  float bridgeBend = (uv2.x - 0.5)*(uv2.x - 0.5);
  k = 1.0;
  k *= smoothstep(0.001, 0.003, abs(uv2.y - bridgeBend*0.15 - 0.12));
  k *= min(step(0.05, 1.0 - abs(uv2.x*2.0 - 1.0)) + step(0.17, uv2.y), 1.0);
  k *= min(smoothstep(0.02, 0.05, 1.0 - abs(uv2.x*2.0 - 1.0)) + step(0.177, uv2.y), 1.0);
  k *= min(step(0.1, uv2.y) + smoothstep(-0.09, -0.085, -uv2.y - 0.001/(1.0 - abs(uv2.x*2.0 - 1.0))), 1.0);
  k *= min(smoothstep(0.05, 0.2, 1.0 - abs(fract(uv2.x*16.0)*2.0 - 1.0)) + step(0.12, uv2.y - bridgeBend*0.15) + step(-0.1, -uv2.y), 1.0);
  vec3 bridgeInk = vec3(0.038, 0.070, 0.145) * smoothstep(-0.08, 0.08, uv.y);
  col = mix(col, mix(bridgeInk, col, k), trainA);

  col = mix(col, fg.rgb, fg.a * smoothstep(0.62, 0.98, uReveal));
  return col;
}

vec3 vignettCorrection(vec3 col, vec2 uv){
  col *= 0.5 + 0.5 * pow(16.0*uv.x*uv.y*(1.0-uv.x)*(1.0-uv.y), 0.2);
  col *= 0.97 + 0.03 * sin(iTime*0.35);
  return col;
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / iResolution.y;
  vec3 col = genRaster(uv);
  col = vignettCorrection(col, fc / iResolution.xy);
  float sparkle = starLayer(uv*0.5 + 3.7, iTime, 38.0, 0.970);
  col += vec3(0.72, 0.84, 1.0) * sparkle * 0.95 * smoothstep(0.35, 0.9, uReveal);
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.55, uReveal));
  fragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Star Sea shader: ' + log);
  }
  return shader;
}

// The texture is a 1024x1024 R8 byte array (the red channel of the original
// blue-noise PNG). Uploading raw bytes avoids browser image decoding entirely,
// which is both smaller (1 MB vs 4.2 MB) and far more reliable.
function makeTexture(gl, data) {
  if (data.length !== 1024 * 1024) throw new Error('Unexpected blue-noise size: ' + data.length);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1024, 1024, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return texture;
}

/**
 * Mount the star-sea background into `host`.
 * Returns { setReveal(progress), setActive(bool), destroy() } or null.
 */
export function initStarSea(host, options = {}) {
  if (!host || typeof window === 'undefined') return null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  canvas.className = 'star-sea-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  let gl = null;
  try {
    gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  } catch (_) { /* handled below */ }
  if (!gl) {
    host.classList.add('star-sea--fallback');
    return { setReveal() {}, setActive() {}, destroy() { canvas.remove(); } };
  }

  let program, vao, texture, raf = 0, active = false, destroyed = false;
  let reveal = 0, shownReveal = -1, lastFrame = 0, started = performance.now();
  let uniforms = {};
  try {
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    uniforms = {
      resolution: gl.getUniformLocation(program, 'iResolution'),
      time: gl.getUniformLocation(program, 'iTime'),
      reveal: gl.getUniformLocation(program, 'uReveal'),
      channel: gl.getUniformLocation(program, 'iChannel0')
    };
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  } catch (error) {
    console.warn('Star Sea WebGL unavailable; using CSS fallback.', error);
    host.classList.add('star-sea--fallback');
    return { setReveal() {}, setActive() {}, destroy() { canvas.remove(); } };
  }

  function resize() {
    const width = Math.max(1, host.clientWidth || innerWidth);
    const height = Math.max(1, host.clientHeight || innerHeight);
    // The original shader is texture-heavy; render at a fraction and let CSS
    // scale it. Cloud bands tolerate upscaling well.
    const scale = Math.min(0.62, 1000 / width, 620 / height);
    const w = Math.max(2, Math.round(width * scale));
    const h = Math.max(2, Math.round(height * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      shownReveal = -1;
    }
  }

  function draw(now) {
    raf = 0;
    if (destroyed || !active || !texture) return;
    // ~30fps is enough for drifting clouds and slow twinkles.
    if (now - lastFrame < 32) { raf = requestAnimationFrame(draw); return; }
    lastFrame = now;
    resize();
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.channel, 0);
    gl.uniform3f(uniforms.resolution, canvas.width, canvas.height, 1);
    gl.uniform1f(uniforms.time, reduced.matches ? 12 : (now - started) / 1000);
    gl.uniform1f(uniforms.reveal, reveal);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduced.matches) raf = requestAnimationFrame(draw);
  }

  function wake() {
    if (destroyed || !active || !texture || reduced.matches) return;
    if (!raf) raf = requestAnimationFrame(draw);
  }

  function renderStill() {
    if (destroyed || !texture) return;
    resize();
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.channel, 0);
    gl.uniform3f(uniforms.resolution, canvas.width, canvas.height, 1);
    gl.uniform1f(uniforms.time, 12);
    gl.uniform1f(uniforms.reveal, reveal);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const source = options.textureUrl || '/assets/star-sea/blue-noise.bin';
  fetch(source).then(response => {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.arrayBuffer();
  }).then(buffer => {
    if (destroyed) return;
    try {
      texture = makeTexture(gl, new Uint8Array(buffer));
      const error = gl.getError();
      if (error !== gl.NO_ERROR) throw new Error('WebGL error ' + error);
      host.classList.add('star-sea--ready');
      if (reduced.matches) renderStill();
      else wake();
    } catch (error) {
      console.warn('Star Sea texture upload failed.', error);
      if (texture) { gl.deleteTexture(texture); texture = null; }
      host.classList.add('star-sea--fallback');
    }
  }).catch(error => {
    console.warn('Star Sea blue-noise unavailable.', error);
    host.classList.add('star-sea--fallback');
  });

  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
    shownReveal = -1;
    if (reduced.matches) renderStill();
    else wake();
  }) : null;
  observer?.observe(host);

  const onReducedChange = () => {
    if (reduced.matches) { cancelAnimationFrame(raf); raf = 0; renderStill(); }
    else wake();
  };
  reduced.addEventListener('change', onReducedChange);

  return {
    setReveal(value) {
      const next = Math.max(0, Math.min(1, value));
      if (Math.abs(next - shownReveal) < 0.004 && !reduced.matches) return;
      reveal = next;
      shownReveal = next;
      if (reduced.matches) renderStill();
      else wake();
    },
    setActive(value) {
      const next = !!value;
      if (active === next) return;
      active = next;
      if (next) { if (reduced.matches) renderStill(); else wake(); }
      else { cancelAnimationFrame(raf); raf = 0; }
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      reduced.removeEventListener('change', onReducedChange);
      if (texture) gl.deleteTexture(texture);
      gl.deleteProgram(program);
      gl.deleteVertexArray(vao);
      canvas.remove();
    }
  };
}
