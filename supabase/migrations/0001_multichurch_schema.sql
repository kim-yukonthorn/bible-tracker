-- Multi-church support: schema, identity helper, and RPCs.
-- Apply this FIRST. It does not enable RLS, so the app keeps working on the anon
-- key until the auth bridge is shipped and 0002_multichurch_rls.sql is applied.

-- ---------------------------------------------------------------------------
-- A1. Tables
-- ---------------------------------------------------------------------------

create table if not exists churches (
  id         uuid primary key default gen_random_uuid(),
  name       varchar(50) not null,
  slug       varchar(5)  not null unique,   -- URL-safe id used in /[church], 1-5 [a-z0-9]
  join_code  text        not null unique,   -- code members enter to join
  created_at timestamptz not null default now(),
  constraint churches_slug_format check (slug ~ '^[a-z0-9]{1,5}$')
);

create table if not exists church_members (
  id         bigint generated always as identity primary key,
  user_id    text        not null references profiles(id) on delete cascade,
  church_id  uuid        not null references churches(id) on delete cascade,
  role       text        not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (user_id, church_id)
);

create index if not exists church_members_church_id_idx on church_members (church_id);
create index if not exists church_members_user_id_idx   on church_members (user_id);

-- ---------------------------------------------------------------------------
-- A2. Identity helper
-- LINE userIds (e.g. "U1a2b...") are NOT UUIDs, so the built-in auth.uid()
-- (which casts the `sub` claim to uuid) would error. Read the raw claim as text.
-- ---------------------------------------------------------------------------

create or replace function requesting_user_id()
returns text
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
    ''
  )
$$;

-- ---------------------------------------------------------------------------
-- A3. RPCs (SECURITY DEFINER) — atomic create/join, keep churches non-enumerable
-- ---------------------------------------------------------------------------

-- 6-char uppercase join code, retried until unique.
create or replace function gen_join_code()
returns text
language plpgsql
volatile
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
    exit when not exists (select 1 from churches where join_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Create a church and make the caller its admin. Slug is provided by the client
-- (suggested from the name, editable at creation) and is immutable afterward.
create or replace function create_church(p_name text, p_slug text)
returns churches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    text := requesting_user_id();
  v_slug   text := lower(trim(p_slug));
  v_church churches;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'church name is required';
  end if;
  if v_slug !~ '^[a-z0-9]{1,5}$' then
    raise exception 'slug must be 1-5 characters (a-z, 0-9)';
  end if;
  if exists (select 1 from churches where slug = v_slug) then
    raise exception 'slug "%" is already taken', v_slug using errcode = 'unique_violation';
  end if;

  insert into churches (name, slug, join_code)
  values (trim(p_name), v_slug, gen_join_code())
  returning * into v_church;

  insert into church_members (user_id, church_id, role)
  values (v_uid, v_church.id, 'admin');

  return v_church;
end;
$$;

-- Join an existing church by code. Idempotent (no-op if already a member).
create or replace function join_church(p_code text)
returns churches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    text := requesting_user_id();
  v_church churches;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_church
  from churches
  where join_code = upper(trim(p_code));

  if v_church.id is null then
    raise exception 'invalid join code';
  end if;

  insert into church_members (user_id, church_id, role)
  values (v_uid, v_church.id, 'member')
  on conflict (user_id, church_id) do nothing;

  return v_church;
end;
$$;

-- Slug availability check for the create form. SECURITY DEFINER so a not-yet-member
-- can probe a single slug without being able to SELECT/enumerate the churches table.
create or replace function slug_available(p_slug text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select case
    when lower(trim(p_slug)) !~ '^[a-z0-9]{1,5}$' then false
    else not exists (select 1 from churches where slug = lower(trim(p_slug)))
  end
$$;

grant execute on function create_church(text, text) to authenticated;
grant execute on function join_church(text)         to authenticated;
grant execute on function slug_available(text)      to authenticated;
