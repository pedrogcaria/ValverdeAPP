select 'tables' as section, jsonb_agg(to_jsonb(t)) as details from
 (select tablename, rowsecurity from pg_tables where schemaname='public' order by tablename) t
union all
select 'functions', jsonb_agg(to_jsonb(f)) from
 (select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('set_updated_at','is_villa_manager','sync_commission_expense','seed_default_valverde_rates','import_legacy_valverde_data')) f
union all
select 'counts', jsonb_build_object('users',(select count(*) from auth.users),'managers',(select count(*) from public.villa_managers),'settings',(select count(*) from public.property_settings),'history',to_regclass('supabase_migrations.schema_migrations'));
