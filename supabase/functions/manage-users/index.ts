// Edge Function: manage-users
// Secrets needed: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_URL, ALLOWED_ORIGINS.
// Deploy ONLY to the Supabase project used by Envio de Brindes.
import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.115.0/cors";
import { createCorsPolicy } from "./cors.ts";

const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const appUrl = (Deno.env.get("APP_URL") ?? "").trim().replace(/\/$/, "");
const cors = createCorsPolicy(Deno.env.get("ALLOWED_ORIGINS") ?? "", appUrl, corsHeaders);
// Initialize only after preflight/config validation. An invalid configuration
// must return a readable CORS response instead of crashing on a cold start.
let admin: ReturnType<typeof createClient> | undefined;
type ActionRequest = { action?: string; id?: string; name?: string; email?: string; status?: string; role?: string };

function reply(payload: Record<string, unknown>, status = 200, origin = "") {
  const headers = cors.headers(origin);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(payload), {
    status,
    headers,
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  if (!cors.isAllowed(origin)) return reply({ error: "Origem não autorizada." }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors.headers(origin) });
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405, origin);
  if (!projectUrl || !serviceKey) return reply({ error: "Backend não configurado." }, 503, origin);

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token || token === req.headers.get("Authorization")) return reply({ error: "Sessão necessária." }, 401, origin);
    admin ??= createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return reply({ error: "Sessão inválida." }, 401, origin);

    const { data: actor, error: actorError } = await admin.from("app_users")
      .select("id, role, status").eq("id", authData.user.id).maybeSingle();
    if (actorError || !actor) return reply({ error: "Conta sem permissão." }, 403, origin);
    let request: ActionRequest;
    try { request = await req.json(); } catch { return reply({ error: "Dados inválidos." }, 400, origin); }

    // Only a user who received an invitation can activate their own account.
    if (request.action === "activate") {
      if (actor.status !== "invited") return reply({ error: "Convite não está pendente." }, 403, origin);
      const { error } = await admin.from("app_users").update({ status: "active" }).eq("id", actor.id).eq("status", "invited");
      return error ? reply({ error: "Não foi possível ativar o convite." }, 500, origin) : reply({ ok: true }, 200, origin);
    }

    if (actor.role !== "admin" || actor.status !== "active") return reply({ error: "Somente administradores podem executar esta ação." }, 403, origin);

    if (request.action === "list") {
      const { data, error } = await admin.from("app_users")
        .select("id, full_name, email, role, status").order("created_at", { ascending: false });
      return error ? reply({ error: "Falha ao consultar usuários." }, 500, origin) : reply({ users: data ?? [] }, 200, origin);
    }

    if (request.action === "invite") {
      const name = (request.name ?? "").trim();
      const email = (request.email ?? "").trim().toLowerCase();
      if (name.length < 2 || name.length > 160 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reply({ error: "Informe nome e e-mail válidos." }, 400, origin);
      }
      if (!appUrl || !cors.isAllowed(appUrl)) return reply({ error: "APP_URL ou ALLOWED_ORIGINS não configurados." }, 503, origin);
      const { data: existing } = await admin.from("app_users").select("id").eq("email", email).maybeSingle();
      if (existing) return reply({ error: "Este e-mail já está cadastrado." }, 409, origin);
      const { data: invitation, error: invitationError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: appUrl + "/", data: { full_name: name },
      });
      if (invitationError || !invitation.user) return reply({ error: "Não foi possível enviar o convite. Verifique o e-mail e o serviço de e-mail do Supabase." }, 400, origin);
      const { error: profileError } = await admin.from("app_users").insert({
        id: invitation.user.id, full_name: name, email, role: "operator", status: "invited", invited_by: actor.id,
      });
      if (profileError) {
        // Prevent untracked invited users if creating the authorization row fails.
        await admin.auth.admin.deleteUser(invitation.user.id);
        return reply({ error: "Falha ao registrar o convite." }, 500, origin);
      }
      return reply({ ok: true }, 200, origin);
    }

    if (request.action === "setRole" || request.action === "setStatus") {
      const targetId = request.id ?? "";
      if (!/^[0-9a-f-]{36}$/i.test(targetId)) return reply({ error: "Usuário inválido." }, 400, origin);
      if (targetId === actor.id) return reply({ error: "Não é permitido modificar sua própria conta." }, 400, origin);
      const change = request.action === "setRole"
        ? (request.role === "operator" || request.role === "admin" ? { role: request.role } : null)
        : (request.status === "active" || request.status === "blocked" ? { status: request.status } : null);
      if (!change) return reply({ error: "Valor inválido." }, 400, origin);
      const { data, error } = await admin.from("app_users").update(change).eq("id", targetId).select("id").maybeSingle();
      if (error || !data) return reply({ error: "Não foi possível alterar esta conta." }, 400, origin);
      return reply({ ok: true }, 200, origin);
    }
    return reply({ error: "Ação desconhecida." }, 400, origin);
  } catch {
    console.error("manage-users: falha inesperada ao processar a solicitação.");
    return reply({ error: "Não foi possível processar a solicitação. Tente novamente." }, 500, origin);
  }
});
