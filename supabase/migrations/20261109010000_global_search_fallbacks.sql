-- The most searched phrase on the site ("رسلي رابط اعذار طبيه", 20+ times a month)
-- returned nothing: request words, missing hamza (اعذار vs الأعذار), Arabic digits and
-- generic prefixes ("اختبارات عربي ١") all defeat the core ilike search.
-- Keep the core untouched; when it finds nothing, retry with cleaned variants.
create or replace function public.uon_global_search_v44(p_query text, p_limit integer default 40, p_language text default 'ar')
returns table(result_type text, result_id text, title text, subtitle text, url text, score numeric, meta jsonb)
language plpgsql stable security definer set search_path to ''
as $$
declare
  lim int := greatest(1,least(coalesce(p_limit,40),100));
  lng text := case when lower(trim(coalesce(p_language,'ar')))='en' then 'en' else 'ar' end;
  q0 text := left(trim(coalesce(p_query,'')),240);
  base text; hamza text; noprefix text; cand text; w text;
  candidates text[] := '{}';
begin
  return query select * from public.uon_global_search_v44_core_v1(q0,lim,lng);
  if found or length(q0)<2 then return; end if;
  base := trim(regexp_replace(translate(q0,'٠١٢٣٤٥٦٧٨٩','0123456789'),
    '(^|\s)(رسلي|ارسلي|ارسل|أرسل|اريد|أريد|ابي|أبي|ابغي|ابغى|عطني|عطيني|اعطني|أعطني|رابط|الرابط|لينك|ممكن|لو سمحت|بليز|وين|كيف|حق|مال)(?=\s|$)','\1','g'));
  base := regexp_replace(base,'\s+',' ','g');
  noprefix := trim(regexp_replace(base,'^(اختبارات|اختبار|ملخصات|ملخص|قروبات|قروب|ماده|مادة|نماذج)\s+',''));
  hamza := trim(regexp_replace(regexp_replace(' '||noprefix,' ال(ا)',' الأ','g'),' ا(?!ل)',' أ','g'));
  candidates := array[base, noprefix, hamza];
  foreach w in array regexp_split_to_array(hamza,'\s+') loop
    if length(w)>=3 then candidates := candidates || w; end if;
  end loop;
  foreach cand in array candidates loop
    if cand is null or length(cand)<2 or cand=q0 then continue; end if;
    return query select * from public.uon_global_search_v44_core_v1(cand,lim,lng);
    if found then return; end if;
  end loop;
end $$;
grant execute on function public.uon_global_search_v44(text,integer,text) to anon, authenticated, service_role;
