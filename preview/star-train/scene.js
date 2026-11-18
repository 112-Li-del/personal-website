const journey = document.querySelector('.journey');
const stage = document.querySelector('.stage');
const profile = document.querySelector('.profile');
const canvas = document.querySelector('canvas');
const start = document.querySelector('#start');
const mode = document.querySelector('#mode');
const hint = document.querySelector('#hint');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let draw, frame = 0, last = 0, clock = 0, original = false, nearby = true;
let arrival = 0, arrived = false, travel = 1;
const clamp = value => Math.max(0, Math.min(1, value));

function shaderSource(source) {
  source = source.replace(/float noise\(vec2 x\)\s*\{[\s\S]*?\n\}/, `float noise(vec2 x) {
    vec2 f = fract(x);
    vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
    return texture(iChannel0, (floor(x) + u + 0.5) / 1024.0).r;
  }`);
  source = source
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
  const response = await fetch('./cloud-sea.glsl');
  if (!response.ok) throw new Error('读取原始着色器失败');
  const source = await response.text();
  const noise = new Image();
  noise.src = './blue-noise.png';
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
  let maxPixels = 360000;
  let fastFrames = 0;
  return (progress, now) => {
    if (pendingFrame) {
      const status = gl.clientWaitSync(pendingFrame, 0, 0);
      if (status === gl.TIMEOUT_EXPIRED) return false;
      gl.deleteSync(pendingFrame);
      pendingFrame = null;
      const elapsed = now - submittedAt;
      if (elapsed > 62) {
        maxPixels = Math.max(145000, Math.round(maxPixels * .78));
        fastFrames = 0;
      } else if (elapsed < 38 && ++fastFrames >= 60) {
        maxPixels = Math.min(500000, Math.round(maxPixels * 1.1));
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

function update(now) {
  frame = 0;
  if (!draw || !nearby || document.hidden) { last = 0; return; }
  const progress = clamp(stage.offsetTop / travel);
  if (!arrived && progress >= 0.82) {
    revealProfile();
    hint.hidden = true;
  } else if (arrived && progress < 0.74) {
    retractProfile();
    hint.hidden = false;
  }
  if (!last || now - last >= 32 || reduced.matches) {
    const previousClock = clock;
    if (!reduced.matches && last) clock += Math.min((now - last) / 1000, .10) * (original ? 1 : .58);
    if (draw(progress, now)) last = now;
    else {
      clock = previousClock;
      schedule();
    }
  }
  if (!reduced.matches) schedule();
}

function schedule() {
  if (!frame && draw && nearby && !document.hidden) frame = requestAnimationFrame(update);
}

function revealProfile() {
  if (arrived) return;
  arrived = true;
  profile.classList.replace('pending', 'badge-only');
  profile.inert = true;
  arrival = setTimeout(showProfile, reduced.matches ? 0 : 760);
}

function retractProfile() {
  clearTimeout(arrival);
  arrived = false;
  profile.inert = true;
  profile.classList.remove('badge-only');
  profile.classList.add('pending');
  for (const card of profile.querySelectorAll('details[open]')) card.open = false;
}

function showProfile() {
  clearTimeout(arrival);
  profile.classList.remove('pending', 'badge-only');
  profile.inert = false;
}

start.addEventListener('click', async () => {
  start.disabled = true;
  hint.textContent = '正在编译原项目的实时着色器…';
  try {
    draw = await initialize();
    canvas.hidden = false;
    profile.hidden = false;
    document.querySelector('.cover').hidden = true;
    mode.hidden = false;
    hint.textContent = '向下滚动，直到列车驶出云海';
    if (!arrived) {
      profile.classList.add('pending');
      profile.inert = true;
    }
    schedule();
  } catch (error) {
    start.disabled = false;
    hint.textContent = '实时预览无法启动，请重试。';
    console.error(error);
  }
});

mode.addEventListener('click', () => {
  original = !original;
  mode.textContent = original ? '星海配色' : '原版配色';
  mode.setAttribute('aria-pressed', String(original));
  schedule();
});
canvas.addEventListener('webglcontextlost', () => {
  draw = null;
  mode.hidden = true;
  hint.hidden = false;
  hint.textContent = '浏览器已停止实时渲染，资料仍可打开。';
  showProfile();
});
new IntersectionObserver(([entry]) => {
  nearby = entry.isIntersecting;
  if (!nearby) last = 0;
  schedule();
}).observe(journey);
addEventListener('scroll', schedule, { passive: true });
function measureTravel() {
  const pageTravel = document.documentElement.scrollHeight - innerHeight;
  const stickyStart = journey.offsetTop - parseFloat(getComputedStyle(stage).top);
  travel = Math.max(1, Math.min(journey.offsetHeight - stage.offsetHeight, pageTravel - stickyStart));
  schedule();
}
addEventListener('resize', measureTravel);
new ResizeObserver(measureTravel).observe(journey);
measureTravel();
document.addEventListener('visibilitychange', () => { last = 0; schedule(); });
reduced.addEventListener('change', schedule);