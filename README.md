# 个人作品集 · 多语言问候开场

运行 `node server.cjs`，打开 http://127.0.0.1:4187 做本地预览。公网站点另行部署，本地改动需要重新发布后才会生效。

按用户要求，已停用人物推拉效果。现为参考 Dennis Snellenberg（https://dennissnellenberg.com/）的深色全屏、居中白色问候语、左侧圆点与弧形底边向上退场。

`app.js` 的 `greetings` 包含 12 种语言，最后为中文“你好”。首次问候停留 650ms，中间每种 150ms，最后中文停留 500ms，然后用 850ms 向上揭开正文。`style.css` 控制加载层配色、字体、圆点和退场曲线。

支持跳过、Esc、重播及系统减少动态效果设置。开场不再加载 Rive、人物图片或 WASM。旧素材保留在 assets，之前的拉动页面与代码已备份到 reference/*-before-simple-loader.*，没有新建独立预览网页。

运行 `node test-animation.cjs`，检查语言顺序、切换时机、最终中文、退场状态、重播与跳过、减少动态效果和无人物运行库依赖。页面显示效果仍以浏览器播放为准。

## CountUp 数字与进度条

加载页左下角新增 0–100% 数字和同步细进度条。按用户提供的 React Bits CountUp（count 模式、easeOut）效果适配到原生 JavaScript，使用 cubic-bezier(.33, 1, .68, 1) 缓动，未迁移 React 或引入 motion。数字与条形共用现有开场时钟，显示最终中文时达到 100%，停留后随加载层一起向上退场。它表示开场动画进度；重播归零，跳过或减少动态效果直接完成。`test-animation.cjs` 额外检查单调性、上下界、可访问性数值以及重播复位。

## CursorGrid 背景

已将用户提供的 React Bits CursorGrid WebGL2 源码适配为原生模块 `cursor-grid.js`。保留原着色器、鼠标范围高亮、400ms 停留/800ms 渐隐、点击扩散与中心入场波纹；默认格子 60px、半径 140px、背景线透明度 0.08、填充透明度 0.06。只作为加载页背景层，文字、计数、进度条、原有时序和正文均保持原设置。加载页开始或重播时重置网格，退场即停渲染，正文期间不响应指针。WebGL2 不可用时使用静态网格降级。原源码的反向 smoothstep 改为等价的正向公式，以避免 GLSL 未定义行为。

## Menu MicroSlats background

The user-provided React Bits MicroSlats shaders and fluid simulation are adapted in `micro-slats.js`, using the exact blue storm preset. The navigation panel supplies an independent dark scrim so highlights do not obscure links. OGL 1.0.11 is vendored under `assets/ogl/src` and loaded from this local server. Its official npm package declares Unlicense; provenance and checksum are recorded in `assets/ogl/NOTICE.txt`.

The renderer is prepared during idle time, starts when the menu opens, and stops when the menu closes or the tab is hidden. Reduced motion produces a static frame. WebGL2 failure retains the dark decorative fallback. The homepage, intro timing, menu links, and scroll-lock fix are unchanged.

## Header pressure and homepage handoff

The identity badge uses larger Arial typography. Its scroll detents and spring behavior are unchanged. `menu-pressure.js` adapts the user-provided React Bits TextPressure wave, cursor smoothing and click ripple to Menu/Close rows. GSAP still animates the original five-row label sequence and layered panel. Roboto Flex is subset locally to the required letters with weight, width and slant axes preserved; the OFL license is in `assets/fonts/OFL-RobotoFlex.txt`.

The homepage handoff now waits until every outgoing hero letter is gone before introducing the profile title. The profile section scrolls in normal flow while the final decorative glyphs continue their exit. Hidden content stays inert; desktop and 375px mobile layouts have been checked.


## Profile section and identity badge

The home hero now hands off to a normal-flow profile section. Its title remains invisible until hero progress .94 (the final hero letter finishes at .895); `floating-symbols.js` also hides the outgoing canvas at .92 to prevent pointer particles from overlapping the next title. `profile-section.js` coordinates the section fade, delayed physical badge drop, and window reveals. Profile layout and responsive styles are in `profile-section.css`.

`lanyard.js` ports the supplied React Bits Lanyard physics/geometry into vanilla JavaScript with locally pinned Three.js 0.180.0 (`assets/three/LICENSE`). The badge texture is composed on canvas around the unmodified user portrait in `assets/lanyard-avatar.png`. Drag and release to swing it; click it or use the keyboard-accessible Flip button to see the back. Resize resets the physical pose safely. Reduced motion uses a static badge and instantaneous flips.

`light-rays.js` ports the supplied LightRays WebGL2 shader with the requested navy color `#122445`. Both effects pause when offscreen, when the document is hidden, or when the menu is open. WebGL failure leaves a readable portrait badge fallback. Phone, email, and GitHub are taken from the user-provided résumé; hobbies and China location follow the user's request.

Menu TextPressure uses a compact upright 20px word (19px on mobile), retaining the existing menu GSAP transition. Width/weight variations stay within its invisible fixed slot.

## 星海列车（关于我段落）

参考 Tianxiu Zhou 的 WebGL2 作品「Up in the Cloud Sea」改造成星海列车，保留原作的 11 层 fbm 云带、矢量火车/桥/车轮/烟、前景运动模糊和暗角校正；把暖色日落按亮度映射到本站的深蓝—钢蓝—霜白色阶，加入会闪烁的星光、银河带与车窗灯光，符合站点主题色。

- `star-sea.js`：GLSL + 原生 WebGL2 runner。`uReveal` 由滚动进度驱动，远层云先浮现、近层云次之、火车与桥再次、前景云最后；约 30fps、渲染分辨率约为显示尺寸的 0.62 倍、离屏/菜单打开时暂停、支持 `prefers-reduced-motion` 静态帧与 WebGL 失败时的 CSS 星空降级。
- `assets/star-sea/blue-noise.bin`：1024×1024 R8 蓝噪声（原 PNG 的红通道，1 MB）。用原始字节上传而不是让浏览器解码 PNG，既省下 4.2 MB→1 MB，也避免解码失败导致云海退化成平滑带子。
- `assets/star-sea/NOTICE.txt`：shader 与纹理的完整出处（原作者、ShaderToy 上游、GitHub blob）。
- `index.html` / `profile-section.css`：四张窗口卡片文案改为中文、缩小并改成云朵轮廓（不规则圆角 + 两朵云耳 + 磨砂玻璃），从上方带旋转落下的错峰入场与轻微漂浮；工牌同步缩小并从上方落下。标题与 kicker 保留英文作为视觉锚点。
- `profile-section.js`：新增本段滚动进度计算传给 `setReveal()`，并按可见性控制 `setActive()`；原先的 `light-rays.js` 初始化已停用（文件保留，`.profile-light` 改作纯 CSS 冷光晕），需要恢复时把 import 加回即可。
- `server.cjs`：白名单加入 `star-sea.js`、`blue-noise.bin`、`NOTICE.txt`，并补 `.bin` 的 MIME 类型。

已用无头 Edge（SwiftShader WebGL2）实际渲染验证：纹理上传成功、无控制台/WebGL 错误，中间滚动态只有天空与部分云带、火车未出现，滚到底全部浮现，桌面 1440×900 下中文卡片可读。
