# 无名之辈

宽地面清版动作 + 肉鸽。主角是穿越到东汉末年的壮实农民（白短袖、黑短裤），第一章：三国 · 黄巾之乱（序章「黄巾劫村」→ 长社 → 广宗 → 下曲阳）。

## 目录

| 位置 | 内容 |
|---|---|
| `art/gemini/` | Gemini 原图（未处理） |
| `art/bg/` | 处理后的背景层：远景 `village_far.jpg`、中景（已抠绿）`village_mid.png/.webp`、补地面 `village_ground.jpg` |
| `art/sprites/` | 主角像素素材表 `farmer_sheet.png`（每帧 56×44，脚底在 (28,40)）和预览动图 |
| `art/reference/` | 视角对比示意图 |
| `index.html` / `game.js` | 游戏本体（网站根目录直接发布；`index.html` 为内嵌素材的单文件，`game.js` 为源码） |
| `tools/` | 生成主角像素图、视角图、抠绿处理背景的脚本；`build.py` 把素材和 `game.js` 打包成 `index.html` |
| `index.src.html` | 网页模板（改界面改这里，然后运行 `python3 tools/build.py`） |

## 主角素材表帧序

站立 0–1 · 走路 2–5 · 翻滚 6–10 · 受击 11 · 倒地 12 · 棍 13–15 · 柴刀 16–18 · 石子 19–21（全部面朝右，向左时镜像）。

`tools/farmer.py` 依赖《暂时停止呼吸》仓库 `src/sprites.py` 的调色板：`python3 tools/farmer.py <jiangshi/src 路径> <输出目录>`。

## 已定的方向

- 视角：宽地面清版（类似《小朋友齐打交 2》），人物只有左右朝向，往右推进、分区域锁屏战斗。
- 美术：人物是像素画，地图和建筑用 Gemini 手绘出图（中文提示词）。
- 比例：人物约占屏幕高度的 1/8，茅屋约 2 个人高。

## 发布

网址：https://wumingzhibei.netlify.app （推送到 main 自动发布）。不区分 DEMO 和正式版，直接在这一个版本上改。
