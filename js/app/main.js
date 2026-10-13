import { sb, isConfigured, getSession } from '../supabase.js';
import { state, h, icon, avatar, coins, go, toast, openSupport } from './core.js';
import { renderFeed, renderPost } from './feed.js';
import { renderChats, onRealtimeMessage, onRealtimeReaction, refreshChatList } from './chats.js';
import { renderAdmin } from './admin.js';
import { renderSearch } from './search.js';
import { renderGifts, getCatalog, loadNftAttrs, onCatalogUpdate } from './gifts.js';
import { renderWallet, refreshBalance } from './wallet.js';
import { renderProfile } from './profile.js';
import { renderSettings } from './settings.js';

if (!isConfigured) { location.replace('index.html'); throw new Error('not configured'); }

const session = await getSession();
if (!session) { location.replace('index.html'); throw new Error('no session'); }
state.me = session.user;

const { data: prof } = await sb.from('profiles').select('*').eq('id', state.me.id).maybeSingle();
if (!prof) {
  document.body.replaceChildren(h('div', { class: 'config-banner' },
    'Профиль не найден. Проверь, что в Supabase выполнены файлы schema.sql и stage2.sql, и зарегистрируйся заново.'));
  throw new Error('no profile');
}
state.profile = prof;

// ---------- Проверка, что база данных обновлена (stage2.sql + stage3.sql) ----------
async function dbHealth() {
  const checks = await Promise.all([
    sb.from('gift_catalog').select('id').limit(1),
    sb.from('contacts').select('contact_id').limit(1),
    sb.from('messages').select('id').limit(1),
    sb.rpc('my_chats'),
    sb.from('nft_models').select('name').limit(1),
    sb.from('message_reactions').select('message_id').limit(1),
  ]);
  return checks.find((r) => r.error)?.error || null;
}
const dbError = await dbHealth();
const [adminRes, banRes] = await Promise.all([sb.rpc('is_admin'), sb.rpc('my_ban')]);
state.isAdmin = adminRes.data === true;
state.banned = (banRes.data && banRes.data[0]) || null;
await Promise.all([getCatalog().catch(() => {}), loadNftAttrs().catch(() => {})]);

// ---------- Каркас приложения ----------
const NAV = [
  ['feed', 'Лента', 'feed'],
  ['chats', 'Чаты', 'chats'],
  ['search', 'Поиск', 'search'],
  ['gifts', 'Подарки', 'gift'],
  ['wallet', 'Кошелёк', 'wallet'],
  ['profile', 'Профиль', 'user'],
  ['settings', 'Настройки', 'settings'],
];
if (state.isAdmin) NAV.push(['admin', 'Админка', 'shield']);

const navLinks = {};
const unreadBadge = h('span', { class: 'badge', hidden: true });
const balanceChip = h('a', { class: 'coin-chip', href: '#/wallet', title: 'Баланс SierCoin' }, icon('coin'), h('span', {}, '…'));
const meAvatar = h('a', { href: '#/profile', class: 'side-me' });

function buildShell() {
  const side = h('aside', { class: 'side' },
    h('a', { class: 'logo side-logo', href: '#/feed', html:
      '<svg viewBox="0 0 40 40"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fd6ff"/><stop offset="1" stop-color="#1d6bff"/></linearGradient></defs><path d="M20 3C10.6 3 3 9.7 3 18c0 4.4 2.1 8.3 5.5 11L7 37l8.2-4.3c1.5.4 3.1.6 4.8.6 9.4 0 17-6.7 17-15S29.4 3 20 3z" fill="url(#lg)"/><path d="M9 24l6.5-9 4 5 3-3.8L31 24z" fill="#021220"/></svg><span>Sierra <b>Messenger</b></span>' }),
    h('nav', { class: 'side-nav' }, NAV.map(([key, label, ic]) => {
      const a = h('a', { href: '#/' + key, class: 'nav-item', 'data-key': key },
        icon(ic), h('span', { class: 'nav-label' }, label), key === 'chats' ? unreadBadge : null);
      navLinks[key] = a;
      return a;
    })),
    h('div', { class: 'side-bottom' }, balanceChip, meAvatar));

  const main = h('main', { class: 'main', id: 'view' });
  document.body.replaceChildren(...[
    h('div', { class: 'bg-glow' }, h('span'), h('span'), h('span')),
    dbError ? h('div', { class: 'db-alert' },
      h('b', {}, '⚠️ База данных не обновлена — чаты, поиск, контакты и подарки не будут работать.'),
      h('span', {}, ' Открой '), h('a', { href: 'setup.html' }, 'страницу настройки'),
      h('span', {}, ' и выполни инструкцию. Ошибка: ' + (dbError.message || dbError.code || ''))) : null,
    h('div', { class: 'app' }, side, main)].filter(Boolean));
  renderMe();
}

export function renderMe() {
  meAvatar.replaceChildren(
    avatar(state.profile.avatar_url, state.profile.display_name, 36),
    h('div', { class: 'side-me-text' }, h('b', {}, state.profile.display_name), h('span', {}, '@' + state.profile.username)));
}
export function setBalance(n) {
  state.balance = n;
  balanceChip.lastChild.textContent = coins(n);
}
export function setUnread(n) {
  unreadBadge.hidden = !n;
  unreadBadge.textContent = n > 99 ? '99+' : n;
  document.title = (n ? `(${n}) ` : '') + 'Sierra Messenger';
}

// ---------- Маршрутизация ----------
let cleanup = null;
async function route() {
  const hash = location.hash.replace(/^#\/?/, '') || 'feed';
  const [page, ...rest] = hash.split('/');
  const arg = rest.join('/');
  const view = document.getElementById('view');

  Object.entries(navLinks).forEach(([k, a]) => {
    const active = k === page || (page === 'chat' && k === 'chats') || (page === 'u' && arg === state.profile.username && k === 'profile');
    a.classList.toggle('active', active);
  });
  document.body.classList.toggle('in-chat', page === 'chat');
  document.body.classList.toggle('is-banned', !!state.banned);

  if (typeof cleanup === 'function') { try { cleanup(); } catch {} }
  cleanup = null;
  view.replaceChildren();
  view.scrollTop = 0;

  // Заблокированный пользователь видит только экран блокировки и чат поддержки
  if (state.banned && !['chat', 'settings'].includes(page)) {
    view.append(banScreen());
    return;
  }

  try {
    switch (page) {
      case 'feed': cleanup = await renderFeed(view); break;
      case 'chats': cleanup = await renderChats(view, null); break;
      case 'chat': cleanup = await renderChats(view, arg); break;
      case 'search': cleanup = await renderSearch(view, decodeURIComponent(arg || '')); break;
      case 'gifts': cleanup = await renderGifts(view, arg || 'shop'); break;
      case 'wallet': cleanup = await renderWallet(view); break;
      case 'profile': cleanup = await renderProfile(view, state.profile.username); break;
      case 'u': cleanup = await renderProfile(view, decodeURIComponent(arg)); break;
      case 'settings': cleanup = await renderSettings(view); break;
      case 'post': cleanup = await renderPost(view, arg); break;
      case 'admin': cleanup = await renderAdmin(view, arg || 'overview'); break;
      default: go('#/feed');
    }
  } catch (e) {
    console.error(e);
    view.append(h('div', { class: 'config-banner' }, 'Не удалось открыть раздел: ' + (e.message || e)));
  }
}

function banScreen() {
  const b = state.banned;
  return h('div', { class: 'ban-screen fade-up' },
    h('div', { class: 'big' }, '⛔'),
    h('h1', {}, 'Аккаунт заблокирован'),
    b.reason ? h('p', {}, 'Причина: ', h('b', {}, b.reason)) : null,
    h('p', { class: 'muted' }, 'Заблокирован ' + new Date(b.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })),
    h('p', { class: 'muted' }, 'Если считаешь это ошибкой — напиши в поддержку, администрация рассмотрит обращение.'),
    h('div', { class: 'stack', style: { maxWidth: '320px', margin: '18px auto 0' } },
      h('button', { class: 'btn', onclick: openSupport }, '💬 Написать в поддержку'),
      h('button', { class: 'btn ghost', onclick: async () => { await sb.auth.signOut(); location.replace('index.html'); } }, 'Выйти')));
}

// ---------- Реальное время: сообщения и «в сети» ----------
function startRealtime() {
  sb.channel('db-messages')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (p) => onRealtimeMessage(p))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (p) => onRealtimeReaction(p))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gift_catalog' }, (p) => onCatalogUpdate(p.new))
    .subscribe();

  const presence = sb.channel('online', { config: { presence: { key: state.me.id } } });
  presence
    .on('presence', { event: 'sync' }, () => {
      state.online = new Set(Object.keys(presence.presenceState()));
      window.dispatchEvent(new Event('sierra:presence'));
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await presence.track({ at: Date.now() });
    });

  const ping = () => sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', state.me.id).then(() => {});
  ping();
  setInterval(ping, 60_000);
}

// ---------- Запуск ----------
buildShell();
window.addEventListener('hashchange', route);
window.addEventListener('sierra:profile', renderMe);
window.addEventListener('sierra:balance', (e) => setBalance(e.detail));
window.addEventListener('sierra:unread', (e) => setUnread(e.detail));
startRealtime();
refreshBalance();
refreshChatList();
await route();

if (!location.hash) history.replaceState(null, '', '#/feed');
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.replace('index.html'); });
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && !e.reason.__shown) console.warn(e.reason);
});
export { toast };
