-- CHEM107 was imported as "/ L Fundamental of Chemistry" (lab marker leaked into the name).
update public.courses set name_ar='Fundamentals of Chemistry', name_en='Fundamentals of Chemistry', updated_at=now()
where upper(code)='CHEM107' and name_en like '/ L %';
