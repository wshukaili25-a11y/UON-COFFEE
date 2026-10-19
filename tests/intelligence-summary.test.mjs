import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/intelligence-summary.js";

function response() {
  return {
    statusCode: 200, headers: {},
    setHeader(k,v){this.headers[k]=v;},
    status(n){this.statusCode=n;return this;},
    json(v){this.body=v;return this;}
  };
}
const secret = "intelligence-test-token-with-at-least-32-characters";
test("rejects missing authorization", async () => {
  process.env.INTELLIGENCE_MONITOR_TOKEN=secret;
  const res=response();
  await handler({method:"GET",headers:{}},res);
  assert.equal(res.statusCode,401);
});
test("rejects short configured secrets", async () => {
  process.env.INTELLIGENCE_MONITOR_TOKEN="short";
  const res=response();
  await handler({method:"GET",headers:{authorization:"Bearer short"}},res);
  assert.equal(res.statusCode,401);
});
test("rejects write methods", async () => {
  const res=response();
  await handler({method:"POST",headers:{}},res);
  assert.equal(res.statusCode,405);
});
test("requires server configuration", async () => {
  process.env.INTELLIGENCE_MONITOR_TOKEN=secret;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res=response();
  await handler({method:"GET",headers:{authorization:`Bearer ${secret}`}},res);
  assert.equal(res.statusCode,503);
});
test("only returns aggregate metrics, not raw records", async () => {
  process.env.INTELLIGENCE_MONITOR_TOKEN=secret;
  process.env.SUPABASE_URL="https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY="server-test-key";
  const previous=globalThis.fetch;
  globalThis.fetch=async ()=>({ok:true,json:async()=>[{status:"open",severity:"info",question:"PRIVATE QUESTION",details:{secret:"PRIVATE"}}]});
  try {
    const res=response();
    await handler({method:"GET",headers:{authorization:`Bearer ${secret}`}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.results.length,7);
    assert.ok(!JSON.stringify(res.body).includes("PRIVATE"));
    assert.equal(res.body.mode,"read_only");
  } finally {globalThis.fetch=previous;}
});
