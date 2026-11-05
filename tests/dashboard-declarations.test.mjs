import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "./supabase" && context.parentURL?.endsWith("/src/lib/db.ts")) {
      return { url: "data:text/javascript,export const supabase = { rpc: (...args) => globalThis.declarationRpcTest(...args), from: (...args) => globalThis.notificationDbTest(...args) };", shortCircuit: true };
    }
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) {
      for (const extension of [".ts", ".tsx"]) {
        try { return next(`${specifier}${extension}`, context); } catch {}
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (/\.tsx?$/.test(url)) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText };
    return next(url, context);
  },
});
const { normalizeDeclarationStatus } = await import("../src/lib/declarationStatus.ts");
const { mapDestinatario, toDbDestinatario, declarationRecipient } = await import("../src/lib/recipient.ts");
const { buildDashboardStats, parseDeclarationDate } = await import("../src/lib/dashboard.ts");

const baseRecipient = { id: "recipient", nome: "Empresa", cpf_cnpj: "", cep: "", endereco: "Rua", numero: "1", bairro: "", cidade: "Timbó", uf: "SC", categorias: [] };
const dec = (data, status, quantidade = 1) => ({ data, status, itens: [{ brindeId: "gift", brinde: { nome: "Caneta" }, quantidade }] });

test("Legacy values map to database statuses; invalid and inherited names are rejected", () => {
  for (const [input, result] of [["gerada", "gerado"], ["impressa", "gerado"], ["enviada", "informado"], ["devolvida", "devolvido"], [" INFORMADO ", "informado"], ["cancelado", "cancelado"]]) assert.equal(normalizeDeclarationStatus(input), result);
  for (const input of ["constructor", "toString", "inválido"]) assert.throws(() => normalizeDeclarationStatus(input));
});

test("A/C is saved in declarations, never in the client registration", async () => {
  const { recipientForDeclaration } = await import("../src/lib/recipient.ts");
  const recipient = mapDestinatario({ ...baseRecipient, aos_cuidados: "Antigo contato" });
  assert.equal(toDbDestinatario(recipient).aos_cuidados, undefined);
  const draft = recipientForDeclaration(recipient);
  assert.equal(draft.aosCuidados, "");
  draft.aosCuidados = "Contato desta declaração";
  assert.equal(recipient.aosCuidados, "Antigo contato");
  assert.equal(recipientForDeclaration(recipient).aosCuidados, "");
});

test("A/C belongs to the saved document and never leaks from later recipient changes", () => {
  const row = { destinatario_id: "recipient", destinatario: { ...baseRecipient, aos_cuidados: "Novo contato" }, destinatario_snapshot: { ...baseRecipient, aos_cuidados: "Contato original" } };
  assert.equal(declarationRecipient(row).aosCuidados, "Contato original");
  assert.equal(declarationRecipient({ ...row, destinatario_snapshot: baseRecipient }).aosCuidados, "");
  assert.equal(declarationRecipient({ ...row, destinatario_snapshot: null }).aosCuidados, "");
});

test("Monthly charts span year boundaries, include empty months, and use document dates", () => {
  const stats = buildDashboardStats([dec("31/12/2025", "gerado"), dec("01/01/2026", "informado", 2), dec("01/01/2025", "informado")], 6, new Date(2026, 0, 15));
  assert.deepEqual(stats.months.map(m => m.count), [0, 0, 0, 0, 1, 1]);
  assert.equal(stats.months[0].label, "ago. de 25");
});

test("All statuses count; returned/cancelled items are excluded from active usage", () => {
  const stats = buildDashboardStats([dec("04/11/2026", "gerado", 2), dec("04/11/2026", "informado", 3), dec("04/11/2026", "devolvido", 10), dec("04/11/2026", "cancelado", 20)], 6, new Date(2026, 10, 4));
  assert.deepEqual(stats.statuses.map(s => s.count), [1, 1, 1, 1]);
  assert.equal(stats.gifts[0].count, 5);
});

test("Invalid dates are excluded; empty charts retain zeros without invented data", () => {
  for (const date of ["31/02/2026", "00/11/2026", "2026-13-01", "", "04/11/26"]) assert.equal(parseDeclarationDate(date), null);
  assert.equal(parseDeclarationDate("2026-11-04")?.getDate(), 4);
  const stats = buildDashboardStats([], 6, new Date(2026, 10, 4));
  assert.equal(stats.months.length, 6);
  assert.ok(stats.months.every(m => m.count === 0));
  assert.equal(stats.gifts.length, 0);
});


test("Actual print component displays optional A/C in screen and print output only when present", async () => {
  const { default: Preview } = await import("../src/components/DeclaracaoPreview.tsx");
  const { defaultConfig } = await import("../src/data/mockData.ts");
  const declaration = { ...dec("04/11/2026", "gerado"), numero: "QA", destinatario: mapDestinatario({ ...baseRecipient, aos_cuidados: "Compras <interno>" }), itens: [], totalItens: 0, pesoTotal: 0 };
  const html = renderToStaticMarkup(React.createElement(Preview, { declaracao: declaration, config: defaultConfig, onBack() {}, onEdit() {} }));
  assert.equal((html.match(/<b>A\/C:<\/b>/g) ?? []).length, 2, "A/C must render in both screen and print document");
  assert.ok(html.includes("COMPRAS &lt;INTERNO&gt;"));
  declaration.destinatario.aosCuidados = "   ";
  const blank = renderToStaticMarkup(React.createElement(Preview, { declaracao: declaration, config: defaultConfig, onBack() {}, onEdit() {} }));
  assert.ok(!blank.includes("A/C:"), "Empty A/C must not add a row to the document");
});

test("Actual database client sends one atomic RPC and maps the saved snapshot on return", async () => {
  const { insertDeclaracoes } = await import("../src/lib/db.ts");
  const declaration = { ...dec("04/11/2026", "gerada", 2), numero: "QA", destinatario: mapDestinatario({ ...baseRecipient, aos_cuidados: " Compras " }), local: "Timbó" };
  const calls = [];
  globalThis.declarationRpcTest = async (...args) => {
    calls.push(args);
    return { data: [{ id: "saved", status: "gerado", destinatario_id: "recipient", destinatario_snapshot: { ...baseRecipient, aos_cuidados: "Compras" }, itens: [] }], error: null };
  };
  const [saved] = await insertDeclaracoes([declaration, { ...declaration, numero: "QA2" }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "create_declaracoes");
  assert.equal(calls[0][1].p_declaracoes.length, 2);
  assert.equal(calls[0][1].p_declaracoes[0].status, "gerado");
  assert.equal(calls[0][1].p_declaracoes[0].aos_cuidados, "Compras");
  assert.equal(saved.destinatario.aosCuidados, "Compras");
  globalThis.declarationRpcTest = async () => { calls.push("error"); return { data: null, error: { message: "network timeout" } }; };
  await assert.rejects(insertDeclaracoes([declaration]), /network timeout/);
  assert.equal(calls.length, 2, "A lost mutation response must never cause an automatic duplicate retry");
  delete globalThis.declarationRpcTest;
});

test("Authorship displays the original creator and a separate editor, with safe legacy fallbacks", async () => {
  const { default: AuthorInfo } = await import("../src/components/AuthorInfo.tsx");
  const { mapAuthorship, formatAuthorDate } = await import("../src/lib/authorship.ts");
  const record = mapAuthorship({ created_by: "creator", created_by_name: "Original <user>", created_at: "2026-11-05T13:30:00Z", updated_by: "editor", updated_by_name: "Editor", updated_at: "2026-11-05T14:30:00Z" });
  const html = renderToStaticMarkup(React.createElement(AuthorInfo, { record }));
  assert.ok(html.includes("Original &lt;user&gt;"));
  assert.ok(html.includes("Última alteração: Editor"));
  assert.ok(html.includes("10:30"));
  assert.ok(html.includes("11:30"));
  assert.equal(formatAuthorDate("invalid"), "");
  assert.ok(renderToStaticMarkup(React.createElement(AuthorInfo, { record: mapAuthorship({}) })).includes("Autor não identificado"));
  const mappedRecipient = mapDestinatario({ ...baseRecipient, created_by: "creator", created_by_name: "Original" });
  assert.equal(mappedRecipient.createdBy, "creator");
  assert.equal(toDbDestinatario(mappedRecipient).created_by, undefined, "Client must never send trusted actor fields");
});


test("Notifications use stored content and read timestamps instead of obsolete fields", async () => {
  const { mapNotificacao } = await import("../src/lib/db.ts");
  const row = { id: "notice", declaracao_id: "declaration", tipo_notificacao: "lembrete_rastreio", conteudo: "Código de rastreio pendente", created_at: "2026-11-05T10:00:00Z", data_leitura: null };
  assert.equal(mapNotificacao(row).mensagem, "Código de rastreio pendente");
  assert.equal(mapNotificacao(row).tipo, "lembrete_rastreio");
  assert.equal(mapNotificacao(row).lida, false);
  assert.equal(mapNotificacao({ ...row, data_leitura: "2026-11-05T11:00:00Z" }).lida, true);
  assert.ok(mapNotificacao({ ...row, conteudo: " " }).mensagem.length > 0);
});

test("Reading one or all notifications writes data_leitura and surfaces a failed save", async () => {
  const { markNotificacaoLida, markAllNotificacoesLidas } = await import("../src/lib/db.ts");
  const calls = [];
  let failure = null;
  globalThis.notificationDbTest = table => {
    assert.equal(table, "notificacoes");
    const result = { error: failure, data: { id: "notice" } };
    const query = {
      update(patch) { calls.push(patch); return this; },
      eq(column, value) { assert.equal(column, "id"); assert.equal(value, "notice"); return this; },
      select() { return this; }, single() { return Promise.resolve(result); },
      is(column, value) { assert.equal(column, "data_leitura"); assert.equal(value, null); return Promise.resolve(result); }
    };
    return query;
  };
  await markNotificacaoLida("notice"); await markAllNotificacoesLidas();
  assert.equal(calls.length, 2);
  assert.ok(calls.every(patch => !Number.isNaN(Date.parse(patch.data_leitura)) && !("lida" in patch)));
  failure = { message: "Acesso negado" };
  await assert.rejects(markNotificacaoLida("notice"), /Acesso negado/);
});

test("Deletion uses one atomic request and never retries stock changes in the browser", async () => {
  const { deleteDeclaracao } = await import("../src/lib/db.ts");
  const calls=[];
  globalThis.declarationRpcTest=async(...args)=>{ calls.push(args);return {data:null,error:null}; };
  await deleteDeclaracao({id:"declaration",itens:[{brindeId:"gift",quantidade:2}]});
  assert.deepEqual(calls,[["delete_declaration",{p_id:"declaration"}]]);
  globalThis.declarationRpcTest=async()=>({error:{message:"Não foi possível excluir"}});
  await assert.rejects(deleteDeclaracao({id:"declaration",itens:[]}),/Não foi possível excluir/);
});
