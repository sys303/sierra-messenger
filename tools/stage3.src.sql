-- =====================================================================
-- Sierra Messenger — ЭТАП 3
-- 250 подарков и NFT-атрибуты, реакции, пересылка, посты,
-- поддержка, жалобы, блокировки и админ-панель.
-- Запускать ПОСЛЕ stage2.sql. Можно запускать повторно.
-- =====================================================================

-- =====================================================================
-- 1. АДМИНИСТРАТОРЫ И БЛОКИРОВКИ
-- =====================================================================
create table if not exists public.admins (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "Видеть себя в админах" on public.admins;
create policy "Видеть себя в админах" on public.admins for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public._require_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Только для администратора'; end if;
end $$;

create table if not exists public.bans (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  reason     text not null default '',
  banned_by  uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.bans enable row level security;
drop policy if exists "Видеть свою блокировку" on public.bans;
create policy "Видеть свою блокировку" on public.bans for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create or replace function public.my_ban()
returns table (reason text, created_at timestamptz) language sql stable security definer set search_path = '' as $$
  select b.reason, b.created_at from public.bans b where b.user_id = auth.uid();
$$;

-- =====================================================================
-- 2. ПОДАРКИ: 250 штук и NFT-атрибуты
-- =====================================================================
alter table public.gift_catalog add column if not exists shape  int;
alter table public.gift_catalog add column if not exists colors text[];
alter table public.gift_catalog add column if not exists theme  text;
alter table public.gift_catalog add column if not exists tier   int not null default 0;
alter table public.gift_catalog add column if not exists effect text;

create table if not exists public.nft_models (
  name text primary key, colors text[], effect text,
  weight int not null, mult numeric not null, tier int not null default 0, sort int not null default 0
);
create table if not exists public.nft_backdrops (
  name text primary key, center text not null, edge text not null,
  weight int not null, mult numeric not null, tier int not null default 0, sort int not null default 0
);
create table if not exists public.nft_symbols (
  name text primary key, path text not null,
  weight int not null, mult numeric not null, tier int not null default 0, sort int not null default 0
);
alter table public.nft_models enable row level security;
alter table public.nft_backdrops enable row level security;
alter table public.nft_symbols enable row level security;
drop policy if exists "Модели видны всем" on public.nft_models;
create policy "Модели видны всем" on public.nft_models for select using (true);
drop policy if exists "Фоны видны всем" on public.nft_backdrops;
create policy "Фоны видны всем" on public.nft_backdrops for select using (true);
drop policy if exists "Символы видны всем" on public.nft_symbols;
create policy "Символы видны всем" on public.nft_symbols for select using (true);

alter table public.user_gifts add column if not exists value bigint;

@@DATA@@

-- Старые NFT: символы → названия, и оценка стоимости
update public.user_gifts set pattern = case pattern
    when '✦' then 'Искра' when '❄' then 'Снежинка' when '⚡' then 'Молния' when '☾' then 'Луна'
    when '✿' then 'Цветок' when '◆' then 'Ромб' when '♛' then 'Корона' when '✺' then 'Солнце' else pattern end
  where is_collectible and pattern in ('✦', '❄', '⚡', '☾', '✿', '◆', '♛', '✺');

update public.user_gifts ug set value = sub.v
from (
  select u.id, (round(gc.price * coalesce(m.mult, 1) * coalesce(b.mult, 1) * coalesce(s.mult, 1)) + 25)::bigint as v
  from public.user_gifts u
  join public.gift_catalog gc on gc.id = u.gift_id
  left join public.nft_models m on m.name = u.model
  left join public.nft_backdrops b on b.name = u.backdrop
  left join public.nft_symbols s on s.name = u.pattern
  where u.is_collectible
) sub
where ug.id = sub.id and ug.value is null;

-- Случайный выбор с учётом редкости
create or replace function public._pick_model() returns text language sql volatile set search_path = '' as $$
  select name from public.nft_models order by -ln(1 - random()) / weight limit 1;
$$;
create or replace function public._pick_backdrop() returns text language sql volatile set search_path = '' as $$
  select name from public.nft_backdrops order by -ln(1 - random()) / weight limit 1;
$$;
create or replace function public._pick_symbol() returns text language sql volatile set search_path = '' as $$
  select name from public.nft_symbols order by -ln(1 - random()) / weight limit 1;
$$;

-- Превратить подарок в NFT (без оплаты — внутренняя функция)
create or replace function public._upgrade(p_ug uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r record; num int; m text; b text; s text; v bigint;
begin
  select ug.*, gc.price into r from public.user_gifts ug join public.gift_catalog gc on gc.id = ug.gift_id
    where ug.id = p_ug for update of ug;
  if r.id is null then raise exception 'Подарок не найден'; end if;
  if r.is_collectible then raise exception 'Подарок уже улучшен'; end if;
  perform 1 from public.gift_catalog where id = r.gift_id for update;
  select coalesce(max(collectible_no), 0) + 1 into num from public.user_gifts where gift_id = r.gift_id;
  m := public._pick_model(); b := public._pick_backdrop(); s := public._pick_symbol();
  select (round(r.price * mm.mult * bb.mult * ss.mult) + 25)::bigint into v
    from public.nft_models mm, public.nft_backdrops bb, public.nft_symbols ss
    where mm.name = m and bb.name = b and ss.name = s;
  update public.user_gifts set is_collectible = true, collectible_no = num, upgraded_at = now(),
    model = m, backdrop = b, pattern = s, value = v
  where id = p_ug;
end $$;

create or replace function public.upgrade_gift(p_ug uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  select ug.*, gc.name, gc.upgrade_price into r from public.user_gifts ug join public.gift_catalog gc on gc.id = ug.gift_id
    where ug.id = p_ug and ug.owner_id = auth.uid() for update of ug;
  if r.id is null then raise exception 'Подарок не найден'; end if;
  if r.is_collectible then raise exception 'Подарок уже улучшен'; end if;
  perform public._coins(auth.uid(), -coalesce(r.upgrade_price, 25), 'Улучшение «' || r.name || '» до NFT');
  perform public._upgrade(p_ug);
  return p_ug;
end $$;

-- Покупка подарка (можно сразу улучшить до NFT за +25)
drop function if exists public.buy_gift(int, uuid, text);
create or replace function public.buy_gift(p_gift int, p_to uuid default null, p_message text default '', p_upgrade boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); g record; ug uuid; cid uuid; cost bigint; r record;
begin
  if me is null then raise exception 'Нужно войти'; end if;
  p_to := coalesce(p_to, me);
  if not exists (select 1 from public.profiles where id = p_to) then raise exception 'Получатель не найден'; end if;
  update public.gift_catalog set sold = sold + 1
    where id = p_gift and (total_supply is null or sold < total_supply)
    returning * into g;
  if g.id is null then raise exception 'Этот подарок закончился'; end if;
  cost := g.price + case when p_upgrade then coalesce(g.upgrade_price, 25) else 0 end;
  perform public._coins(me, -cost, 'Подарок «' || g.name || '»' || case when p_upgrade then ' + NFT' else '' end);
  insert into public.user_gifts (gift_id, owner_id, sender_id, message, serial)
    values (g.id, p_to, me, coalesce(left(p_message, 255), ''), g.sold)
    returning id into ug;
  if p_upgrade then perform public._upgrade(ug); end if;
  if p_to <> me then
    cid := public._direct_between(me, p_to);
    select collectible_no into r from public.user_gifts where id = ug;
    insert into public.messages (chat_id, sender_id, kind, text, meta)
    values (cid, me, 'gift', coalesce(left(p_message, 255), ''),
      jsonb_build_object('user_gift', ug, 'gift_id', g.id, 'emoji', g.emoji,
        'name', g.name || case when p_upgrade then ' #' || r.collectible_no else '' end,
        'price', g.price, 'nft', p_upgrade));
  end if;
  return ug;
end $$;

-- =====================================================================
-- 3. ПОСТЫ: счётчики лайков, комментариев и пересылок
-- =====================================================================
alter table public.posts add column if not exists like_count    int not null default 0;
alter table public.posts add column if not exists comment_count int not null default 0;
alter table public.posts add column if not exists share_count   int not null default 0;

create or replace function public._post_counts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'likes' then
    if tg_op = 'INSERT' then update public.posts set like_count = like_count + 1 where id = new.post_id;
    else update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id; end if;
  else
    if tg_op = 'INSERT' then update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    else update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id; end if;
  end if;
  return null;
end $$;
drop trigger if exists likes_count on public.likes;
create trigger likes_count after insert or delete on public.likes for each row execute function public._post_counts();
drop trigger if exists comments_count on public.comments;
create trigger comments_count after insert or delete on public.comments for each row execute function public._post_counts();

update public.posts p set
  like_count = (select count(*) from public.likes l where l.post_id = p.id),
  comment_count = (select count(*) from public.comments c where c.post_id = p.id);

drop policy if exists "Админ удаляет посты" on public.posts;
create policy "Админ удаляет посты" on public.posts for delete to authenticated using (public.is_admin());
drop policy if exists "Админ удаляет комменты" on public.comments;
create policy "Админ удаляет комменты" on public.comments for delete to authenticated using (public.is_admin());

-- =====================================================================
-- 4. ЧАТЫ ПОДДЕРЖКИ
-- =====================================================================
alter table public.chats drop constraint if exists chats_type_check;
alter table public.chats add constraint chats_type_check check (type in ('direct', 'group', 'channel', 'support'));
alter table public.chats add column if not exists support_user uuid unique references public.profiles(id) on delete cascade;

create or replace function public.is_support_chat(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chats where id = c and type = 'support');
$$;

create or replace function public.is_chat_member(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chat_members m where m.chat_id = c and m.user_id = auth.uid())
    or (public.is_admin() and public.is_support_chat(c));
$$;

create or replace function public.can_post(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_members m join public.chats ch on ch.id = m.chat_id
    where m.chat_id = c and m.user_id = auth.uid()
      and (ch.type <> 'channel' or m.role in ('owner', 'admin'))
  ) or (public.is_admin() and public.is_support_chat(c));
$$;

create or replace function public._support_chat_for(u uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  select id into cid from public.chats where support_user = u;
  if cid is null then
    insert into public.chats (type, title, description, support_user, created_by)
      values ('support', 'Поддержка Sierra', 'Здесь можно задать вопрос администрации', u, u)
      on conflict (support_user) do nothing returning id into cid;
    if cid is null then select id into cid from public.chats where support_user = u; end if;
    insert into public.chat_members (chat_id, user_id) values (cid, u) on conflict do nothing;
    insert into public.messages (chat_id, sender_id, kind, text)
      values (cid, null, 'system', 'Здравствуйте! Опишите вопрос или проблему — администрация ответит прямо здесь.');
  end if;
  return cid;
end $$;

create or replace function public.get_support_chat()
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Нужно войти'; end if;
  return public._support_chat_for(auth.uid());
end $$;

-- =====================================================================
-- 5. СООБЩЕНИЯ: посты в чатах, реакции, пересылка
-- =====================================================================
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text', 'image', 'gift', 'coins', 'system', 'post'));

drop policy if exists "Админ удаляет сообщения" on public.messages;
create policy "Админ удаляет сообщения" on public.messages for delete to authenticated using (public.is_admin());

create table if not exists public.message_reactions (
  message_id bigint not null references public.messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists message_reactions_msg_idx on public.message_reactions(message_id);
alter table public.message_reactions enable row level security;
alter table public.message_reactions replica identity full;

create or replace function public._msg_chat(m bigint)
returns uuid language sql stable security definer set search_path = '' as $$
  select chat_id from public.messages where id = m;
$$;

drop policy if exists "Видеть реакции" on public.message_reactions;
create policy "Видеть реакции" on public.message_reactions for select to authenticated
  using (public.is_chat_member(public._msg_chat(message_id)));
drop policy if exists "Ставить реакцию" on public.message_reactions;
create policy "Ставить реакцию" on public.message_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_chat_member(public._msg_chat(message_id)));
drop policy if exists "Менять реакцию" on public.message_reactions;
create policy "Менять реакцию" on public.message_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Убирать реакцию" on public.message_reactions;
create policy "Убирать реакцию" on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

-- Переслать сообщения в другие чаты
create or replace function public.forward_messages(p_ids bigint[], p_chats uuid[])
returns int language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c uuid; m record; n int := 0; src record; fwd jsonb;
begin
  if me is null then raise exception 'Нужно войти'; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 or coalesce(array_length(p_chats, 1), 0) = 0 then return 0; end if;
  if array_length(p_ids, 1) > 50 or array_length(p_chats, 1) > 20 then raise exception 'Слишком много за один раз'; end if;
  foreach c in array p_chats loop
    if not public.can_post(c) then continue; end if;
    for m in select * from public.messages where id = any(p_ids) and kind in ('text', 'image', 'post') order by id loop
      if not public.is_chat_member(m.chat_id) then continue; end if;
      if m.meta ? 'fwd_name' then
        fwd := jsonb_build_object('fwd_name', m.meta->>'fwd_name', 'fwd_username', m.meta->>'fwd_username', 'fwd_chat', m.meta->>'fwd_chat');
      else
        select ch.type, ch.title, ch.username, p.username as u_name, p.display_name into src
          from public.chats ch left join public.profiles p on p.id = m.sender_id where ch.id = m.chat_id;
        if src.type = 'channel' then
          fwd := jsonb_build_object('fwd_name', src.title, 'fwd_username', src.username, 'fwd_chat', m.chat_id);
        else
          fwd := jsonb_build_object('fwd_name', coalesce(src.display_name, 'Пользователь'), 'fwd_username', src.u_name, 'fwd_chat', null);
        end if;
      end if;
      insert into public.messages (chat_id, sender_id, kind, text, image_url, meta)
        values (c, me, m.kind, m.text, m.image_url, coalesce(m.meta, '{}'::jsonb) || fwd);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

-- Поделиться постом в чатах
create or replace function public.share_post(p_post uuid, p_chats uuid[], p_text text default '')
returns int language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c uuid; n int := 0;
begin
  if me is null then raise exception 'Нужно войти'; end if;
  if not exists (select 1 from public.posts where id = p_post) then raise exception 'Пост не найден'; end if;
  if coalesce(array_length(p_chats, 1), 0) > 20 then raise exception 'Слишком много чатов'; end if;
  foreach c in array coalesce(p_chats, '{}') loop
    if not public.can_post(c) then continue; end if;
    insert into public.messages (chat_id, sender_id, kind, text, meta)
      values (c, me, 'post', coalesce(left(p_text, 1000), ''), jsonb_build_object('post_id', p_post));
    n := n + 1;
  end loop;
  update public.posts set share_count = share_count + n where id = p_post;
  return n;
end $$;

-- =====================================================================
-- 6. ЖАЛОБЫ
-- =====================================================================
create table if not exists public.reports (
  id           bigint generated always as identity primary key,
  reporter_id  uuid references public.profiles(id) on delete set null default auth.uid(),
  target_type  text not null check (target_type in ('user', 'message', 'post', 'chat')),
  target_id    text not null,
  target_user  uuid references public.profiles(id) on delete set null,
  reason       text not null check (char_length(reason) between 1 and 100),
  details      text not null default '' check (char_length(details) <= 1000),
  snapshot     jsonb,
  status       text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  admin_reply  text,
  resolved_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index if not exists reports_status_idx on public.reports(status, created_at desc);
alter table public.reports enable row level security;
drop policy if exists "Свои жалобы и админ" on public.reports;
create policy "Свои жалобы и админ" on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

create or replace function public.create_report(p_type text, p_target text, p_reason text, p_details text default '')
returns bigint language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); tu uuid; snap jsonb; rid bigint; r record;
begin
  if me is null then raise exception 'Нужно войти'; end if;
  if (select count(*) from public.reports where reporter_id = me and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Слишком много жалоб. Попробуй позже';
  end if;
  if p_type = 'user' then
    select id, username, display_name, bio into r from public.profiles where id = p_target::uuid;
    if r.id is null then raise exception 'Пользователь не найден'; end if;
    tu := r.id; snap := jsonb_build_object('username', r.username, 'name', r.display_name, 'bio', r.bio);
  elsif p_type = 'message' then
    select id, chat_id, sender_id, kind, text, image_url into r from public.messages where id = p_target::bigint;
    if r.id is null or not public.is_chat_member(r.chat_id) then raise exception 'Сообщение не найдено'; end if;
    tu := r.sender_id; snap := jsonb_build_object('text', r.text, 'image_url', r.image_url, 'kind', r.kind, 'chat_id', r.chat_id);
  elsif p_type = 'post' then
    select id, author_id, text, image_url into r from public.posts where id = p_target::uuid;
    if r.id is null then raise exception 'Пост не найден'; end if;
    tu := r.author_id; snap := jsonb_build_object('text', r.text, 'image_url', r.image_url);
  elsif p_type = 'chat' then
    select id, created_by, title, username, description into r from public.chats where id = p_target::uuid;
    if r.id is null then raise exception 'Чат не найден'; end if;
    tu := r.created_by; snap := jsonb_build_object('title', r.title, 'username', r.username, 'description', r.description);
  else
    raise exception 'Неверный тип жалобы';
  end if;
  if tu = me then raise exception 'Нельзя пожаловаться на себя'; end if;
  select id into rid from public.reports
    where reporter_id = me and target_type = p_type and target_id = p_target and status = 'open';
  if rid is not null then return rid; end if;
  insert into public.reports (reporter_id, target_type, target_id, target_user, reason, details, snapshot)
    values (me, p_type, p_target, tu, left(coalesce(p_reason, 'Другое'), 100), left(coalesce(p_details, ''), 1000), snap)
    returning id into rid;
  return rid;
end $$;

-- =====================================================================
-- 7. ЗАЩИТА: заблокированные не могут ничего делать (кроме поддержки)
-- =====================================================================
create or replace function public._block_banned()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.bans where user_id = auth.uid()) then return new; end if;
  -- в поддержку писать можно всегда
  if tg_table_name in ('messages', 'chat_members') then
    if public.is_support_chat((to_jsonb(new) ->> 'chat_id')::uuid) then return new; end if;
  elsif tg_table_name = 'chats' then
    if to_jsonb(new) ->> 'type' = 'support' then return new; end if;
  end if;
  raise exception 'Аккаунт заблокирован';
end $$;

do $$
declare t text;
begin
  foreach t in array array['posts', 'comments', 'likes', 'contacts', 'messages', 'message_reactions',
                           'chats', 'chat_members', 'user_gifts', 'coin_tx', 'reports'] loop
    execute format('drop trigger if exists block_banned on public.%I', t);
    if t = 'user_gifts' then
      execute format('create trigger block_banned before insert or update on public.%I for each row execute function public._block_banned()', t);
    else
      execute format('create trigger block_banned before insert on public.%I for each row execute function public._block_banned()', t);
    end if;
  end loop;
end $$;

-- =====================================================================
-- 8. АДМИН-ФУНКЦИИ
-- =====================================================================
create or replace function public._support_notice(u uuid, txt text)
returns void language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  cid := public._support_chat_for(u);
  insert into public.messages (chat_id, sender_id, kind, text) values (cid, auth.uid(), 'text', txt);
end $$;

create or replace function public.admin_stats()
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_admin();
  return json_build_object(
    'users',          (select count(*) from public.profiles),
    'active_today',   (select count(*) from public.profiles where last_seen > now() - interval '1 day'),
    'messages',       (select count(*) from public.messages),
    'posts',          (select count(*) from public.posts),
    'gifts',          (select count(*) from public.user_gifts),
    'nfts',           (select count(*) from public.user_gifts where is_collectible),
    'coins',          (select coalesce(sum(balance), 0) from public.wallets),
    'banned',         (select count(*) from public.bans),
    'open_reports',   (select count(*) from public.reports where status = 'open'),
    'support_waiting', (
      select count(*) from public.chats c
      where c.type = 'support' and (
        select m.sender_id from public.messages m where m.chat_id = c.id and m.kind <> 'system' order by m.id desc limit 1
      ) = c.support_user)
  );
end $$;

create or replace function public.admin_users(p_q text default '')
returns table (
  id uuid, username text, display_name text, avatar_url text, email text, phone text,
  balance bigint, is_banned boolean, ban_reason text, is_admin boolean, created_at timestamptz, last_seen timestamptz
) language plpgsql stable security definer set search_path = '' as $$
declare s text := '%' || lower(trim(leading '@' from coalesce(trim(p_q), ''))) || '%';
begin
  perform public._require_admin();
  return query
    select p.id, p.username, p.display_name, p.avatar_url, i.email, i.phone,
      coalesce(w.balance, 0), b.user_id is not null, b.reason, a.user_id is not null, p.created_at, p.last_seen
    from public.profiles p
    left join public.private_info i on i.user_id = p.id
    left join public.wallets w on w.user_id = p.id
    left join public.bans b on b.user_id = p.id
    left join public.admins a on a.user_id = p.id
    where coalesce(p_q, '') = '' or lower(p.username) like s or lower(p.display_name) like s or lower(coalesce(i.email, '')) like s
    order by p.created_at desc
    limit 60;
end $$;

create or replace function public.admin_give_coins(p_username text, p_amount bigint, p_note text default '')
returns bigint language plpgsql security definer set search_path = '' as $$
declare u uuid; nb bigint; note text := coalesce(nullif(trim(p_note), ''), '');
begin
  perform public._require_admin();
  if p_amount is null or p_amount = 0 or abs(p_amount) > 100000000 then raise exception 'Сумма от 1 до 100 000 000'; end if;
  select id into u from public.profiles where username = lower(trim(leading '@' from trim(p_username)));
  if u is null then raise exception 'Пользователь @% не найден', trim(leading '@' from trim(p_username)); end if;
  insert into public.wallets (user_id, balance) values (u, 0) on conflict (user_id) do nothing;
  perform public._coins(u, p_amount,
    case when p_amount > 0 then 'Начисление от администрации' else 'Списание администрацией' end
    || case when note <> '' then ': ' || note else '' end);
  select balance into nb from public.wallets where user_id = u;
  if u <> auth.uid() then
    perform public._support_notice(u,
      case when p_amount > 0 then '🪙 Администрация начислила вам ' || p_amount || ' SierCoin'
           else '🪙 Администрация списала ' || abs(p_amount) || ' SierCoin' end
      || case when note <> '' then '. Комментарий: ' || note else '' end);
  end if;
  return nb;
end $$;

create or replace function public.admin_ban(p_user uuid, p_reason text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_admin();
  if p_user = auth.uid() then raise exception 'Нельзя заблокировать себя'; end if;
  if exists (select 1 from public.admins where user_id = p_user) then raise exception 'Нельзя заблокировать администратора'; end if;
  insert into public.bans (user_id, reason, banned_by) values (p_user, coalesce(p_reason, ''), auth.uid())
    on conflict (user_id) do update set reason = excluded.reason, banned_by = excluded.banned_by, created_at = now();
  update public.user_gifts set sale_price = null where owner_id = p_user and sale_price is not null;
  perform public._support_notice(p_user, '⛔ Ваш аккаунт заблокирован.'
    || case when coalesce(p_reason, '') <> '' then ' Причина: ' || p_reason || '.' else '' end
    || ' Если считаете это ошибкой — напишите сюда.');
end $$;

create or replace function public.admin_unban(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_admin();
  delete from public.bans where user_id = p_user;
  perform public._support_notice(p_user, '✅ Ваш аккаунт разблокирован. Добро пожаловать обратно!');
end $$;

create or replace function public.admin_reports(p_status text default 'open')
returns table (
  id bigint, target_type text, target_id text, reason text, details text, snapshot jsonb, status text,
  admin_reply text, created_at timestamptz, resolved_at timestamptz,
  reporter_id uuid, reporter_username text, reporter_name text,
  target_user uuid, target_username text, target_name text, target_banned boolean
) language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_admin();
  return query
    select r.id, r.target_type, r.target_id, r.reason, r.details, r.snapshot, r.status, r.admin_reply, r.created_at, r.resolved_at,
      r.reporter_id, rp.username, rp.display_name, r.target_user, tp.username, tp.display_name,
      exists (select 1 from public.bans b where b.user_id = r.target_user)
    from public.reports r
    left join public.profiles rp on rp.id = r.reporter_id
    left join public.profiles tp on tp.id = r.target_user
    where coalesce(p_status, 'all') = 'all' or r.status = p_status
    order by r.created_at desc
    limit 100;
end $$;

create or replace function public.admin_resolve_report(p_id bigint, p_status text, p_reply text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  perform public._require_admin();
  if p_status not in ('open', 'resolved', 'rejected') then raise exception 'Неверный статус'; end if;
  update public.reports set status = p_status, admin_reply = nullif(trim(p_reply), ''),
    resolved_by = auth.uid(), resolved_at = case when p_status = 'open' then null else now() end
    where id = p_id returning * into r;
  if r.id is null then raise exception 'Жалоба не найдена'; end if;
  if coalesce(trim(p_reply), '') <> '' and r.reporter_id is not null then
    perform public._support_notice(r.reporter_id, '📋 Ответ на вашу жалобу №' || r.id || ': ' || trim(p_reply));
  end if;
end $$;

create or replace function public.admin_support_chats()
returns table (
  chat_id uuid, user_id uuid, username text, display_name text, avatar_url text,
  last_text text, last_kind text, last_at timestamptz, waiting boolean, total bigint
) language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_admin();
  return query
    select c.id, p.id, p.username, p.display_name, p.avatar_url,
      lm.text, lm.kind, coalesce(lm.created_at, c.created_at),
      coalesce(lm.sender_id = c.support_user, false),
      (select count(*) from public.messages m where m.chat_id = c.id and m.kind <> 'system')
    from public.chats c
    join public.profiles p on p.id = c.support_user
    left join lateral (
      select m.text, m.kind, m.sender_id, m.created_at from public.messages m
      where m.chat_id = c.id and m.kind <> 'system' order by m.id desc limit 1
    ) lm on true
    where c.type = 'support'
    order by coalesce(lm.sender_id = c.support_user, false) desc, coalesce(lm.created_at, c.created_at) desc
    limit 200;
end $$;

-- =====================================================================
-- 9. ПРАВА, РЕАЛЬНОЕ ВРЕМЯ, ВНУТРЕННИЕ ФУНКЦИИ
-- =====================================================================
grant select on public.nft_models, public.nft_backdrops, public.nft_symbols to anon, authenticated;
grant select on public.admins, public.bans, public.reports to authenticated;
grant select, insert, update, delete on public.message_reactions to authenticated;

revoke execute on function public._upgrade(uuid) from public, anon, authenticated;
revoke execute on function public._pick_model() from public, anon, authenticated;
revoke execute on function public._pick_backdrop() from public, anon, authenticated;
revoke execute on function public._pick_symbol() from public, anon, authenticated;
revoke execute on function public._support_chat_for(uuid) from public, anon, authenticated;
revoke execute on function public._support_notice(uuid, text) from public, anon, authenticated;
revoke execute on function public._post_counts() from public, anon, authenticated;
revoke execute on function public._block_banned() from public, anon, authenticated;

grant execute on function
  public.is_admin(), public.my_ban(), public.upgrade_gift(uuid), public.buy_gift(int, uuid, text, boolean),
  public.get_support_chat(), public.is_support_chat(uuid), public.is_chat_member(uuid), public.can_post(uuid),
  public._msg_chat(bigint), public.forward_messages(bigint[], uuid[]), public.share_post(uuid, uuid[], text),
  public.create_report(text, text, text, text), public._require_admin(),
  public.admin_stats(), public.admin_users(text), public.admin_give_coins(text, bigint, text),
  public.admin_ban(uuid, text), public.admin_unban(uuid), public.admin_reports(text),
  public.admin_resolve_report(bigint, text, text), public.admin_support_chats()
to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions') then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Если ты видишь «Success» — этап 3 установлен! 🎉
