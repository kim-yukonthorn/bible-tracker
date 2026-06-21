-- Fix: "infinite recursion detected in policy for relation church_members".
-- The 0002 policies on church_members / churches / profiles read church_members
-- inside the policy, which re-triggers RLS on church_members. Move those checks
-- into SECURITY DEFINER helpers so their internal reads bypass RLS.

create or replace function is_church_member(p_church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from church_members
    where church_id = p_church_id
      and user_id = requesting_user_id()
  )
$$;

create or replace function is_church_admin(p_church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from church_members
    where church_id = p_church_id
      and user_id = requesting_user_id()
      and role = 'admin'
  )
$$;

create or replace function shares_church_with(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from church_members me
    join church_members them on them.church_id = me.church_id
    where me.user_id = requesting_user_id()
      and them.user_id = p_user_id
  )
$$;

grant execute on function is_church_member(uuid)  to authenticated;
grant execute on function is_church_admin(uuid)   to authenticated;
grant execute on function shares_church_with(text) to authenticated;

-- ---------------------------------------------------------------------------
-- church_members
-- ---------------------------------------------------------------------------
drop policy if exists church_members_select_co_member on church_members;
create policy church_members_select_co_member on church_members
  for select to authenticated
  using (is_church_member(church_id));

drop policy if exists church_members_update_admin on church_members;
create policy church_members_update_admin on church_members
  for update to authenticated
  using (is_church_admin(church_id));

drop policy if exists church_members_delete_admin_or_self on church_members;
create policy church_members_delete_admin_or_self on church_members
  for delete to authenticated
  using (user_id = requesting_user_id() or is_church_admin(church_id));

-- ---------------------------------------------------------------------------
-- churches
-- ---------------------------------------------------------------------------
drop policy if exists churches_select_member on churches;
create policy churches_select_member on churches
  for select to authenticated
  using (is_church_member(id));

drop policy if exists churches_update_admin on churches;
create policy churches_update_admin on churches
  for update to authenticated
  using (is_church_admin(id))
  with check (is_church_admin(id));

drop policy if exists churches_delete_admin on churches;
create policy churches_delete_admin on churches
  for delete to authenticated
  using (is_church_admin(id));

-- ---------------------------------------------------------------------------
-- profiles (co-church SELECT)
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_co_church on profiles;
create policy profiles_select_co_church on profiles
  for select to authenticated
  using (id = requesting_user_id() or shares_church_with(id));
