import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) {
    try { return next(`${specifier}.ts`, context); } catch {}
  }
  return next(specifier, context);
}});
const { normalizeDeclarationStatus } = await import("../src/lib/declarationStatus.ts");
const { mapDestinatario, toDbDestinatario, declarationRecipient } = await import("../src/lib/recipient.ts");
const { buildDashboardStats, parseDeclarationDate } = await import("../src/lib/dashboard.ts");

const baseRecipient = { id: "recipient", nome: "Empresa", cpf_cnpj: "", cep: "", endereco: "Rua", numero: "1", bairro: "", cidade: "Timbó", uf: "SC", categorias: [] };
const dec = (data, status, quantidade = 1) => ({ data, status, itens: [{ brindeId: "gift", brinde: { nome: "Caneta" }, quantidade }] });

test("Legacy values map to database statuses; invalid and inherited names are rejected", () => {
  for (const [input, result] of [["gerada", "gerado"], ["impressa", "gerado"], ["enviada", "informado"], ["devolvida", "devolvido"], [" INFORMADO ", "informado"], ["cancelado", "cancelado"]]) assert.equal(normalizeDeclarationStatus(input), result);
  for (const input of ["constructor", "toString", "inválido"]) assert.throws(() => normalizeDeclarationStatus(input));
});

test("Optional A/C survives recipient writes and reads, trimmed", () => {
  const recipient = mapDestinatario({ ...baseRecipient, aos_cuidados: " Setor de compras " });
  assert.equal(toDbDestinatario(recipient).aos_cuidados, "Setor de compras");
  assert.equal(mapDestinatario(baseRecipient).aosCuidados, "");
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
