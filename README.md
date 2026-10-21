# 个人作品集 · 多语言问候开场

运行 `node server.cjs`，打开 http://127.0.0.1:4187 。当前为本地预览，未部署。

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
