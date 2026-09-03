create or replace function public.uon_marketplace_feed(p_limit integer default 100)
returns table(
  id integer,
  title text,
  description text,
  type text,
  emoji text,
  price numeric,
  condition text,
  phone text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id,m.title,m.description,m.type,m.emoji,m.price,m.condition,m.phone,m.created_at
  from public.marketplace m
  where m.approved is true
    and (m.expires_at is null or m.expires_at > now())
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit,100),1),200);
$$;

create or replace function public.uon_submit_marketplace_item_v2(
  p_title text,
  p_description text,
  p_type text,
  p_price numeric,
  p_condition text,
  p_phone text,
  p_session_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id integer;
  v_title text := btrim(coalesce(p_title,''));
  v_description text := btrim(coalesce(p_description,''));
  v_type text := lower(btrim(coalesce(p_type,'')));
  v_condition text := lower(btrim(coalesce(p_condition,'')));
  v_phone text := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  v_price numeric := coalesce(p_price,0);
  v_phone_hash text;
begin
  if p_session_id is null then raise exception 'تعذر التحقق من الجلسة'; end if;
  if char_length(v_title) < 2 or char_length(v_title) > 120 then raise exception 'عنوان الإعلان غير صالح'; end if;
  if char_length(v_description) > 800 then raise exception 'الوصف أطول من الحد المسموح'; end if;
  if v_type not in ('sell','buy','exchange') then raise exception 'نوع الإعلان غير صالح'; end if;
  if v_condition not in ('new','good','used') then raise exception 'حالة الإعلان غير صالحة'; end if;
  if v_price < 0 or v_price > 100000 then raise exception 'السعر غير صالح'; end if;
  if v_phone !~ '^[0-9]{8,20}$' then raise exception 'رقم التواصل غير صالح'; end if;

  v_phone_hash := encode(extensions.digest(convert_to(v_phone,'UTF8'),'sha256'),'hex');
  if not public.uon_public_rate_allow('marketplace_session',p_session_id::text,3,3600) then raise exception 'rate_limited'; end if;
  if not public.uon_public_rate_allow('marketplace_phone',v_phone_hash,5,86400) then raise exception 'rate_limited'; end if;

  insert into public.marketplace(title,description,type,emoji,price,condition,phone,approved,expires_at,created_at)
  values(v_title,nullif(v_description,''),v_type,'📚',v_price,v_condition,v_phone,false,now()+interval '30 days',now())
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.uon_marketplace_feed(integer) from public;
revoke all on function public.uon_submit_marketplace_item_v2(text,text,text,numeric,text,text,uuid) from public;
grant execute on function public.uon_marketplace_feed(integer) to anon, authenticated, service_role;
grant execute on function public.uon_submit_marketplace_item_v2(text,text,text,numeric,text,text,uuid) to anon, authenticated, service_role;

revoke all on table public.marketplace from anon, authenticated;
grant select,insert,update,delete on table public.marketplace to service_role;

drop policy if exists public_read_approved_marketplace on public.marketplace;
drop policy if exists public_submit_pending_marketplace on public.marketplace;
