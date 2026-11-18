const journey = document.querySelector('.profile-section');
const stage = journey.querySelector('.stage');
const profile = stage.querySelector('.profile');
const canvas = stage.querySelector('.star-train-canvas');
const lightHost = stage.querySelector('.profile-light');
const badge = profile.querySelector('.badge');
const host = badge.querySelector('.lanyard-host');
const flip = badge.querySelector('.badge-flip');
const badgeInstructions = badge.querySelector('.badge-instructions');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const original = false;
let draw, frame = 0, last = 0, clock = 0, visible = false;
let loading, raysLoading, badgeLoading, rays, lanyard;
let raysActive = false, badgeReady = false, arrived = false, arrival = 0, progress = 0, travel = 1;
const clamp = value => Math.max(0, Math.min(1, value));

function shaderSource(source) {
  source = source.replace(/float noise\(vec2 x\)\s*\{[\s\S]*?\n\}/, `float noise(vec2 x) {
    vec2 f = fract(x);
    vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
    return texture(iChannel0, (floor(x) + u + 0.5) / 1024.0).r;
  }`);
  source = source
    .replace('vec2 uvGen = fragCoord/iResolution.y;', 'vec2 uvGen = fragCoord/iResolution.y; uvGen.x += max(0.0, .92 - iResolution.x / iResolution.y) * .55;')
    .replace('int n = 5;', 'int n = original > 0.5 ? 5 : 2;')
    .replace('if (uv.y < 0.5)', 'if (uv.y < 0.5 && (original > 0.5 || reveal > 0.30))')
    .replace('1.3 + 0.4 * cos(0.5 * (iTime + 3.14))',
      'original > 0.5 ? 1.3 + 0.4 * cos(0.5 * (iTime + 3.14)) : 1.08');
  return `#version 300 es
precision highp float;
uniform vec3 iResolution;
uniform float iTime, reveal, original;
uniform sampler2D iChannel0;
out vec4 pixel;
` + source.replace('vec4 bg = background(uv, t);', `
    vec3 daySky = vec3(0.58, 0.7, 1.0);
    float upperSky = original < 0.5 ? smoothstep(.66, .93, uv.y + .04 * sin(uv.x * 7.0)) : 0.0;
    float cloudReveal = smoothstep(0.02, 0.42, reveal);
    vec2 cloudUV = uv;
    if (original < 0.5) cloudUV.y += .32 * smoothstep(.39, .82, uv.y);
    vec4 bg = upperSky >= 1.0 || cloudReveal <= 0.0 ? vec4(daySky, 1.0) : background(cloudUV, t);
    float sky = max(upperSky, float(distance(bg.rgb, daySky) < 0.001));
    bg.rgb = mix(daySky, bg.rgb, cloudReveal);
`).replace('col = mix(col, fg.rgb, fg.a);', `
    float trainReveal = smoothstep(0.43, 0.72, reveal);
    float foregroundReveal = smoothstep(0.30, 0.82, reveal);
    col = mix(bg.rgb, col, trainReveal);
    float mist = fg.a * foregroundReveal;
    if (original < 0.5) {
        // Keep the railway readable through moving foreground clouds.
        float railway = smoothstep(0.05, 0.09, uv.y) * (1.0 - smoothstep(0.13, 0.17, uv.y));
        mist *= 1.0 - 0.68 * railway * trainReveal;
        float light = dot(clamp(col, 0.0, 1.0), vec3(0.32, 0.56, 0.12));
        float warm = clamp(col.r - col.b, 0.0, 1.0);
        vec3 shadow = mix(vec3(0.075, 0.105, 0.23), vec3(0.19, 0.20, 0.35), warm);
        vec3 silver = mix(vec3(0.66, 0.81, 0.99), vec3(0.90, 0.88, 1.0), warm);
        vec3 navy = mix(shadow, silver, smoothstep(0.17, 0.91, light));
        vec2 grid = uv * 155.0;
        vec2 cell = floor(grid);
        float seed = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
        vec2 starCenter = vec2(0.25 + 0.5 * fract(seed * 137.0), 0.25 + 0.5 * fract(seed * 253.0));
        float distanceToStar = length(fract(grid) - starCenter);
        float bright = step(0.986, seed);
        float radius = mix(0.115, 0.24, bright);
        float twinkle = 0.67 + 0.33 * sin(iTime * (3.8 + fract(seed * 17.0) * 4.0) + seed * 483.0);
        float star = step(0.931, seed) * twinkle * (1.0 - smoothstep(radius * .20, radius, distanceToStar));
        float haze = exp(-8.0 * abs(uv.y - .76 - .105 * sin(uv.x * 2.7)));
        vec3 nightSky = mix(vec3(.015, .025, .069), vec3(.095, .119, .235), haze * .61);
        nightSky += bright * twinkle * (1.0 - smoothstep(.13, .43, distanceToStar)) * vec3(.075, .083, .10);
        nightSky += star * mix(vec3(.53, .73, 1.0), vec3(1.0, .86, .64), bright);
        float exposedSky = max(sky, 1.0 - cloudReveal) * (1.0 - trainReveal * railway);
        col = mix(navy, nightSky, exposedSky);
        float mistLight = dot(fg.rgb, vec3(0.32, 0.56, 0.12));
        vec3 ice = mix(vec3(0.13, 0.18, 0.31), vec3(0.77, 0.85, 0.98), smoothstep(0.24, 0.93, mistLight));
        col = mix(col, ice, mist);
        float windows = wagon * step(0.72, fract(uv.x * 75.0)) * box(uv, 0.0, 0.45, 0.107, 0.110);
        col += windows * trainReveal * (1.0 - mist) * vec3(0.69, 0.57, 0.42);
    } else {
        col = mix(col, fg.rgb, mist);
    }
`) + '\nvoid main(){ mainImage(pixel, gl_FragCoord.xy); }';
}

async function initialize() {
  const response = await fetch('/assets/star-train/cloud-sea.glsl');
  if (!response.ok) throw new Error('读取原始着色器失败');
  const source = await response.text();
  const noise = new Image();
  noise.src = '/assets/star-train/blue-noise.png';
  await noise.decode();

  const gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: false, stencil: false,
    failIfMajorPerformanceCaveat: true, powerPreference: 'low-power'
  });
  if (!gl) throw new Error('当前浏览器无法提供硬件加速 WebGL2');
  function compile(type, code) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    return shader;
  }

  const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID << 1) & 2),float(gl_VertexID & 2));gl_Position=vec4(p*2.0-1.0,0,1);}`);
  const fragment = compile(gl.FRAGMENT_SHADER, shaderSource(source));
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  if (parallel) {
    const deadline = performance.now() + 12000;
    while (!gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) {
      if (performance.now() >= deadline) throw new Error('着色器编译超时');
      await new Promise(resolve => setTimeout(resolve, 80));
    }
  }
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error([gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment), gl.getProgramInfoLog(program)].filter(Boolean).join('\n'));
  }
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  gl.useProgram(program);
  gl.bindVertexArray(gl.createVertexArray());
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, noise);
  const uniform = name => gl.getUniformLocation(program, name);
  const resolution = uniform('iResolution'), time = uniform('iTime');
  const reveal = uniform('reveal'), palette = uniform('original');
  gl.uniform1i(uniform('iChannel0'), 0);
  let pendingFrame = null;
  let submittedAt = 0;
  let maxPixels = 540000;
  let fastFrames = 0;
  return (progress, now) => {
    if (pendingFrame) {
      const status = gl.clientWaitSync(pendingFrame, 0, 0);
      if (status === gl.TIMEOUT_EXPIRED) return false;
      gl.deleteSync(pendingFrame);
      pendingFrame = null;
      const elapsed = now - submittedAt;
      if (elapsed > 62) {
        maxPixels = Math.max(190000, Math.round(maxPixels * .78));
        fastFrames = 0;
      } else if (elapsed < 38 && ++fastFrames >= 60) {
        maxPixels = Math.min(890000, Math.round(maxPixels * 1.1));
        fastFrames = 0;
      }
    }
    // Match the displayed aspect ratio and cap the fragment shader's workload.
    const viewWidth = Math.max(1, stage.clientWidth);
    const viewHeight = Math.max(1, stage.clientHeight);
    const scale = Math.min(devicePixelRatio || 1, 1.35, Math.sqrt(maxPixels / (viewWidth * viewHeight)));
    const width = Math.max(1, Math.floor(viewWidth * scale));
    const height = Math.max(1, Math.floor(viewHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    gl.uniform3f(resolution, width, height, 1);
    gl.uniform1f(time, clock);
    gl.uniform1f(reveal, original || reduced.matches ? 1 : progress);
    gl.uniform1f(palette, Number(original));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    pendingFrame = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    submittedAt = now;
    gl.flush();
    return true;
  };
}

function allowed() {
  return visible && !document.hidden && document.body.dataset.page === 'home'
    && !document.body.classList.contains('intro-playing')
    && !document.body.classList.contains('menu-open');
}

function prepareScene() {
  if (loading) return;
  loading = initialize().then(renderer => {
    draw = renderer;
    canvas.hidden = false;
    schedule();
  }).catch(error => console.warn('星海实时渲染不可用，使用静态星空。', error));
}

function syncLight() {
  const active = !!rays && allowed() && progress >= .22;
  if (active === raysActive) return;
  raysActive = active;
  rays.setActive(active);
}

function prepareLight() {
  if (raysLoading) return;
  raysLoading = (async () => {
    await loading;
    const {initLightRays} = await import('./light-rays.js');
    if (!allowed() || progress < .22) { raysLoading = null; return; }
    rays = initLightRays(lightHost, {
      raysOrigin: 'top-center', raysColor: '#122445', raysSpeed: 1,
      lightSpread: .5, rayLength: 3, glow: .6, haze: .25,
      followMouse: true, mouseInfluence: .1, maxDevicePixelRatio: .6
    });
    syncLight();
  })().catch(error => console.warn('原光束组件初始化失败。', error));
}

function prepareBadge() {
  if (badgeReady || badgeLoading) return;
  badgeLoading = (async () => {
    await raysLoading;
    const {initLanyard} = await import('./lanyard.js');
    if (!allowed() || progress < .56) return;
    badge.classList.add('badge-enhanced');
    lanyard = initLanyard(host, {
      frontImage: '/assets/lanyard-avatar.png', size: .58,
      cardColor: '#122445', strapColor: '#254a84', strapLength: .42,
      strapWidth: .65, cornerRadius: .25, finish: 'glossy',
      metal: 'silver', damping: .62, elasticity: .45, breeze: .12, intro: false
    });
    badgeReady = true;
    if (lanyard) {
      badgeInstructions.hidden = false;
      flip.hidden = false;
    }
  })().catch(error => {
    badgeReady = true;
    console.warn('原名牌组件初始化失败。', error);
  }).finally(() => {
    badge.classList.toggle('badge-enhanced', !!lanyard);
    badgeLoading = null;
    presentProfile();
    schedule();
  });
}

function closeProfile() {
  clearTimeout(arrival);
  arrived = false;
  profile.inert = true;
  profile.classList.remove('badge-only');
  profile.classList.add('pending');
  lanyard?.setActive(false);
  for (const card of profile.querySelectorAll('details[open]')) card.open = false;
}

function presentProfile() {
  if (!arrived || !badgeReady || !allowed() || !profile.classList.contains('pending')) return;
  profile.classList.replace('pending', 'badge-only');
  lanyard?.reveal();
  arrival = setTimeout(() => {
    profile.classList.remove('badge-only');
    profile.inert = false;
  }, reduced.matches ? 0 : 760);
}

function update(now) {
  frame = 0;
  if (!allowed()) { last = 0; syncLight(); return; }
  progress = clamp(stage.offsetTop / travel);
  if (progress >= .22) prepareLight();
  if (progress >= .56) prepareBadge();
  syncLight();
  if (!arrived && progress >= .82) arrived = true;
  else if (arrived && progress < .74) closeProfile();
  presentProfile();

  if (draw && (!last || now - last >= 32 || reduced.matches)) {
    const previous = clock;
    if (!reduced.matches && last) clock += Math.min((now - last) / 1000, .10) * .58;
    if (draw(progress, now)) last = now;
    else { clock = previous; schedule(); }
  }
  if (draw && !reduced.matches) schedule();
}

function schedule() {
  if (!frame && allowed()) frame = requestAnimationFrame(update);
}

function sync() {
  if (allowed()) prepareScene();
  syncLight();
  lanyard?.setActive(allowed() && arrived && !profile.classList.contains('pending'));
  schedule();
}

function checkVisibility() {
  const rect = stage.getBoundingClientRect();
  const next = rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
  if (next === visible) { schedule(); return; }
  visible = next;
  if (!visible) { last = 0; progress = 0; closeProfile(); }
  sync();
}

function measure() {
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  const stickyStart = journey.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(stage).top);
  travel = Math.max(1, Math.min(journey.offsetHeight - stage.offsetHeight, maxScroll - stickyStart));
  checkVisibility();
}

flip.addEventListener('click', () => lanyard?.flip());
canvas.addEventListener('webglcontextlost', () => {
  draw = null;
  canvas.hidden = true;
});
new IntersectionObserver(checkVisibility).observe(stage);
new ResizeObserver(measure).observe(journey);
addEventListener('scroll', checkVisibility, {passive: true});
addEventListener('resize', measure);
addEventListener('portfolio:navigate', () => { measure(); sync(); });
document.addEventListener('visibilitychange', sync);
new MutationObserver(sync).observe(document.body, {attributes: true, attributeFilter: ['class', 'data-page']});
reduced.addEventListener('change', schedule);
measure();
