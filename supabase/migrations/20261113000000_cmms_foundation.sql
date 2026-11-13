-- Initial Supabase-native CMMS foundation. Existing Atlas tables and API are
-- intentionally untouched; frontend integration is a separate migration.
create table public.cmms_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  created_at timestamptz not null default now()
);

create table public.cmms_memberships (
  organization_id uuid not null references public.cmms_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'technician', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index cmms_memberships_user_id_idx on public.cmms_memberships(user_id);

create table public.cmms_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.cmms_organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  description text,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index cmms_assets_organization_idx on public.cmms_assets(organization_id);

create table public.cmms_work_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.cmms_organizations(id) on delete cascade,
  asset_id uuid,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, asset_id) references public.cmms_assets(organization_id, id)
);
create index cmms_work_orders_organization_idx on public.cmms_work_orders(organization_id);
create index cmms_work_orders_asset_idx on public.cmms_work_orders(organization_id, asset_id);

-- Security-definer helpers avoid recursive membership RLS checks. They return
-- only a boolean and always derive the current user from Supabase Auth.
create function public.cmms_has_role(target_organization uuid, allowed_roles text[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cmms_memberships m
    where m.organization_id = target_organization
      and m.user_id = (select auth.uid())
      and m.role = any(allowed_roles)
  );
$$;
revoke all on function public.cmms_has_role(uuid, text[]) from public, anon;
grant execute on function public.cmms_has_role(uuid, text[]) to authenticated;

-- Creating the organization and its owner membership is atomic; clients
-- cannot grant themselves a membership through direct table access.
create function public.cmms_create_organization(organization_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  insert into public.cmms_organizations(name) values (btrim(organization_name)) returning id into new_id;
  insert into public.cmms_memberships(organization_id, user_id, role)
    values (new_id, auth.uid(), 'owner');
  return new_id;
end;
$$;
revoke all on function public.cmms_create_organization(text) from public, anon;
grant execute on function public.cmms_create_organization(text) to authenticated;

alter table public.cmms_organizations enable row level security;
alter table public.cmms_memberships enable row level security;
alter table public.cmms_assets enable row level security;
alter table public.cmms_work_orders enable row level security;

create policy cmms_organizations_read on public.cmms_organizations for select to authenticated
  using (public.cmms_has_role(id, array['owner', 'admin', 'technician', 'viewer']));
create policy cmms_memberships_read on public.cmms_memberships for select to authenticated
  using (user_id = (select auth.uid()));
create policy cmms_assets_read on public.cmms_assets for select to authenticated
  using (public.cmms_has_role(organization_id, array['owner', 'admin', 'technician', 'viewer']));
create policy cmms_assets_write on public.cmms_assets for all to authenticated
  using (public.cmms_has_role(organization_id, array['owner', 'admin', 'technician']))
  with check (public.cmms_has_role(organization_id, array['owner', 'admin', 'technician']));
create policy cmms_work_orders_read on public.cmms_work_orders for select to authenticated
  using (public.cmms_has_role(organization_id, array['owner', 'admin', 'technician', 'viewer']));
create policy cmms_work_orders_write on public.cmms_work_orders for all to authenticated
  using (public.cmms_has_role(organization_id, array['owner', 'admin', 'technician']))
  with check (public.cmms_has_role(organization_id, array['owner', 'admin', 'technician']));

revoke all on public.cmms_organizations, public.cmms_memberships, public.cmms_assets, public.cmms_work_orders from public, anon, authenticated;
grant select on public.cmms_organizations, public.cmms_memberships to authenticated;
grant select, insert, update, delete on public.cmms_assets, public.cmms_work_orders to authenticated;
-- Schema USAGE is deliberately not granted here. Enable the Data API only
-- after the full migration and its authorization tests are ready.
