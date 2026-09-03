-- Public settings are allow-listed so future secrets/config keys stay private by default.
alter policy public_read_site_settings
on public.site_settings
using (
  key = any (array[
    'anjiz_booking_url','anjiz_cta','anjiz_description','anjiz_image_url','anjiz_title',
    'footer_credit_label','footer_credit_prefix','footer_credit_url','footer_rights','footer_subtitle','footer_top_text',
    'instagram_url',
    'maintenance_enabled','maintenance_message','maintenance_until',
    'masalik_booking_url','masalik_cta','masalik_description','masalik_image_url','masalik_title',
    'official_calendar_url','platform_version',
    'stats_groups_label','stats_ratings_label','stats_section_enabled','stats_summaries_label','stats_title','stats_tools_label','stats_university_name',
    'tool_catalog_version','tool_health_alerts','tool_realtime_enabled',
    'whatsapp_channel_name','whatsapp_channel_url'
  ]::text[])
);
