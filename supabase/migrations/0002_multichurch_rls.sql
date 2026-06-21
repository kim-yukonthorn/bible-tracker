-- Multi-church support: Row Level Security.
-- Apply this LAST, only after the auth bridge (app/api/auth/line) is live so that
-- every client request carries a Supabase JWT whose `sub` = LINE userId.
-- Enabling RLS before that will lock out the anon-key client.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;

-- Read your own profile, plus profiles of anyone in a church you belong to
-- (needed for the per-church leaderboard).
create policy profiles_select_co_church on profiles
  for select to authenticated
  using (
    id = requesting_user_id()
    or exists (
      select 1
      from church_members me
      join church_members them on them.church_id = me.church_id
      where me.user_id = requesting_user_id()
        and them.user_id = profiles.id
    )
  );

-- Upsert / update only your own profile row (covers LIFF upsert, onboarding, score).
create policy profiles_insert_self on profiles
  for insert to authenticated
  with check (id = requesting_user_id());

create policy profiles_update_self on profiles
  for update to authenticated
  using (id = requesting_user_id())
  with check (id = requesting_user_id());

-- ---------------------------------------------------------------------------
-- reading_logs — own rows only
-- ---------------------------------------------------------------------------
alter table reading_logs enable row level security;

create policy reading_logs_select_self on reading_logs
  for select to authenticated
  using (user_id = requesting_user_id());

create policy reading_logs_insert_self on reading_logs
  for insert to authenticated
  with check (user_id = requesting_user_id());

create policy reading_logs_delete_self on reading_logs
  for delete to authenticated
  using (user_id = requesting_user_id());

-- ---------------------------------------------------------------------------
-- churches
-- Create/join happen via SECURITY DEFINER RPCs which bypass these policies, so
-- churches stay non-enumerable: you can only SELECT churches you belong to.
-- ---------------------------------------------------------------------------
alter table churches enable row level security;

create policy churches_select_member on churches
  for select to authenticated
  using (
    exists (
      select 1 from church_members m
      where m.church_id = churches.id
        and m.user_id = requesting_user_id()
    )
  );

-- Only an admin of the church may edit/delete it.
create policy churches_update_admin on churches
  for update to authenticated
  using (
    exists (
      select 1 from church_members m
      where m.church_id = churches.id
        and m.user_id = requesting_user_id()
        and m.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from church_members m
      where m.church_id = churches.id
        and m.user_id = requesting_user_id()
        and m.role = 'admin'
    )
  );

create policy churches_delete_admin on churches
  for delete to authenticated
  using (
    exists (
      select 1 from church_members m
      where m.church_id = churches.id
        and m.user_id = requesting_user_id()
        and m.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- church_members
-- Inserts go through create_church / join_church (SECURITY DEFINER). No direct
-- insert policy => members can read their church roster; only admins manage roles.
-- ---------------------------------------------------------------------------
alter table church_members enable row level security;

create policy church_members_select_co_member on church_members
  for select to authenticated
  using (
    exists (
      select 1 from church_members me
      where me.church_id = church_members.church_id
        and me.user_id = requesting_user_id()
    )
  );

create policy church_members_update_admin on church_members
  for update to authenticated
  using (
    exists (
      select 1 from church_members me
      where me.church_id = church_members.church_id
        and me.user_id = requesting_user_id()
        and me.role = 'admin'
    )
  );

-- Admins may remove members; members may remove themselves (leave).
create policy church_members_delete_admin_or_self on church_members
  for delete to authenticated
  using (
    user_id = requesting_user_id()
    or exists (
      select 1 from church_members me
      where me.church_id = church_members.church_id
        and me.user_id = requesting_user_id()
        and me.role = 'admin'
    )
  );
