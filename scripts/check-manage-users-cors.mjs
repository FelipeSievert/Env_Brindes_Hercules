// Read-only HTTP regression check. Never sends invitations or writes data.
const [originValue, functionName = "manage-users"] = process.argv.slice(2);
if (!originValue || !["manage-users", "manage-users-preview"].includes(functionName)) {
  console.error("Usage: node scripts/check-manage-users-cors.mjs <exact-preview-origin> [manage-users|manage-users-preview]");
  process.exit(2);
}
const origin = new URL(originValue).origin;
const url = `https://cddxvgegzzyafxgcpklt.supabase.co/functions/v1/${functionName}`;
const requiredHeaders = ["authorization", "apikey", "content-type", "x-client-info", "x-retry-count", "traceparent", "tracestate", "baggage"];
const response = await fetch(url, {
  method: "OPTIONS",
  headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": requiredHeaders.join(", ") },
  signal: AbortSignal.timeout(20000),
});
const allowOrigin = response.headers.get("Access-Control-Allow-Origin");
const allowedHeaders = (response.headers.get("Access-Control-Allow-Headers") ?? "").toLowerCase().split(/,\s*/);
const allowedMethods = (response.headers.get("Access-Control-Allow-Methods") ?? "").toUpperCase().split(/,\s*/);
const missingHeaders = requiredHeaders.filter(header => !allowedHeaders.includes(header));
console.log(JSON.stringify({ functionName, origin, status: response.status, allowOrigin, missingHeaders, allowPost: allowedMethods.includes("POST") }, null, 2));
if (response.status !== 204 || allowOrigin !== origin || missingHeaders.length || !allowedMethods.includes("POST")) {
  console.error("CORS preflight failed:", (await response.text()).slice(0, 400));
  process.exit(1);
}
// An unauthenticated caller must still be denied after a successful preflight.
const unauthorized = await fetch(url, {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify({ action: "list" }), signal: AbortSignal.timeout(20000),
});
if (unauthorized.status !== 401 || ![origin, "*"].includes(unauthorized.headers.get("Access-Control-Allow-Origin"))) {
  console.error("Expected a readable 401 for an unauthenticated caller; got", unauthorized.status);
  process.exit(1);
}
console.log("PASS: preflight accepted; unauthenticated listing denied. Authenticated browser verification remains required.");
