# 披甲男主·戟 动作帧

来源：`art/gemini/披甲男主戟.png`（5×2 动作表）

## 目录

- `full/`：原尺寸透明帧，用于再编辑
- `game/`：按 0.29 缩放到游戏用尺寸，身高约 75px
- `atlas.json`：`[宽, 高, 脚底中心 x, 脚底 y]`
- `contact.png`：10 帧检查图
- `hero_armored_halberd_frames.zip`：全尺寸 + 游戏尺寸 + atlas 打包

## 帧名

| 文件 | 动作 |
|---|---|
| 01_idle | 站立握戟 |
| 02_thrust | 平刺 |
| 03_sweep_low | 低位横扫 |
| 04_uppercut | 上撩 |
| 05_recover | 收招 |
| 06_low_guard | 低位握戟 |
| 07_sweep_back | 回扫 |
| 08_thrust_low | 下刺 |
| 09_smash | 砸地 |
| 10_recover2 | 收招 |

## 说明

- 已按连通域切帧，不按等分网格切，所以长戟不会被切到邻帧。
- 白刀光/碎片并入最近的主体帧。
- 脚底锚点在底部中心。
- 当前未接入 `build.py`，也没有改游戏代码。
