"""心魔 AI 训练（用户定 2026-10-31）：用玩家真实对局训练一个小神经网络，训练完留痕、原始数据交给服务器自动删除。

做什么（全部是真训练，每一步都写进报告）：
  1. 读 data/xinmo/ 里的对局录像（心魔战 kind=xinmo：你和心魔双方；主线/校场首领战 kind=play：只有你一方）。
  2. 把每一行变成「局面 → 下一刻做了什么」：局面 = 和对手的距离、双方状态/招式/血量/翻滚冷却等 28 个数；
     动作 = 8 类（不动 / 靠近 / 远离 / 上下对齐 / 上下拉开 / 出招 / 翻滚 / 蓄力）。
  3. 模仿学习（behavior cloning）：训练两层 64 个神经元的网络，按对局切 80% 训练 / 20% 验证（同一局不会两边都有）。
     分别训练「像真人玩家」和「像规则版心魔」两个头，报告里写清每轮误差、验证准确率，和「永远猜最多那一类」的基线对比。
  4. 输出：data/xinmo_model.json（权重，几十 KB）、docs/xinmo_train/日期.md（训练报告）、
     data/xinmo_trained.json（这次用过的对局编号 + 数据校验码；服务器读到后删掉这些原始对局）。
  数据不够（少于 MIN_EPS 局或少于 MIN_ROWS 行）时只写报告、不出模型、不删数据。

强化学习（自己跟自己打）需要把模型接进游戏里跑对打，等模仿学习的模型在验证集上明显好过基线后再做，报告里会写明当前阶段。
用法：python3 tools/xinmo_train/train.py [--epochs 40]
"""
import argparse, datetime, glob, hashlib, json, os, sys
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATA = os.path.join(ROOT, 'data', 'xinmo')
MIN_EPS, MIN_ROWS = 5, 400
ACTIONS = ['不动', '靠近', '远离', '上下对齐', '上下拉开', '出招', '翻滚', '蓄力']
ST_GROUPS = {'idle': 0, 'walk': 0, 'move': 0, 'atk': 1, 'wind': 1, 'strike': 1, 'rec': 1, 'roll': 2, 'hurt': 3, 'bounce': 4, 'getup': 4, 'land': 4, 'down': 4, 'air': 4, 'charge': 5}
XINMO_ST = ['idle', 'walk', 'atk', 'roll', 'hurt', 'bounce', 'getup', 'charge', 'air', 'land', 'down']
PLAY_ST = ['idle', 'walk', 'atk', 'roll', 'hurt', 'bounce', 'getup', 'charge', 'air', 'land', 'down', 'wind', 'strike', 'rec', 'move']
FEATS = ['dx', 'dy', 'adx', 'ady'] + [f'me_st{i}' for i in range(6)] + ['me_c', 'me_hp', 'me_rollcd', 'me_inv', 'me_chg'] + [f'op_st{i}' for i in range(6)] + ['op_c', 'op_hp', 'op_inv', 'op_left', 'proj_dx', 'proj_dy', 'has_proj', 'is_ranged']
RANGED = {'stone', 'bow'}


def onehot(code, names):
    v = [0.0] * 6
    name = names[int(code)] if 0 <= int(code) < len(names) else 'idle'
    v[ST_GROUPS.get(name, 0)] = 1.0
    return v


def label(me_now, me_next, dx, dy):
    """下一刻做了什么：动作优先（翻滚 > 出招 > 蓄力），否则看方向输入相对对手。"""
    if me_next['roll'] and not me_now['roll']: return 6
    if me_next['st'] == 'atk' and (me_now['st'] != 'atk' or me_next['c'] != me_now['c']): return 5
    if me_next['chg'] > 0 and me_now['chg'] == 0: return 7
    ix, iy = me_now['ix'], me_now['iy']
    if abs(ix) < .2 and abs(iy) < .2: return 0
    if abs(ix) >= abs(iy): return 1 if ix * dx > 0 else 2
    return 3 if iy * dy > 0 else 4


def side(row, ci, pre, names):
    g = lambda k, d=0.0: float(row[ci[pre + k]]) if pre + k in ci else d
    st_code = int(g('st'))
    return {'st': names[st_code] if 0 <= st_code < len(names) else 'idle', 'stv': onehot(st_code, names), 'c': g('c', -1), 'hp': g('hp'), 'rollcd': g('rollcd'),
            'inv': g('inv'), 'chg': g('chg'), 'ix': g('ix'), 'iy': g('iy'), 'roll': g('roll'), 'left': g('left'), 'x': g('x'), 'y': g('y')}


def episode_samples(ep):
    """返回 [(特征, 动作, 谁)]，谁 = 'human' 或 'rule'。"""
    cols, rows = ep['cols'], ep['rows']
    ci = {c: i for i, c in enumerate(cols)}
    out = []
    ranged = 1.0 if ep.get('weapon') in RANGED else 0.0
    if ep.get('kind', 'xinmo') == 'xinmo' and 'h_x' in ci and 'm_x' in ci:
        hp0h = max(1e-3, max(float(r[ci['h_hp']]) for r in rows)); hp0m = max(1e-3, max(float(r[ci['m_hp']]) for r in rows))
        for a, b in zip(rows[:-1], rows[1:]):
            for me_pre, op_pre, who, hpm, hpo, proj in (('h_', 'm_', 'human', hp0h, hp0m, 'ms0_'), ('m_', 'h_', 'rule', hp0m, hp0h, 'hs0_')):
                me, op, me2 = side(a, ci, me_pre, XINMO_ST), side(a, ci, op_pre, XINMO_ST), side(b, ci, me_pre, XINMO_ST)
                dx, dy = op['x'] - me['x'], op['y'] - me['y']
                pdx, pdy = (float(a[ci[proj + 'dx']]), float(a[ci[proj + 'dy']])) if proj + 'dx' in ci else (0.0, 0.0)
                f = [dx / 100, dy / 50, abs(dx) / 100, abs(dy) / 50] + me['stv'] + [me['c'], me['hp'] / hpm, me['rollcd'], me['inv'], me['chg']] + op['stv'] + [op['c'], op['hp'] / hpo, op['inv'], op['left'], pdx / 100, pdy / 50, 1.0 if (pdx or pdy) else 0.0, ranged]
                out.append((f, label(me, me2, dx, dy), who))
    elif ep.get('kind') == 'play' and 'e0_dx' in ci:
        hp0 = max(1e-3, max(float(r[ci['h_hp']]) for r in rows))
        for a, b in zip(rows[:-1], rows[1:]):
            me, me2 = side(a, ci, 'h_', PLAY_ST), side(b, ci, 'h_', PLAY_ST)
            if a[ci['e0_type']] < 0: continue
            dx, dy = float(a[ci['e0_dx']]), float(a[ci['e0_dy']])
            op_stv = onehot(a[ci['e0_st']], PLAY_ST)
            f = [dx / 100, dy / 50, abs(dx) / 100, abs(dy) / 50] + me['stv'] + [me['c'], me['hp'] / hp0, me['rollcd'], me['inv'], me['chg']] + op_stv + [-1.0, float(a[ci['e0_hp']]), 0.0, 0.0, 0.0, 0.0, 0.0, ranged]
            out.append((f, label(me, me2, dx, dy), 'human'))
    return out


class MLP:
    def __init__(self, n_in, n_out, h=64, seed=0):
        r = np.random.default_rng(seed)
        self.p = {'W1': r.normal(0, np.sqrt(2 / n_in), (n_in, h)), 'b1': np.zeros(h), 'W2': r.normal(0, np.sqrt(2 / h), (h, h)), 'b2': np.zeros(h),
                  'W3': r.normal(0, np.sqrt(1 / h), (h, n_out)), 'b3': np.zeros(n_out)}
        self.m = {k: np.zeros_like(v) for k, v in self.p.items()}; self.v = {k: np.zeros_like(v) for k, v in self.p.items()}; self.t = 0

    def forward(self, X):
        p = self.p; z1 = X @ p['W1'] + p['b1']; a1 = np.maximum(z1, 0); z2 = a1 @ p['W2'] + p['b2']; a2 = np.maximum(z2, 0); z3 = a2 @ p['W3'] + p['b3']
        z3 = z3 - z3.max(1, keepdims=True); e = np.exp(z3); return e / e.sum(1, keepdims=True), (X, z1, a1, z2, a2)

    def step(self, X, y, w, lr=1e-3):
        P, (X, z1, a1, z2, a2) = self.forward(X); n = len(y)
        loss = -np.sum(w * np.log(P[np.arange(n), y] + 1e-9)) / w.sum()
        d3 = P.copy(); d3[np.arange(n), y] -= 1; d3 *= (w / w.sum())[:, None]
        g = {'W3': a2.T @ d3, 'b3': d3.sum(0)}; d2 = (d3 @ self.p['W3'].T) * (z2 > 0)
        g['W2'] = a1.T @ d2; g['b2'] = d2.sum(0); d1 = (d2 @ self.p['W2'].T) * (z1 > 0); g['W1'] = X.T @ d1; g['b1'] = d1.sum(0)
        self.t += 1
        for k in self.p:   # Adam
            self.m[k] = .9 * self.m[k] + .1 * g[k]; self.v[k] = .999 * self.v[k] + .001 * g[k] ** 2
            self.p[k] -= lr * (self.m[k] / (1 - .9 ** self.t)) / (np.sqrt(self.v[k] / (1 - .999 ** self.t)) + 1e-8)
        return loss


def train_head(Xtr, ytr, Xva, yva, epochs, log):
    counts = np.bincount(ytr, minlength=len(ACTIONS)).astype(float)
    cw = np.where(counts > 0, counts.sum() / (len(ACTIONS) * np.maximum(counts, 1)), 0)   # 类别加权：少见的动作（翻滚、出招）不被「不动」淹没
    w = cw[ytr]; net = MLP(Xtr.shape[1], len(ACTIONS)); rng = np.random.default_rng(1); hist = []
    for ep in range(epochs):
        idx = rng.permutation(len(ytr)); tl = []
        for s in range(0, len(idx), 256):
            j = idx[s:s + 256]; tl.append(net.step(Xtr[j], ytr[j], w[j]))
        Pv, _ = net.forward(Xva) if len(yva) else (np.zeros((0, len(ACTIONS))), None)
        vacc = float((Pv.argmax(1) == yva).mean()) if len(yva) else float('nan')
        vbal = float(np.mean([(Pv.argmax(1)[yva == k] == k).mean() for k in range(len(ACTIONS)) if (yva == k).any()])) if len(yva) else float('nan')
        hist.append((ep + 1, float(np.mean(tl)), vacc, vbal)); log(f'  第 {ep + 1:>2} 轮  训练误差 {np.mean(tl):.4f}  验证准确率 {vacc:.3f}  各动作平均准确率 {vbal:.3f}')
    return net, hist


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--epochs', type=int, default=40); args = ap.parse_args()
    files = sorted(glob.glob(os.path.join(DATA, 'ep_*.json')))
    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d_%H%M'); lines = []; log = lambda s: (print(s), lines.append(s))
    eps = []
    for f in files:
        try: d = json.load(open(f)); d['_key'] = os.path.basename(f)[:-5].replace('ep_', 'ep:', 1); eps.append(d)
        except Exception as e: log(f'读不了 {f}: {e}')
    raw = b''.join(open(f, 'rb').read() for f in files); digest = hashlib.sha256(raw).hexdigest()
    log(f'# 心魔训练报告 {now} (UTC)\n')
    log(f'- 数据：{len(eps)} 局（心魔战 {sum(e.get("kind", "xinmo") == "xinmo" for e in eps)}、首领战 {sum(e.get("kind") == "play" for e in eps)}），全部文件 SHA-256 `{digest}`')
    per = [(e['_key'], episode_samples(e)) for e in eps]; per = [(k, s) for k, s in per if s]
    total = sum(len(s) for _, s in per); log(f'- 样本：{total} 条「局面 → 动作」，特征 {len(FEATS)} 个，动作 {len(ACTIONS)} 类（{"/".join(ACTIONS)}）')
    os.makedirs(os.path.join(ROOT, 'docs', 'xinmo_train'), exist_ok=True)
    report = os.path.join(ROOT, 'docs', 'xinmo_train', now + '.md')
    if len(per) < MIN_EPS or total < MIN_ROWS:
        log(f'\n**数据不够（至少 {MIN_EPS} 局、{MIN_ROWS} 条），这次不训练、不出模型、不删数据。**')
        open(report, 'w').write('\n'.join(lines) + '\n'); return 0
    rng = np.random.default_rng(42); order = rng.permutation(len(per)); nva = max(1, len(per) // 5)
    va_keys = {per[i][0] for i in order[:nva]}
    model = {'version': now, 'features': FEATS, 'actions': ACTIONS, 'heads': {}, 'trainedEps': [k for k, _ in per], 'dataSha256': digest}
    for who, title in (('human', '像真人玩家'), ('rule', '像规则版心魔')):
        tr = [(f, a) for k, s in per if k not in va_keys for f, a, w in s if w == who]; va = [(f, a) for k, s in per if k in va_keys for f, a, w in s if w == who]
        if len(tr) < MIN_ROWS // 2: log(f'\n## {title}\n样本太少（{len(tr)}），跳过'); continue
        Xtr = np.array([f for f, _ in tr], float); ytr = np.array([a for _, a in tr]); Xva = np.array([f for f, _ in va], float).reshape(-1, len(FEATS)); yva = np.array([a for _, a in va], int)
        mu, sd = Xtr.mean(0), Xtr.std(0) + 1e-6
        log(f'\n## {title}（训练 {len(ytr)} 条 / 验证 {len(yva)} 条，验证集是另外的 {nva} 局）')
        log('- 动作分布：' + '、'.join(f'{ACTIONS[k]} {int(c)}' for k, c in enumerate(np.bincount(ytr, minlength=len(ACTIONS)))))
        base = float((yva == np.bincount(ytr).argmax()).mean()) if len(yva) else float('nan')
        log(f'- 基线（永远猜最多那一类「{ACTIONS[int(np.bincount(ytr).argmax())]}」）：验证准确率 {base:.3f}；各动作平均准确率 {1 / len(ACTIONS):.3f}\n- 训练过程：')
        net, hist = train_head((Xtr - mu) / sd, ytr, (Xva - mu) / sd, yva, args.epochs, log)
        last = hist[-1]; log(f'- 结果：训练误差 {hist[0][1]:.4f} → {last[1]:.4f}；验证各动作平均准确率 {last[3]:.3f}（基线 {1 / len(ACTIONS):.3f}）')
        model['heads'][who] = {'mean': mu.round(5).tolist(), 'std': sd.round(5).tolist(), **{k: np.round(v, 5).tolist() for k, v in net.p.items()},
                               'valAcc': last[2], 'valBalAcc': last[3], 'baseline': base, 'trainRows': int(len(ytr)), 'valRows': int(len(yva))}
    if not model['heads']:
        log('\n**两个头的样本都不够，不出模型、不删数据。**'); open(report, 'w').write('\n'.join(lines) + '\n'); return 0
    out = os.path.join(ROOT, 'data', 'xinmo_model.json'); json.dump(model, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
    log(f'\n- 模型：`data/xinmo_model.json`，{os.path.getsize(out) // 1024} KB，版本 `{now}`')
    log('- 当前阶段：模仿学习。模型还没接进游戏对打（游戏里仍是规则版心魔）；等「像真人」的验证成绩稳定明显高于基线，再接入游戏做自我对打强化学习和胜率对比。')
    log(f'- 用过的对局（{len(per)} 局，服务器读到 `data/xinmo_trained.json` 后自动删除原始数据）：' + '、'.join(k for k, _ in per))
    json.dump({'at': now, 'dataSha256': digest, 'eps': [k for k, _ in per if not k.startswith('ep:sim')]}, open(os.path.join(ROOT, 'data', 'xinmo_trained.json'), 'w'), ensure_ascii=False, indent=1)
    open(report, 'w').write('\n'.join(lines) + '\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
