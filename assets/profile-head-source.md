# 侧脸头部素材与绑定

原图：用户提供的右向漫画侧脸（codex-clipboard-fd91dfd7-280c-464a-b29c-222cfc25454d.png）。

工具：内置 imagegen 编辑模式。输出 `profile-head.png`，1254 × 1254，RGBA；检查到 alpha 范围 0–255。保留黑发、眼镜、五官、痣和网点画风，去除背景，缩短原来的宽阔颈胸底部，作为头部测试素材。生成编辑仍可能改变局部细节，形象以用户审视为准。

完整编辑提示词：

> Edit target: the attached monochrome manga side-profile portrait. Produce a clean transparent-background cutout of EXACTLY this same right-facing head and a SHORT neck stump suitable for a 2D animated character. Preserve identity, original profile angle, black tousled hair, rectangular glasses, visible ear, eye, nose, smile, cheek mole, original black linework and halftone texture. Remove only the pale background and the broad flared bottom neck/chest bust: end the neck just below the jaw with a short narrow rounded stump, no shoulders or collar. No cap, no clothes, no new features, no redraw into a different style, no shadow or halo. Skin, white highlights and glasses interiors must remain opaque white; only the outside silhouette is transparent. Keep all hair tips. Center the whole head in the frame with ~8 percent transparent padding. This is a surgical asset extraction/edit, not a new portrait.

绑定：`character.js` 使用固定版本 Rive Canvas 2.40.1 的 artboard 适配接口，读取原 `head` 骨骼的世界变换，在原圆头区域擦除后绘制侧脸。颈部锚点、角度与原骨骼一致，身体与四肢仍播放原 Rive 动画。未修改源 `.riv` 文件；读取 artboard 依赖固定版本运行库内部实例入口，升级运行库时需重新核对。保留原版本代码于 `reference/character-original-rive.js`。
