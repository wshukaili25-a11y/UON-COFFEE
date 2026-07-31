create index if not exists drive_import_items_summary_id_idx
on public.drive_import_items (summary_id);

create index if not exists dropbox_import_items_run_id_idx
on public.dropbox_import_items (run_id);

create index if not exists dropbox_import_items_summary_id_idx
on public.dropbox_import_items (summary_id);

create index if not exists telegram_import_items_summary_id_idx
on public.telegram_import_items (summary_id);
