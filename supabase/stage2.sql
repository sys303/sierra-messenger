-- =====================================================================
-- Sierra Messenger — ЭТАП 2
-- Лента, чаты, группы и каналы, контакты, SierCoin, подарки и NFT
-- Запускать ПОСЛЕ schema.sql: Supabase → SQL Editor → вставить всё → Run
-- Можно запускать повторно — ничего не сломается.
-- =====================================================================

-- ---------- 0. Профиль: «был в сети» ----------
alter table public.profiles add column if not exists last_seen timestamptz default now();

-- =====================================================================
-- 1. ЛИЧНЫЕ ДАННЫЕ (почта, телефон) — видны только владельцу
-- =====================================================================
create table if not exists public.private_info (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  email         text,
  phone         text unique,
  find_by_email boolean not null default true,
  find_by_phone boolean not null default true
);
alter table public.private_info enable row level security;
drop policy if exists "Свои личные данные" on public.private_info;
create policy "Свои личные данные" on public.private_info for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.normalize_phone(p text)
returns text language plpgsql immutable set search_path = '' as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if length(d) = 11 and left(d, 1) = '8' then d := '7' || substr(d, 2); end if;
  if length(d) = 10 and left(d, 1) = '9' then d := '7' || d; end if;
  if length(d) < 10 or length(d) > 15 then return null; end if;
  return '+' || d;
end $$;

-- =====================================================================
-- 2. КОШЕЛЁК SierCoin
-- =====================================================================
create table if not exists public.wallets (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  balance    bigint not null default 0 check (balance >= 0),
  last_daily timestamptz
);
alter table public.wallets enable row level security;
drop policy if exists "Свой кошелёк" on public.wallets;
create policy "Свой кошелёк" on public.wallets for select to authenticated
  using (auth.uid() = user_id);

create table if not exists public.coin_tx (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     bigint not null,
  reason     text not null,
  created_at timestamptz not null default now()
);
create index if not exists coin_tx_user_idx on public.coin_tx(user_id, id desc);
alter table public.coin_tx enable row level security;
drop policy if exists "Свои операции" on public.coin_tx;
create policy "Свои операции" on public.coin_tx for select to authenticated
  using (auth.uid() = user_id);

-- Внутренняя функция: изменить баланс (+/-). Пользователи вызвать её не могут.
create or replace function public._coins(u uuid, amt bigint, why text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  begin
    update public.wallets set balance = balance + amt where user_id = u;
  exception when check_violation then
    raise exception 'Недостаточно SierCoin';
  end;
  if not found then raise exception 'Кошелёк не найден'; end if;
  insert into public.coin_tx(user_id, amount, reason) values (u, amt, why);
end $$;
revoke execute on function public._coins(uuid, bigint, text) from public, anon, authenticated;

-- =====================================================================
-- 3. РЕГИСТРАЦИЯ: профиль + личные данные + кошелёк со 100 SierCoin
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'username'),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), new.raw_user_meta_data ->> 'username')
  );
  insert into public.private_info (user_id, email) values (new.id, lower(new.email))
    on conflict (user_id) do nothing;
  insert into public.wallets (user_id, balance) values (new.id, 100)
    on conflict (user_id) do nothing;
  insert into public.coin_tx (user_id, amount, reason) values (new.id, 100, 'Приветственный бонус');
  return new;
end $$;

-- Для тех, кто зарегистрировался до этапа 2
insert into public.private_info (user_id, email)
  select u.id, lower(u.email) from auth.users u join public.profiles p on p.id = u.id
  on conflict (user_id) do nothing;
with created as (
  insert into public.wallets (user_id, balance)
    select p.id, 100 from public.profiles p
    on conflict (user_id) do nothing
  returning user_id
)
insert into public.coin_tx (user_id, amount, reason)
  select user_id, 100, 'Приветственный бонус' from created;

-- =====================================================================
-- 4. КОНТАКТЫ
-- =====================================================================
create table if not exists public.contacts (
  owner_id   uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  contact_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, contact_id),
  check (owner_id <> contact_id)
);
alter table public.contacts enable row level security;
drop policy if exists "Свои контакты: видеть" on public.contacts;
create policy "Свои контакты: видеть" on public.contacts for select to authenticated using (auth.uid() = owner_id);
drop policy if exists "Свои контакты: добавлять" on public.contacts;
create policy "Свои контакты: добавлять" on public.contacts for insert to authenticated with check (auth.uid() = owner_id);
drop policy if exists "Свои контакты: удалять" on public.contacts;
create policy "Свои контакты: удалять" on public.contacts for delete to authenticated using (auth.uid() = owner_id);

-- Поиск человека по ТОЧНОЙ почте или телефону (сами почты/телефоны никому не показываются)
create or replace function public.find_user_by_contact(q text)
returns setof public.profiles language plpgsql stable security definer set search_path = '' as $$
declare ph text;
begin
  if auth.uid() is null or q is null or length(trim(q)) < 5 then return; end if;
  if position('@' in q) > 0 then
    return query select p.* from public.profiles p
      join public.private_info i on i.user_id = p.id
      where i.email = lower(trim(q)) and i.find_by_email and p.id <> auth.uid();
  else
    ph := public.normalize_phone(q);
    if ph is null then return; end if;
    return query select p.* from public.profiles p
      join public.private_info i on i.user_id = p.id
      where i.phone = ph and i.find_by_phone and p.id <> auth.uid();
  end if;
end $$;

create or replace function public.set_phone(p text)
returns text language plpgsql security definer set search_path = '' as $$
declare ph text;
begin
  if auth.uid() is null then raise exception 'Нужно войти'; end if;
  if p is null or trim(p) = '' then
    update public.private_info set phone = null where user_id = auth.uid();
    return null;
  end if;
  ph := public.normalize_phone(p);
  if ph is null then raise exception 'Неверный номер телефона'; end if;
  begin
    update public.private_info set phone = ph where user_id = auth.uid();
  exception when unique_violation then
    raise exception 'Этот номер уже привязан к другому аккаунту';
  end;
  return ph;
end $$;

create or replace function public.set_privacy(by_email boolean, by_phone boolean)
returns void language sql security definer set search_path = '' as $$
  update public.private_info set find_by_email = by_email, find_by_phone = by_phone
  where user_id = auth.uid();
$$;

-- =====================================================================
-- 5. ПОСТЫ, ЛАЙКИ, КОММЕНТАРИИ
-- =====================================================================
create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  text       text not null default '' check (char_length(text) <= 2000),
  image_url  text,
  created_at timestamptz not null default now(),
  check (char_length(text) > 0 or image_url is not null)
);
create index if not exists posts_created_idx on public.posts(created_at desc);
create index if not exists posts_author_idx on public.posts(author_id, created_at desc);
alter table public.posts enable row level security;
drop policy if exists "Посты видны всем" on public.posts;
create policy "Посты видны всем" on public.posts for select using (true);
drop policy if exists "Писать свои посты" on public.posts;
create policy "Писать свои посты" on public.posts for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists "Удалять свои посты" on public.posts;
create policy "Удалять свои посты" on public.posts for delete to authenticated using (auth.uid() = author_id);

create table if not exists public.likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.likes enable row level security;
drop policy if exists "Лайки видны всем" on public.likes;
create policy "Лайки видны всем" on public.likes for select using (true);
drop policy if exists "Ставить свой лайк" on public.likes;
create policy "Ставить свой лайк" on public.likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Убирать свой лайк" on public.likes;
create policy "Убирать свой лайк" on public.likes for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  text       text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments(post_id, created_at);
alter table public.comments enable row level security;
drop policy if exists "Комменты видны всем" on public.comments;
create policy "Комменты видны всем" on public.comments for select using (true);
drop policy if exists "Писать свои комменты" on public.comments;
create policy "Писать свои комменты" on public.comments for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists "Удалять комменты" on public.comments;
create policy "Удалять комменты" on public.comments for delete to authenticated using (
  auth.uid() = author_id
  or auth.uid() = (select p.author_id from public.posts p where p.id = post_id)
);

-- =====================================================================
-- 6. ЧАТЫ, ГРУППЫ, КАНАЛЫ, СООБЩЕНИЯ
-- =====================================================================
create table if not exists public.chats (
  id              uuid primary key default gen_random_uuid(),
  type            text not null check (type in ('direct', 'group', 'channel')),
  title           text check (char_length(title) <= 64),
  username        text unique check (username ~ '^[a-z0-9_]{4,32}$'),
  description     text not null default '' check (char_length(description) <= 255),
  avatar_url      text,
  is_public       boolean not null default false,
  direct_key      text unique,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
alter table public.chats enable row level security;

create table if not exists public.chat_members (
  chat_id      uuid not null references public.chats(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at    timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index if not exists chat_members_user_idx on public.chat_members(user_id);
alter table public.chat_members enable row level security;

create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  chat_id    uuid not null references public.chats(id) on delete cascade,
  sender_id  uuid references public.profiles(id) on delete set null default auth.uid(),
  kind       text not null default 'text' check (kind in ('text', 'image', 'gift', 'coins', 'system')),
  text       text not null default '' check (char_length(text) <= 4000),
  image_url  text,
  reply_to   bigint references public.messages(id) on delete set null,
  meta       jsonb,
  edited_at  timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_chat_idx on public.messages(chat_id, id desc);
alter table public.messages enable row level security;

-- Помощники для правил доступа
create or replace function public.chat_role(c uuid)
returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.chat_members m where m.chat_id = c and m.user_id = auth.uid();
$$;
create or replace function public.is_chat_member(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chat_members m where m.chat_id = c and m.user_id = auth.uid());
$$;
create or replace function public.is_public_chat(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select ch.is_public from public.chats ch where ch.id = c), false);
$$;
create or replace function public.can_post(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_members m join public.chats ch on ch.id = m.chat_id
    where m.chat_id = c and m.user_id = auth.uid()
      and (ch.type <> 'channel' or m.role in ('owner', 'admin'))
  );
$$;

-- Чаты: свои + публичные группы/каналы
drop policy if exists "Видеть чаты" on public.chats;
create policy "Видеть чаты" on public.chats for select
  using (is_public or public.is_chat_member(id));

-- Участники: видны участникам и для публичных чатов
drop policy if exists "Видеть участников" on public.chat_members;
create policy "Видеть участников" on public.chat_members for select
  using (public.is_chat_member(chat_id) or public.is_public_chat(chat_id));
drop policy if exists "Выйти из чата" on public.chat_members;
create policy "Выйти из чата" on public.chat_members for delete to authenticated
  using (user_id = auth.uid() and role <> 'owner');

-- Сообщения
drop policy if exists "Читать сообщения" on public.messages;
create policy "Читать сообщения" on public.messages for select to authenticated
  using (public.is_chat_member(chat_id));
drop policy if exists "Писать сообщения" on public.messages;
create policy "Писать сообщения" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and kind in ('text', 'image') and meta is null and public.can_post(chat_id));
drop policy if exists "Редактировать свои" on public.messages;
create policy "Редактировать свои" on public.messages for update to authenticated
  using (sender_id = auth.uid() and kind in ('text', 'image'))
  with check (sender_id = auth.uid());
drop policy if exists "Удалять сообщения" on public.messages;
create policy "Удалять сообщения" on public.messages for delete to authenticated
  using (sender_id = auth.uid() or public.chat_role(chat_id) in ('owner', 'admin'));

-- Редактировать можно только текст
revoke update on public.messages from anon, authenticated;
grant update (text, edited_at) on public.messages to authenticated;

-- Обновлять время последнего сообщения в чате
create or replace function public.touch_chat()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.chats set last_message_at = new.created_at where id = new.chat_id;
  return new;
end $$;
drop trigger if exists on_message_created on public.messages;
create trigger on_message_created after insert on public.messages
  for each row execute function public.touch_chat();

-- Личный чат с человеком (создаётся, если ещё нет)
create or replace function public.get_or_create_direct(other uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); k text; cid uuid;
begin
  if me is null then raise exception 'Нужно войти'; end if;
  if other is null or other = me then raise exception 'Нельзя написать самому себе'; end if;
  if not exists (select 1 from public.profiles where id = other) then raise exception 'Пользователь не найден'; end if;
  k := least(me::text, other::text) || ':' || greatest(me::text, other::text);
  select id into cid from public.chats where direct_key = k;
  if cid is null then
    insert into public.chats (type, direct_key, created_by) values ('direct', k, me)
      on conflict (direct_key) do nothing returning id into cid;
    if cid is null then select id into cid from public.chats where direct_key = k; end if;
    insert into public.chat_members (chat_id, user_id, role) values (cid, me, 'member'), (cid, other, 'member')
      on conflict do nothing;
  end if;
  return cid;
end $$;

-- Внутренний вариант для подарков/переводов (для двух любых людей)
create or replace function public._direct_between(a uuid, b uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare k text := least(a::text, b::text) || ':' || greatest(a::text, b::text); cid uuid;
begin
  select id into cid from public.chats where direct_key = k;
  if cid is null then
    insert into public.chats (type, direct_key, created_by) values ('direct', k, a)
      on conflict (direct_key) do nothing returning id into cid;
    if cid is null then select id into cid from public.chats where direct_key = k; end if;
    insert into public.chat_members (chat_id, user_id) values (cid, a), (cid, b) on conflict do nothing;
  end if;
  return cid;
end $$;
revoke execute on function public._direct_between(uuid, uuid) from public, anon, authenticated;

-- Создать группу или канал
create or replace function public.create_chat(
  p_type text, p_title text, p_username text default null, p_description text default '',
  p_is_public boolean default false, p_members uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); cid uuid; u uuid;
begin
  if me is null then raise exception 'Нужно войти'; end if;
  if p_type not in ('group', 'channel') then raise exception 'Неверный тип чата'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Введи название'; end if;
  if p_is_public and coalesce(p_username, '') = '' then raise exception 'Для публичного чата нужна ссылка (username)'; end if;
  begin
    insert into public.chats (type, title, username, description, is_public, created_by)
    values (p_type, trim(p_title), nullif(lower(trim(p_username)), ''), coalesce(p_description, ''), p_is_public, me)
    returning id into cid;
  exception
    when unique_violation then raise exception 'Эта ссылка уже занята';
    when check_violation then raise exception 'Ссылка: 4–32 символа, латиница, цифры и _';
  end;
  insert into public.chat_members (chat_id, user_id, role) values (cid, me, 'owner');
  foreach u in array coalesce(p_members, '{}') loop
    if u <> me and exists (select 1 from public.profiles where id = u) then
      insert into public.chat_members (chat_id, user_id) values (cid, u) on conflict do nothing;
    end if;
  end loop;
  insert into public.messages (chat_id, sender_id, kind, text)
  values (cid, me, 'system', case when p_type = 'group' then 'Группа создана' else 'Канал создан' end);
  return cid;
end $$;

create or replace function public.update_chat(
  c uuid, p_title text, p_username text, p_description text, p_is_public boolean, p_avatar_url text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.chat_role(c) not in ('owner', 'admin') then raise exception 'Нет прав'; end if;
  if p_is_public and coalesce(p_username, '') = '' then raise exception 'Для публичного чата нужна ссылка'; end if;
  begin
    update public.chats set
      title = coalesce(nullif(trim(p_title), ''), title),
      username = nullif(lower(trim(p_username)), ''),
      description = coalesce(p_description, ''),
      is_public = p_is_public,
      avatar_url = p_avatar_url
    where id = c and type <> 'direct';
  exception
    when unique_violation then raise exception 'Эта ссылка уже занята';
    when check_violation then raise exception 'Ссылка: 4–32 символа, латиница, цифры и _';
  end;
end $$;

create or replace function public.join_chat(c uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Нужно войти'; end if;
  if not public.is_public_chat(c) then raise exception 'Чат закрытый'; end if;
  insert into public.chat_members (chat_id, user_id) values (c, auth.uid()) on conflict do nothing;
end $$;

create or replace function public.add_members(c uuid, p_users uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare u uuid; t text;
begin
  select type into t from public.chats where id = c;
  if t is null or t = 'direct' then raise exception 'Чат не найден'; end if;
  if public.chat_role(c) is null then raise exception 'Нет прав'; end if;
  if t = 'channel' and public.chat_role(c) = 'member' then raise exception 'Нет прав'; end if;
  foreach u in array coalesce(p_users, '{}') loop
    insert into public.chat_members (chat_id, user_id) values (c, u) on conflict do nothing;
  end loop;
end $$;

create or replace function public.kick_member(c uuid, u uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.chat_role(c) not in ('owner', 'admin') then raise exception 'Нет прав'; end if;
  delete from public.chat_members where chat_id = c and user_id = u and role <> 'owner';
end $$;

create or replace function public.set_member_role(c uuid, u uuid, r text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.chat_role(c) <> 'owner' then raise exception 'Только владелец может назначать админов'; end if;
  if r not in ('admin', 'member') then raise exception 'Неверная роль'; end if;
  update public.chat_members set role = r where chat_id = c and user_id = u and role <> 'owner';
end $$;

create or replace function public.mark_read(c uuid)
returns void language sql security definer set search_path = '' as $$
  update public.chat_members set last_read_at = now() where chat_id = c and user_id = auth.uid();
$$;

-- Список моих чатов с последним сообщением и непрочитанными
create or replace function public.my_chats()
returns table (
  id uuid, type text, title text, username text, avatar_url text, is_public boolean,
  my_role text, members bigint,
  peer_id uuid, peer_username text, peer_name text, peer_avatar text, peer_last_seen timestamptz,
  last_text text, last_kind text, last_sender uuid, last_at timestamptz, unread bigint
) language sql stable security definer set search_path = '' as $$
  select c.id, c.type, c.title, c.username, c.avatar_url, c.is_public,
    me.role,
    (select count(*) from public.chat_members x where x.chat_id = c.id),
    p.id, p.username, p.display_name, p.avatar_url, p.last_seen,
    lm.text, lm.kind, lm.sender_id, coalesce(lm.created_at, c.created_at),
    (select count(*) from public.messages m2
      where m2.chat_id = c.id and m2.created_at > me.last_read_at
        and m2.sender_id is distinct from auth.uid())
  from public.chat_members me
  join public.chats c on c.id = me.chat_id
  left join lateral (
    select pr.* from public.chat_members o join public.profiles pr on pr.id = o.user_id
    where c.type = 'direct' and o.chat_id = c.id and o.user_id <> auth.uid() limit 1
  ) p on true
  left join lateral (
    select m.text, m.kind, m.sender_id, m.created_at from public.messages m
    where m.chat_id = c.id order by m.id desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
    and (c.type <> 'direct' or lm.created_at is not null)
  order by coalesce(lm.created_at, c.created_at) desc;
$$;

-- =====================================================================
-- 7. ПОДАРКИ И NFT
-- =====================================================================
create table if not exists public.gift_catalog (
  id            int primary key,
  name          text not null,
  emoji         text not null,
  price         int  not null check (price > 0),
  total_supply  int,
  sold          int  not null default 0,
  upgrade_price int,
  sort          int  not null default 0
);
alter table public.gift_catalog enable row level security;
drop policy if exists "Каталог виден всем" on public.gift_catalog;
create policy "Каталог виден всем" on public.gift_catalog for select using (true);

insert into public.gift_catalog (id, name, emoji, price, total_supply, upgrade_price, sort) values
  (1,  'Роза',            '🌹', 15,   null, 25,  1),
  (2,  'Мишка',           '🧸', 25,   null, 25,  2),
  (3,  'Сердце',          '💙', 25,   null, 25,  3),
  (4,  'Торт',            '🎂', 50,   null, 50,  4),
  (5,  'Кубок',           '🏆', 100,  null, 50,  5),
  (6,  'Алмаз',           '💎', 100,  null, 50,  6),
  (7,  'Ракета',          '🚀', 250,  null, 100, 7),
  (8,  'Вершина Sierra',  '🏔️', 500,  1000, 150, 8),
  (9,  'Корона',          '👑', 1000, 300,  250, 9),
  (10, 'Хрустальный шар', '🔮', 2500, 100,  500, 10)
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, price = excluded.price,
  total_supply = excluded.total_supply, upgrade_price = excluded.upgrade_price, sort = excluded.sort;

create table if not exists public.user_gifts (
  id             uuid primary key default gen_random_uuid(),
  gift_id        int  not null references public.gift_catalog(id),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  sender_id      uuid references public.profiles(id) on delete set null,
  message        text not null default '' check (char_length(message) <= 255),
  serial         int,
  is_hidden      boolean not null default false,
  is_collectible boolean not null default false,
  collectible_no int,
  model          text,
  backdrop       text,
  pattern        text,
  sale_price     bigint check (sale_price > 0),
  created_at     timestamptz not null default now(),
  upgraded_at    timestamptz,
  unique (gift_id, collectible_no)
);
create index if not exists user_gifts_owner_idx on public.user_gifts(owner_id, created_at desc);
create index if not exists user_gifts_sale_idx on public.user_gifts(sale_price) where sale_price is not null;
alter table public.user_gifts enable row level security;
drop policy if exists "Подарки в профиле" on public.user_gifts;
create policy "Подарки в профиле" on public.user_gifts for select
  using (not is_hidden or owner_id = auth.uid());

-- Случайный выбор с весами (для NFT-атрибутов)
create or replace function public._pick(items text[], weights int[])
returns text language plpgsql volatile set search_path = '' as $$
declare total int := 0; r int; acc int := 0; i int;
begin
  for i in 1..array_length(weights, 1) loop total := total + weights[i]; end loop;
  r := floor(random() * total)::int;
  for i in 1..array_length(items, 1) loop
    acc := acc + weights[i];
    if r < acc then return items[i]; end if;
  end loop;
  return items[array_length(items, 1)];
end $$;

-- Купить подарок (себе или другому)
create or replace function public.buy_gift(p_gift int, p_to uuid default null, p_message text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); g record; n int; ug uuid; cid uuid;
begin
  if me is null then raise exception 'Нужно войти'; end if;
  p_to := coalesce(p_to, me);
  if not exists (select 1 from public.profiles where id = p_to) then raise exception 'Получатель не найден'; end if;
  update public.gift_catalog set sold = sold + 1
    where id = p_gift and (total_supply is null or sold < total_supply)
    returning * into g;
  if g.id is null then raise exception 'Этот подарок закончился'; end if;
  n := g.sold;
  perform public._coins(me, -g.price, 'Подарок «' || g.name || '»');
  insert into public.user_gifts (gift_id, owner_id, sender_id, message, serial)
    values (g.id, p_to, me, coalesce(left(p_message, 255), ''), n)
    returning id into ug;
  if p_to <> me then
    cid := public._direct_between(me, p_to);
    insert into public.messages (chat_id, sender_id, kind, text, meta)
    values (cid, me, 'gift', coalesce(left(p_message, 255), ''),
      jsonb_build_object('user_gift', ug, 'gift_id', g.id, 'emoji', g.emoji, 'name', g.name, 'price', g.price));
  end if;
  return ug;
end $$;

-- Обменять обычный подарок на 80% SierCoin
create or replace function public.convert_gift(p_ug uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare r record; v bigint;
begin
  select ug.*, gc.price, gc.name into r from public.user_gifts ug join public.gift_catalog gc on gc.id = ug.gift_id
    where ug.id = p_ug and ug.owner_id = auth.uid() for update of ug;
  if r.id is null then raise exception 'Подарок не найден'; end if;
  if r.is_collectible then raise exception 'NFT-подарок нельзя обменять, его можно продать на маркете'; end if;
  v := floor(r.price * 0.8);
  delete from public.user_gifts where id = p_ug;
  perform public._coins(auth.uid(), v, 'Обмен подарка «' || r.name || '»');
  return v;
end $$;

-- Улучшить подарок до NFT
create or replace function public.upgrade_gift(p_ug uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r record; num int;
begin
  select ug.*, gc.upgrade_price, gc.name into r from public.user_gifts ug join public.gift_catalog gc on gc.id = ug.gift_id
    where ug.id = p_ug and ug.owner_id = auth.uid() for update of ug;
  if r.id is null then raise exception 'Подарок не найден'; end if;
  if r.is_collectible then raise exception 'Подарок уже улучшен'; end if;
  if r.upgrade_price is null then raise exception 'Этот подарок нельзя улучшить'; end if;
  perform 1 from public.gift_catalog where id = r.gift_id for update;
  select coalesce(max(collectible_no), 0) + 1 into num from public.user_gifts where gift_id = r.gift_id;
  perform public._coins(auth.uid(), -r.upgrade_price, 'Улучшение «' || r.name || '» до NFT');
  update public.user_gifts set
    is_collectible = true,
    collectible_no = num,
    upgraded_at = now(),
    model    = public._pick(array['Классика','Неон','Лёд','Пиксель','Аврора','Обсидиан','Золото','Космос'],
                            array[300, 180, 150, 120, 100, 80, 50, 20]),
    backdrop = public._pick(array['Полночь','Лазурь','Мята','Закат','Аметист','Графит','Рубин','Изумруд'],
                            array[220, 180, 150, 130, 110, 90, 70, 50]),
    pattern  = public._pick(array['✦','❄','⚡','☾','✿','◆','♛','✺'],
                            array[220, 180, 150, 130, 110, 90, 70, 50])
  where id = p_ug;
  return p_ug;
end $$;

-- Передать NFT другому человеку
create or replace function public.transfer_gift(p_ug uuid, p_to uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r record; cid uuid;
begin
  select ug.*, gc.emoji, gc.name into r from public.user_gifts ug join public.gift_catalog gc on gc.id = ug.gift_id
    where ug.id = p_ug and ug.owner_id = me for update of ug;
  if r.id is null then raise exception 'Подарок не найден'; end if;
  if not r.is_collectible then raise exception 'Передавать можно только NFT-подарки'; end if;
  if p_to = me then raise exception 'Это и так твой подарок'; end if;
  if not exists (select 1 from public.profiles where id = p_to) then raise exception 'Получатель не найден'; end if;
  update public.user_gifts set owner_id = p_to, sender_id = me, sale_price = null, is_hidden = false where id = p_ug;
  cid := public._direct_between(me, p_to);
  insert into public.messages (chat_id, sender_id, kind, text, meta)
  values (cid, me, 'gift', '', jsonb_build_object('user_gift', p_ug, 'gift_id', r.gift_id, 'emoji', r.emoji,
    'name', r.name || ' #' || r.collectible_no, 'nft', true));
end $$;

-- Маркет NFT: выставить / снять / купить
create or replace function public.list_gift(p_ug uuid, p_price bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_price is not null and (p_price < 1 or p_price > 10000000) then raise exception 'Цена от 1 до 10 000 000 SierCoin'; end if;
  update public.user_gifts set sale_price = p_price, is_hidden = false
    where id = p_ug and owner_id = auth.uid() and is_collectible;
  if not found then raise exception 'Выставлять на продажу можно только свои NFT-подарки'; end if;
end $$;

create or replace function public.buy_listed_gift(p_ug uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r record;
begin
  if me is null then raise exception 'Нужно войти'; end if;
  select ug.*, gc.name into r from public.user_gifts ug join public.gift_catalog gc on gc.id = ug.gift_id
    where ug.id = p_ug for update of ug;
  if r.id is null or r.sale_price is null then raise exception 'Этот NFT уже не продаётся'; end if;
  if r.owner_id = me then raise exception 'Это твой NFT'; end if;
  perform public._coins(me, -r.sale_price, 'Покупка NFT «' || r.name || ' #' || r.collectible_no || '»');
  perform public._coins(r.owner_id, floor(r.sale_price * 0.95)::bigint,
    'Продажа NFT «' || r.name || ' #' || r.collectible_no || '» (комиссия 5%)');
  update public.user_gifts set owner_id = me, sale_price = null where id = p_ug;
end $$;

create or replace function public.toggle_gift_hidden(p_ug uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare h boolean;
begin
  update public.user_gifts set is_hidden = not is_hidden
    where id = p_ug and owner_id = auth.uid() and sale_price is null
    returning is_hidden into h;
  if h is null then raise exception 'Нельзя скрыть подарок, выставленный на продажу'; end if;
  return h;
end $$;

-- =====================================================================
-- 8. SierCoin: ежедневный бонус и переводы
-- =====================================================================
create or replace function public.claim_daily()
returns bigint language plpgsql security definer set search_path = '' as $$
declare w record; left_h int;
begin
  if auth.uid() is null then raise exception 'Нужно войти'; end if;
  select * into w from public.wallets where user_id = auth.uid() for update;
  if w.user_id is null then raise exception 'Кошелёк не найден'; end if;
  if w.last_daily is not null and w.last_daily > now() - interval '20 hours' then
    left_h := ceil(extract(epoch from (w.last_daily + interval '20 hours' - now())) / 3600);
    raise exception 'Бонус уже получен. Следующий через % ч.', left_h;
  end if;
  update public.wallets set last_daily = now() where user_id = auth.uid();
  perform public._coins(auth.uid(), 25, 'Ежедневный бонус');
  return (select balance from public.wallets where user_id = auth.uid());
end $$;

create or replace function public.send_coins(p_to uuid, p_amount bigint, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); cid uuid; to_name text;
begin
  if me is null then raise exception 'Нужно войти'; end if;
  if p_to = me then raise exception 'Нельзя перевести самому себе'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000000 then raise exception 'Сумма от 1 до 1 000 000'; end if;
  select username into to_name from public.profiles where id = p_to;
  if to_name is null then raise exception 'Получатель не найден'; end if;
  perform public._coins(me, -p_amount, 'Перевод @' || to_name);
  perform public._coins(p_to, p_amount,
    'Перевод от @' || (select username from public.profiles where id = me));
  cid := public._direct_between(me, p_to);
  insert into public.messages (chat_id, sender_id, kind, text, meta)
  values (cid, me, 'coins', coalesce(left(p_note, 255), ''), jsonb_build_object('amount', p_amount));
end $$;

-- =====================================================================
-- 9. ХРАНИЛИЩЕ ДЛЯ ФОТО (посты, чаты, аватарки групп)
-- =====================================================================
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "Медиа видно всем" on storage.objects;
create policy "Медиа видно всем" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "Загружать медиа в свою папку" on storage.objects;
create policy "Загружать медиа в свою папку" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Удалять своё медиа" on storage.objects;
create policy "Удалять своё медиа" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- 10. ВНУТРЕННИЕ функции не должны вызываться с сайта
-- =====================================================================
revoke execute on function public._pick(text[], int[]) from public, anon, authenticated;
revoke execute on function public.touch_chat() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- =====================================================================
-- 11. СООБЩЕНИЯ В РЕАЛЬНОМ ВРЕМЕНИ
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- =====================================================================
-- 12. ЯВНЫЕ ПРАВА ДОСТУПА (на случай, если в проекте выключены права по умолчанию)
-- =====================================================================
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.posts, public.likes, public.comments,
  public.chats, public.chat_members, public.gift_catalog, public.user_gifts to anon, authenticated;
grant update on public.profiles to authenticated;
grant select on public.private_info, public.wallets, public.coin_tx, public.contacts, public.messages to authenticated;
grant insert, delete on public.posts, public.likes, public.comments, public.contacts to authenticated;
grant insert, delete on public.messages to authenticated;
grant update (text, edited_at) on public.messages to authenticated;
grant delete on public.chat_members to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant execute on function
  public.find_user_by_contact(text), public.set_phone(text), public.set_privacy(boolean, boolean),
  public.chat_role(uuid), public.is_chat_member(uuid), public.is_public_chat(uuid), public.can_post(uuid),
  public.get_or_create_direct(uuid), public.create_chat(text, text, text, text, boolean, uuid[]),
  public.update_chat(uuid, text, text, text, boolean, text), public.join_chat(uuid),
  public.add_members(uuid, uuid[]), public.kick_member(uuid, uuid), public.set_member_role(uuid, uuid, text),
  public.mark_read(uuid), public.my_chats(),
  public.buy_gift(int, uuid, text), public.convert_gift(uuid), public.upgrade_gift(uuid),
  public.transfer_gift(uuid, uuid), public.list_gift(uuid, bigint), public.buy_listed_gift(uuid),
  public.toggle_gift_hidden(uuid), public.claim_daily(), public.send_coins(uuid, bigint, text),
  public.normalize_phone(text)
to authenticated;

-- Обновить кэш API, чтобы сайт сразу увидел новые таблицы и функции
notify pgrst, 'reload schema';

-- Если ты видишь «Success» — всё готово! 🎉
