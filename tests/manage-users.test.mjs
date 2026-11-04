import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { after, beforeEach, test } from "node:test";
import { corsHeaders } from "@supabase/supabase-js/cors";
import { createCorsPolicy } from "../supabase/functions/manage-users/cors.ts";

// Execute the actual Deno entrypoint under Node, with the same pinned SDK.
// Only Supabase HTTP requests are mocked; no live data or emails are touched.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "npm:@supabase/supabase-js@2.115.0") specifier = "@supabase/supabase-js";
    if (specifier === "npm:@supabase/supabase-js@2.115.0/cors") specifier = "@supabase/supabase-js/cors";
    return nextResolve(specifier, context);
  },
});

const preview = "https://env-brindes-hercules-qz1mh0ytu-felipesievert864-7979s-projects.vercel.app";
const appUrl = "https://brindes.example.com";
const id = "11111111-1111-4111-8111-111111111111";
const invitedId = "22222222-2222-4222-8222-222222222222";
const profile = { id, full_name: "Administrador de teste", email: "admin@example.com", role: "admin", status: "active" };
const env = { SUPABASE_URL: "https://backend.example.com", SUPABASE_SERVICE_ROLE_KEY: "test-only-not-a-real-key", APP_URL: appUrl, INVITE_URL: preview, ALLOWED_ORIGINS: ` ${preview}/,\nhttps://other.example.com/ ` };
const originalFetch = globalThis.fetch;
const originalDeno = globalThis.Deno;
let actor;
let requests;
let authValid;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  assert.equal(url.origin, env.SUPABASE_URL, "Tests must never contact a live backend");
  const method = init.method ?? "GET";
  requests.push({ url, method, body: init.body ? JSON.parse(init.body) : null });
  if (url.pathname === "/auth/v1/user") {
    return authValid ? json({ id, aud: "authenticated", role: "authenticated", email: profile.email })
      : json({ message: "Invalid JWT", code: "bad_jwt" }, 401);
  }
  if (url.pathname === "/auth/v1/invite") return json({ id: invitedId, email: "new@example.com" });
  if (url.pathname === "/rest/v1/app_users") {
    if (method === "POST" || method === "PATCH") return new Response(null, { status: 204 });
    if (url.searchParams.has("order")) return json([profile]);
    if (url.searchParams.has("email")) return json(null);
    return json(actor);
  }
  assert.fail(`Unexpected backend route: ${method} ${url.pathname}`);
};

let moduleCount = 0;
async function loadHandler(values = env) {
  let handler;
  globalThis.Deno = { env: { get: key => values[key] }, serve: value => { handler = value; } };
  await import(`../supabase/functions/manage-users/index.ts?test=${moduleCount++}`);
  assert.equal(typeof handler, "function");
  return handler;
}

const handler = await loadHandler();
function request({ origin = preview, method = "POST", token = "test-session", body = { action: "list" } } = {}) {
  const headers = new Headers({ Origin: origin });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (method === "OPTIONS") {
    headers.set("Access-Control-Request-Method", "POST");
    headers.set("Access-Control-Request-Headers", "authorization,apikey,content-type,x-client-info,x-retry-count,traceparent,tracestate,baggage");
  }
  if (method === "POST") headers.set("Content-Type", "application/json");
  return new Request("https://function.example.com/manage-users", { method, headers, ...(method === "POST" ? { body: JSON.stringify(body) } : {}) });
}

beforeEach(() => { actor = { ...profile }; requests = []; authValid = true; });
after(() => { globalThis.fetch = originalFetch; globalThis.Deno = originalDeno; hooks.deregister(); });

test("normalizes explicit Preview origins and includes APP_URL without accepting wildcards/lookalikes", () => {
  const policy = createCorsPolicy(env.ALLOWED_ORIGINS + ",*,https://*.vercel.app", appUrl + "/", corsHeaders);
  assert.equal(policy.isAllowed(preview), true);
  assert.equal(policy.isAllowed(appUrl), true);
  assert.equal(policy.isAllowed("https://other.example.com"), true);
  for (const origin of ["https://attacker.vercel.app", preview + ".attacker.com", "null", "https://other.example.com/path", "https://user:pass@other.example.com"]) {
    assert.equal(policy.isAllowed(origin), false, origin);
    assert.equal(policy.headers(origin).has("Access-Control-Allow-Origin"), false);
  }
});

test("Preview preflight succeeds without session or backend calls and allows every SDK header", async () => {
  const response = await handler(request({ method: "OPTIONS", token: "" }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), preview);
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  const allowed = response.headers.get("Access-Control-Allow-Headers").toLowerCase().split(/,\s*/);
  for (const header of ["authorization", "apikey", "content-type", "x-client-info", "x-retry-count", "traceparent", "tracestate", "baggage"]) assert.ok(allowed.includes(header), header);
  assert.equal(response.headers.get("Vary"), "Origin");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(await response.text(), "");
  assert.equal(requests.length, 0);
});

test("foreign Preview preflight is denied without CORS or backend calls", async () => {
  const response = await handler(request({ method: "OPTIONS", origin: "https://foreign.vercel.app" }));
  assert.equal(response.status, 403);
  assert.equal(response.headers.has("Access-Control-Allow-Origin"), false);
  assert.equal(requests.length, 0);
});

test("known project Preview aliases work without replacing existing origin configuration", async () => {
  for (const origin of [
    "https://env-brindes-hercules-git-7201d7-felipesievert864-7979s-projects.vercel.app",
    "https://env-brindes-hercules-mryrruru8-felipesievert864-7979s-projects.vercel.app",
    appUrl,
    "https://other.example.com",
  ]) {
    const response = await handler(request({ method: "OPTIONS", origin, token: "" }));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  }
  assert.equal(requests.length, 0);
});

test("missing session remains unauthorized with a readable CORS response", async () => {
  const response = await handler(request({ token: "" }));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), preview);
  assert.equal(requests.length, 0);
});

test("invalid session is validated by Supabase Auth and denied", async () => {
  authValid = false;
  const response = await handler(request());
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), preview);
  assert.equal(requests.length, 1);
});

test("operator and blocked administrator cannot list or invite users", async () => {
  for (const state of [{ role: "operator", status: "active" }, { role: "admin", status: "blocked" }]) {
    actor = { ...profile, ...state };
    for (const action of ["list", "invite"]) {
      const response = await handler(request({ body: { action } }));
      assert.equal(response.status, 403);
      assert.equal(response.headers.get("Access-Control-Allow-Origin"), preview);
    }
  }
  assert.ok(requests.every(r => r.method === "GET"));
});

test("active administrator can list users from Preview", async () => {
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), preview);
  assert.deepEqual(await response.json(), { users: [profile] });
  assert.ok(requests.every(r => r.method === "GET"));
});

test("invitation uses the validated activation URL and creates an invited operator", async () => {
  const response = await handler(request({ body: { action: "invite", name: " Novo Funcionário ", email: " NEW@example.com " } }));
  assert.equal(response.status, 200);
  const invite = requests.find(r => r.url.pathname === "/auth/v1/invite");
  assert.equal(invite.url.searchParams.get("redirect_to"), preview + "/");
  assert.equal(invite.body.email, "new@example.com");
  const insert = requests.find(r => r.url.pathname === "/rest/v1/app_users" && r.method === "POST");
  assert.deepEqual(insert.body, { id: invitedId, full_name: "Novo Funcionário", email: "new@example.com", role: "operator", status: "invited", invited_by: id });
});

test("activation still only updates the invited caller", async () => {
  actor.status = "invited";
  const response = await handler(request({ body: { action: "activate", id: invitedId } }));
  assert.equal(response.status, 200);
  const update = requests.find(r => r.method === "PATCH");
  assert.equal(update.url.searchParams.get("id"), "eq." + id);
  assert.equal(update.url.searchParams.get("status"), "eq.invited");
  assert.deepEqual(update.body, { status: "active" });
});

test("non-invited user cannot activate an invitation", async () => {
  const response = await handler(request({ body: { action: "activate" } }));
  assert.equal(response.status, 403);
  assert.ok(requests.every(r => r.method === "GET"));
});

test("unsupported method and unexpected request failure retain CORS", async () => {
  const unsupported = await handler(request({ method: "GET" }));
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.get("Access-Control-Allow-Origin"), preview);
  const failure = await handler(request({ body: { action: "invite", name: 42, email: "new@example.com" } }));
  assert.equal(failure.status, 500);
  assert.equal(failure.headers.get("Access-Control-Allow-Origin"), preview);
});

test("preflight and configuration errors remain readable even without server credentials", async () => {
  const missingConfig = await loadHandler({ ...env, SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" });
  assert.equal((await missingConfig(request({ method: "OPTIONS", token: "" }))).status, 204);
  const response = await missingConfig(request());
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), preview);
  assert.equal(requests.length, 0);
});

test("Preview entrypoint registers the same protected handler", async () => {
  // A fresh process represents a separate deployed function's module cache.
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { registerHooks } from 'node:module';
    registerHooks({ resolve(s, c, n) { return n(s.replace('npm:@supabase/supabase-js@2.115.0', '@supabase/supabase-js'), c); } });
    let handler;
    globalThis.Deno = { env: { get: key => (${JSON.stringify(env)})[key] }, serve: value => handler = value };
    await import('./supabase/functions/manage-users-preview/index.ts');
    const response = await handler(new Request('https://function.example.com', {method:'OPTIONS',headers:{Origin:${JSON.stringify(preview)}}}));
    if (response.status !== 204 || response.headers.get('Access-Control-Allow-Origin') !== ${JSON.stringify(preview)}) process.exit(1);
  `], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
