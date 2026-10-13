// Маркет коллекционных юзернеймов: выставляют только пользователи, за свою цену.
// Маркет только раскладывает по длине: 3, 4, 5, 6 символов.
import { sb, state, h, icon, avatar, coins, rpc, toast, ruError, modal, confirmBox, emptyState } from './core.js';
import { refreshBalance } from './wallet.js';

const SUBS = [['all', 'Все'], ['3', '3 символа'], ['4', '4 символа'], ['5', '5 символов'], ['6', '6 символов'], ['mine', '⭐ Мои']];
const PAGE = 48;

export async function renderUsernameMarket(body, sub = 'all') {
  body.append(h('div', { class: 'shop-checks uname-subs' },
    SUBS.map(([k, l]) => h('a', { href: '#/gifts/usernames/' + k, class: 'check-chip' + (k === sub ? ' on' : '') }, l))));
  if (sub === 'mine') return renderMine(body);
  return renderMarket(body, sub);
}

// ---------- Витрина ----------
async function renderMarket(body, sub) {
  const search = h('input', { class: 'input', placeholder: 'Поиск юзернейма…' });
  const sort = h('select', { class: 'input select' },
    h('option', { value: 'asc' }, 'Сначала дешёвые'), h('option', { value: 'desc' }, 'Сначала дорогие'), h('option', { value: 'new' }, 'Сначала новые'));
  const grid = h('div', { class: 'gift-grid uname-grid' });
  const more = h('button', { class: 'btn ghost more-btn', hidden: true }, 'Показать ещё');
  const hint = h('p', { class: 'muted small', style: { margin: '0 0 12px' } },
    'Юзернеймы выставляют сами пользователи за свою цену. Купленный появится у тебя в профиле как «also @…». ',
    h('a', { href: '#/gifts/usernames/mine' }, 'Продать свой →'));
  body.append(hint, h('div', { class: 'shop-tools two' }, search, sort), grid, more);

  let offset = 0;
  async function load(reset = true) {
    if (reset) { offset = 0; grid.replaceChildren(h('div', { class: 'muted pad' }, 'Загружаем…')); }
    let q = sb.from('usernames').select('*').not('sale_price', 'is', null);
    if (sub !== 'all') q = q.eq('len', Number(sub));
    const t = search.value.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
    if (t) q = q.ilike('name', `%${t}%`);
    q = sort.value === 'new' ? q.order('listed_at', { ascending: false }) : q.order('sale_price', { ascending: sort.value === 'asc' });
    const { data, error } = await q.range(offset, offset + PAGE - 1);
    if (reset) grid.replaceChildren();
    if (error) { grid.append(h('div', { class: 'config-banner' }, ruError(error))); return; }
    const sellers = await profilesById(data.map((r) => r.owner_id));
    data.forEach((r) => grid.append(card(r, sellers.get(r.owner_id), () => load())));
    offset += data.length;
    more.hidden = data.length < PAGE;
    if (reset && !data.length) grid.append(emptyState('@', 'Пока никто не продаёт', sub === 'all' ? 'Стань первым — выставь свой юзернейм' : `Нет юзернеймов из ${sub} символов`,
      h('a', { class: 'btn small', href: '#/gifts/usernames/mine' }, 'Продать юзернейм')));
  }
  let tm;
  search.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(load, 250); });
  sort.onchange = () => load();
  more.onclick = () => load(false);
  await load();
}

async function profilesById(ids) {
  const map = new Map();
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return map;
  const { data } = await sb.from('profiles').select('id,username,display_name,avatar_url').in('id', uniq);
  (data || []).forEach((p) => map.set(p.id, p));
  return map;
}

function card(r, seller, onChange) {
  const mine = r.owner_id === state.me.id;
  const el = h('button', { class: 'gift-card uname-card' + (mine ? ' mine' : '') },
    h('div', { class: 'uname-at' }, h('span', { class: 'uname-sign' }, '@'), h('span', { class: 'uname-text' }, r.name)),
    h('span', { class: 'price' }, icon('coin', 'ico sm'), coins(r.sale_price)),
    h('span', { class: 'muted small' }, mine ? 'твой лот' : 'продаёт ' + (seller ? '@' + seller.username : '…')));
  el.onclick = () => openLot(r, seller, onChange);
  return el;
}

function openLot(r, seller, onChange) {
  const mine = r.owner_id === state.me.id;
  const act = (label, cls, fn) => {
    const b = h('button', { class: 'btn ' + cls }, label);
    b.onclick = async () => { b.disabled = true; try { await fn(); } catch { b.disabled = false; } };
    return b;
  };
  const actions = mine ? [
    act('Изменить цену', '', async () => {
      const p = await askPrice(r.name, r.sale_price);
      if (!p) throw 0;
      await rpc('list_username', { p_name: r.name, p_price: p });
      m.close(); toast(`@${r.name} теперь стоит ${coins(p)} SierCoin`, 'success'); onChange();
    }),
    act('Снять с продажи', 'ghost', async () => {
      await rpc('list_username', { p_name: r.name, p_price: null });
      m.close(); toast('Снято с продажи', 'success'); onChange();
    }),
  ] : [
    act(`Купить за ${coins(r.sale_price)} SierCoin`, '', async () => {
      if (!(await confirmBox(`Купить @${r.name} за ${coins(r.sale_price)} SierCoin? Он появится в твоём профиле.`, 'Купить'))) throw 0;
      await rpc('buy_username', { p_name: r.name });
      m.close(); refreshBalance();
      toast(`@${r.name} теперь твой! 🎉`, 'success');
      onChange();
    }),
  ];
  const m = modal('@' + r.name, h('div', { class: 'center' },
    h('div', { class: 'uname-hero' }, h('span', { class: 'uname-sign' }, '@'), r.name),
    h('div', { class: 'nft-value' }, 'Цена: ', icon('coin', 'ico sm'), h('b', {}, coins(r.sale_price)), ' SierCoin'),
    seller ? h('a', { class: 'uname-seller', href: '#/u/' + seller.username, onclick: () => m.close() },
      avatar(seller.avatar_url, seller.display_name, 28), 'Продавец: ', h('b', {}, seller.display_name)) : null,
    h('p', { class: 'muted small', style: { margin: '10px 0 0' } }, mine ? 'Маркет берёт 5% с продажи.' : `Твой баланс: ${coins(state.balance)} SierCoin`),
    h('div', { class: 'stack' }, actions)));
}

function askPrice(name, current) {
  return new Promise((resolve) => {
    let ok = false;
    const inp = h('input', { class: 'input', type: 'number', min: 1, max: 100000000, placeholder: 'Цена в SierCoin', value: current || '' });
    const m = modal('Цена для @' + name, h('div', {},
      h('p', { class: 'muted', style: { marginBottom: '10px' } }, 'Цену назначаешь ты. Маркет возьмёт 5% комиссии, остальное получишь ты.'),
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

// ---------- Мои юзернеймы ----------
async function renderMine(body) {
  const box = h('div', {});
  body.append(box);
  async function draw() {
    const { data, error } = await sb.from('usernames').select('*').eq('owner_id', state.me.id).order('created_at');
    if (error) return box.replaceChildren(h('div', { class: 'config-banner' }, ruError(error)));
    const primary = state.profile.username;

    const claim = h('input', { class: 'input with-prefix', maxlength: 20, placeholder: 'svobodny_nik' });
    const status = h('div', { class: 'hint' }, '3–20 символов: латиница, цифры и _ · можно занять до 10');
    const claimBtn = h('button', { class: 'btn small' }, 'Занять');
    let t;
    claim.addEventListener('input', () => {
      claim.value = claim.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
      clearTimeout(t);
      const v = claim.value;
      if (v.length < 3) { status.className = 'hint'; status.textContent = '3–20 символов: латиница, цифры и _ · можно занять до 10'; return; }
      t = setTimeout(async () => {
        const [{ data: u }, { data: c }] = await Promise.all([
          sb.from('usernames').select('name,sale_price').eq('name', v).maybeSingle(),
          sb.from('chats').select('id').eq('username', v).maybeSingle(),
        ]);
        if (claim.value !== v) return;
        const free = !u && !c;
        status.className = 'hint ' + (free ? 'ok' : 'err');
        status.textContent = free ? `@${v} свободен ✓` : u?.sale_price ? `@${v} продаётся на маркете за ${coins(u.sale_price)}` : `@${v} уже занят`;
      }, 300);
    });
    claimBtn.onclick = async () => {
      if (claim.value.length < 3) return toast('Минимум 3 символа', 'error');
      claimBtn.disabled = true;
      try { const n = await rpc('claim_username', { p_name: claim.value }); toast(`@${n} теперь твой`, 'success'); draw(); }
      catch { claimBtn.disabled = false; }
    };

    const rows = (data || []).map((r) => {
      const isPrimary = r.name === primary;
      const btns = [];
      if (!isPrimary) btns.push(h('button', { class: 'btn ghost small', onclick: async () => {
        try {
          await rpc('set_primary_username', { p_name: r.name });
          state.profile.username = r.name;
          window.dispatchEvent(new Event('sierra:profile'));
          toast(`Теперь твой основной ник — @${r.name}`, 'success'); draw();
        } catch {}
      } }, 'Сделать основным'));
      btns.push(r.sale_price
        ? h('button', { class: 'btn ghost small', onclick: async () => { try { await rpc('list_username', { p_name: r.name, p_price: null }); toast('Снято с продажи'); draw(); } catch {} } }, 'Снять с продажи')
        : h('button', { class: 'btn small', onclick: async () => {
          const p = await askPrice(r.name);
          if (!p) return;
          if (isPrimary && !(await confirmBox(`@${r.name} — твой основной ник. Если его купят, основным станет другой твой юзернейм. Продолжить?`, 'Выставить'))) return;
          try { await rpc('list_username', { p_name: r.name, p_price: p }); toast(`@${r.name} выставлен за ${coins(p)} SierCoin`, 'success'); draw(); } catch {}
        } }, 'Продать'));
      if (!isPrimary && !r.sale_price) btns.push(h('button', { class: 'btn ghost small danger-text', onclick: async () => {
        if (!(await confirmBox(`Освободить @${r.name}? Его сможет занять кто угодно.`, 'Освободить', true))) return;
        try { await rpc('release_username', { p_name: r.name }); toast('Освобождён'); draw(); } catch {}
      } }, 'Освободить'));
      return h('div', { class: 'row-item uname-row' },
        h('div', { class: 'uname-mini' }, '@'),
        h('div', { class: 'row-main' },
          h('b', {}, '@' + r.name,
            isPrimary ? h('span', { class: 'role-tag' }, 'основной') : h('span', { class: 'role-tag also' }, 'also'),
            r.sale_price ? h('span', { class: 'role-tag sale' }, 'в продаже · ' + coins(r.sale_price)) : null),
          h('span', { class: 'muted small' }, r.len + ' ' + (r.len === 3 || r.len === 4 ? 'символа' : 'символов'))),
        h('div', { class: 'row-btns wrap' }, btns));
    });

    box.replaceChildren(
      h('section', { class: 'panel' },
        h('h3', {}, 'Мои юзернеймы · ' + (data || []).length),
        h('p', { class: 'muted small', style: { marginBottom: '8px' } }, 'Основной показывается крупно в профиле, остальные — строкой «also @…». Любой можно выставить на маркет за свою цену.'),
        h('div', { class: 'list' }, rows)),
      h('section', { class: 'panel' },
        h('h3', {}, 'Занять свободный юзернейм'),
        h('div', { class: 'inline-form' }, h('div', { class: 'input-wrap', style: { flex: 1 } }, h('span', { class: 'prefix' }, '@'), claim), claimBtn),
        status));
  }
  await draw();
}

// «also @a, @b» под ником в профиле
export async function alsoUsernames(profile) {
  const { data } = await sb.from('usernames').select('name').eq('owner_id', profile.id).neq('name', profile.username).order('created_at');
  return (data || []).map((r) => r.name);
}

// Найти владельца по любому его юзернейму
export async function ownerOf(name) {
  const { data } = await sb.from('usernames').select('owner_id').eq('name', name).maybeSingle();
  return data?.owner_id || null;
}
