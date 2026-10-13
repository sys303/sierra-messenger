import { sb, state, h, icon, avatar, coins, rpc, toast, ruError, modal, confirmBox, timeAgo, emptyState, go } from './core.js';
import { supportAvatar } from './chats.js';
import { getCatalog, giftArt, loadNftAttrs, leftText } from './gifts.js';

const TABS = [
  ['overview', '📊 Обзор'], ['reports', '🚩 Жалобы'], ['support', '💬 Поддержка'],
  ['users', '👥 Пользователи'], ['coins', '🪙 SierCoin'], ['gifts', '🎁 Подарки'],
];

export async function renderAdmin(view, tab = 'overview') {
  if (!state.isAdmin) {
    view.append(emptyState('🔒', 'Нет доступа', 'Эта страница только для администратора'));
    return;
  }
  const body = h('div', {});
  view.append(
    h('div', { class: 'page-head' }, h('h1', {}, 'Админ-панель'), h('p', { class: 'muted' }, 'Управление Sierra Messenger')),
    h('div', { class: 'tabs' }, TABS.map(([k, l]) => h('a', { href: '#/admin/' + k, class: 'tab' + (k === tab ? ' active' : '') }, l))),
    body);
  const fn = { overview, reports, support, users, coinsTab, giftsTab }[tab === 'coins' ? 'coinsTab' : tab === 'gifts' ? 'giftsTab' : tab] || overview;
  await fn(body);
}

// ---------- Обзор ----------
async function overview(body) {
  let s;
  try { s = await rpc('admin_stats'); } catch { return; }
  const tile = (emoji, label, value, href) => h(href ? 'a' : 'div', { class: 'stat-tile', href },
    h('span', { class: 'st-emoji' }, emoji), h('b', {}, coins(value)), h('span', { class: 'muted small' }, label));
  body.append(h('div', { class: 'stat-grid' },
    tile('👥', 'пользователей', s.users, '#/admin/users'),
    tile('🟢', 'заходили за сутки', s.active_today),
    tile('🚩', 'открытых жалоб', s.open_reports, '#/admin/reports'),
    tile('💬', 'ждут ответа поддержки', s.support_waiting, '#/admin/support'),
    tile('⛔', 'заблокировано', s.banned, '#/admin/users'),
    tile('✉️', 'сообщений', s.messages),
    tile('📝', 'постов', s.posts),
    tile('🎁', 'подарков', s.gifts),
    tile('◆', 'NFT', s.nfts),
    tile('🪙', 'SierCoin у всех', s.coins, '#/admin/coins')));
}

// ---------- Жалобы ----------
const STATUS = { open: 'Открыта', resolved: 'Решена', rejected: 'Отклонена' };
const TYPE = { user: '👤 Пользователь', message: '💬 Сообщение', post: '📝 Пост', chat: '👥 Чат' };

async function reports(body) {
  let status = 'open';
  const filter = h('div', { class: 'shop-checks' });
  const list = h('div', {});
  body.append(filter, list);
  const drawFilter = () => filter.replaceChildren(...[['open', 'Открытые'], ['resolved', 'Решённые'], ['rejected', 'Отклонённые'], ['all', 'Все']].map(([k, l]) =>
    h('button', { class: 'check-chip' + (status === k ? ' on' : ''), onclick: () => { status = k; drawFilter(); load(); } }, l)));
  drawFilter();

  async function load() {
    list.replaceChildren(h('div', { class: 'muted pad' }, 'Загружаем…'));
    let rows;
    try { rows = await rpc('admin_reports', { p_status: status }); } catch { return; }
    if (!rows.length) return list.replaceChildren(emptyState('✅', 'Жалоб нет', status === 'open' ? 'Все жалобы обработаны' : ''));
    list.replaceChildren(...rows.map(reportCard));
  }

  function reportCard(r) {
    const snap = r.snapshot || {};
    const reply = h('textarea', { class: 'input', rows: 2, maxlength: 1000, placeholder: 'Ответ пользователю (придёт в его чат поддержки)' }, r.admin_reply || '');
    const act = (label, cls, fn) => {
      const b = h('button', { class: 'btn small ' + cls }, label);
      b.onclick = async () => { b.disabled = true; try { await fn(); } catch {} b.disabled = false; };
      return b;
    };
    const resolve = async (st) => {
      await rpc('admin_resolve_report', { p_id: r.id, p_status: st, p_reply: reply.value.trim() });
      toast(st === 'resolved' ? 'Жалоба решена' : st === 'rejected' ? 'Жалоба отклонена' : 'Жалоба открыта снова', 'success');
      load();
    };
    const content = r.target_type === 'user'
      ? h('div', {}, h('b', {}, snap.name || ''), ' @', snap.username || '', snap.bio ? h('p', { class: 'muted small' }, snap.bio) : null)
      : r.target_type === 'chat' ? h('div', {}, h('b', {}, snap.title || ''), snap.username ? ' @' + snap.username : '', snap.description ? h('p', { class: 'muted small' }, snap.description) : null)
      : h('div', {}, snap.text ? h('div', { class: 'quote-text' }, snap.text) : null,
          snap.image_url ? h('img', { class: 'report-img', src: snap.image_url, alt: '' }) : null);

    const extra = [];
    if (r.target_user && !r.target_banned) extra.push(act('⛔ Заблокировать автора', 'ghost danger-text', async () => {
      const reason = await askText('Причина блокировки', r.reason);
      if (reason === null) throw 0;
      await rpc('admin_ban', { p_user: r.target_user, p_reason: reason });
      toast('Пользователь заблокирован', 'success'); load();
    }));
    if (r.target_banned) extra.push(h('span', { class: 'gtag hid' }, 'автор заблокирован'));
    if (r.target_type === 'message' || r.target_type === 'post') extra.push(act('🗑 Удалить контент', 'ghost', async () => {
      if (!(await confirmBox('Удалить это ' + (r.target_type === 'post' ? 'пост' : 'сообщение') + ' у всех?', 'Удалить', true))) throw 0;
      const { error } = r.target_type === 'post'
        ? await sb.from('posts').delete().eq('id', r.target_id)
        : await sb.from('messages').delete().eq('id', Number(r.target_id));
      if (error) { toast(ruError(error), 'error'); throw error; }
      toast('Удалено', 'success');
    }));

    return h('article', { class: 'panel report-card' },
      h('div', { class: 'report-head' },
        h('span', { class: 'gtag ' + (r.status === 'open' ? 'sale' : r.status === 'resolved' ? 'epic' : 'hid') }, STATUS[r.status]),
        h('b', {}, `№${r.id} · ${TYPE[r.target_type] || r.target_type}`),
        h('span', { class: 'muted small' }, timeAgo(r.created_at))),
      h('div', { class: 'report-reason' }, '🚩 ', h('b', {}, r.reason), r.details ? h('span', { class: 'muted' }, ' — ' + r.details) : null),
      h('div', { class: 'report-people muted small' },
        'От: ', r.reporter_username ? h('a', { href: '#/u/' + r.reporter_username }, '@' + r.reporter_username) : '—',
        ' · На: ', r.target_username ? h('a', { href: '#/u/' + r.target_username }, '@' + r.target_username) : '—'),
      h('div', { class: 'report-content' }, content),
      reply,
      h('div', { class: 'report-actions' },
        r.status !== 'resolved' ? act('✅ Решено', '', () => resolve('resolved')) : null,
        r.status !== 'rejected' ? act('✖ Отклонить', 'ghost', () => resolve('rejected')) : null,
        r.status !== 'open' ? act('↺ Открыть снова', 'ghost', () => resolve('open')) : null,
        ...extra));
  }
  await load();
}

// ---------- Поддержка ----------
async function support(body) {
  let rows;
  try { rows = await rpc('admin_support_chats'); } catch { return; }
  if (!rows.length) return body.append(emptyState('💬', 'Обращений пока нет', 'Когда пользователь напишет в поддержку, чат появится здесь'));
  body.append(h('div', { class: 'panel list' }, rows.map((r) =>
    h('a', { class: 'row-item', href: '#/chat/' + r.chat_id },
      avatar(r.avatar_url, r.display_name, 46),
      h('div', { class: 'row-main' },
        h('b', {}, r.display_name, h('span', { class: 'muted small' }, '  @' + r.username)),
        h('span', { class: 'muted small ellipsis' }, r.last_text ? (r.last_kind === 'image' ? '📷 Фото' : r.last_text) : 'Пока без сообщений')),
      h('div', { class: 'row-btns' },
        r.waiting ? h('span', { class: 'gtag sale' }, 'ждёт ответа') : h('span', { class: 'gtag hid' }, 'отвечено'),
        h('span', { class: 'muted small' }, timeAgo(r.last_at)))))));
}

// ---------- Пользователи ----------
async function users(body) {
  const search = h('input', { class: 'input', placeholder: 'Ник, имя или почта' });
  const list = h('div', { class: 'panel list' });
  body.append(h('div', { class: 'search-box', style: { marginBottom: '12px' } }, icon('search'), search), list);
  async function load() {
    let rows;
    try { rows = await rpc('admin_users', { p_q: search.value.trim() }); } catch { return; }
    list.replaceChildren(...(rows.length ? rows.map(userRow) : [h('div', { class: 'muted pad' }, 'Никого не нашли')]));
  }
  function userRow(u) {
    const btns = [];
    btns.push(h('button', { class: 'btn ghost small', onclick: () => giveDialog(u.username, load) }, '🪙'));
    if (!u.is_admin) btns.push(u.is_banned
      ? h('button', { class: 'btn small', onclick: async () => { await rpc('admin_unban', { p_user: u.id }); toast('Разблокирован', 'success'); load(); } }, 'Разбанить')
      : h('button', { class: 'btn ghost small danger-text', onclick: async () => {
        const reason = await askText(`Заблокировать @${u.username}?`, '', 'Причина (увидит пользователь)');
        if (reason === null) return;
        try { await rpc('admin_ban', { p_user: u.id, p_reason: reason }); toast('Заблокирован', 'success'); load(); } catch {}
      } }, 'Бан'));
    return h('div', { class: 'row-item admin-user' + (u.is_banned ? ' banned' : '') },
      h('a', { href: '#/u/' + u.username }, avatar(u.avatar_url, u.display_name, 44)),
      h('a', { class: 'row-main', href: '#/u/' + u.username },
        h('b', {}, u.display_name, u.is_admin ? h('span', { class: 'role-tag' }, 'админ') : null, u.is_banned ? h('span', { class: 'role-tag ban' }, 'бан') : null),
        h('span', { class: 'muted small' }, '@' + u.username + (u.email ? ' · ' + u.email : '') + (u.phone ? ' · ' + u.phone : '')),
        h('span', { class: 'muted small' }, '🪙 ' + coins(u.balance) + ' · в Sierra с ' + new Date(u.created_at).toLocaleDateString('ru-RU')
          + (u.is_banned && u.ban_reason ? ' · причина: ' + u.ban_reason : ''))),
      h('div', { class: 'row-btns' }, btns));
  }
  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 300); });
  await load();
}

// ---------- SierCoin ----------
async function coinsTab(body) {
  const uname = h('input', { class: 'input with-prefix', placeholder: 'username' });
  const amount = h('input', { class: 'input', type: 'number', placeholder: 'Сумма (минус — списать)' });
  const note = h('input', { class: 'input', maxlength: 200, placeholder: 'Комментарий (необязательно)' });
  const give = h('button', { class: 'btn' }, 'Начислить');
  const self = h('button', { class: 'btn ghost' }, 'Себе');
  self.onclick = () => { uname.value = state.profile.username; amount.focus(); };
  give.onclick = async () => {
    const u = uname.value.trim().replace(/^@/, '');
    const a = Math.trunc(Number(amount.value));
    if (!u) return toast('Укажи @username', 'error');
    if (!a) return toast('Укажи сумму', 'error');
    give.disabled = true;
    try {
      const nb = await rpc('admin_give_coins', { p_username: u, p_amount: a, p_note: note.value.trim() });
      toast(`${a > 0 ? 'Начислено' : 'Списано'} ${coins(Math.abs(a))} SierCoin @${u}. Баланс: ${coins(nb)}`, 'success', 6000);
      amount.value = ''; note.value = '';
      if (u === state.profile.username) window.dispatchEvent(new CustomEvent('sierra:balance', { detail: nb }));
    } catch {}
    give.disabled = false;
  };
  body.append(h('section', { class: 'panel' },
    h('h3', {}, 'Выдать SierCoin'),
    h('p', { class: 'muted small', style: { marginBottom: '12px' } }, 'Пользователь получит уведомление в чате поддержки. Отрицательная сумма — списание.'),
    h('div', { class: 'field' }, h('label', {}, 'Кому'), h('div', { class: 'inline-form' }, h('div', { class: 'input-wrap', style: { flex: 1 } }, h('span', { class: 'prefix' }, '@'), uname), self)),
    h('div', { class: 'field' }, h('label', {}, 'Сумма'), amount),
    h('div', { class: 'field' }, h('label', {}, 'Комментарий'), note),
    h('div', { class: 'inline-form' }, ...[100, 500, 1000, 10000].map((v) => h('button', { class: 'check-chip', onclick: () => { amount.value = v; } }, '+' + coins(v)))),
    h('div', { style: { marginTop: '14px' } }, give)));
}

function giveDialog(username, after) {
  const amount = h('input', { class: 'input', type: 'number', placeholder: 'Сумма' });
  const note = h('input', { class: 'input', maxlength: 200, placeholder: 'Комментарий' });
  const ok = h('button', { class: 'btn' }, 'Начислить');
  const m = modal('SierCoin для @' + username, h('div', {}, h('div', { class: 'field' }, amount), h('div', { class: 'field' }, note), ok));
  amount.focus();
  ok.onclick = async () => {
    const a = Math.trunc(Number(amount.value));
    if (!a) return toast('Укажи сумму', 'error');
    ok.disabled = true;
    try {
      const nb = await rpc('admin_give_coins', { p_username: username, p_amount: a, p_note: note.value.trim() });
      toast(`Готово. Баланс @${username}: ${coins(nb)}`, 'success');
      if (username === state.profile.username) window.dispatchEvent(new CustomEvent('sierra:balance', { detail: nb }));
      m.close(); after?.();
    } catch { ok.disabled = false; }
  };
}

function askText(title, value = '', placeholder = 'Причина') {
  return new Promise((resolve) => {
    let done = false;
    const inp = h('input', { class: 'input', maxlength: 200, placeholder, value });
    const m = modal(title, h('div', {}, h('div', { class: 'field' }, inp),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
        h('button', { class: 'btn danger', onclick: () => { done = true; m.close(); resolve(inp.value.trim()); } }, 'Подтвердить'))),
      { onClose: () => { if (!done) resolve(null); } });
    inp.focus();
  });
}

// Быстрые действия админа в чужом профиле
export function adminProfileActions(p) {
  if (!state.isAdmin || p.id === state.me.id) return [];
  return [
    h('button', { class: 'btn ghost small', onclick: () => giveDialog(p.username) }, '🪙 Выдать'),
    h('button', { class: 'btn ghost small danger-text', onclick: async () => {
      const { data } = await sb.from('bans').select('user_id').eq('user_id', p.id).maybeSingle();
      if (data) {
        if (!(await confirmBox(`Разблокировать @${p.username}?`, 'Разбанить'))) return;
        try { await rpc('admin_unban', { p_user: p.id }); toast('Разблокирован', 'success'); } catch {}
      } else {
        const reason = await askText(`Заблокировать @${p.username}?`, '', 'Причина (увидит пользователь)');
        if (reason === null) return;
        try { await rpc('admin_ban', { p_user: p.id, p_reason: reason }); toast('Заблокирован', 'success'); } catch {}
      }
    } }, '⛔ Бан / разбан'),
  ];
}

export { supportAvatar, go };

// ---------- Выдать подарок ----------
async function giftsTab(body) {
  await Promise.all([getCatalog(true), loadNftAttrs()]);
  const cat = await getCatalog();
  let chosen = null;
  const uname = h('input', { class: 'input with-prefix', placeholder: 'username' });
  const self = h('button', { class: 'btn ghost small' }, 'Себе');
  self.onclick = () => { uname.value = state.profile.username; };
  const nft = h('input', { type: 'checkbox' });
  const msg = h('input', { class: 'input', maxlength: 255, placeholder: 'Подпись (необязательно)' });
  const picked = h('div', { class: 'admin-picked muted' }, 'Подарок не выбран — выбери ниже');
  const give = h('button', { class: 'btn' }, '🎁 Выдать подарок');
  const search = h('input', { class: 'input', placeholder: 'Поиск подарка…' });
  const grid = h('div', { class: 'gift-grid small pick-gifts' });

  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const list = cat.filter((g) => !q || g.name.toLowerCase().includes(q)).sort((a, b) => b.price - a.price).slice(0, 80);
    grid.replaceChildren(...list.map((g) => {
      const c = h('button', { class: 'gift-card' + (chosen?.id === g.id ? ' chosen' : '') },
        giftArt(g, null, 72), h('b', { class: 'gift-name' }, g.name),
        h('span', { class: 'price' }, icon('coin', 'ico sm'), coins(g.price)),
        g.total_supply ? h('span', { class: 'muted small' }, leftText(g)) : null);
      c.onclick = () => {
        chosen = g;
        picked.replaceChildren(giftArt(g, null, 44), h('b', {}, g.name), h('span', { class: 'muted small' }, ' · ' + coins(g.price) + ' SierCoin'));
        picked.classList.remove('muted');
        draw();
      };
      return c;
    }));
  };
  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(draw, 200); });
  give.onclick = async () => {
    const u = uname.value.trim().replace(/^@/, '');
    if (!u) return toast('Укажи @username', 'error');
    if (!chosen) return toast('Выбери подарок', 'error');
    give.disabled = true;
    try {
      await rpc('admin_give_gift', { p_username: u, p_gift: chosen.id, p_upgrade: nft.checked, p_message: msg.value.trim() });
      toast(`«${chosen.name}»${nft.checked ? ' (NFT)' : ''} выдан @${u} ✓`, 'success', 6000);
      msg.value = '';
    } catch {}
    give.disabled = false;
  };

  body.append(
    h('section', { class: 'panel' },
      h('h3', {}, 'Выдать подарок'),
      h('p', { class: 'muted small', style: { marginBottom: '12px' } }, 'Подарок бесплатный и выдаётся даже если лимит исчерпан. Получатель увидит его в профиле и в чате поддержки.'),
      h('div', { class: 'field' }, h('label', {}, 'Кому'),
        h('div', { class: 'inline-form' }, h('div', { class: 'input-wrap', style: { flex: 1 } }, h('span', { class: 'prefix' }, '@'), uname), self)),
      h('div', { class: 'field' }, h('label', {}, 'Подпись'), msg),
      h('label', { class: 'upgrade-box' }, nft, h('div', {}, h('b', {}, '✨ Сразу сделать NFT'), h('span', { class: 'muted small' }, 'Случайная модель, фон и символ'))),
      h('div', { class: 'field', style: { marginTop: '12px' } }, picked),
      give),
    h('section', { class: 'panel' }, h('h3', {}, 'Выбери подарок'), h('div', { class: 'field' }, search), grid));
  draw();
}
