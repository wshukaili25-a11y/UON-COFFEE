-- QA performance cleanup: keep the FK lookup covered and remove one redundant unique index.

create index if not exists uon_ai_handoff_queue_conversation_id_idx
  on public.uon_ai_handoff_queue(conversation_id);

drop index if exists public.ai_supervisor_reviews_source_unique;
