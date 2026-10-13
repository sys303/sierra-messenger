import { sb, state, h, icon, avatar, coins, rpc, toast, ruError, modal, confirmBox, pickUser, emptyState } from './core.js';
import { refreshBalance } from './wallet.js';
import { giftSvg, paletteFor, symbolSvg } from './giftart.js';

// =====================================================================
// Данные: каталог подарков и NFT-атрибуты (загружаются один раз)
// =====================================================================
let catalogCache = null;
let catalogById = new Map();
export async function getCatalog(force = false) {
  if (catalogCache && !force) return catalogCache;
  const { data, error } = await sb.from('gift_catalog').select('*').order('sort');
  if (error) throw error;
  catalogCache = data || [];
  catalogById = new Map(catalogCache.map((g) => [g.id, g]));
  return catalogCache;
}

export const ATTR = { model: new Map(), backdrop: new Map(), symbol: new Map() };
let attrsLoaded = false;
export async function loadNftAttrs() {
  if (attrsLoaded) return;
  const [m, b, s] = await Promise.all([
    sb.from('nft_models').select('*').order('sort'),
    sb.from('nft_backdrops').select('*').order('sort'),
    sb.from('nft_symbols').select('*').order('sort'),
  ]);
  const fill = (map, res) => {
    const rows = res.data || [];
    const total = rows.reduce((t, r) => t + r.weight, 0) || 1;
    rows.forEach((r) => map.set(r.name, { ...r, pct: Math.round((r.weight / total) * 1000) / 10 }));
  };
  fill(ATTR.model, m); fill(ATTR.backdrop, b); fill(ATTR.symbol, s);
  attrsLoaded = !m.error;
}

export function findGift(key) {
  if (key === null || key === undefined) return null;
  return catalogById.get(Number(key)) || (catalogCache || []).find((g) => g.emoji === key) || null;
}

const TIER = [
  { name: 'Обычный', cls: 't0' }, { name: 'Необычный', cls: 't1' }, { name: 'Редкий', cls: 't2' },
  { name: 'Эпический', cls: 't3' }, { name: 'Легендарный', cls: 't4' },
];
const OLD_BACKDROP = ['#1d3b8f', '#0b1a3a'];

// Фон NFT
function backdropCss(ug) {
  const b = ATTR.backdrop.get(ug.backdrop);
  if (b && b.name === 'Радуга') {
    return 'radial-gradient(circle at 50% 38%, rgba(255,255,255,.35), transparent 55%), conic-gradient(from 200deg at 50% 40%, #f472b6, #facc15, #4ade80, #22d3ee, #818cf8, #f472b6)';
  }
  const [center, edge] = b ? [b.center, b.edge] : OLD_BACKDROP;
  return `radial-gradient(circle at 50% 38%, ${center} 0%, ${edge} 78%)`;
}

// Узор из символов вокруг модели (как в Telegram)
const RINGS = [
  { n: 6, r: 30, s: 9, o: .55, off: 30 },
  { n: 10, r: 46, s: 7.5, o: .38, off: 0 },
  { n: 14, r: 62, s: 6, o: .22, off: 12 },
];
function patternLayer(ug, cy = 40) {
  const sym = ATTR.symbol.get(ug.pattern);
  const b = ATTR.backdrop.get(ug.backdrop);
  const color = b ? b.center : '#4cc9ff';
  const layer = h('div', { class: 'nft-pattern' });
  if (!sym) return layer;
  for (const ring of RINGS) {
    for (let i = 0; i < ring.n; i++) {
      const a = ((i / ring.n) * 360 + ring.off) * Math.PI / 180;
      const el = h('span', {
        class: 'nft-sym',
        style: {
          left: 50 + ring.r * Math.cos(a) + '%', top: cy + ring.r * Math.sin(a) * 0.92 + '%',
          width: ring.s + '%', opacity: ring.o,
        },
        html: symbolSvg(sym.path, color),
      });
      layer.append(el);
    }
  }
  return layer;
}

// Картинка подарка. full — фон NFT на весь контейнер (для карточек)
export function giftArt(gift, ug = null, size = 96, { bare = false } = {}) {
  const g = gift && typeof gift === 'object' && gift.shape !== undefined ? gift : findGift(gift?.id ?? gift) || gift;
  const nft = ug && ug.is_collectible;
  const el = h('div', { class: 'gift-art' + (nft && !bare ? ' nft' : '') + (!nft ? ' plain' : ''), style: { width: size + 'px', height: size + 'px' } });
  if (nft && !bare) {
    el.style.background = backdropCss(ug);
    el.append(patternLayer(ug, 50));
  }
  let svg = null;
  if (g && g.shape) {
    const model = nft ? ATTR.model.get(ug.model) : null;
    const colors = paletteFor(g.shape, g.colors, model?.colors || null);
    svg = giftSvg(g.shape, colors, nft ? (model?.effect || null) : (g.effect || null));
    if (!nft && g.colors) el.style.setProperty('--glow', g.colors[0]);
  }
  const inner = h('div', { class: 'gift-model', style: { width: (nft && !bare ? 74 : 90) + '%', height: (nft && !bare ? 74 : 90) + '%' } });
  if (svg) inner.innerHTML = svg;
  else inner.append(h('span', { class: 'gift-emoji', style: { fontSize: size * 0.5 + 'px' } }, (g && g.emoji) || '🎁'));
  el.append(inner);
  return el;
}

function tags(...items) {
  const list = items.filter(Boolean);
  return list.length ? h('div', { class: 'gift-tags' }, list.map(([cls, text]) => h('span', { class: 'gtag ' + cls }, text))) : null;
}

// Загрузить подарки пользователей вместе с владельцем и отправителем (без вложенных запросов)
async function hydrate(rows) {
  await getCatalog();
  const ids = [...new Set(rows.flatMap((r) => [r.owner_id, r.sender_id]).filter(Boolean))];
  const people = new Map();
  if (ids.length) {
    const { data } = await sb.from('profiles').select('id,username,display_name,avatar_url').in('id', ids);
    (data || []).forEach((p) => people.set(p.id, p));
  }
  return rows.map((r) => ({ ...r, gift: findGift(r.gift_id) || { name: 'Подарок', emoji: '🎁' }, owner: people.get(r.owner_id), sender: people.get(r.sender_id) }));
}

async function fetchUserGifts(build) {
  const { data, error } = await build(sb.from('user_gifts').select('*'));
  if (error) { toast(ruError(error), 'error'); return []; }
  return hydrate(data || []);
}

// =====================================================================
// Раздел «Подарки»
// =====================================================================
export async function renderGifts(view, tab = 'shop') {
  await Promise.all([getCatalog(), loadNftAttrs()]);
  const [tabKey, sub] = String(tab || 'shop').split('/');
  tab = tabKey;
  const tabs = [['shop', '🛍️ Магазин'], ['mine', '🎁 Мои подарки'], ['usernames', '@ Юзернеймы']];
  const body = h('div', {});
  view.append(
    h('div', { class: 'page-head' }, h('h1', {}, 'Подарки'),
      h('p', { class: 'muted' }, `${catalogCache.length} подарков · любой можно сразу превратить в уникальный NFT за 25 SierCoin`)),
    h('div', { class: 'tabs' }, tabs.map(([k, l]) => h('a', { href: '#/gifts/' + k, class: 'tab' + (k === tab ? ' active' : '') }, l))),
    body);
  if (tab === 'mine') await renderMine(body);
  else if (tab === 'usernames') await (await import('./usernames.js')).renderUsernameMarket(body, sub || 'all');
  else await renderShop(body);
}

const PAGE = 48;
async function renderShop(body) {
  const cat = await getCatalog(true);
  const themes = [...new Set(cat.map((g) => g.theme).filter(Boolean))];

  // NFT, которые продают пользователи — лента сверху
  const nftRow = h('div', { class: 'h-scroll' });
  const nftSection = h('section', { hidden: true },
    h('div', { class: 'shop-sub' }, h('h3', { class: 'section-title' }, '💎 NFT на продаже')), nftRow);

  const search = h('input', { class: 'input', placeholder: 'Поиск подарка…' });
  const theme = h('select', { class: 'input select' }, h('option', { value: '' }, 'Все расцветки'), themes.map((t) => h('option', { value: t }, t)));
  const sort = h('select', { class: 'input select' },
    h('option', { value: 'price-asc' }, 'Сначала дешёвые'), h('option', { value: 'price-desc' }, 'Сначала дорогие'),
    h('option', { value: 'rare' }, 'Сначала редкие'), h('option', { value: 'sort' }, 'По коллекциям'));
  const onlyLimited = h('input', { type: 'checkbox' });
  const onlyAfford = h('input', { type: 'checkbox' });
  const grid = h('div', { class: 'gift-grid' });
  const more = h('button', { class: 'btn ghost more-btn' }, 'Показать ещё');
  const counter = h('span', { class: 'muted small' });

  body.append(nftSection,
    h('div', { class: 'shop-tools' }, search, theme, sort),
    h('div', { class: 'shop-checks' },
      h('label', { class: 'check-chip' }, onlyLimited, h('span', {}, '🔥 Только лимитированные')),
      h('label', { class: 'check-chip' }, onlyAfford, h('span', {}, '🪙 Хватает SierCoin')),
      counter),
    grid, more);

  let list = [], shown = 0;
  function apply() {
    const q = search.value.trim().toLowerCase();
    list = cat.filter((g) =>
      (!q || g.name.toLowerCase().includes(q)) &&
      (!theme.value || g.theme === theme.value) &&
      (!onlyLimited.checked || g.total_supply) &&
      (!onlyAfford.checked || g.price <= (state.balance || 0)));
    const s = sort.value;
    list.sort((a, b) => s === 'price-asc' ? a.price - b.price || a.sort - b.sort
      : s === 'price-desc' ? b.price - a.price
      : s === 'rare' ? (b.tier - a.tier) || (b.price - a.price) : a.sort - b.sort);
    grid.replaceChildren();
    shown = 0;
    counter.textContent = `Найдено: ${list.length}`;
    page();
  }
  function page() {
    const next = list.slice(shown, shown + PAGE);
    next.forEach((g) => grid.append(shopCard(g)));
    shown += next.length;
    more.hidden = shown >= list.length;
    if (!list.length) grid.append(emptyState('🔍', 'Ничего не найдено', 'Попробуй другой фильтр'));
  }
  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 200); });
  [theme, sort, onlyLimited, onlyAfford].forEach((el) => el.addEventListener('change', apply));
  more.onclick = page;
  apply();

  const listed = await fetchUserGifts((q) => q.not('sale_price', 'is', null).order('sale_price').limit(40));
  if (listed.length) {
    nftSection.hidden = false;
    nftRow.replaceChildren(...listed.map((ug) => userGiftTile(ug, () => renderShop((body.replaceChildren(), body)))));
  }
}

export function leftOf(g) { return g.total_supply ? Math.max(0, g.total_supply - g.sold) : null; }
export function leftText(g) {
  const left = leftOf(g);
  return left === null ? '' : left === 0 ? 'Sold out · распродано' : `Осталось ${coins(left)} из ${coins(g.total_supply)}`;
}

function shopCard(g) {
  const left = leftOf(g);
  const card = h('button', { class: 'gift-card' + (left === 0 ? ' soldout' : '') + ' tier-' + (g.tier || 0), 'data-gift': g.id },
    tags(g.tier >= 3 ? ['legend', 'Legend'] : g.tier === 2 ? ['epic', 'Rare'] : null, g.total_supply ? ['limit', 'Limited'] : null),
    giftArt(g, null, 104),
    h('b', { class: 'gift-name' }, g.name),
    h('span', { class: 'price' }, icon('coin', 'ico sm'), coins(g.price)),
    left !== null ? h('span', { class: 'muted small gift-left', 'data-left': g.id }, leftText(g)) : null);
  card.onclick = () => leftOf(catalogById.get(g.id) || g) !== 0 && openBuyGift(catalogById.get(g.id) || g);
  return card;
}

// Живой счётчик: база сообщает об изменении «sold» — обновляем все карточки
export function onCatalogUpdate(row) {
  if (!row || !row.id) return;
  const g = catalogById.get(row.id);
  if (g) Object.assign(g, row); else return;
  document.querySelectorAll(`[data-left="${row.id}"]`).forEach((el) => { el.textContent = leftText(g); });
  document.querySelectorAll(`[data-gift="${row.id}"]`).forEach((el) => el.classList.toggle('soldout', leftOf(g) === 0));
}

// =====================================================================
// Покупка: кому → подпись → (NFT за +25) → оплатить
// =====================================================================
export async function openBuyGift(g, toUser = undefined) {
  await loadNftAttrs();
  let recipient = toUser === undefined ? null : toUser;
  const who = h('div', { class: 'gift-to' });
  const msg = h('textarea', { class: 'input', maxlength: 255, rows: 2, placeholder: 'Подпись к подарку (необязательно)' });
  const up = h('input', { type: 'checkbox' });
  const upPrice = g.upgrade_price || 25;
  const buy = h('button', { class: 'btn' });
  const drawBtn = () => { buy.textContent = `Купить за ${coins(g.price + (up.checked ? upPrice : 0))} SierCoin`; };
  up.onchange = drawBtn;
  drawBtn();

  function renderWho() {
    who.replaceChildren(
      h('span', { class: 'muted' }, 'Кому:'),
      recipient ? h('span', { class: 'chip-user' }, avatar(recipient.avatar_url, recipient.display_name, 24), recipient.display_name) : h('span', { class: 'chip-user' }, '🙋 Себе'),
      h('button', { class: 'link-btn', onclick: async () => {
        const u = await pickUser({ title: 'Кому подарить?' });
        if (u) { recipient = u; renderWho(); }
      } }, recipient ? 'изменить' : 'подарить другу'),
      recipient ? h('button', { class: 'link-btn', onclick: () => { recipient = null; renderWho(); } }, 'себе') : null);
  }
  renderWho();

  const left = leftOf(g);
  const m = modal(g.name, h('div', { class: 'center' },
    h('div', { class: 'buy-art' }, giftArt(g, null, 170)),
    h('div', { class: 'buy-meta' },
      h('span', { class: 'gtag ' + (g.tier >= 3 ? 'legend' : g.tier === 2 ? 'epic' : 'limit') }, g.tier >= 3 ? 'Legend' : g.tier === 2 ? 'Rare' : (g.theme || 'Classic')),
      g.total_supply ? h('span', { class: 'gtag limit' }, 'Limited') : null,
      left !== null ? h('span', { class: 'muted small', 'data-left': g.id }, leftText(g)) : null),
    who, msg,
    h('label', { class: 'upgrade-box' }, up,
      h('div', {}, h('b', {}, `✨ Сразу сделать NFT (+${upPrice} SierCoin)`),
        h('span', { class: 'muted small' }, 'Подарок получит уникальную модель, фон и символ — как в Telegram. Его можно будет продать или передать.'))),
    h('p', { class: 'muted small', style: { margin: '10px 0' } }, `Твой баланс: ${coins(state.balance)} SierCoin`),
    buy));

  buy.onclick = async () => {
    buy.disabled = true;
    try {
      const ugId = await rpc('buy_gift', { p_gift: g.id, p_to: recipient ? recipient.id : null, p_message: msg.value.trim(), p_upgrade: up.checked });
      m.close();
      refreshBalance();
      const { data: fresh } = await sb.from('gift_catalog').select('*').eq('id', g.id).maybeSingle();
      if (fresh) onCatalogUpdate(fresh);
      if (up.checked && !recipient) {
        const [ug] = await fetchUserGifts((q) => q.eq('id', ugId));
        if (ug) return revealNft(ug);
      }
      toast(recipient ? `Подарок отправлен ${recipient.display_name}! 🎉` : 'Подарок добавлен в твой профиль 🎉', 'success');
    } catch { buy.disabled = false; }
  };
}

// =====================================================================
// Мои подарки
// =====================================================================
async function renderMine(body) {
  const all = await fetchUserGifts((q) => q.eq('owner_id', state.me.id).order('created_at', { ascending: false }));
  if (!all.length) return body.append(emptyState('🎁', 'Подарков пока нет', 'Купи подарок себе или попроси друга что-нибудь подарить',
    h('a', { class: 'btn small', href: '#/gifts/shop' }, 'В магазин')));
  const nfts = all.filter((g) => g.is_collectible).length;
  const filter = h('div', { class: 'shop-checks' });
  const grid = h('div', { class: 'gift-grid' });
  let mode = 'all';
  const draw = () => {
    filter.replaceChildren(...[['all', `Все · ${all.length}`], ['nft', `NFT · ${nfts}`], ['plain', `Обычные · ${all.length - nfts}`]].map(([k, l]) =>
      h('button', { class: 'check-chip' + (mode === k ? ' on' : ''), onclick: () => { mode = k; draw(); } }, l)));
    const list = all.filter((g) => mode === 'all' || (mode === 'nft') === !!g.is_collectible);
    grid.replaceChildren(...list.map((ug) => userGiftTile(ug, () => { body.replaceChildren(); renderMine(body); })));
  };
  body.append(filter, grid);
  draw();
}

// Карточка подарка пользователя. NFT — с фоном и узором на всю карточку
export function userGiftTile(ug, onChange) {
  const g = ug.gift || findGift(ug.gift_id) || {};
  const nft = ug.is_collectible;
  const tile = h('button', { class: 'gift-card' + (nft ? ' nft-card' : '') + (ug.is_hidden ? ' hidden-gift' : '') });
  if (nft) {
    tile.style.background = backdropCss(ug);
    tile.append(patternLayer(ug, 38));
  }
  tile.append(...[
    tags(nft ? ['nft', 'NFT'] : null, ug.sale_price ? ['sale', 'В продаже'] : null, ug.is_hidden ? ['hid', 'Скрыт'] : null),
    giftArt(g, ug, 104, { bare: true }),
    h('b', { class: 'gift-name' }, g.name + (nft ? ' #' + ug.collectible_no : '')),
    nft ? h('span', { class: 'nft-sub' }, ug.model + ' · ' + ug.backdrop) : null,
    ug.sale_price ? h('span', { class: 'price' }, icon('coin', 'ico sm'), coins(ug.sale_price))
      : nft && ug.value ? h('span', { class: 'nft-sub' }, '≈ ' + coins(ug.value) + ' SierCoin')
      : ug.sender && ug.sender.id !== ug.owner_id ? h('span', { class: 'muted small' }, 'от ' + ug.sender.display_name) : null,
  ].filter(Boolean));
  tile.onclick = () => openUserGift(ug, onChange);
  return tile;
}

// =====================================================================
// Подробнее о подарке
// =====================================================================
function attrRow(label, name, kind) {
  const a = ATTR[kind].get(name);
  const tier = TIER[a?.tier ?? 0];
  return h('div', { class: 'attr' },
    h('span', { class: 'muted' }, label),
    h('b', {}, kind === 'symbol' && a ? h('span', { class: 'attr-sym', html: symbolSvg(a.path, '#cfe6f7') }) : null, name),
    h('span', { class: 'rar ' + tier.cls, title: tier.name }, a ? a.pct + '%' : '—'));
}

function nftHero(g, ug, size) {
  const box = h('div', { class: 'nft-hero', style: { background: backdropCss(ug) } }, patternLayer(ug, 46), giftArt(g, ug, size, { bare: true }));
  return box;
}

export async function openUserGift(ug, onChange = () => {}) {
  await loadNftAttrs();
  const g = ug.gift || findGift(ug.gift_id) || {};
  const mine = ug.owner_id === state.me.id;
  const act = (label, cls, fn) => {
    const b = h('button', { class: 'btn ' + cls }, label);
    b.onclick = async () => { b.disabled = true; try { await fn(); } catch { b.disabled = false; } };
    return b;
  };
  const done = (text) => { m.close(); toast(text, 'success'); refreshBalance(); onChange(); };
  const nft = ug.is_collectible;

  const actions = [];
  if (mine) {
    if (!nft) {
      actions.push(act(`✨ Улучшить до NFT за ${coins(g.upgrade_price || 25)}`, '', async () => {
        await rpc('upgrade_gift', { p_ug: ug.id });
        const [fresh] = await fetchUserGifts((q) => q.eq('id', ug.id));
        m.close(); refreshBalance(); onChange();
        if (fresh) revealNft(fresh);
      }));
      actions.push(act(`Обменять на ${coins(Math.floor((g.price || 0) * 0.8))} SierCoin`, 'ghost', async () => {
        if (!(await confirmBox('Подарок исчезнет, а ты получишь 80% его цены. Продолжить?', 'Обменять'))) throw 0;
        const v = await rpc('convert_gift', { p_ug: ug.id });
        done(`+${coins(v)} SierCoin`);
      }));
    } else {
      actions.push(act('🎁 Передать другу', '', async () => {
        const u = await pickUser({ title: 'Кому передать NFT?' });
        if (!u) throw 0;
        if (!(await confirmBox(`Передать ${g.name} #${ug.collectible_no} пользователю ${u.display_name}? Вернуть будет нельзя.`, 'Передать'))) throw 0;
        await rpc('transfer_gift', { p_ug: ug.id, p_to: u.id });
        done('NFT передан ' + u.display_name);
      }));
      if (ug.sale_price) actions.push(act('Снять с продажи', 'ghost', async () => {
        await rpc('list_gift', { p_ug: ug.id, p_price: null }); done('Снято с продажи');
      }));
      else actions.push(act('💰 Выставить на продажу', 'ghost', async () => {
        const price = await askPrice(ug.value);
        if (!price) throw 0;
        await rpc('list_gift', { p_ug: ug.id, p_price: price });
        done('Выставлено на продажу за ' + coins(price) + ' SierCoin');
      }));
    }
    if (!ug.sale_price) actions.push(act(ug.is_hidden ? '👁 Показывать в профиле' : '🙈 Скрыть из профиля', 'ghost', async () => {
      const hidden = await rpc('toggle_gift_hidden', { p_ug: ug.id });
      done(hidden ? 'Подарок скрыт из профиля' : 'Подарок снова виден в профиле');
    }));
  } else if (ug.sale_price) {
    actions.push(act(`Купить за ${coins(ug.sale_price)} SierCoin`, '', async () => {
      if (!(await confirmBox(`Купить ${g.name} #${ug.collectible_no} за ${coins(ug.sale_price)} SierCoin?`, 'Купить'))) throw 0;
      await rpc('buy_listed_gift', { p_ug: ug.id });
      done('NFT теперь твой! 🎉');
    }));
  }

  const m = modal(g.name + (nft ? ' #' + ug.collectible_no : ''), h('div', { class: 'center gift-detail' },
    nft ? nftHero(g, ug, 190) : h('div', { class: 'buy-art' }, giftArt(g, null, 170)),
    nft ? h('div', { class: 'nft-badge' }, '◆ NFT · коллекционный подарок №' + ug.collectible_no)
      : g.total_supply ? h('div', { class: 'muted small' }, `Limited · №${ug.serial} из ${coins(g.total_supply)}`) : null,
    nft ? h('div', { class: 'attrs' },
      attrRow('Модель', ug.model, 'model'), attrRow('Фон', ug.backdrop, 'backdrop'), attrRow('Символ', ug.pattern, 'symbol')) : null,
    nft && ug.value ? h('div', { class: 'nft-value' }, 'Оценка: ', icon('coin', 'ico sm'), h('b', {}, coins(ug.value)), ' SierCoin') : null,
    h('div', { class: 'gift-meta' },
      ug.owner ? h('a', { href: '#/u/' + ug.owner.username, onclick: () => m.close() }, 'Владелец: ', h('b', {}, ug.owner.display_name)) : null,
      ug.sender && ug.sender.id !== ug.owner_id ? h('a', { href: '#/u/' + ug.sender.username, onclick: () => m.close() }, 'От: ', h('b', {}, ug.sender.display_name)) : null,
      ug.message ? h('p', { class: 'gift-msg' }, '«' + ug.message + '»') : null),
    h('div', { class: 'stack' }, actions)));
}

function askPrice(suggest) {
  return new Promise((resolve) => {
    let ok = false;
    const inp = h('input', { class: 'input', type: 'number', min: 1, max: 10000000, placeholder: 'Цена в SierCoin', value: suggest || '' });
    const m = modal('Цена продажи', h('div', {},
      h('p', { class: 'muted' }, suggest ? `Оценка этого NFT — ${coins(suggest)} SierCoin. Комиссия 5%, остальное получишь ты.` : 'Комиссия 5%, остальное получишь ты.'),
      inp,
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
        h('button', { class: 'btn', onclick: () => {
          const v = Math.floor(Number(inp.value));
          if (!v || v < 1) return toast('Введи цену', 'error');
          ok = true; m.close(); resolve(v);
        } }, 'Выставить'))), { onClose: () => { if (!ok) resolve(null); } });
    inp.focus();
  });
}

// «Распаковка» нового NFT
function revealNft(ug) {
  const g = ug.gift;
  modal('Новый NFT! ✨', h('div', { class: 'center reveal' },
    nftHero(g, ug, 200),
    h('h3', {}, `${g.name} #${ug.collectible_no}`),
    h('div', { class: 'attrs' },
      attrRow('Модель', ug.model, 'model'), attrRow('Фон', ug.backdrop, 'backdrop'), attrRow('Символ', ug.pattern, 'symbol')),
    ug.value ? h('div', { class: 'nft-value' }, 'Оценка: ', icon('coin', 'ico sm'), h('b', {}, coins(ug.value)), ' SierCoin') : null));
}

// Подарки в профиле
export async function giftsShowcase(container, ownerId) {
  await loadNftAttrs();
  const data = await fetchUserGifts((q) => q.eq('owner_id', ownerId)
    .order('is_collectible', { ascending: false }).order('created_at', { ascending: false }).limit(36));
  if (!data.length) {
    container.append(emptyState('🎁', 'Подарков пока нет', ownerId === state.me.id ? 'Подарки, которые тебе дарят, появятся здесь' : ''));
    return 0;
  }
  container.append(h('div', { class: 'gift-grid' }, data.map((ug) => userGiftTile(ug, () => {}))));
  return data.length;
}

export async function openGiftById(id) {
  const [ug] = await fetchUserGifts((q) => q.eq('id', id));
  if (!ug) return toast('Подарок не найден или скрыт', 'error');
  openUserGift(ug);
}

// Выбор подарка для друга (из чата или профиля): поиск + сортировка
export async function chooseGiftFor(user) {
  const cat = await getCatalog(true);
  const search = h('input', { class: 'input', placeholder: 'Поиск подарка…' });
  const sort = h('select', { class: 'input select' }, h('option', { value: 'asc' }, 'Дешёвые'), h('option', { value: 'desc' }, 'Дорогие'), h('option', { value: 'rare' }, 'Редкие'));
  const grid = h('div', { class: 'gift-grid small pick-gifts' });
  const m = modal('Подарок для ' + user.display_name, h('div', {}, h('div', { class: 'shop-tools two' }, search, sort), grid), { wide: true });
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const list = cat.filter((g) => !q || g.name.toLowerCase().includes(q))
      .sort((a, b) => sort.value === 'asc' ? a.price - b.price : sort.value === 'desc' ? b.price - a.price : (b.tier - a.tier) || (b.price - a.price))
      .slice(0, 60);
    grid.replaceChildren(...list.map((g) => {
      const card = shopCard(g);
      card.onclick = () => { if (leftOf(g) === 0) return; m.close(); openBuyGift(g, user); };
      return card;
    }));
  };
  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(draw, 200); });
  sort.onchange = draw;
  draw();
  search.focus();
}
