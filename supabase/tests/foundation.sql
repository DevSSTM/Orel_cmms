-- Run only against a disposable or new project. All changes are rolled back.
begin;
grant usage on schema public to authenticated;
insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000004');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select public.cmms_create_organization('Foundation test');
insert into public.cmms_assets (id, organization_id, name)
select '00000000-0000-4000-8000-000000000003', id, 'Test asset'
from public.cmms_organizations where name = 'Foundation test';
insert into public.cmms_work_orders (organization_id, asset_id, title)
select organization_id, id, 'Test work order' from public.cmms_assets where name = 'Test asset';
do $$
begin
  if (select count(*) from public.cmms_work_orders where title = 'Test work order') <> 1 then
    raise exception 'Owner cannot read its work order';
  end if;
end $$;
reset role;
insert into public.cmms_memberships (organization_id, user_id, role)
select id, '00000000-0000-4000-8000-000000000004', 'viewer'
from public.cmms_organizations where name = 'Foundation test';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
do $$
declare changed integer;
begin
  if (select count(*) from public.cmms_work_orders where title = 'Test work order') <> 1 then
    raise exception 'Viewer cannot read its organization work order';
  end if;
  update public.cmms_work_orders set title = 'Viewer modified order' where title = 'Test work order';
  get diagnostics changed = row_count;
  if changed <> 0 then
    raise exception 'Viewer can modify work orders';
  end if;
  begin
    insert into public.cmms_assets (organization_id, name)
    select id, 'Viewer asset' from public.cmms_organizations where name = 'Foundation test';
    raise exception 'Viewer asset creation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select public.cmms_create_organization('Second organization');
do $$
declare changed integer;
begin
  if exists (select 1 from public.cmms_work_orders where title = 'Test work order') then
    raise exception 'Non-member can read another organization work order';
  end if;
  if exists (select 1 from public.cmms_assets where name = 'Test asset') then
    raise exception 'Non-member can read another organization asset';
  end if;
  update public.cmms_work_orders set title = 'Cross-organization update' where title = 'Test work order';
  get diagnostics changed = row_count;
  if changed <> 0 then
    raise exception 'Non-member can update another organization work order';
  end if;
  begin
    insert into public.cmms_memberships (organization_id, user_id, role)
    values (gen_random_uuid(), auth.uid(), 'owner');
    raise exception 'Direct membership creation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.cmms_work_orders (organization_id, asset_id, title)
    select id, '00000000-0000-4000-8000-000000000003', 'Cross-organization asset'
    from public.cmms_organizations where name = 'Second organization';
    raise exception 'Cross-organization asset reference unexpectedly succeeded';
  exception when foreign_key_violation then null;
  end;
end $$;
rollback;
