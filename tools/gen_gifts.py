# Генератор каталога подарков и NFT-атрибутов для Sierra Messenger.
# Запуск: python3 tools/gen_gifts.py  → создаёт supabase/stage3-data.sql
import math, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# id, название, эмодзи, базовая цена, цвета [a,b,c,d], индексы цветов, которые не перекрашиваются
SHAPES = [
    (1,  'Роза',            '🌹', 15,   ['#e11d48', '#fb7185', '#fecdd3', '#22c55e'], [3]),
    (2,  'Мишка',           '🧸', 25,   ['#c08457', '#8b5a33', '#f5d5b0', '#2a1a10'], [3]),
    (3,  'Сердце',          '💙', 25,   ['#2f80ff', '#6db8ff', '#d6ecff', '#0b3a8a'], []),
    (4,  'Торт',            '🎂', 50,   ['#f9a8d4', '#fde68a', '#ffffff', '#ef4444'], []),
    (5,  'Кубок',           '🏆', 100,  ['#fbbf24', '#b45309', '#fef3c7', '#78350f'], []),
    (6,  'Алмаз',           '💎', 100,  ['#67e8f9', '#0ea5e9', '#e0f7ff', '#0369a1'], []),
    (7,  'Ракета',          '🚀', 250,  ['#e8edf3', '#ef4444', '#38bdf8', '#94a3b8'], []),
    (8,  'Вершина Sierra',  '🏔️', 500,  ['#3b82f6', '#1e3a8a', '#ffffff', '#fbbf24'], [2]),
    (9,  'Корона',          '👑', 1000, ['#fbbf24', '#b45309', '#ef4444', '#3b82f6'], []),
    (10, 'Хрустальный шар', '🔮', 2500, ['#a78bfa', '#4c1d95', '#f0abfc', '#5b3a1e'], [3]),
    (11, 'Звезда',          '⭐', 35,   ['#fbbf24', '#f59e0b', '#fef3c7', '#3b2a10'], [3]),
    (12, 'Луна',            '🌙', 80,   ['#fde68a', '#eab308', '#ffffff', '#a16207'], []),
    (13, 'Подарок',         '🎁', 40,   ['#ef4444', '#b91c1c', '#fde047', '#fca5a5'], []),
    (14, 'Шарик',           '🎈', 20,   ['#f43f5e', '#be123c', '#ffe4e6', '#cbd5e1'], [3]),
    (15, 'Мороженое',       '🍦', 30,   ['#f9a8d4', '#fde68a', '#38bdf8', '#ef4444'], []),
    (16, 'Леденец',         '🍭', 20,   ['#ec4899', '#be185d', '#ffffff', '#a855f7'], []),
    (17, 'Котик',           '🐱', 60,   ['#f59e0b', '#b45309', '#fde68a', '#1f2937'], [3]),
    (18, 'Призрак',         '👻', 55,   ['#f1f5f9', '#cbd5e1', '#a5b4fc', '#1e293b'], [3]),
    (19, 'Тыква',           '🎃', 50,   ['#f97316', '#c2410c', '#fde047', '#15803d'], [3]),
    (20, 'Снеговик',        '⛄', 60,   ['#ef4444', '#ffffff', '#f8fafc', '#1f2937'], [2, 3]),
    (21, 'Ёлка',            '🎄', 90,   ['#22c55e', '#15803d', '#facc15', '#ef4444'], []),
    (22, 'Бабочка',         '🦋', 75,   ['#38bdf8', '#6366f1', '#fde047', '#1e1b4b'], [3]),
    (23, 'Грибок',          '🍄', 45,   ['#ef4444', '#b91c1c', '#ffffff', '#7c2d12'], [3]),
    (24, 'Планета',         '🪐', 180,  ['#f59e0b', '#b45309', '#fde68a', '#94a3b8'], []),
    (25, 'Зелье',           '🧪', 140,  ['#a855f7', '#7e22ce', '#f0abfc', '#7c4a1e'], [3]),
]

# название, цвета, множитель цены, редкость (0..3), эффект, базовый тираж
THEMES = [
    ('Рубин',   ['#e11d48', '#9f1239', '#fecdd3', '#fb7185'], 1.2, 0, None,    None),
    ('Сапфир',  ['#2563eb', '#1e3a8a', '#bfdbfe', '#60a5fa'], 1.2, 0, None,    None),
    ('Изумруд', ['#10b981', '#065f46', '#a7f3d0', '#34d399'], 1.3, 0, None,    None),
    ('Аметист', ['#a855f7', '#581c87', '#e9d5ff', '#c084fc'], 1.4, 0, None,    None),
    ('Закат',   ['#fb923c', '#c2410c', '#fed7aa', '#f472b6'], 1.6, 1, None,    None),
    ('Лёд',     ['#bae6fd', '#0ea5e9', '#f0f9ff', '#7dd3fc'], 1.8, 1, 'frost', None),
    ('Неон',    ['#22d3ee', '#c026d3', '#a5f3fc', '#f0abfc'], 2.5, 2, 'glow',  2000),
    ('Золото',  ['#fcd34d', '#a16207', '#fff7cc', '#f59e0b'], 3.0, 2, 'shine', 1000),
    ('Космос',  ['#8b5cf6', '#1e1b4b', '#f0abfc', '#22d3ee'], 4.0, 3, 'stars', 300),
]

OLD_SUPPLY = {8: 1000, 9: 300, 10: 100}


def nice(p):
    if p < 100: step = 5
    elif p < 1000: step = 10
    elif p < 5000: step = 50
    else: step = 100
    return max(step, int(round(p / step)) * step)


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def arr(cols):
    return "array[" + ",".join(q(c) for c in cols) + "]::text[]"


rows = []
for (sid, name, emoji, price, colors, fixed) in SHAPES:
    supply = OLD_SUPPLY.get(sid)
    rows.append(dict(id=sid, name=name, emoji=emoji, price=price, supply=supply, shape=sid,
                     colors=colors, theme='Классика', tier=1 if price >= 500 else 0, effect=None, sort=sid))

nid = 26
for ti, (tname, tcol, mult, tier, effect, tsupply) in enumerate(THEMES):
    for (sid, name, emoji, price, colors, fixed) in SHAPES:
        cols = [colors[i] if i in fixed else tcol[i] for i in range(4)]
        p = nice(price * mult)
        supply = None
        if tsupply:
            supply = tsupply // 10 if price >= 500 else tsupply // 2 if price >= 100 else tsupply
        if price >= 500:
            base = {8: 800, 9: 250, 10: 80}[sid]
            supply = min(supply, base) if supply else base
        rows.append(dict(id=nid, name=f'{name} «{tname}»', emoji=emoji, price=p, supply=supply, shape=sid,
                         colors=cols, theme=tname, tier=max(tier, 1 if price >= 500 else 0), effect=effect,
                         sort=100 + ti * 30 + sid))
        nid += 1

assert len(rows) == 250, len(rows)

# ---------------- NFT-атрибуты ----------------
TIERS = [(120, 1.0), (70, 1.3), (35, 2.0), (14, 3.5), (5, 6.0)]  # (вес, множитель цены)

MODELS = [
    # name, colors (None = родные цвета подарка), effect, tier
    ('Классика',   None, None, 0),
    ('Пастель',    ['#fbcfe8', '#f472b6', '#ffffff', '#c4b5fd'], None, 0),
    ('Мята',       ['#6ee7b7', '#059669', '#ecfdf5', '#a7f3d0'], None, 0),
    ('Карамель',   ['#fdba74', '#c2410c', '#ffedd5', '#fde68a'], None, 0),
    ('Лаванда',    ['#c4b5fd', '#6d28d9', '#f5f3ff', '#e9d5ff'], None, 0),
    ('Небо',       ['#7dd3fc', '#0369a1', '#f0f9ff', '#bae6fd'], None, 0),
    ('Лёд',        ['#bae6fd', '#38bdf8', '#f0f9ff', '#7dd3fc'], 'frost', 1),
    ('Аврора',     ['#2dd4bf', '#047857', '#a7f3d0', '#a3e635'], None, 1),
    ('Закат',      ['#fb923c', '#be185d', '#fed7aa', '#fde047'], None, 1),
    ('Океан',      ['#0ea5e9', '#1e3a8a', '#e0f2fe', '#22d3ee'], None, 1),
    ('Вишня',      ['#f43f5e', '#881337', '#ffe4e6', '#fda4af'], None, 1),
    ('Неон',       ['#22d3ee', '#c026d3', '#a5f3fc', '#f0abfc'], 'glow', 2),
    ('Пиксель',    ['#f472b6', '#facc15', '#ffffff', '#22d3ee'], 'pixel', 2),
    ('Рубин',      ['#e11d48', '#4c0519', '#fecdd3', '#fb7185'], 'shine', 2),
    ('Изумруд',    ['#10b981', '#022c22', '#d1fae5', '#34d399'], 'shine', 2),
    ('Токсик',     ['#a3e635', '#3f6212', '#ecfccb', '#facc15'], 'glow', 2),
    ('Хром',       ['#e2e8f0', '#475569', '#ffffff', '#94a3b8'], 'shine', 3),
    ('Обсидиан',   ['#4b5563', '#0b0f17', '#c4b5fd', '#9ca3af'], 'glow', 3),
    ('Лава',       ['#f97316', '#7f1d1d', '#fde047', '#ef4444'], 'glow', 3),
    ('Призрак',    ['#e0e7ff', '#818cf8', '#ffffff', '#c7d2fe'], 'glow', 3),
    ('Золото',     ['#fcd34d', '#a16207', '#fff7cc', '#f59e0b'], 'shine', 4),
    ('Космос',     ['#8b5cf6', '#1e1b4b', '#f0abfc', '#22d3ee'], 'stars', 4),
    ('Голограмма', ['#67e8f9', '#a78bfa', '#ffffff', '#f0abfc'], 'holo', 4),
    ('Бриллиант',  ['#e0f2fe', '#7dd3fc', '#ffffff', '#bae6fd'], 'stars', 4),
]

BACKDROPS = [
    # name, центр, край, tier
    ('Полночь', '#1d3b8f', '#0b1a3a', 0), ('Графит', '#5b6677', '#1a1f27', 0), ('Лазурь', '#4cc9ff', '#0e5aa7', 0),
    ('Мята', '#3ee6a8', '#0f5c4d', 0), ('Сирень', '#c4b5fd', '#4c3a8a', 0), ('Песок', '#e7c99a', '#7a5a2e', 0),
    ('Закат', '#ff8a4c', '#7a2a1a', 1), ('Аметист', '#a46bff', '#3b1a6b', 1), ('Океан', '#22d3ee', '#0c3d66', 1),
    ('Вишня', '#fb7185', '#6b1230', 1), ('Лайм', '#bef264', '#3f6212', 1),
    ('Рубин', '#ff4d6d', '#5c0f22', 2), ('Изумруд', '#10b981', '#064e3b', 2), ('Индиго', '#818cf8', '#1e1b4b', 2),
    ('Персик', '#fdba74', '#9a3412', 2), ('Бирюза', '#5eead4', '#115e59', 2),
    ('Северное сияние', '#4ade80', '#1e1b4b', 3), ('Магма', '#fb923c', '#450a0a', 3),
    ('Неоновая ночь', '#f0abfc', '#0f0a2e', 3), ('Морская глубина', '#38bdf8', '#020617', 3),
    ('Золотой рассвет', '#fde68a', '#b45309', 4), ('Чёрная дыра', '#a78bfa', '#000000', 4),
    ('Платина', '#f8fafc', '#64748b', 4), ('Радуга', '#f472b6', '#4338ca', 4),
]


def circle(cx, cy, r):
    return f'M{cx - r:.2f} {cy:.2f}a{r} {r} 0 1 0 {2 * r} 0a{r} {r} 0 1 0 {-2 * r} 0z'


def poly(points):
    return 'M' + 'L'.join(f'{x:.2f} {y:.2f}' for x, y in points) + 'z'


def rot_rect(cx, cy, w, h, ang):
    a = math.radians(ang)
    pts = []
    for dx, dy in [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]:
        pts.append((cx + dx * math.cos(a) - dy * math.sin(a), cy + dx * math.sin(a) + dy * math.cos(a)))
    return poly(pts)


flower = ''.join(circle(12 + 5.5 * math.cos(math.radians(a)), 12 + 5.5 * math.sin(math.radians(a)), 4) for a in range(0, 360, 60)) + circle(12, 12, 3.5)
snow = ''.join(rot_rect(12, 12, 2.6, 22, a) for a in (0, 60, 120)) + ''.join(circle(12 + 8 * math.cos(math.radians(a)), 12 + 8 * math.sin(math.radians(a)), 1.8) for a in range(30, 360, 60))
sun = circle(12, 12, 5.5) + ''.join(poly([(12 + 7.5 * math.cos(math.radians(a - 12)), 12 + 7.5 * math.sin(math.radians(a - 12))),
                                         (12 + 11.5 * math.cos(math.radians(a)), 12 + 11.5 * math.sin(math.radians(a))),
                                         (12 + 7.5 * math.cos(math.radians(a + 12)), 12 + 7.5 * math.sin(math.radians(a + 12)))]) for a in range(0, 360, 45))
clover = circle(12, 7, 4.5) + circle(7, 12, 4.5) + circle(17, 12, 4.5) + circle(12, 17, 4.5)
paw = circle(12, 15.5, 5.5) + circle(5.5, 9.5, 2.6) + circle(9.5, 5, 2.6) + circle(14.5, 5, 2.6) + circle(18.5, 9.5, 2.6)
cherry = circle(7, 17, 4.5) + circle(17, 17, 4.5) + poly([(7, 13), (8, 13), (13, 3), (12, 2)]) + poly([(16, 13), (17, 13), (13, 3), (12, 4)])
sparks = 'M8 2l1.6 5L15 8.6 9.6 10.2 8 15 6.4 10.2 1 8.6 6.4 7z' + 'M18 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1z'

SYMBOLS = [
    ('Искра', 'M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z', 0),
    ('Сердце', 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z', 0),
    ('Ромб', 'M12 1l8 11-8 11-8-11z', 0),
    ('Капля', 'M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z', 0),
    ('Лист', 'M4 20C4 9 11 3 21 3c0 10-6 17-17 17z', 0),
    ('Звезда', 'M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z', 1),
    ('Луна', 'M15 2a10 10 0 1 0 7 14A8 8 0 0 1 15 2z', 1),
    ('Клевер', clover, 1),
    ('Цветок', flower, 1),
    ('Кольцо', 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 1 1 0-12z', 1),
    ('Молния', 'M13 1L4 14h7l-2 9 9-13h-7z', 2),
    ('Снежинка', snow, 2),
    ('Нота', 'M9 3v12.3A3.5 3.5 0 1 0 11 18.5V8h8V3z', 2),
    ('Лапка', paw, 2),
    ('Вишня', cherry, 2),
    ('Пламя', 'M12 1c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z', 3),
    ('Солнце', sun, 3),
    ('Кристалл', 'M12 1l9 5v12l-9 5-9-5V6z', 3),
    ('Щит', 'M12 1l9 4v6c0 6-4 10-9 12C7 21 3 17 3 11V5z', 3),
    ('Корона', 'M3 19l-1-12 6 5 4-9 4 9 6-5-1 12z', 4),
    ('Звездопад', sparks, 4),
    ('Волна', 'M2 13c3-4 5-4 8 0s5 4 8 0 3-3 4-2v5c-2-1-2 2-4 2s-5-4-8 0-5 4-8 0z', 4),
]

out = []
out.append('-- Создано автоматически: python3 tools/gen_gifts.py — не редактируй вручную\n')
out.append('insert into public.gift_catalog (id, name, emoji, price, total_supply, upgrade_price, sort, shape, colors, theme, tier, effect) values')
vals = []
for r in rows:
    vals.append(f"  ({r['id']}, {q(r['name'])}, {q(r['emoji'])}, {r['price']}, {r['supply'] if r['supply'] else 'null'}, 25, {r['sort']}, {r['shape']}, {arr(r['colors'])}, {q(r['theme'])}, {r['tier']}, {q(r['effect']) if r['effect'] else 'null'})")
out.append(',\n'.join(vals))
out.append('''on conflict (id) do update set name = excluded.name, emoji = excluded.emoji, price = excluded.price,
  total_supply = excluded.total_supply, upgrade_price = excluded.upgrade_price, sort = excluded.sort,
  shape = excluded.shape, colors = excluded.colors, theme = excluded.theme, tier = excluded.tier, effect = excluded.effect;
''')

out.append('insert into public.nft_models (name, colors, effect, weight, mult, tier, sort) values')
out.append(',\n'.join(f"  ({q(n)}, {arr(c) if c else 'null'}, {q(e) if e else 'null'}, {TIERS[t][0]}, {TIERS[t][1]}, {t}, {i})" for i, (n, c, e, t) in enumerate(MODELS)))
out.append('on conflict (name) do update set colors = excluded.colors, effect = excluded.effect, weight = excluded.weight, mult = excluded.mult, tier = excluded.tier, sort = excluded.sort;\n')

out.append('insert into public.nft_backdrops (name, center, edge, weight, mult, tier, sort) values')
out.append(',\n'.join(f"  ({q(n)}, {q(c)}, {q(e)}, {TIERS[t][0]}, {TIERS[t][1]}, {t}, {i})" for i, (n, c, e, t) in enumerate(BACKDROPS)))
out.append('on conflict (name) do update set center = excluded.center, edge = excluded.edge, weight = excluded.weight, mult = excluded.mult, tier = excluded.tier, sort = excluded.sort;\n')

out.append('insert into public.nft_symbols (name, path, weight, mult, tier, sort) values')
out.append(',\n'.join(f"  ({q(n)}, {q(p)}, {TIERS[t][0]}, {TIERS[t][1]}, {t}, {i})" for i, (n, p, t) in enumerate(SYMBOLS)))
out.append('on conflict (name) do update set path = excluded.path, weight = excluded.weight, mult = excluded.mult, tier = excluded.tier, sort = excluded.sort;\n')

open(os.path.join(ROOT, 'supabase', 'stage3-data.sql'), 'w', encoding='utf-8').write('\n'.join(out))

# Для клиента: какие цвета не перекрашиваются у каждой модели
fixed = {sid: f for (sid, _n, _e, _p, _c, f) in SHAPES}
base = {sid: c for (sid, _n, _e, _p, c, _f) in SHAPES}
js = '// Создано автоматически: python3 tools/gen_gifts.py\nexport const FIXED = ' + json.dumps(fixed) + ';\nexport const BASE_COLORS = ' + json.dumps(base) + ';\n'
open(os.path.join(ROOT, 'js', 'app', 'giftmeta.js'), 'w', encoding='utf-8').write(js)

prices = sorted(r['price'] for r in rows)
print('gifts:', len(rows), 'price range', prices[0], '-', prices[-1], 'limited:', sum(1 for r in rows if r['supply']))
print('models', len(MODELS), 'backdrops', len(BACKDROPS), 'symbols', len(SYMBOLS))
