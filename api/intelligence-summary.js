// UON Hub Intelligence: private, read-only server endpoint.
// Configure INTELLIGENCE_MONITOR_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// in Vercel server-side environment settings. Never prefix them with NEXT_PUBLIC_.
const sources = [
  ["ai_gaps", "uon_ai_knowledge_gaps", "status,priority_score,times_seen"],
  ["ai_queue", "uon_ai_improvement_queue", "status,priority_score,occurrences"],
  ["ai_feedback", "uon_ai_feedback", "rating"],
  ["student_feedback", "platform_feedback", "status,rating"],
  ["system_errors", "system_errors", "status,severity,occurrences"],
  ["security_events", "security_events", "severity,created_at"],
  ["tool_health", "tool_health_checks", "status,checked_at"]
];
function aggregate(key, rows) {
  const counts = {};
  for (const row of rows) {
    const status = String(row.status ?? row.severity ?? "record");
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return { source: key, sample_count: rows.length, breakdown: counts, sampled: rows.length === 1000 };
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const token = process.env.INTELLIGENCE_MONITOR_TOKEN;
  const auth = req.headers.authorization || "";
  if (!token || auth !== `Bearer ${token}`) return res.status(401).json({ error: "unauthorized" });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
    return res.status(503).json({ error: "monitor_not_configured" });
  }
  const results = await Promise.all(sources.map(async ([name, table, columns]) => {
    const endpoint = new URL(`/rest/v1/${table}`, url);
    endpoint.searchParams.set("select", columns);
    endpoint.searchParams.set("limit", "1000");
    if (name === "security_events") endpoint.searchParams.set("created_at", `gte.${new Date(Date.now()-86400000).toISOString()}`);
    if (name === "tool_health") endpoint.searchParams.set("checked_at", `gte.${new Date(Date.now()-86400000).toISOString()}`);
    try {
      const response = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) return { source: name, error: "source_unavailable" };
      return aggregate(name, await response.json());
    } catch { return { source: name, error: "source_unavailable" }; }
  }));
  return res.status(200).json({ generated_at: new Date().toISOString(), mode: "read_only", results });
}
