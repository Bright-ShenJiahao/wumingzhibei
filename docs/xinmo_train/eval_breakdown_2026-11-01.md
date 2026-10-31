# 心魔分项评测（2026-11-01，正式版同一份模型，每把武器 70 局，未训练只评测）

- 方法：进化策略（每代 2 组扰动 × 1 局，σ=0.05，学习率 0.03），对手 14 种测试玩家 × 6 把武器，按“越打不过越常练”采样
- 奖励：赢 +1 / 输 −1；换血（打掉你的血% − 被打掉的血%）× 0.25 作辅助；一局最长 30 秒
- 网络输入 37 维（新增：你的翻滚冷却、你是否在蓄、你是否被晕、离左右墙、离中线、我上次打中你多久、我翻滚冷却）
- 一局约 0.61 秒（不画画面加速跑）

| 代 | 平均奖励 | 用时(分) |
|---|---|---|

## 测试（每把武器 70 局没练过的对局，14 种测试玩家轮换，成对比较）
- 累计训练 0 局，0 代
- 规则版心魔：平均奖励 0.186，赢 145 / 420 局，出错 0 局
- 网络心魔：平均奖励 0.425，赢 206 / 420 局，出错 0 局
  - staff：规则 胜16负0 / 网络 胜31负0（60 局正常对手），奖励提升 0.31，下界 0.15，留出对手提升 0.03；2 倍强敌 规则胜0 / 网络胜0 → **用网络**
  - hammer：规则 胜11负0 / 网络 胜31负0（60 局正常对手），奖励提升 0.42，下界 0.24，留出对手提升 0.55；2 倍强敌 规则胜0 / 网络胜0 → **用网络**
  - stone：规则 胜41负5 / 网络 胜35负1（60 局正常对手），奖励提升 -0.04，下界 -0.32，留出对手提升 -0.36；2 倍强敌 规则胜0 / 网络胜0 → 用规则版
  - halberd：规则 胜21负15 / 网络 胜29负12（60 局正常对手），奖励提升 0.22，下界 -0.03，留出对手提升 -0.02；2 倍强敌 规则胜0 / 网络胜0 → 用规则版
  - blade：规则 胜20负10 / 网络 胜39负2（60 局正常对手），奖励提升 0.52，下界 0.25，留出对手提升 0.10；2 倍强敌 规则胜0 / 网络胜0 → **用网络**
  - bow：规则 胜33负19 / 网络 胜40负11（60 局正常对手），奖励提升 0.25，下界 -0.04，留出对手提升 0.12；2 倍强敌 规则胜3 / 网络胜1 → 用规则版
- **网络上场，只用在：staff、hammer、blade**

## 分武器 × 测试玩家（实际上场的版本；胜/负/超时 = 心魔视角；后两列是平均掉血比例）
| 武器 | 测试玩家 | 版本 | 胜 | 负 | 超时 | 心魔掉血% | 玩家掉血% |
|---|---|---|---|---|---|---|---|
| staff | push | net | 5 | 0 | 0 | 13 | 100 |
| staff | human | net | 4 | 0 | 1 | 4 | 94 |
| staff | kite | net | 5 | 0 | 0 | 26 | 100 |
| staff | charger | net | 0 | 0 | 5 | 0 | 0 |
| staff | ylane | net | 5 | 0 | 0 | 2 | 100 |
| staff | poke | net | 0 | 0 | 5 | 25 | 11 |
| staff | oki | net | 4 | 0 | 1 | 23 | 94 |
| staff | fake | net | 1 | 0 | 4 | 17 | 48 |
| staff | walkdodge | net | 0 | 0 | 5 | 12 | 58 |
| staff | rollatk | net | 5 | 0 | 0 | 6 | 100 |
| staff | camp | net | 0 | 0 | 5 | 0 | 43 |
| staff | switch | net | 2 | 0 | 3 | 20 | 92 |
| staff | push2 | net | 0 | 1 | 4 | 66 | 56 |
| staff | charger2 | net | 0 | 0 | 5 | 0 | 0 |
| hammer | push | net | 4 | 0 | 1 | 24 | 98 |
| hammer | human | net | 5 | 0 | 0 | 3 | 100 |
| hammer | kite | net | 4 | 0 | 1 | 52 | 100 |
| hammer | charger | net | 0 | 0 | 5 | 0 | 0 |
| hammer | ylane | net | 5 | 0 | 0 | 15 | 100 |
| hammer | poke | net | 0 | 0 | 5 | 35 | 24 |
| hammer | oki | net | 4 | 0 | 1 | 24 | 92 |
| hammer | fake | net | 0 | 0 | 5 | 13 | 37 |
| hammer | walkdodge | net | 0 | 0 | 5 | 46 | 69 |
| hammer | rollatk | net | 5 | 0 | 0 | 27 | 100 |
| hammer | camp | net | 2 | 0 | 3 | 7 | 87 |
| hammer | switch | net | 2 | 0 | 3 | 15 | 87 |
| hammer | push2 | net | 0 | 2 | 3 | 83 | 52 |
| hammer | charger2 | net | 0 | 0 | 5 | 0 | 0 |
| stone | push | rule | 3 | 1 | 1 | 66 | 97 |
| stone | human | rule | 2 | 2 | 1 | 84 | 78 |
| stone | kite | rule | 3 | 0 | 2 | 72 | 98 |
| stone | charger | rule | 4 | 0 | 1 | 3 | 99 |
| stone | ylane | rule | 2 | 2 | 1 | 86 | 88 |
| stone | poke | rule | 4 | 0 | 1 | 24 | 92 |
| stone | oki | rule | 4 | 0 | 1 | 54 | 98 |
| stone | fake | rule | 2 | 0 | 3 | 51 | 98 |
| stone | walkdodge | rule | 5 | 0 | 0 | 59 | 100 |
| stone | rollatk | rule | 2 | 0 | 3 | 49 | 92 |
| stone | camp | rule | 5 | 0 | 0 | 3 | 100 |
| stone | switch | rule | 5 | 0 | 0 | 47 | 100 |
| stone | push2 | rule | 0 | 5 | 0 | 100 | 32 |
| stone | charger2 | rule | 0 | 0 | 5 | 44 | 47 |
| halberd | push | rule | 1 | 4 | 0 | 98 | 56 |
| halberd | human | rule | 2 | 2 | 1 | 69 | 88 |
| halberd | kite | rule | 3 | 0 | 2 | 49 | 88 |
| halberd | charger | rule | 0 | 0 | 5 | 0 | 0 |
| halberd | ylane | rule | 3 | 0 | 2 | 59 | 90 |
| halberd | poke | rule | 0 | 0 | 5 | 0 | 0 |
| halberd | oki | rule | 0 | 5 | 0 | 100 | 41 |
| halberd | fake | rule | 0 | 2 | 3 | 79 | 51 |
| halberd | walkdodge | rule | 4 | 1 | 0 | 83 | 93 |
| halberd | rollatk | rule | 5 | 0 | 0 | 2 | 100 |
| halberd | camp | rule | 0 | 0 | 5 | 2 | 27 |
| halberd | switch | rule | 3 | 1 | 1 | 63 | 89 |
| halberd | push2 | rule | 0 | 5 | 0 | 100 | 22 |
| halberd | charger2 | rule | 0 | 0 | 5 | 0 | 0 |
| blade | push | net | 3 | 2 | 0 | 49 | 76 |
| blade | human | net | 4 | 0 | 1 | 11 | 98 |
| blade | kite | net | 5 | 0 | 0 | 30 | 100 |
| blade | charger | net | 0 | 0 | 5 | 0 | 13 |
| blade | ylane | net | 5 | 0 | 0 | 23 | 100 |
| blade | poke | net | 1 | 0 | 4 | 8 | 26 |
| blade | oki | net | 4 | 0 | 1 | 30 | 96 |
| blade | fake | net | 5 | 0 | 0 | 16 | 100 |
| blade | walkdodge | net | 2 | 0 | 3 | 16 | 89 |
| blade | rollatk | net | 5 | 0 | 0 | 37 | 100 |
| blade | camp | net | 0 | 0 | 5 | 0 | 19 |
| blade | switch | net | 5 | 0 | 0 | 31 | 100 |
| blade | push2 | net | 0 | 2 | 3 | 67 | 52 |
| blade | charger2 | net | 0 | 0 | 5 | 0 | 0 |
| bow | push | rule | 5 | 0 | 0 | 51 | 100 |
| bow | human | rule | 2 | 2 | 1 | 89 | 96 |
| bow | kite | rule | 2 | 1 | 2 | 72 | 89 |
| bow | charger | rule | 5 | 0 | 0 | 0 | 100 |
| bow | ylane | rule | 2 | 3 | 0 | 93 | 76 |
| bow | poke | rule | 0 | 4 | 1 | 89 | 15 |
| bow | oki | rule | 1 | 4 | 0 | 99 | 84 |
| bow | fake | rule | 4 | 0 | 1 | 25 | 95 |
| bow | walkdodge | rule | 3 | 2 | 0 | 87 | 87 |
| bow | rollatk | rule | 1 | 1 | 3 | 78 | 90 |
| bow | camp | rule | 5 | 0 | 0 | 24 | 100 |
| bow | switch | rule | 3 | 2 | 0 | 69 | 92 |
| bow | push2 | rule | 0 | 4 | 1 | 99 | 25 |
| bow | charger2 | rule | 3 | 1 | 1 | 30 | 91 |
