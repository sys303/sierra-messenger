import {
  sb, state, h, icon, avatar, timeAgo, toast, ruError, uploadImage, pickFile, confirmBox, emptyState,
  modal, rpc, pickChats, openReport, go,
} from './core.js';

const PAGE = 15;
const AUTHOR = 'id,username,display_name,avatar_url';
const authors = new Map();

async function loadAuthors(ids) {
  const missing = [...new Set(ids.filter((id) => id && !authors.has(id)))];
  if (!missing.length) return;
  const { data } = await sb.from('profiles').select(AUTHOR).in('id', missing);
  (data || []).forEach((p) => authors.set(p.id, p));
}

export async function renderFeed(view) {
  view.append(...[
    h('div', { class: 'page-head' }, h('h1', {}, 'Лента'), h('p', { class: 'muted' }, 'Что нового у людей в Sierra')),
    state.banned ? null : composer(),
    h('div', { id: 'postList' })].filter(Boolean));
  await loadPosts(view.querySelector('#postList'));
}

// ---------- Новый пост ----------
function composer() {
  let file = null;
  const text = h('textarea', { class: 'input composer-text', placeholder: 'Что у тебя нового?', maxlength: 2000, rows: 2 });
  const preview = h('div', { class: 'composer-preview', hidden: true });
  const postBtn = h('button', { class: 'btn small' }, 'Опубликовать');
  const attach = h('button', { class: 'icon-btn', title: 'Добавить фото' }, icon('image'));
  attach.onclick = async () => {
    const f = await pickFile();
    if (!f) return;
    file = f;
    preview.replaceChildren(h('img', { src: URL.createObjectURL(f) }),
      h('button', { class: 'icon-btn remove', onclick: () => { file = null; preview.hidden = true; preview.replaceChildren(); } }, icon('close')));
    preview.hidden = false;
  };

  postBtn.onclick = async () => {
    const t = text.value.trim();
    if (!t && !file) return toast('Напиши что-нибудь или добавь фото', 'error');
    postBtn.disabled = true;
    postBtn.textContent = 'Публикуем…';
    try {
      const image_url = file ? await uploadImage(file, 'posts') : null;
      const { data, error } = await sb.from('posts').insert({ author_id: state.me.id, text: t, image_url }).select('*').single();
      if (error) throw error;
      text.value = ''; file = null; preview.hidden = true; preview.replaceChildren();
      authors.set(state.me.id, state.profile);
      const list = document.getElementById('postList');
      list.querySelector('.empty')?.remove();
      list.prepend(postCard(data, false));
      toast('Пост опубликован', 'success');
    } catch (e) {
      console.error('Ошибка публикации', e);
      toast('Пост не опубликован: ' + ruError(e), 'error', 7000);
    } finally {
      postBtn.disabled = false;
      postBtn.textContent = 'Опубликовать';
    }
  };
  text.addEventListener('input', () => { text.style.height = 'auto'; text.style.height = Math.min(text.scrollHeight, 300) + 'px'; });

  return h('section', { class: 'panel composer fade-up' },
    h('div', { class: 'composer-row' }, avatar(state.profile.avatar_url, state.profile.display_name, 44), text),
    preview,
    h('div', { class: 'composer-actions' }, attach, postBtn));
}

async function myLikes(ids) {
  if (!ids.length) return new Set();
  const { data } = await sb.from('likes').select('post_id').eq('user_id', state.me.id).in('post_id', ids);
  return new Set((data || []).map((l) => l.post_id));
}

// ---------- Список постов (лента или профиль) ----------
export async function loadPosts(list, authorId = null, before = null) {
  if (!before) list.replaceChildren(skeletonPost(), skeletonPost());
  let q = sb.from('posts').select('*').order('created_at', { ascending: false }).limit(PAGE);
  if (authorId) q = q.eq('author_id', authorId);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (!before) list.replaceChildren();
  list.querySelector('.more-btn')?.remove();
  if (error) { list.append(h('div', { class: 'config-banner' }, 'Не удалось загрузить посты: ' + ruError(error))); return; }

  if (!data.length && !before) {
    list.append(emptyState('📝', authorId ? 'Постов пока нет' : 'Лента пустая', authorId ? '' : 'Опубликуй первый пост — его увидят все!'));
    return;
  }
  await loadAuthors(data.map((p) => p.author_id));
  const liked = await myLikes(data.map((p) => p.id));
  data.forEach((p) => list.append(postCard(p, liked.has(p.id))));

  if (data.length === PAGE) {
    const more = h('button', { class: 'btn ghost more-btn' }, 'Показать ещё');
    more.onclick = () => { more.disabled = true; loadPosts(list, authorId, data[data.length - 1].created_at); };
    list.append(more);
  }
}

function skeletonPost() {
  return h('div', { class: 'panel post' },
    h('div', { class: 'post-head' }, h('div', { class: 'skeleton', style: { width: '44px', height: '44px', borderRadius: '50%' } }),
      h('div', { style: { flex: 1 } }, h('div', { class: 'skeleton', style: { width: '40%', height: '14px' } }),
        h('div', { class: 'skeleton', style: { width: '25%', height: '12px', marginTop: '8px' } }))),
    h('div', { class: 'skeleton', style: { height: '60px', marginTop: '14px' } }));
}

export function postCard(p, isLiked, { open = false } = {}) {
  const a = authors.get(p.author_id) || {};
  let likeCount = p.like_count || 0;
  let commentCount = p.comment_count || 0;
  let shareCount = p.share_count || 0;
  const mine = p.author_id === state.me.id;

  // ❤️ лайк
  const likeNum = h('span', {}, likeCount || '');
  const likeBtn = h('button', { class: 'act' + (isLiked ? ' liked' : ''), title: 'Нравится' }, icon('heart'), likeNum);
  likeBtn.onclick = async () => {
    likeBtn.disabled = true;
    const was = likeBtn.classList.contains('liked');
    likeBtn.classList.toggle('liked', !was);
    likeBtn.classList.add('pop');
    setTimeout(() => likeBtn.classList.remove('pop'), 400);
    likeCount += was ? -1 : 1;
    likeNum.textContent = likeCount || '';
    const { error } = was
      ? await sb.from('likes').delete().eq('post_id', p.id).eq('user_id', state.me.id)
      : await sb.from('likes').insert({ post_id: p.id, user_id: state.me.id });
    if (error && error.code !== '23505') {
      likeBtn.classList.toggle('liked', was);
      likeCount += was ? 1 : -1;
      likeNum.textContent = likeCount || '';
      toast(ruError(error), 'error');
    }
    likeBtn.disabled = false;
  };

  // 💬 комментарии
  const comNum = h('span', {}, commentCount || '');
  const comBox = h('div', { class: 'comments', hidden: !open });
  const comBtn = h('button', { class: 'act', title: 'Комментарии' }, icon('comment'), comNum);
  comBtn.onclick = () => {
    comBox.hidden = !comBox.hidden;
    if (!comBox.hidden && !comBox.dataset.loaded) loadComments();
  };

  // ↪ переслать
  const shareNum = h('span', {}, shareCount || '');
  const shareBtn = h('button', { class: 'act', title: 'Переслать' }, icon('send'), shareNum);
  shareBtn.onclick = async () => {
    const chats = await pickChats('Переслать пост в…');
    if (!chats.length) return;
    try {
      const n = await rpc('share_post', { p_post: p.id, p_chats: chats, p_text: '' });
      shareCount += n; shareNum.textContent = shareCount || '';
      toast(n ? `Пост отправлен в ${n} ${n === 1 ? 'чат' : 'чата'}` : 'Не удалось отправить', n ? 'success' : 'error');
    } catch {}
  };

  // ⋯ меню
  const menuBtn = h('button', { class: 'icon-btn', title: 'Ещё' }, h('span', { class: 'dots' }, '⋯'));
  menuBtn.onclick = () => {
    const items = [
      ['send', 'Скопировать ссылку', () => {
        navigator.clipboard?.writeText(location.origin + location.pathname + '#/post/' + p.id);
        toast('Ссылка скопирована');
      }],
    ];
    if (!mine) items.push(['info', 'Пожаловаться', () => openReport('post', p.id)]);
    if (mine || state.isAdmin) items.push(['trash', mine ? 'Удалить пост' : 'Удалить (админ)', async () => {
      if (!(await confirmBox('Удалить этот пост?', 'Удалить', true))) return;
      const { error } = await sb.from('posts').delete().eq('id', p.id);
      if (error) return toast(ruError(error), 'error');
      card.classList.add('removing');
      setTimeout(() => card.remove(), 250);
    }]);
    const mm = modal('Пост', h('div', { class: 'stack' }, items.map(([ic, label, fn]) =>
      h('button', { class: 'menu-item', onclick: () => { mm.close(); fn(); } }, icon(ic), h('b', {}, label)))));
  };

  async function loadComments() {
    comBox.dataset.loaded = '1';
    comBox.replaceChildren(h('div', { class: 'muted' }, 'Загружаем…'));
    const { data, error } = await sb.from('comments').select('*').eq('post_id', p.id).order('created_at');
    if (error) return comBox.replaceChildren(h('div', { class: 'muted' }, ruError(error)));
    await loadAuthors((data || []).map((c) => c.author_id));
    const input = h('input', { class: 'input', placeholder: 'Написать комментарий…', maxlength: 500 });
    const send = h('button', { class: 'icon-btn accent' }, icon('send'));
    const form = h('form', { class: 'comment-form' }, input, send);
    const rows = h('div', {}, (data || []).map(commentRow));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const t = input.value.trim();
      if (!t) return;
      send.disabled = true;
      const { data: c, error: err } = await sb.from('comments').insert({ post_id: p.id, author_id: state.me.id, text: t }).select('*').single();
      send.disabled = false;
      if (err) return toast('Комментарий не отправлен: ' + ruError(err), 'error');
      authors.set(state.me.id, state.profile);
      input.value = '';
      rows.append(commentRow(c));
      commentCount++; comNum.textContent = commentCount;
    };
    comBox.replaceChildren(...[rows, state.banned ? null : form].filter(Boolean));
  }

  function commentRow(c) {
    const ca = authors.get(c.author_id) || {};
    const canDelete = c.author_id === state.me.id || mine || state.isAdmin;
    const row = h('div', { class: 'comment' },
      h('a', { href: '#/u/' + ca.username }, avatar(ca.avatar_url, ca.display_name, 32)),
      h('div', { class: 'comment-body' },
        h('div', {}, h('a', { class: 'name', href: '#/u/' + ca.username }, ca.display_name || 'Пользователь'), h('span', { class: 'muted small' }, ' · ' + timeAgo(c.created_at))),
        h('div', { class: 'comment-text' }, c.text)),
      canDelete ? h('button', { class: 'icon-btn tiny', title: 'Удалить', onclick: async () => {
        const { error } = await sb.from('comments').delete().eq('id', c.id);
        if (error) return toast(ruError(error), 'error');
        row.remove(); commentCount--; comNum.textContent = commentCount || '';
      } }, icon('trash')) : null);
    return row;
  }

  const card = h('article', { class: 'panel post fade-up' },
    h('div', { class: 'post-head' },
      h('a', { href: '#/u/' + a.username }, avatar(a.avatar_url, a.display_name, 44)),
      h('div', { class: 'post-who' },
        h('a', { class: 'name', href: '#/u/' + a.username }, a.display_name || 'Пользователь'),
        h('a', { class: 'muted small', href: '#/post/' + p.id }, '@' + (a.username || '') + ' · ' + timeAgo(p.created_at))),
      menuBtn),
    p.text ? h('div', { class: 'post-text' }, p.text) : null,
    p.image_url ? h('img', { class: 'post-img', src: p.image_url, loading: 'lazy', alt: '', onclick: () => openImage(p.image_url) }) : null,
    h('div', { class: 'post-actions' }, likeBtn, comBtn, shareBtn),
    comBox);
  if (open) loadComments();
  return card;
}

// Отдельная страница поста: #/post/<id>
export async function renderPost(view, id) {
  const { data: p, error } = await sb.from('posts').select('*').eq('id', id).maybeSingle();
  view.append(h('div', { class: 'page-head' }, h('a', { class: 'link-btn', href: '#/feed' }, '← Лента')));
  if (error || !p) { view.append(emptyState('🗑️', 'Пост не найден', 'Возможно, его удалили')); return; }
  await loadAuthors([p.author_id]);
  const liked = await myLikes([p.id]);
  view.append(postCard(p, liked.has(p.id), { open: true }));
}

// Мини-карточка поста для чата
const postCache = new Map();
export async function postPreview(postId) {
  const box = h('a', { class: 'post-preview', href: '#/post/' + postId }, h('span', { class: 'muted small' }, 'Загружаем пост…'));
  let p = postCache.get(postId);
  if (!p) {
    const { data } = await sb.from('posts').select('*').eq('id', postId).maybeSingle();
    p = data; if (p) postCache.set(postId, p);
  }
  if (!p) { box.replaceChildren(h('span', { class: 'muted small' }, '🗑️ Пост удалён')); return box; }
  await loadAuthors([p.author_id]);
  const a = authors.get(p.author_id) || {};
  box.replaceChildren(...[
    h('div', { class: 'pp-head' }, avatar(a.avatar_url, a.display_name, 24), h('b', {}, a.display_name || 'Пользователь'), h('span', { class: 'muted small' }, '· пост')),
    p.text ? h('div', { class: 'pp-text' }, p.text.length > 220 ? p.text.slice(0, 220) + '…' : p.text) : null,
    p.image_url ? h('img', { class: 'pp-img', src: p.image_url, alt: '', loading: 'lazy' }) : null,
    h('div', { class: 'pp-foot muted small' }, `❤️ ${p.like_count || 0} · 💬 ${p.comment_count || 0} · Открыть пост →`)].filter(Boolean));
  return box;
}

export function openImage(url) {
  const bg = h('div', { class: 'lightbox', onclick: () => bg.remove() }, h('img', { src: url, alt: '' }));
  document.body.append(bg);
}

export { go };
