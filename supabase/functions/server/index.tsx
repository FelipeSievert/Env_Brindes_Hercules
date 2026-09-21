import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/make-server-8d3e443d/health", (c) => c.json({ status: "ok" }));

// ── Rastreio check — chamado pelo pg_cron ou manualmente ─────────────────────
// POST /make-server-8d3e443d/rastreio-check
// Executa run_rastreio_check() e, se email_lembretes configurado, envia e-mails.
app.post("/make-server-8d3e443d/rastreio-check", async (c) => {
  const sb = getSupabase();

  // 1. Busca config
  const { data: cfg } = await sb
    .from("configuracoes")
    .select("lembretes_ativos, email_lembretes")
    .eq("id", 1)
    .maybeSingle();

  if (!cfg?.lembretes_ativos) {
    return c.json({ ok: true, enviados: 0, msg: "Lembretes desativados." });
  }

  // 2. Roda a função SQL de verificação
  const { data: count, error } = await sb.rpc("run_rastreio_check");
  if (error) return c.json({ ok: false, error: error.message }, 500);

  // 3. Busca declarações que acabaram de receber lembrete para montar e-mails
  if (cfg.email_lembretes && count > 0) {
    const { data: pendentes } = await sb
      .from("declaracoes")
      .select("numero, data, destinatario:destinatarios(nome)")
      .eq("lembrete_rastreio_enviado", true)
      .is("codigo_rastreio", null)
      .gte(
        "data_lembrete_rastreio",
        new Date(Date.now() - 60_000).toISOString(), // enviados no último minuto
      );

    // Estrutura de e-mail preparada — integre com Resend, SendGrid, ou SMTP
    // Para ativar: adicione RESEND_API_KEY em Supabase > Settings > Edge Functions > Secrets
    const emailApiKey = Deno.env.get("RESEND_API_KEY");
    if (emailApiKey && pendentes && pendentes.length > 0) {
      for (const dec of pendentes) {
        const dest = dec.destinatario as { nome?: string } | null;
        const body = [
          "Olá,",
          "",
          `A declaração de conteúdo nº ${dec.numero} foi criada em ${dec.data} e já completou 2 dias sem que um código de rastreio tenha sido informado.`,
          "",
          "Por favor, verifique a declaração e informe o código de rastreio.",
          "",
          "Acesse o sistema para atualizar a declaração.",
        ].join("\n");

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${emailApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "lembretes@hercules.com.br",
            to: [cfg.email_lembretes],
            subject: "Lembrete: código de rastreio pendente",
            text: body,
          }),
        }).catch(() => null); // não bloqueia se e-mail falhar
      }
    }
  }

  return c.json({ ok: true, enviados: Number(count ?? 0) });
});

Deno.serve(app.fetch);
