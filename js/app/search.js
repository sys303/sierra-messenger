import { sb, state, h, icon, avatar, rpc, toast, ruError, modal, lastSeenText, searchPeople, go, emptyState, coins } from './core.js';

let contactIds = new Set();
export async function loadContactIds() {
  const { data } = await sb.from('contacts').select('contact_id').eq('owner_id', state.me.id);
  contactIds = new Set((data || []).map((r) => r.contact_id));
  return contactIds;
}
export const isContact = (id) => contactIds.has(id);

export async function addContact(u) {
  const { error } = await sb.from('contacts').insert({ owner_id: state.me.id, contact_id: u.id });
  if (error && error.code !== '23505') { toast(ruError(error), 'error'); return false; }
  contactIds.add(u.id);
  toast(`${u.display_name} добавлен в контакты`, 'success');
  return true;
}
export async function removeContact(u) {
  const { error } = await sb.from('contacts').delete().eq('owner_id', state.me.id).eq('contact_id', u.id);
  if (error) { toast(ruError(error), 'error'); return false; }
  contactIds.delete(u.id);
  toast('Удалён из контактов');
  return true;
}

export async function writeTo(u) {
  try {
    const id = await rpc('get_or_create_direct', { other: u.id });
    if (id) go('#/chat/' + id);
  } catch {}
}

export function personRow(u, { compact = false } = {}) {
  const contactBtn = h('button', { class: 'btn ghost small' });
  const drawBtn = () => { contactBtn.replaceChildren(icon(isContact(u.id) ? 'check' : 'contact'), isContact(u.id) ? ' В контактах' : ' В контакты'); };
  drawBtn();
  contactBtn.onclick = async () => {
    contactBtn.disabled = true;
    if (isContact(u.id)) await removeContact(u); else await addContact(u);
    drawBtn(); contactBtn.disabled = false;
  };
  return h('div', { class: 'row-item' },
    h('a', { href: '#/u/' + u.username }, avatar(u.avatar_url, u.display_name, 46, { online: state.online.has(u.id) })),
    h('a', { class: 'row-main', href: '#/u/' + u.username },
      h('b', {}, u.display_name), h('span', { class: 'muted small' }, '@' + u.username + ' · ' + lastSeenText(u.id, u.last_seen))),
    u.id !== state.me.id ? h('div', { class: 'row-btns' },
      compact ? null : contactBtn,
      h('button', { class: 'btn small', onclick: () => writeTo(u) }, icon('chats'), compact ? '' : ' Написать')) : null);
}

function chatRow(c, count) {
  return h('a', { class: 'row-item', href: '#/chat/' + c.id },
    avatar(c.avatar_url, c.title, 46),
    h('div', { class: 'row-main' },
      h('b', {}, c.type === 'channel' ? icon('megaphone', 'ico xs') : icon('users', 'ico xs'), c.title),
      h('span', { class: 'muted small' }, '@' + c.username + ' · ' + coins(count || 0) + (c.type === 'channel' ? ' подписчиков' : ' участников'))),
    h('span', { class: 'btn ghost small' }, 'Открыть'));
}

export async function renderSearch(view, initial = '') {
  await loadContactIds();
  const input = h('input', { class: 'input big-search', placeholder: 'Ник, имя, @группа, почта или телефон', value: initial });
  const results = h('div', {});

  const addByContact = h('button', { class: 'btn ghost small' }, icon('phone'), ' Добавить по почте или телефону');
  addByContact.onclick = openAddContact;
  const newGroup = h('button', { class: 'btn ghost small', onclick: async () => (await import('./chats.js')).openCreateChat('group') }, icon('users'), ' Создать группу');
  const newChannel = h('button', { class: 'btn ghost small', onclick: async () => (await import('./chats.js')).openCreateChat('channel') }, icon('megaphone'), ' Создать канал');

  view.append(
    h('div', { class: 'page-head' }, h('h1', {}, 'Поиск')),
    h('div', { class: 'search-box' }, icon('search'), input),
    h('div', { class: 'quick-actions' }, addByContact, newGroup, newChannel),
    results);

  let t;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => run(input.value.trim()), 300); });
  input.focus();
  await run(initial);

  async function run(q) {
    if (!q) return showContacts();
    results.replaceChildren(h('div', { class: 'muted pad' }, 'Ищем…'));
    const safe = q.replace(/^@/, '').replace(/[%,()*\\:."']/g, ' ').trim();
    const [people, chatsRes] = await Promise.all([
      searchPeople(q),
      safe ? sb.from('chats').select('id,type,title,username,avatar_url,description').eq('is_public', true)
        .or(`username.ilike.*${safe}*,title.ilike.*${safe}*`).limit(20) : { data: [] },
    ]);
    const chats = chatsRes.data || [];
    const counts = {};
    if (chats.length) {
      await Promise.all(chats.map(async (c) => {
        const { count } = await sb.from('chat_members').select('*', { count: 'exact', head: true }).eq('chat_id', c.id);
        counts[c.id] = count;
      }));
    }
    const blocks = [];
    if (people.length) blocks.push(h('h3', { class: 'section-title' }, 'Люди'), h('div', { class: 'panel list' }, people.map((u) => personRow(u))));
    if (chats.length) blocks.push(h('h3', { class: 'section-title' }, 'Группы и каналы'), h('div', { class: 'panel list' }, chats.map((c) => chatRow(c, counts[c.id]))));
    if (!blocks.length) blocks.push(emptyState('🔍', 'Ничего не найдено',
      /@.+\./.test(q) || /^[+\d]/.test(q) ? 'Человек мог отключить поиск по почте/телефону в настройках' : 'Попробуй другой ник или название'));
    results.replaceChildren(...blocks);
  }

  async function showContacts() {
    const list = await searchPeople('');
    results.replaceChildren(
      h('h3', { class: 'section-title' }, `Мои контакты · ${list.length}`),
      list.length ? h('div', { class: 'panel list' }, list.map((u) => personRow(u, { compact: true })))
        : emptyState('👥', 'Контактов пока нет', 'Найди друзей по нику или добавь по почте и номеру телефона'));
  }

  function openAddContact() {
    const inp = h('input', { class: 'input', placeholder: 'friend@mail.ru или +7 999 123-45-67' });
    const out = h('div', {});
    const find = h('button', { class: 'btn' }, 'Найти');
    const m = modal('Добавить контакт', h('div', {},
      h('p', { class: 'muted', style: { marginBottom: '12px' } }, 'Введи точную почту или номер телефона, который человек привязал в настройках.'),
      h('form', { onsubmit: (e) => { e.preventDefault(); find.click(); } }, h('div', { class: 'field' }, inp)), find, out));
    inp.focus();
    find.onclick = async () => {
      const q = inp.value.trim();
      if (q.length < 5) return toast('Введи почту или телефон', 'error');
      find.disabled = true;
      const { data, error } = await sb.rpc('find_user_by_contact', { q });
      find.disabled = false;
      if (error) return toast(ruError(error), 'error');
      if (!data?.length) return out.replaceChildren(h('p', { class: 'muted pad' }, 'Никого не нашли. Возможно, человек не привязал этот контакт или скрыл его.'));
      out.replaceChildren(...data.map((u) => {
        const row = personRow(u);
        row.addEventListener('click', (e) => { if (e.target.closest('a, .btn:not(.ghost)')) m.close(); });
        return row;
      }));
    };
  }
}
