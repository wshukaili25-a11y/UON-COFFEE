-- UON Hub V22.2 - Footer settings controlled from Telegram
insert into public.site_settings(key,value,updated_at) values
 ('footer_top_text',to_jsonb('رب اغفر لي ولوالدي'::text),now()),
 ('footer_credit_prefix',to_jsonb('Designed with ❤️ By'::text),now()),
 ('footer_credit_label',to_jsonb('@uonhub'::text),now()),
 ('footer_credit_url',to_jsonb(''::text),now()),
 ('footer_rights',to_jsonb('جميع الحقوق محفوظة © 2026 UON Hub'::text),now())
on conflict(key) do nothing;
