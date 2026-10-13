import {
  sb, state, h, icon, avatar, coins, rpc, toast, ruError, modal, confirmBox, pickUser, uploadImage,
  pickFile, timeShort, lastSeenText, chatTitle, go, emptyState, pickChats, openReport, openSupport,
} from './core.js';
import { EMOJI } from './emoji.js';
import { giftArt, openGiftById, findGift, chooseGiftFor } from './gifts.js';
import { openSendCoins } from './wallet.js';
import { openImage, postPreview } from './feed.js';

let listEl = null;          // контейнер списка чатов (если открыт)
let active = null;          // открытый чат
const people = new Map();   // кэш профилей отправителей

// ---------- Список чатов ----------
let refreshTimer;
export function refreshChatList() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    const { data, error } = await sb.rpc('my_chats');
    if (error) return;
    state.chats = data || [];
    const unread = state.chats.reduce((s, c) => s + Number(c.unread || 0), 0);
    window.dispatchEvent(new CustomEvent('sierra:unread', { detail: unread }));
    if (listEl && listEl.isConnected) drawList();
  }, 150);
}

function lastPreview(c) {
  const who = c.last_sender === state.me.id ? 'Вы: ' : '';
  switch (c.last_kind) {
    case 'image': return who + '📷 Фото';
    case 'gift': return who + '🎁 Подарок';
    case 'coins': return who + '🪙 Перевод SierCoin';
    case 'post': return who + '📝 Пост';
    case 'system': return c.last_text || '';
    default: return who + (c.last_text || '');
  }
}

let listFilter = '';
function drawList() {
  const q = listFilter.toLowerCase();
  const rows = state.chats
    .filter((c) => !q || chatTitle(c).toLowerCase().includes(q) || (c.peer_username || c.username || '').includes(q))
    .map((c) => {
      const title = chatTitle(c);
      const isOnline = c.type === 'direct' && state.online.has(c.peer_id);
      const row = h('a', { href: '#/chat/' + c.id, class: 'chat-row' + (active && active.id === c.id ? ' active' : '') },
        c.type === 'direct'
          ? avatar(c.peer_avatar, title, 50, { online: isOnline })
          : c.type === 'support' ? supportAvatar(50) : avatar(c.avatar_url, title, 50),
        h('div', { class: 'chat-row-main' },
          h('div', { class: 'chat-row-top' },
            h('b', { class: 'ellipsis' },
              c.type === 'group' ? icon('users', 'ico xs') : c.type === 'channel' ? icon('megaphone', 'ico xs') : c.type === 'support' ? icon('info', 'ico xs') : null, title),
            h('span', { class: 'muted small' }, timeShort(c.last_at))),
          h('div', { class: 'chat-row-bottom' },
            h('span', { class: 'muted ellipsis' }, lastPreview(c)),
            Number(c.unread) ? h('span', { class: 'badge' }, c.unread > 99 ? '99+' : c.unread) : null)));
      return row;
    });
  listEl.replaceChildren(...(rows.length ? rows : [emptyState('💬', state.chats.length ? 'Ничего не найдено' : 'Чатов пока нет',
    state.chats.length ? '' : 'Найди друга в поиске или создай группу',
    state.chats.length ? null : h('a', { class: 'btn small', href: '#/search' }, 'Найти людей'))]));
}

// ---------- Раздел «Чаты» ----------
export async function renderChats(view, chatId) {
  view.classList.add('no-pad');
  const filter = h('input', { class: 'input', placeholder: 'Поиск по чатам', value: listFilter });
  filter.addEventListener('input', () => { listFilter = filter.value.trim(); drawList(); });

  const newBtn = h('button', { class: 'icon-btn accent', title: 'Создать' }, icon('plus'));
  newBtn.onclick = () => openNewMenu(newBtn);

  listEl = h('div', { class: 'chat-list' });
  const pane = h('section', { class: 'chat-pane' });
  view.append(h('div', { class: 'chats-layout' },
    h('aside', { class: 'chat-list-pane' },
      h('div', { class: 'chat-list-head' }, h('h2', {}, 'Чаты'), newBtn),
      h('div', { class: 'chat-list-search' }, filter),
      listEl),
    pane));

  if (state.chats.length) drawList(); else listEl.append(h('div', { class: 'muted pad' }, 'Загружаем…'));
  refreshChatList();

  const onPresence = () => { drawList(); active?.updateStatus?.(); };
  window.addEventListener('sierra:presence', onPresence);

  if (chatId) await openChat(pane, chatId);
  else pane.append(h('div', { class: 'chat-placeholder' }, h('div', { class: 'big' }, '💬'), h('p', { class: 'muted' }, 'Выбери чат слева или начни новый')));

  return () => {
    window.removeEventListener('sierra:presence', onPresence);
    view.classList.remove('no-pad');
    active?.destroy?.();
    active = null;
    listEl = null;
  };
}

function openNewMenu(anchor) {
  const m = modal('Создать', h('div', { class: 'stack' },
    h('button', { class: 'menu-item', onclick: async () => {
      m.close();
      const u = await pickUser({ title: 'Написать человеку' });
      if (u) { const id = await rpc('get_or_create_direct', { other: u.id }); go('#/chat/' + id); }
    } }, icon('user'), h('div', {}, h('b', {}, 'Личное сообщение'), h('span', { class: 'muted small' }, 'Чат один на один'))),
    h('button', { class: 'menu-item', onclick: () => { m.close(); openCreateChat('group'); } },
      icon('users'), h('div', {}, h('b', {}, 'Новая группа'), h('span', { class: 'muted small' }, 'Общение с друзьями, до сотен человек'))),
    h('button', { class: 'menu-item', onclick: () => { m.close(); openCreateChat('channel'); } },
      icon('megaphone'), h('div', {}, h('b', {}, 'Новый канал'), h('span', { class: 'muted small' }, 'Пишут только админы, остальные читают'))),
    h('button', { class: 'menu-item', onclick: () => { m.close(); openSupport(); } },
      icon('info'), h('div', {}, h('b', {}, 'Написать в поддержку'), h('span', { class: 'muted small' }, 'Вопрос или проблема — ответит администрация')))));
}

export function openCreateChat(type) {
  const isGroup = type === 'group';
  const title = h('input', { class: 'input', maxlength: 64, placeholder: isGroup ? 'Название группы' : 'Название канала' });
  const desc = h('textarea', { class: 'input', maxlength: 255, rows: 2, placeholder: 'Описание (необязательно)' });
  const pub = h('input', { type: 'checkbox' });
  const uname = h('input', { class: 'input with-prefix', maxlength: 32, placeholder: 'ssylka_na_chat' });
  const unameWrap = h('div', { class: 'field', hidden: true },
    h('label', {}, 'Публичная ссылка (для поиска)'),
    h('div', { class: 'input-wrap' }, h('span', { class: 'prefix' }, '@'), uname),
    h('div', { class: 'hint' }, '4–32 символа: латиница, цифры и _'));
  pub.onchange = () => { unameWrap.hidden = !pub.checked; };
  uname.addEventListener('input', () => { uname.value = uname.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); });

  let members = [];
  const memberBox = h('div', { class: 'chips' });
  const drawMembers = () => memberBox.replaceChildren(...members.map((u) =>
    h('span', { class: 'chip-user' }, avatar(u.avatar_url, u.display_name, 22), u.display_name,
      h('button', { class: 'chip-x', onclick: () => { members = members.filter((x) => x.id !== u.id); drawMembers(); } }, '×'))));
  const addBtn = h('button', { class: 'btn ghost small', type: 'button' }, icon('plus'), isGroup ? ' Добавить участников' : ' Добавить подписчиков');
  addBtn.onclick = async () => {
    const picked = await pickUser({ title: 'Кого добавить?', multi: true, exclude: members.map((m) => m.id) });
    members = [...members, ...picked];
    drawMembers();
  };

  const create = h('button', { class: 'btn' }, isGroup ? 'Создать группу' : 'Создать канал');
  const m = modal(isGroup ? 'Новая группа' : 'Новый канал', h('div', {},
    h('div', { class: 'field' }, title),
    h('div', { class: 'field' }, desc),
    h('label', { class: 'switch-row' }, pub, h('span', {}, 'Публичный — можно найти в поиске и вступить')),
    unameWrap,
    h('div', { class: 'field' }, addBtn, memberBox),
    create));
  title.focus();
  create.onclick = async () => {
    if (!title.value.trim()) return toast('Введи название', 'error');
    create.disabled = true;
    try {
      const id = await rpc('create_chat', {
        p_type: type, p_title: title.value.trim(), p_username: pub.checked ? uname.value : null,
        p_description: desc.value.trim(), p_is_public: pub.checked, p_members: members.map((u) => u.id),
      });
      m.close();
      toast(isGroup ? 'Группа создана' : 'Канал создан', 'success');
      refreshChatList();
      go('#/chat/' + id);
    } catch { create.disabled = false; }
  };
}

// ---------- Открытый чат ----------
async function openChat(pane, chatId) {
  const { data: chat, error } = await sb.from('chats').select('*').eq('id', chatId).maybeSingle();
  if (error || !chat) {
    pane.append(h('div', { class: 'chat-placeholder' }, h('div', { class: 'big' }, '🔒'),
      h('p', { class: 'muted' }, error ? ruError(error) : 'Чат не найден или закрыт')));
    return;
  }
  const { data: myRow } = await sb.from('chat_members').select('role').eq('chat_id', chatId).eq('user_id', state.me.id).maybeSingle();
  let role = myRow?.role || null;
  const isSupport = chat.type === 'support';
  const supportStaff = isSupport && state.isAdmin && chat.support_user !== state.me.id;  // админ отвечает пользователю
  if (isSupport && state.isAdmin && !role) role = 'admin';
  const { count: memberCount } = await sb.from('chat_members').select('*', { count: 'exact', head: true }).eq('chat_id', chatId);

  let peer = null;
  if (chat.type === 'direct') {
    const { data: mem } = await sb.from('chat_members').select('user_id').eq('chat_id', chatId).neq('user_id', state.me.id).limit(1);
    const pid = mem?.[0]?.user_id;
    if (pid) {
      const { data: pp } = await sb.from('profiles').select('id,username,display_name,avatar_url,last_seen').eq('id', pid).maybeSingle();
      peer = pp || null;
    }
    if (peer) people.set(peer.id, peer);
  }
  let supportUser = null;
  if (supportStaff) {
    const { data: su } = await sb.from('profiles').select('id,username,display_name,avatar_url,last_seen').eq('id', chat.support_user).maybeSingle();
    supportUser = su; if (su) people.set(su.id, su);
  }
  people.set(state.me.id, state.profile);

  const title = chat.type === 'direct' ? (peer?.display_name || 'Пользователь')
    : supportStaff ? 'Поддержка: ' + (supportUser?.display_name || 'пользователь') : chat.title;
  const sub = h('span', { class: 'muted small' });
  const typingEl = h('span', { class: 'typing', hidden: true });
  const updateStatus = () => {
    if (chat.type === 'direct') sub.textContent = peer ? lastSeenText(peer.id, peer.last_seen) : '';
    else if (isSupport) sub.textContent = supportStaff ? '@' + (supportUser?.username || '') + ' · ' + lastSeenText(chat.support_user, supportUser?.last_seen) : 'администрация Sierra Messenger';
    else sub.textContent = `${coins(memberCount || 0)} ${chat.type === 'channel' ? 'подписчиков' : 'участников'}`;
  };
  updateStatus();

  const headAvatar = chat.type === 'direct' ? avatar(peer?.avatar_url, title, 42)
    : supportStaff ? avatar(supportUser?.avatar_url, supportUser?.display_name, 42) : isSupport ? supportAvatar(42) : avatar(chat.avatar_url, title, 42);
  const headClick = () => chat.type === 'direct' ? peer && go('#/u/' + peer.username)
    : supportStaff ? supportUser && go('#/u/' + supportUser.username) : isSupport ? null : openChatInfo(chat, role);
  const head = h('header', { class: 'chat-head' },
    h('a', { class: 'icon-btn back-btn', href: supportStaff ? '#/admin/support' : '#/chats' }, icon('back')),
    h('button', { class: 'chat-head-info', onclick: headClick },
      headAvatar,
      h('div', { class: 'chat-head-text' }, h('b', { class: 'ellipsis' }, title), sub, typingEl)),
    chat.type === 'group' || chat.type === 'channel' ? h('button', { class: 'icon-btn', title: 'Информация', onclick: () => openChatInfo(chat, role) }, icon('info')) : null);

  const msgs = h('div', { class: 'msgs' });
  const scroller = h('div', { class: 'msgs-scroll' }, msgs);
  const bottom = h('div', { class: 'chat-bottom' });
  pane.append(head, scroller, bottom);

  // ----- сообщения -----
  const rendered = new Map(); // id → элемент
  const reactions = new Map(); // id сообщения → Map(user_id → emoji)
  let oldestId = null;
  let loadingOlder = false;
  let replyTo = null;

  async function ensurePeople(list) {
    const missing = [...new Set(list.map((m) => m.sender_id).filter((id) => id && !people.has(id)))];
    if (!missing.length) return;
    const { data } = await sb.from('profiles').select('id,username,display_name,avatar_url').in('id', missing);
    (data || []).forEach((p) => people.set(p.id, p));
  }

  async function loadMessages(before = null) {
    let q = sb.from('messages').select('*').eq('chat_id', chatId).order('id', { ascending: false }).limit(50);
    if (before) q = q.lt('id', before);
    const { data, error } = await q;
    if (error) { toast(ruError(error), 'error'); return []; }
    const list = (data || []).reverse();
    await ensurePeople(list);
    if (list.length) {
      const { data: rs } = await sb.from('message_reactions').select('message_id,user_id,emoji').in('message_id', list.map((m) => m.id));
      (rs || []).forEach((r) => {
        if (!reactions.has(r.message_id)) reactions.set(r.message_id, new Map());
        reactions.get(r.message_id).set(r.user_id, r.emoji);
      });
    }
    return list;
  }

  function dayLabel(ts) {
    const d = new Date(ts), now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Сегодня';
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Вчера';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }

  function bubble(m) {
    const mine = m.sender_id === state.me.id;
    const sender = people.get(m.sender_id);
    if (m.kind === 'system') {
      return h('div', { class: 'msg-system', 'data-id': m.id, 'data-day': new Date(m.created_at).toDateString() }, m.text);
    }
    let content;
    if (m.kind === 'gift') {
      const meta = m.meta || {};
      content = h('button', { class: 'gift-msg-card', onclick: () => meta.user_gift && openGiftById(meta.user_gift) },
        giftArt(findGift(meta.gift_id) || findGift(meta.emoji) || { emoji: meta.emoji }, null, 84),
        meta.nft ? h('span', { class: 'gtag nft inline' }, 'NFT') : null,
        h('b', {}, (meta.nft ? 'NFT ' : 'Подарок ') + (meta.name || '')),
        meta.price ? h('span', { class: 'muted small' }, coins(meta.price) + ' SierCoin') : null,
        m.text ? h('span', { class: 'gift-msg-text' }, m.text) : null,
        h('span', { class: 'small accent' }, 'Посмотреть'));
    } else if (m.kind === 'coins') {
      content = h('div', { class: 'coins-msg' },
        h('div', { class: 'coins-msg-top' }, '🪙', h('b', {}, '+' + coins(m.meta?.amount) + ' SierCoin')),
        h('span', { class: 'muted small' }, mine ? 'Ты отправил перевод' : 'Перевод для тебя'),
        m.text ? h('span', {}, m.text) : null);
    } else if (m.kind === 'post') {
      const holder = h('div', { class: 'post-holder' });
      if (m.meta?.post_id) postPreview(m.meta.post_id).then((card) => holder.replaceChildren(card));
      content = h('div', {}, holder, m.text ? h('div', { class: 'msg-text', style: { marginTop: '6px' } }, m.text) : null);
    } else {
      content = h('div', {},
        m.image_url ? h('img', { class: 'msg-img', src: m.image_url, alt: '', loading: 'lazy', onclick: (e) => { e.stopPropagation(); openImage(m.image_url); } }) : null,
        m.text ? h('div', { class: 'msg-text' }, m.text) : null);
    }
    const fwd = m.meta && m.meta.fwd_name ? h('a', {
      class: 'fwd-from', href: m.meta.fwd_chat ? '#/chat/' + m.meta.fwd_chat : m.meta.fwd_username ? '#/u/' + m.meta.fwd_username : null,
    }, icon('send', 'ico xs'), 'Переслано от ', h('b', {}, m.meta.fwd_name)) : null;
    const reply = m.reply_to ? replyQuote(m.reply_to) : null;
    const fromSupport = isSupport && !mine && (supportStaff ? m.sender_id !== chat.support_user : true);
    const showName = !mine && (chat.type === 'group' || isSupport);
    const nameEl = !showName ? null : fromSupport
      ? h('span', { class: 'msg-name support-name' }, 'Поддержка Sierra ✓')
      : h('a', { class: 'msg-name', href: '#/u/' + (sender?.username || '') }, sender?.display_name || 'Пользователь');
    const avEl = !showName ? null : fromSupport ? h('span', { class: 'msg-av' }, supportAvatar(30))
      : h('a', { href: '#/u/' + (sender?.username || ''), class: 'msg-av' }, avatar(sender?.avatar_url, sender?.display_name, 30));
    const special = m.kind !== 'text' && m.kind !== 'image' && m.kind !== 'post';
    const el = h('div', { class: 'msg ' + (mine ? 'out' : 'in') + (special ? ' special' : ''), 'data-id': m.id, 'data-day': new Date(m.created_at).toDateString() },
      avEl,
      h('div', { class: 'bubble-wrap' },
        h('div', { class: 'bubble' },
          nameEl, fwd, reply, content,
          h('span', { class: 'msg-time' }, m.edited_at ? 'изм. ' : '', new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))),
        reactionRow(m.id)));
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); msgMenu(m, el); });
    const b = el.querySelector('.bubble');
    let clickTimer = null;
    b.addEventListener('click', (e) => {
      if (e.target.closest('a,button,img,.post-holder')) return;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => msgMenu(m, el), 260);
    });
    b.addEventListener('dblclick', (e) => {
      if (e.target.closest('a,button,img')) return;
      clearTimeout(clickTimer);
      toggleReaction(m.id, '❤️');
    });
    return el;
  }

  // ----- реакции -----
  function reactionRow(id) {
    const map = reactions.get(id);
    const row = h('div', { class: 'reactions' });
    if (!map || !map.size) return row;
    const counts = new Map();
    for (const e of map.values()) counts.set(e, (counts.get(e) || 0) + 1);
    const my = map.get(state.me.id);
    for (const [e, n] of counts) {
      row.append(h('button', { class: 'react-chip' + (e === my ? ' mine' : ''), onclick: (ev) => { ev.stopPropagation(); toggleReaction(id, e); } },
        h('span', {}, e), n > 1 ? h('b', {}, n) : null));
    }
    return row;
  }
  function redrawReactions(id) {
    const el = rendered.get(id);
    if (!el) return;
    el.querySelector('.reactions')?.replaceWith(reactionRow(id));
  }
  async function toggleReaction(id, emoji) {
    if (!role || state.banned) return;
    if (!reactions.has(id)) reactions.set(id, new Map());
    const map = reactions.get(id);
    const prev = map.get(state.me.id);
    let error;
    if (prev === emoji) {
      map.delete(state.me.id); redrawReactions(id);
      ({ error } = await sb.from('message_reactions').delete().eq('message_id', id).eq('user_id', state.me.id));
    } else {
      map.set(state.me.id, emoji); redrawReactions(id);
      const el = rendered.get(id);
      el?.classList.add('react-pop'); setTimeout(() => el?.classList.remove('react-pop'), 500);
      ({ error } = await sb.from('message_reactions').upsert({ message_id: id, user_id: state.me.id, emoji }, { onConflict: 'message_id,user_id' }));
    }
    if (error) {
      if (prev) map.set(state.me.id, prev); else map.delete(state.me.id);
      redrawReactions(id);
      toast(ruError(error), 'error');
    }
  }

  function replyQuote(id) {
    const q = h('div', { class: 'reply-quote' }, '…');
    const src = rendered.get(id);
    const fill = (txt, name) => q.replaceChildren(h('b', {}, name || ''), h('span', {}, txt || '📎'));
    if (src && src._m) fill(src._m.text || (src._m.image_url ? '📷 Фото' : ''), people.get(src._m.sender_id)?.display_name);
    else sb.from('messages').select('text,image_url,sender_id').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) fill(data.text || (data.image_url ? '📷 Фото' : ''), people.get(data.sender_id)?.display_name || '');
      else fill('Сообщение удалено', '');
    });
    q.onclick = (e) => { e.stopPropagation(); rendered.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); rendered.get(id)?.classList.add('flash'); setTimeout(() => rendered.get(id)?.classList.remove('flash'), 1200); };
    return q;
  }

  function insertMessages(list, atTop = false) {
    const frag = document.createDocumentFragment();
    let lastDay = atTop ? null : msgs.lastElementChild?.dataset?.day;
    for (const m of list) {
      if (rendered.has(m.id)) continue;
      const day = new Date(m.created_at).toDateString();
      if (day !== lastDay) { frag.append(h('div', { class: 'day-sep', 'data-day': day }, h('span', {}, dayLabel(m.created_at)))); lastDay = day; }
      const el = bubble(m);
      el._m = m;
      rendered.set(m.id, el);
      frag.append(el);
    }
    if (atTop) {
      const first = msgs.firstElementChild;
      if (first && first.classList.contains('day-sep') && frag.lastChild?.dataset?.day === first.dataset.day) first.remove();
      msgs.prepend(frag);
    } else msgs.append(frag);
  }

  const atBottom = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
  const toBottom = (smooth = false) => scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });

  if (role || chat.is_public) {
    const first = await loadMessages();
    oldestId = first[0]?.id ?? null;
    if (!first.length) msgs.append(h('div', { class: 'msg-system' }, chat.type === 'direct' ? 'Напиши первое сообщение 👋' : 'Сообщений пока нет'));
    insertMessages(first);
    requestAnimationFrame(() => toBottom());
  }
  if (!role && chat.is_public) {
    // RLS не показывает сообщения не участникам
    msgs.replaceChildren(h('div', { class: 'msg-system' }, chat.description || 'Вступи, чтобы читать и писать сообщения'));
  }

  scroller.addEventListener('scroll', async () => {
    if (scroller.scrollTop > 80 || loadingOlder || !oldestId || !role) return;
    loadingOlder = true;
    const prevH = scroller.scrollHeight;
    const older = await loadMessages(oldestId);
    if (older.length) {
      oldestId = older[0].id;
      insertMessages(older, true);
      scroller.scrollTop = scroller.scrollHeight - prevH;
    } else oldestId = null;
    loadingOlder = false;
  });

  // ----- меню сообщения -----
  function msgMenu(m, el) {
    if (m.kind === 'system') return;
    const mine = m.sender_id === state.me.id;
    const items = [];
    if (canPost()) items.push(['reply', 'Ответить', () => setReply(m)]);
    if (['text', 'image', 'post'].includes(m.kind)) items.push(['send', 'Переслать', async () => {
      const chats = await pickChats('Переслать в…');
      if (!chats.length) return;
      try {
        const n = await rpc('forward_messages', { p_ids: [m.id], p_chats: chats });
        toast(n ? 'Переслано ✓' : 'Не удалось переслать', n ? 'success' : 'error');
        refreshChatList();
      } catch {}
    }]);
    if (m.text) items.push(['check', 'Копировать текст', () => { navigator.clipboard?.writeText(m.text); toast('Скопировано'); }]);
    if (mine && m.kind === 'text') items.push(['edit', 'Изменить', () => editMessage(m, el)]);
    if (mine || role === 'owner' || role === 'admin' || state.isAdmin) items.push(['trash', 'Удалить', async () => {
      if (!(await confirmBox('Удалить сообщение у всех?', 'Удалить', true))) return;
      const { error } = await sb.from('messages').delete().eq('id', m.id);
      if (error) return toast(ruError(error), 'error');
      removeBubble(m.id);
      refreshChatList();
    }]);
    if (!mine && !isSupport && m.sender_id) items.push(['info', 'Пожаловаться', () => openReport('message', m.id)]);
    const quick = role && !state.banned ? h('div', { class: 'react-bar' }, ['👍', '❤️', '🔥', '😂', '😮', '😢', '🎉', '👏'].map((e) =>
      h('button', { class: 'react-btn' + (reactions.get(m.id)?.get(state.me.id) === e ? ' on' : ''), onclick: () => { mm.close(); toggleReaction(m.id, e); } }, e))) : null;
    if (!items.length && !quick) return;
    const mm = modal('Сообщение', h('div', {}, quick, h('div', { class: 'stack' }, items.map(([ic, label, fn]) =>
      h('button', { class: 'menu-item', onclick: () => { mm.close(); fn(); } }, icon(ic), h('b', {}, label))))));
  }

  function removeBubble(id) {
    const el = rendered.get(id);
    if (!el) return;
    el.classList.add('removing');
    setTimeout(() => el.remove(), 200);
    rendered.delete(id);
  }

  function editMessage(m, el) {
    const inp = h('textarea', { class: 'input', maxlength: 4000, rows: 3 }, m.text);
    const save = h('button', { class: 'btn' }, 'Сохранить');
    const mm = modal('Изменить сообщение', h('div', {}, inp, h('div', { class: 'modal-actions' }, save)));
    inp.focus();
    save.onclick = async () => {
      const t = inp.value.trim();
      if (!t) return toast('Сообщение не может быть пустым', 'error');
      const { error } = await sb.from('messages').update({ text: t, edited_at: new Date().toISOString() }).eq('id', m.id);
      if (error) return toast(ruError(error), 'error');
      mm.close();
      replaceBubble({ ...m, text: t, edited_at: new Date().toISOString() });
    };
  }

  function replaceBubble(m) {
    const old = rendered.get(m.id);
    if (!old) return;
    const nb = bubble(m);
    nb._m = m;
    old.replaceWith(nb);
    rendered.set(m.id, nb);
  }

  // ----- нижняя панель -----
  const canPost = () => role && (chat.type !== 'channel' || role === 'owner' || role === 'admin');
  const replyBar = h('div', { class: 'reply-bar', hidden: true });
  function setReply(m) {
    replyTo = m;
    replyBar.hidden = false;
    replyBar.replaceChildren(icon('reply'),
      h('div', { class: 'row-main' }, h('b', { class: 'accent' }, people.get(m.sender_id)?.display_name || ''), h('span', { class: 'ellipsis muted' }, m.text || '📷 Фото')),
      h('button', { class: 'icon-btn tiny', onclick: () => { replyTo = null; replyBar.hidden = true; } }, icon('close')));
    textEl?.focus();
  }

  let textEl = null;
  let typingChannel = null;
  function drawBottom() {
    bottom.replaceChildren();
    if (state.banned && !isSupport) {
      bottom.append(h('div', { class: 'chat-bottom-note muted' }, '⛔ Аккаунт заблокирован — писать можно только в поддержку'));
      return;
    }
    if (!role) {
      if (chat.is_public) {
        const join = h('button', { class: 'btn' }, chat.type === 'channel' ? 'Подписаться' : 'Вступить в группу');
        join.onclick = async () => {
          join.disabled = true;
          try {
            await rpc('join_chat', { c: chat.id });
            toast(chat.type === 'channel' ? 'Ты подписался на канал' : 'Ты в группе!', 'success');
            refreshChatList();
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          } catch { join.disabled = false; }
        };
        bottom.append(h('div', { class: 'chat-bottom-note' }, join));
      } else bottom.append(h('div', { class: 'chat-bottom-note muted' }, 'Ты не участник этого чата'));
      return;
    }
    if (!canPost()) {
      bottom.append(h('div', { class: 'chat-bottom-note muted' }, '📢 В канале пишут только админы'));
      return;
    }
    textEl = h('textarea', { class: 'msg-input', rows: 1, maxlength: 4000, placeholder: 'Сообщение' });
    const send = h('button', { class: 'send-btn', title: 'Отправить' }, icon('send'));
    const attach = h('button', { class: 'icon-btn', title: 'Фото' }, icon('image'));
    const emojiBtn = h('button', { class: 'icon-btn emoji-btn', title: 'Эмодзи' }, h('span', { class: 'emo-ico' }, '😊'));
    const emojiPanel = emojiPicker((e) => {
      const st = textEl.selectionStart ?? textEl.value.length, en = textEl.selectionEnd ?? st;
      textEl.value = textEl.value.slice(0, st) + e + textEl.value.slice(en);
      textEl.selectionStart = textEl.selectionEnd = st + e.length;
      textEl.dispatchEvent(new Event('input'));
      textEl.focus();
    });
    emojiBtn.onclick = (ev) => { ev.stopPropagation(); emojiPanel.hidden = !emojiPanel.hidden; };
    const extras = chat.type === 'direct' && peer ? [
      h('button', { class: 'icon-btn', title: 'Подарить подарок', onclick: () => chooseGiftFor(peer) }, icon('gift')),
      h('button', { class: 'icon-btn', title: 'Перевести SierCoin', onclick: () => openSendCoins(peer) }, icon('coin')),
    ] : [];

    let lastTyping = 0;
    textEl.addEventListener('input', () => {
      textEl.style.height = 'auto';
      textEl.style.height = Math.min(textEl.scrollHeight, 160) + 'px';
      if (typingChannel && Date.now() - lastTyping > 2500) {
        lastTyping = Date.now();
        typingChannel.send({ type: 'broadcast', event: 'typing', payload: { id: state.me.id, name: state.profile.display_name } });
      }
    });
    textEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.innerWidth > 700) { e.preventDefault(); sendText(); }
    });
    send.onclick = sendText;
    attach.onclick = async () => {
      const f = await pickFile();
      if (!f) return;
      const caption = textEl.value.trim();
      attach.disabled = true;
      toast('Загружаем фото…');
      try {
        const url = await uploadImage(f, 'chats');
        await insertMessage({ kind: 'image', image_url: url, text: caption });
        textEl.value = '';
      } catch (e) { toast(ruError(e), 'error'); }
      attach.disabled = false;
    };

    let sending = false;
    async function sendText() {
      const t = textEl.value.trim();
      if (!t || sending) return;
      sending = true;
      send.disabled = true;
      textEl.value = '';
      textEl.style.height = 'auto';
      const ok = await insertMessage({ kind: 'text', text: t });
      if (ok === false && !textEl.value) textEl.value = t;   // вернуть текст, если не ушло
      sending = false;
      send.disabled = false;
      textEl.focus();
    }

    bottom.append(replyBar, emojiPanel, h('div', { class: 'composer-bar' }, attach, ...extras, emojiBtn, textEl, send));
    textEl.addEventListener('focus', () => { if (window.innerWidth <= 700) emojiPanel.hidden = true; });
    if (window.innerWidth > 700) textEl.focus();
  }

  async function insertMessage(fields) {
    const row = { chat_id: chat.id, sender_id: state.me.id, ...fields, reply_to: replyTo?.id || null };
    const savedReply = replyTo;
    replyTo = null; replyBar.hidden = true;
    const { data, error } = await sb.from('messages').insert(row).select().single();
    if (error) {
      console.error('Ошибка отправки', error);
      toast('Сообщение не отправлено: ' + ruError(error), 'error', 7000);
      if (savedReply) setReply(savedReply);
      return false;
    }
    msgs.querySelector('.msg-system:only-child')?.remove();
    insertMessages([data]);
    toBottom(true);
    refreshChatList();
    return true;
  }

  drawBottom();

  // ----- «печатает…» -----
  if (role) {
    typingChannel = sb.channel('typing:' + chat.id);
    let tt;
    typingChannel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.id === state.me.id) return;
      typingEl.textContent = (chat.type === 'direct' ? '' : payload.name + ' ') + 'печатает…';
      typingEl.hidden = false; sub.hidden = true;
      clearTimeout(tt);
      tt = setTimeout(() => { typingEl.hidden = true; sub.hidden = false; }, 3500);
    }).subscribe();
    rpc('mark_read', { c: chat.id }).then(refreshChatList).catch(() => {});
  }

  active = {
    id: chat.id,
    updateStatus,
    async onInsert(m) {
      if (rendered.has(m.id)) return;
      await ensurePeople([m]);
      const stick = atBottom();
      msgs.querySelector('.msg-system:only-child')?.remove();
      insertMessages([m]);
      if (stick || m.sender_id === state.me.id) toBottom(true);
      typingEl.hidden = true; sub.hidden = false;
      if (document.visibilityState === 'visible') sb.rpc('mark_read', { c: chat.id }).then(() => refreshChatList());
    },
    onUpdate(m) { if (rendered.has(m.id)) replaceBubble({ ...rendered.get(m.id)._m, ...m }); },
    onReaction(p) {
      const r = p.eventType === 'DELETE' ? p.old : p.new;
      if (!r || !rendered.has(r.message_id)) return;
      if (!reactions.has(r.message_id)) reactions.set(r.message_id, new Map());
      const map = reactions.get(r.message_id);
      if (p.eventType === 'DELETE') map.delete(r.user_id); else map.set(r.user_id, r.emoji);
      redrawReactions(r.message_id);
    },
    onDelete(id) { removeBubble(id); },
    destroy() { if (typingChannel) sb.removeChannel(typingChannel); },
  };
  drawList();
}

// Вызывается из main.js при любом изменении в таблице messages
export function onRealtimeMessage(p) {
  if (p.eventType === 'INSERT') {
    const m = p.new;
    if (active && active.id === m.chat_id) active.onInsert(m);
    else if (m.sender_id !== state.me.id) {
      const c = state.chats.find((x) => x.id === m.chat_id);
      const name = c ? chatTitle(c) : 'Новое сообщение';
      if (!location.hash.startsWith('#/chat')) toast(`💬 ${name}: ${m.kind === 'text' ? m.text.slice(0, 60) : m.kind === 'gift' ? '🎁 Подарок' : m.kind === 'coins' ? '🪙 Перевод' : '📷 Фото'}`);
    }
  } else if (p.eventType === 'UPDATE') {
    if (active && active.id === p.new.chat_id) active.onUpdate(p.new);
  } else if (p.eventType === 'DELETE') {
    if (active && p.old?.id) active.onDelete(p.old.id);
  }
  refreshChatList();
}

// ---------- Информация о группе / канале ----------
async function openChatInfo(chat, role) {
  const isAdmin = role === 'owner' || role === 'admin';
  const body = h('div', {});
  const m = modal(chat.type === 'channel' ? 'Канал' : 'Группа', body, { wide: true });

  async function draw() {
    const { data: c } = await sb.from('chats').select('*').eq('id', chat.id).single();
    Object.assign(chat, c || {});
    const { data: members } = await sb.from('chat_members')
      .select('role, user:profiles(id,username,display_name,avatar_url,last_seen)')
      .eq('chat_id', chat.id).order('joined_at').limit(200);

    const av = avatar(chat.avatar_url, chat.title, 96);
    const avWrap = h('div', { class: 'info-avatar' + (isAdmin ? ' editable' : '') }, av, isAdmin ? h('span', { class: 'av-edit' }, icon('image')) : null);
    if (isAdmin) avWrap.onclick = async () => {
      const f = await pickFile();
      if (!f) return;
      try {
        const url = await uploadImage(f, 'chat-avatars', 4);
        await rpc('update_chat', { c: chat.id, p_title: chat.title, p_username: chat.username, p_description: chat.description, p_is_public: chat.is_public, p_avatar_url: url });
        toast('Фото обновлено', 'success'); refreshChatList(); draw();
      } catch (e) { if (e?.message) toast(ruError(e), 'error'); }
    };

    const actions = [];
    if (isAdmin) actions.push(h('button', { class: 'btn ghost small', onclick: () => editChat() }, icon('edit'), ' Изменить'));
    if (role && (chat.type === 'group' || isAdmin)) actions.push(h('button', { class: 'btn ghost small', onclick: async () => {
      const picked = await pickUser({ title: 'Добавить в чат', multi: true, exclude: (members || []).map((x) => x.user?.id) });
      if (!picked.length) return;
      await rpc('add_members', { c: chat.id, p_users: picked.map((u) => u.id) });
      toast('Добавлено: ' + picked.length, 'success'); draw();
    } }, icon('plus'), ' Добавить'));
    if (chat.username) actions.push(h('button', { class: 'btn ghost small', onclick: () => {
      const link = location.origin + location.pathname + '#/search/' + chat.username;
      navigator.clipboard?.writeText(link); toast('Ссылка скопирована');
    } }, icon('send'), ' Поделиться'));
    if (role && role !== 'owner') actions.push(h('button', { class: 'btn ghost small danger-text', onclick: async () => {
      if (!(await confirmBox(chat.type === 'channel' ? 'Отписаться от канала?' : 'Выйти из группы?', 'Выйти', true))) return;
      const { error } = await sb.from('chat_members').delete().eq('chat_id', chat.id).eq('user_id', state.me.id);
      if (error) return toast(ruError(error), 'error');
      m.close(); refreshChatList(); go('#/chats');
    } }, icon('logout'), chat.type === 'channel' ? ' Отписаться' : ' Выйти'));

    const roleLabel = { owner: 'владелец', admin: 'админ', member: '' };
    const memberRows = (members || []).filter((x) => x.user).map((x) => {
      const u = x.user;
      const btns = [];
      if (role === 'owner' && x.role !== 'owner') btns.push(h('button', { class: 'link-btn small', onclick: async () => {
        await rpc('set_member_role', { c: chat.id, u: u.id, r: x.role === 'admin' ? 'member' : 'admin' }); draw();
      } }, x.role === 'admin' ? 'снять админа' : 'сделать админом'));
      if (isAdmin && x.role !== 'owner' && u.id !== state.me.id) btns.push(h('button', { class: 'link-btn small danger-text', onclick: async () => {
        if (!(await confirmBox(`Удалить ${u.display_name} из чата?`, 'Удалить', true))) return;
        await rpc('kick_member', { c: chat.id, u: u.id }); draw();
      } }, 'удалить'));
      return h('div', { class: 'row-item' },
        h('a', { href: '#/u/' + u.username, onclick: () => m.close() }, avatar(u.avatar_url, u.display_name, 38, { online: state.online.has(u.id) })),
        h('div', { class: 'row-main' }, h('b', {}, u.display_name, roleLabel[x.role] ? h('span', { class: 'role-tag' }, roleLabel[x.role]) : null),
          h('span', { class: 'muted small' }, lastSeenText(u.id, u.last_seen))),
        h('div', { class: 'row-btns' }, btns));
    });

    body.replaceChildren(
      h('div', { class: 'center' }, avWrap,
        h('h2', { style: { marginTop: '12px' } }, chat.title),
        chat.username ? h('div', { class: 'accent' }, '@' + chat.username) : h('div', { class: 'muted small' }, 'Закрытый чат'),
        chat.description ? h('p', { class: 'muted', style: { marginTop: '8px', whiteSpace: 'pre-wrap' } }, chat.description) : null),
      h('div', { class: 'info-actions' }, actions),
      h('h3', { class: 'section-title' }, `${chat.type === 'channel' ? 'Подписчики' : 'Участники'} · ${(members || []).length}`),
      h('div', { class: 'member-list' }, memberRows));
  }

  function editChat() {
    const title = h('input', { class: 'input', maxlength: 64, value: chat.title || '' });
    const desc = h('textarea', { class: 'input', maxlength: 255, rows: 3 }, chat.description || '');
    const pub = h('input', { type: 'checkbox' }); pub.checked = chat.is_public;
    const uname = h('input', { class: 'input with-prefix', maxlength: 32, value: chat.username || '' });
    uname.addEventListener('input', () => { uname.value = uname.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); });
    const save = h('button', { class: 'btn' }, 'Сохранить');
    const em = modal('Изменить', h('div', {},
      h('div', { class: 'field' }, h('label', {}, 'Название'), title),
      h('div', { class: 'field' }, h('label', {}, 'Описание'), desc),
      h('label', { class: 'switch-row' }, pub, h('span', {}, 'Публичный')),
      h('div', { class: 'field' }, h('label', {}, 'Ссылка'), h('div', { class: 'input-wrap' }, h('span', { class: 'prefix' }, '@'), uname)),
      save));
    save.onclick = async () => {
      save.disabled = true;
      try {
        await rpc('update_chat', { c: chat.id, p_title: title.value, p_username: uname.value, p_description: desc.value, p_is_public: pub.checked, p_avatar_url: chat.avatar_url });
        em.close(); toast('Сохранено', 'success'); refreshChatList(); draw();
      } catch { save.disabled = false; }
    };
  }

  await draw();
}

export function onRealtimeReaction(p) {
  active?.onReaction?.(p);
}

// Аватар поддержки — логотип Sierra
export function supportAvatar(size = 44) {
  return h('span', { class: 'support-av', style: { width: size + 'px', height: size + 'px' }, html:
    '<svg viewBox="0 0 40 40"><defs><linearGradient id="sav" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fd6ff"/><stop offset="1" stop-color="#1d6bff"/></linearGradient></defs><circle cx="20" cy="20" r="20" fill="url(#sav)"/><path d="M9 26l6.5-9 4 5 3-3.8L31 26z" fill="#021220"/></svg>' });
}

// Панель эмодзи
function emojiPicker(onPick) {
  const tabs = h('div', { class: 'emoji-tabs' });
  const grid = h('div', { class: 'emoji-grid' });
  const panel = h('div', { class: 'emoji-panel', hidden: true }, tabs, grid);
  let current = 0;
  const draw = () => {
    tabs.replaceChildren(...EMOJI.map((c, i) => h('button', { class: 'emoji-tab' + (i === current ? ' on' : ''), title: c.name, onclick: (e) => { e.stopPropagation(); current = i; draw(); } }, c.icon)));
    grid.replaceChildren(...EMOJI[current].list.map((e) => h('button', { class: 'emoji', onclick: (ev) => { ev.stopPropagation(); onPick(e); } }, e)));
  };
  draw();
  document.addEventListener('click', (e) => { if (!panel.contains(e.target)) panel.hidden = true; });
  return panel;
}
