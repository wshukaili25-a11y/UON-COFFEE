import { timingSafeEqual } from "node:crypto";

// Private read-only metrics endpoint. No raw user content leaves this API.
const SOURCES = [
  ["ai_gaps","uon_ai_knowledge_gaps","status,priority_score,times_seen"],
  ["ai_queue","uon_ai_improvement_queue","status,priority_score,occurrences"],
  ["ai_feedback","uon_ai_feedback","rating"],
  ["student_feedback","platform_feedback","status,rating"],
  ["system_errors","system_errors","status,severity,occurrences"],
  ["security_events","security_events","severity,created_at"],
  ["tool_health","tool_health_checks","status,checked_at"]
];
function authorized(header, secret) {
  if (typeof secret !== "string" || secret.length < 32 || typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const provided = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
function summarize(source, rows) {
  const breakdown = {};
  for (const row of rows) {
    const group = String(row.status ?? row.severity ?? "record");
    breakdown[group] = (breakdown[group] || 0) + 1;
  }
  return { source, sample_count: rows.length, breakdown, sampled: rows.length >= 1000 };
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") return res.status(405).json({error:"method_not_allowed"});
  if (!authorized(req.headers.authorization, process.env.INTELLIGENCE_MONITOR_TOKEN)) return res.status(401).json({error:"unauthorized"});
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(base)) return res.status(503).json({error:"monitor_not_configured"});
  const results = await Promise.all(SOURCES.map(async ([source,table,columns]) => {
    const url = new URL(`/rest/v1/${table}`,base);
    url.searchParams.set("select",columns);
    url.searchParams.set("limit","1000");
    if (source === "security_events") url.searchParams.set("created_at",`gte.${new Date(Date.now()-86400000).toISOString()}`);
    if (source === "tool_health") url.searchParams.set("checked_at",`gte.${new Date(Date.now()-86400000).toISOString()}`);
    try {
      const response = await fetch(url,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(8000)});
      if (!response.ok) return {source,error:"source_unavailable"};
      const rows = await response.json();
      if (!Array.isArray(rows)) return {source,error:"invalid_source_response"};
      return summarize(source,rows);
    } catch { return {source,error:"source_unavailable"}; }
  }));
  return res.status(200).json({generated_at:new Date().toISOString(),mode:"read_only",results});
}
