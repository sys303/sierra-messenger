import { sb, state, h, icon, avatar, toast, ruError, modal, pickFile, lastSeenText, emptyState, coins, openReport } from './core.js';
import { adminProfileActions } from './admin.js';
import { loadPosts } from './feed.js';
import { giftsShowcase, chooseGiftFor } from './gifts.js';
import { openSendCoins } from './wallet.js';
import { loadContactIds, isContact, addContact, removeContact, writeTo } from './search.js';
import { alsoUsernames, ownerOf } from './usernames.js';

export async function renderProfile(view, username) {
  const uname = (username || '').toLowerCase().replace(/^@/, '');
  let { data: p } = await sb.from('profiles').select('*').eq('username', uname).maybeSingle();
  if (!p) {
    // может, это дополнительный («also») юзернейм кого-то
    const owner = await ownerOf(uname).catch(() => null);
    if (owner) ({ data: p } = await sb.from('profiles').select('*').eq('id', owner).maybeSingle());
  }
  if (!p) {
    view.append(emptyState('🤷', 'Пользователь не найден', `Нет профиля @${username}`, h('a', { class: 'btn small', href: '#/search' }, 'Поиск')));
    return;
  }
  const mine = p.id === state.me.id;
  await loadContactIds();
  const also = await alsoUsernames(p).catch(() => []);

  const [{ count: postCount }, { count: giftCount }] = await Promise.all([
    sb.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', p.id),
    sb.from('user_gifts').select('*', { count: 'exact', head: true }).eq('owner_id', p.id).eq('is_hidden', false),
  ]);

  const avatarWrap = h('div', { class: 'avatar-wrap' + (mine ? ' editable' : '') },
    h('img', { src: avatar(p.avatar_url, p.display_name).src, alt: '' }),
    mine ? h('div', { class: 'avatar-overlay' }, 'Сменить фото') : null);
  if (mine) avatarWrap.onclick = () => changeAvatar(p, avatarWrap);

  const status = h('span', { class: 'muted small' + (state.online.has(p.id) ? ' accent' : '') }, mine ? 'в сети' : lastSeenText(p.id, p.last_seen));
  const onPresence = () => { if (!mine) status.textContent = lastSeenText(p.id, p.last_seen); };
  window.addEventListener('sierra:presence', onPresence);

  const actions = [];
  if (mine) {
    actions.push(h('button', { class: 'btn ghost small', onclick: () => editProfile(p) }, icon('edit'), ' Редактировать'));
    actions.push(h('a', { class: 'btn ghost small', href: '#/settings' }, icon('settings'), ' Настройки'));
  } else {
    actions.push(h('button', { class: 'btn small', onclick: () => writeTo(p) }, icon('chats'), ' Написать'));
    const cBtn = h('button', { class: 'btn ghost small' });
    const drawC = () => cBtn.replaceChildren(icon(isContact(p.id) ? 'check' : 'contact'), isContact(p.id) ? ' В контактах' : ' В контакты');
    drawC();
    cBtn.onclick = async () => { cBtn.disabled = true; isContact(p.id) ? await removeContact(p) : await addContact(p); drawC(); cBtn.disabled = false; };
    actions.push(cBtn);
    actions.push(h('button', { class: 'btn ghost small', onclick: () => chooseGift(p) }, icon('gift'), ' Подарить'));
    actions.push(h('button', { class: 'btn ghost small', onclick: () => openSendCoins(p) }, icon('coin'), ' Перевести'));
    actions.push(h('button', { class: 'btn ghost small', title: 'Пожаловаться', onclick: () => openReport('user', p.id) }, '🚩'));
    actions.push(...adminProfileActions(p));
  }

  const tabBody = h('div', {});
  const tabPosts = h('button', { class: 'tab active' }, `Посты · ${coins(postCount || 0)}`);
  const tabGifts = h('button', { class: 'tab' }, `Подарки · ${coins(giftCount || 0)}`);
  tabPosts.onclick = () => { tabPosts.classList.add('active'); tabGifts.classList.remove('active'); tabBody.replaceChildren(); const l = h('div', {}); tabBody.append(l); loadPosts(l, p.id); };
  tabGifts.onclick = () => { tabGifts.classList.add('active'); tabPosts.classList.remove('active'); tabBody.replaceChildren(); giftsShowcase(tabBody, p.id); };

  view.append(
    h('section', { class: 'profile-card fade-up' },
      h('div', { class: 'cover' }),
      h('div', { class: 'profile-body' },
        avatarWrap,
        h('div', { class: 'profile-head' },
          h('div', {}, h('h1', {}, p.display_name), h('div', { class: 'username' }, '@' + p.username, ' · ', status),
            also.length ? h('div', { class: 'also-line' }, 'also ', ...also.flatMap((n, i) => [
              i ? ', ' : null, h('a', { href: '#/gifts/usernames/mine', onclick: (e) => { if (!mine) e.preventDefault(); } }, '@' + n)]).filter(Boolean)) : null),
          h('div', { class: 'profile-actions' }, actions)),
        p.bio ? h('p', { class: 'bio' }, p.bio) : mine ? h('p', { class: 'bio empty' }, 'Расскажи о себе — нажми «Редактировать»') : null,
        h('p', { class: 'joined' }, '📅 В Sierra с ' + new Date(p.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })))),
    h('div', { class: 'tabs' }, tabPosts, tabGifts),
    tabBody);
  tabPosts.click();

  return () => window.removeEventListener('sierra:presence', onPresence);
}

function chooseGift(user) { return chooseGiftFor(user); }

async function changeAvatar(p, wrap) {
  const file = await pickFile('image/png,image/jpeg,image/webp,image/gif');
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) return toast('Файл больше 3 МБ', 'error');
  wrap.classList.add('loading');
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${state.me.id}/avatar-${Date.now()}.${ext}`;
  const up = await sb.storage.from('avatars').upload(path, file, { contentType: file.type });
  if (up.error) { wrap.classList.remove('loading'); return toast(ruError(up.error), 'error'); }
  const url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  const { error } = await sb.from('profiles').update({ avatar_url: url }).eq('id', state.me.id);
  wrap.classList.remove('loading');
  if (error) return toast(ruError(error), 'error');
  const old = p.avatar_url?.split('/avatars/')[1];
  if (old) sb.storage.from('avatars').remove([decodeURIComponent(old)]);
  p.avatar_url = url;
  state.profile.avatar_url = url;
  wrap.querySelector('img').src = url;
  window.dispatchEvent(new Event('sierra:profile'));
  toast('Аватарка обновлена', 'success');
}

export function editProfile(p = state.profile) {
  const name = h('input', { class: 'input', maxlength: 40, value: p.display_name });
  const uname = h('input', { class: 'input with-prefix', maxlength: 20, value: p.username });
  uname.addEventListener('input', () => { uname.value = uname.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); });
  const bio = h('textarea', { class: 'input', maxlength: 160, rows: 3 }, p.bio || '');
  const counter = h('span', {}, String((p.bio || '').length));
  bio.addEventListener('input', () => { counter.textContent = bio.value.length; });
  const save = h('button', { class: 'btn' }, 'Сохранить');
  const m = modal('Редактировать профиль', h('div', {},
    h('div', { class: 'field' }, h('label', {}, 'Имя'), name),
    h('div', { class: 'field' }, h('label', {}, 'Ник'), h('div', { class: 'input-wrap' }, h('span', { class: 'prefix' }, '@'), uname),
      h('div', { class: 'hint' }, '3–20 символов: латиница, цифры и _ · старый ник останется у тебя как «also»')),
    h('div', { class: 'field' }, h('label', {}, 'О себе'), bio, h('div', { class: 'counter' }, counter, '/160')),
    save));
  save.onclick = async () => {
    const display_name = name.value.trim();
    const username = uname.value.trim();
    if (!display_name) return toast('Имя не может быть пустым', 'error');
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return toast('Ник: 3–20 символов, латиница, цифры и _', 'error');
    save.disabled = true;
    const { data, error } = await sb.from('profiles').update({ display_name, username, bio: bio.value.trim() })
      .eq('id', state.me.id).select().single();
    save.disabled = false;
    if (error) return toast(error.code === '23505' ? 'Этот ник уже занят' : ruError(error), 'error');
    Object.assign(state.profile, data);
    m.close();
    toast('Профиль сохранён', 'success');
    window.dispatchEvent(new Event('sierra:profile'));
    location.hash = '#/u/' + data.username;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
}
