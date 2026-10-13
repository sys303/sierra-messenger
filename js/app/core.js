// Общие вещи для всего приложения
import { sb } from '../supabase.js';
import { toast, ruError, defaultAvatar } from '../ui.js';

export { sb, toast, ruError, defaultAvatar };

// Защита: пустые значения (null/undefined/false) никогда не выводятся текстом «null»
for (const proto of [Element.prototype, DocumentFragment.prototype]) {
  for (const fn of ['append', 'prepend', 'replaceChildren']) {
    const orig = proto[fn];
    proto[fn] = function (...nodes) { return orig.apply(this, nodes.filter((n) => n !== null && n !== undefined && n !== false)); };
  }
}

export const state = {
  me: null,          // пользователь из Supabase Auth
  profile: null,     // мой профиль
  online: new Set(), // id пользователей в сети
  chats: [],         // список моих чатов
  balance: null,
};

// ---------- Создание элементов без innerHTML (защита от XSS) ----------
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v; // только для своих иконок
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);

// ---------- Иконки ----------
const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const icons = {
  feed: I('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 8h10M7 12h10M7 16h6"/>'),
  chats: I('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  gift: I('<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8S10.5 3 7.5 3 5 6.5 7.5 8H12zM12 8s1.5-5 4.5-5S19 6.5 16.5 8H12z"/>'),
  wallet: I('<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  send: I('<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>'),
  image: I('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
  heart: I('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>'),
  comment: I('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  trash: I('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
  back: I('<path d="m15 18-6-6 6-6"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  users: I('<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3"/>'),
  megaphone: I('<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  coin: I('<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.7 0-2.8 1-2.8 2.1 0 2.8 5.6 1.4 5.6 4.2 0 1.2-1.2 2.2-2.8 2.2-1.1 0-2.2-.6-2.7-1.6M12 6.5V8M12 16.5V18"/>'),
  logout: I('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  reply: I('<path d="m9 14-5-5 5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  edit: I('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  close: I('<path d="M18 6 6 18M6 6l12 12"/>'),
  check: I('<path d="M20 6 9 17l-5-5"/>'),
  contact: I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0M19 3v6M16 6h6"/>'),
  phone: I('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>'),
  shield: I('<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="m9 12 2 2 4-4"/>'),
};
export const icon = (name, cls = 'ico') => h('span', { class: cls, html: icons[name] || '' });

// ---------- Форматирование ----------
export const coins = (n) => Number(n || 0).toLocaleString('ru-RU');

export function timeShort(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const diff = (now - d) / 864e5;
  if (diff < 6) return d.toLocaleDateString('ru-RU', { weekday: 'short' });
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
export function timeAgo(ts) {
  const s = (Date.now() - new Date(ts)) / 1000;
  if (s < 60) return 'только что';
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
export function lastSeenText(userId, ts) {
  if (state.online.has(userId)) return 'в сети';
  if (!ts) return 'был(а) давно';
  const s = (Date.now() - new Date(ts)) / 1000;
  if (s < 300) return 'был(а) только что';
  return 'был(а) ' + timeAgo(ts);
}

// ---------- Аватар ----------
export function avatar(url, name, size = 44, opts = {}) {
  const img = h('img', {
    class: 'av', src: url || defaultAvatar(name || '?'), alt: '',
    style: { width: size + 'px', height: size + 'px' }, loading: 'lazy',
  });
  img.onerror = () => { img.src = defaultAvatar(name || '?'); };
  if (opts.online !== undefined) {
    return h('span', { class: 'av-wrap' + (opts.online ? ' online' : ''), style: { width: size + 'px', height: size + 'px' } }, img);
  }
  return img;
}

export function chatTitle(c) {
  return c.type === 'direct' ? (c.peer_name || c.peer_username || 'Пользователь') : (c.title || 'Без названия');
}

// ---------- Работа с базой ----------
export async function rpc(name, args = {}) {
  const { data, error } = await sb.rpc(name, args);
  if (error) {
    toast(ruError(error), 'error');
    throw error;
  }
  return data;
}

// Загрузка картинки в хранилище media
export async function uploadImage(file, folder = 'misc', maxMb = 8) {
  if (!file.type.startsWith('image/')) throw new Error('Можно загружать только картинки');
  if (file.size > maxMb * 1024 * 1024) throw new Error(`Файл больше ${maxMb} МБ`);
  const blob = await shrinkImage(file);
  const ext = blob.type === 'image/gif' ? 'gif' : 'jpg';
  const path = `${state.me.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from('media').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
  if (error) throw error;
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}

// Сжимаем большие фото до 1600px, чтобы быстрее грузились
async function shrinkImage(file) {
  if (file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const max = 1600;
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}

export function pickFile(accept = 'image/*') {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept, style: { display: 'none' } });
    inp.addEventListener('change', () => { resolve(inp.files[0] || null); inp.remove(); });
    document.body.append(inp);
    inp.click();
  });
}

// ---------- Модальные окна ----------
export function modal(title, body, opts = {}) {
  const close = () => { bg.classList.remove('open'); setTimeout(() => bg.remove(), 200); opts.onClose?.(); };
  const card = h('div', { class: 'card modal-card' + (opts.wide ? ' wide' : '') },
    h('div', { class: 'modal-head' },
      h('h2', {}, title),
      h('button', { class: 'icon-btn', onclick: close, 'aria-label': 'Закрыть' }, icon('close'))),
    body);
  const bg = h('div', { class: 'modal-bg open', onclick: (e) => { if (e.target === bg) close(); } }, card);
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
  document.body.append(bg);
  return { close, card };
}

export function confirmBox(text, okText = 'Да', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal('Подтверди', h('div', {},
      h('p', { class: 'sub', style: { marginTop: '4px' } }, text),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn ghost', onclick: () => { done = true; m.close(); resolve(false); } }, 'Отмена'),
        h('button', { class: 'btn' + (danger ? ' danger' : ''), onclick: () => { done = true; m.close(); resolve(true); } }, okText))),
      { onClose: () => { if (!done) resolve(false); } });
  });
}

// Выбор человека (для подарков, переводов, групп)
export function pickUser({ title = 'Выбери человека', multi = false, exclude = [] } = {}) {
  return new Promise((resolve) => {
    const picked = new Map();
    let done = false;
    const list = h('div', { class: 'pick-list' });
    const input = h('input', { class: 'input', placeholder: 'Ник, имя, почта или телефон' });
    const doneBtn = multi ? h('button', { class: 'btn', onclick: () => { done = true; m.close(); resolve([...picked.values()]); } }, 'Готово') : null;

    async function render(q) {
      list.replaceChildren(h('div', { class: 'muted pad' }, 'Ищем…'));
      const users = await searchPeople(q);
      const rows = users.filter((u) => !exclude.includes(u.id) && u.id !== state.me.id).map((u) => {
        const row = h('button', { class: 'row-item' + (picked.has(u.id) ? ' picked' : '') },
          avatar(u.avatar_url, u.display_name, 40),
          h('div', { class: 'row-main' }, h('b', {}, u.display_name), h('span', { class: 'muted' }, '@' + u.username)),
          multi ? h('span', { class: 'tick' }, icon('check')) : null);
        row.onclick = () => {
          if (!multi) { done = true; m.close(); resolve(u); return; }
          if (picked.has(u.id)) picked.delete(u.id); else picked.set(u.id, u);
          row.classList.toggle('picked');
        };
        return row;
      });
      list.replaceChildren(...(rows.length ? rows : [h('div', { class: 'muted pad' }, q ? 'Никого не нашли' : 'Добавь контакты или начни вводить ник')]));
    }
    let t;
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => render(input.value.trim()), 300); });
    const m = modal(title, h('div', {}, input, list, doneBtn), { onClose: () => { if (!done) resolve(multi ? [...picked.values()] : null); } });
    input.focus();
    render('');
  });
}

// Поиск людей: пусто → контакты, иначе по нику/имени + по почте/телефону
const PERSON = 'id,username,display_name,avatar_url,last_seen';

// Мои контакты (два простых запроса — так надёжнее, чем вложенный select)
export async function myContacts() {
  const { data: rows, error } = await sb.from('contacts').select('contact_id,created_at').order('created_at', { ascending: false });
  if (error) { toast(ruError(error), 'error'); return []; }
  const ids = (rows || []).map((r) => r.contact_id);
  if (!ids.length) return [];
  const { data: ppl, error: e2 } = await sb.from('profiles').select(PERSON).in('id', ids);
  if (e2) { toast(ruError(e2), 'error'); return []; }
  const byId = new Map((ppl || []).map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export const looksLikeEmail = (q) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q);
export const looksLikePhone = (q) => /^\+?[\d\s()-]{7,}$/.test(q) && q.replace(/\D/g, '').length >= 10;

export async function searchPeople(q) {
  q = (q || '').trim();
  if (!q) return myContacts();
  const found = new Map();

  if (looksLikeEmail(q) || looksLikePhone(q)) {
    const { data, error } = await sb.rpc('find_user_by_contact', { q });
    if (error) toast(ruError(error), 'error');
    (data || []).forEach((u) => found.set(u.id, u));
  }

  // По нику и имени. Спецсимволы убираем, «*» — шаблон «любые символы» для API
  const safe = q.replace(/^@/, '').replace(/[%,()*\\:."']/g, ' ').trim();
  if (safe) {
    const { data, error } = await sb.from('profiles').select(PERSON)
      .or(`username.ilike.*${safe}*,display_name.ilike.*${safe}*`)
      .limit(30);
    if (error) toast(ruError(error), 'error');
    (data || []).forEach((u) => found.set(u.id, u));
    // дополнительные («also») юзернеймы
    const { data: extra } = await sb.from('usernames').select('owner_id').ilike('name', `%${safe.replace(/\s+/g, '')}%`).limit(20);
    const ids = [...new Set((extra || []).map((r) => r.owner_id).filter((id) => !found.has(id)))];
    if (ids.length) {
      const { data: more } = await sb.from('profiles').select(PERSON).in('id', ids);
      (more || []).forEach((u) => found.set(u.id, u));
    }
  }
  found.delete(state.me?.id);
  return [...found.values()];
}

export function go(hash) { location.hash = hash; }

export function emptyState(emoji, title, text, action) {
  return h('div', { class: 'empty' },
    h('div', { class: 'big' }, emoji),
    h('b', {}, title),
    text ? h('p', { class: 'muted' }, text) : null,
    action || null);
}

// ---------- Выбор чатов (для пересылки) ----------
export function pickChats(title = 'Переслать в…') {
  return new Promise(async (resolve) => {
    const { data, error } = await sb.rpc('my_chats');
    if (error) { toast(ruError(error), 'error'); return resolve([]); }
    const chats = (data || []).filter((c) => c.type !== 'channel' || c.my_role === 'owner' || c.my_role === 'admin');
    const picked = new Set();
    let done = false;
    const search = h('input', { class: 'input', placeholder: 'Поиск чата' });
    const list = h('div', { class: 'pick-list' });
    const send = h('button', { class: 'btn', disabled: true }, 'Отправить');
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const rows = chats.filter((c) => !q || chatTitle(c).toLowerCase().includes(q)).map((c) => {
        const t = c.type === 'support' ? 'Поддержка Sierra' : chatTitle(c);
        const row = h('button', { class: 'row-item' + (picked.has(c.id) ? ' picked' : '') },
          avatar(c.type === 'direct' ? c.peer_avatar : c.avatar_url, t, 40),
          h('div', { class: 'row-main' }, h('b', {}, t),
            h('span', { class: 'muted small' }, c.type === 'direct' ? '@' + (c.peer_username || '') : c.type === 'group' ? 'Группа' : c.type === 'channel' ? 'Канал' : 'Поддержка')),
          h('span', { class: 'tick' }, icon('check')));
        row.onclick = () => {
          picked.has(c.id) ? picked.delete(c.id) : picked.add(c.id);
          row.classList.toggle('picked');
          send.disabled = !picked.size;
          send.textContent = picked.size ? `Отправить (${picked.size})` : 'Отправить';
        };
        return row;
      });
      list.replaceChildren(...(rows.length ? rows : [h('div', { class: 'muted pad' }, chats.length ? 'Ничего не найдено' : 'У тебя пока нет чатов')]));
    };
    search.addEventListener('input', draw);
    send.onclick = () => { done = true; m.close(); resolve([...picked]); };
    const m = modal(title, h('div', {}, search, list, send), { onClose: () => { if (!done) resolve([]); } });
    draw();
    search.focus();
  });
}

// ---------- Жалоба ----------
const REASONS = ['Спам', 'Оскорбления или травля', 'Мошенничество', 'Неприемлемый контент', 'Выдаёт себя за другого', 'Другое'];
export function openReport(type, targetId) {
  let reason = REASONS[0];
  const chips = h('div', { class: 'chips' });
  const draw = () => chips.replaceChildren(...REASONS.map((r) =>
    h('button', { class: 'check-chip' + (r === reason ? ' on' : ''), onclick: () => { reason = r; draw(); } }, r)));
  draw();
  const details = h('textarea', { class: 'input', rows: 3, maxlength: 1000, placeholder: 'Опиши, что случилось (необязательно)' });
  const send = h('button', { class: 'btn' }, 'Отправить жалобу');
  const m = modal('Пожаловаться', h('div', {},
    h('p', { class: 'muted', style: { marginBottom: '10px' } }, 'Жалобу увидит только администрация. Ответ придёт в чат «Поддержка Sierra».'),
    chips, h('div', { class: 'field', style: { marginTop: '12px' } }, details), send));
  send.onclick = async () => {
    send.disabled = true;
    try {
      await rpc('create_report', { p_type: type, p_target: String(targetId), p_reason: reason, p_details: details.value.trim() });
      m.close();
      toast('Жалоба отправлена. Спасибо!', 'success');
    } catch { send.disabled = false; }
  };
}

// Открыть свой чат с поддержкой
export async function openSupport() {
  try {
    const id = await rpc('get_support_chat');
    if (id) go('#/chat/' + id);
  } catch {}
}
