-- Church slug is now uppercase (shown as "ID คริสตจักร" in the UI).

-- 1. Drop the old lowercase constraint FIRST, so the uppercase update below is allowed.
alter table churches drop constraint if exists churches_slug_format;

-- 2. Uppercase any existing slugs.
update churches set slug = upper(slug) where slug <> upper(slug);

-- 3. Add the new uppercase constraint.
alter table churches add constraint churches_slug_format check (slug ~ '^[A-Z0-9]{1,5}$');

-- 3. Normalize slug to uppercase in the RPCs.
create or replace function create_church(p_name text, p_slug text)
returns churches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    text := requesting_user_id();
  v_slug   text := upper(trim(p_slug));
  v_church churches;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'church name is required';
  end if;
  if v_slug !~ '^[A-Z0-9]{1,5}$' then
    raise exception 'slug must be 1-5 characters (A-Z, 0-9)';
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

create or replace function slug_available(p_slug text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select case
    when upper(trim(p_slug)) !~ '^[A-Z0-9]{1,5}$' then false
    else not exists (select 1 from churches where slug = upper(trim(p_slug)))
  end
$$;

grant execute on function create_church(text, text) to authenticated;
grant execute on function slug_available(text)      to authenticated;
