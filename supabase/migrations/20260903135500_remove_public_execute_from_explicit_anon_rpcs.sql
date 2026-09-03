do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and exists (
        select 1 from aclexplode(p.proacl) a
        where a.grantee=0 and a.privilege_type='EXECUTE'
      )
      and exists (
        select 1 from aclexplode(p.proacl) a
        where a.grantee=(select oid from pg_roles where rolname='anon')
          and a.privilege_type='EXECUTE'
      )
  loop
    execute format('revoke execute on function %s from public, authenticated', r.fn);
  end loop;
end $$;
