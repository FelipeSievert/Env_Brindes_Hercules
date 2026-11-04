import type { Declaracao } from "../types";
import { declarationStatuses, normalizeDeclarationStatus } from "./declarationStatus";

/** Interpret document dates, not import timestamps. Invalid dates stay out of monthly totals. */
export function parseDeclarationDate(value: string): Date | null {
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
  if (!br && !iso) return null;
  const [year, month, day] = br ? [+br[3], +br[2], +br[1]] : [+iso![1], +iso![2], +iso![3]];
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function buildDashboardStats(declaracoes: Declaracao[], monthCount = 6, now = new Date()) {
  const months = Array.from({ length: monthCount }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - monthCount + i + 1, 1, 12);
    return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), count: 0 };
  });
  const statuses = Object.entries(declarationStatuses).map(([key, info]) => ({ key, ...info, count: 0 }));
  const gifts = new Map<string, { key: string; label: string; count: number }>();
  for (const dec of declaracoes) {
    const date = parseDeclarationDate(dec.data);
    const bucket = date && months.find(m => m.key === `${date.getFullYear()}-${date.getMonth()}`);
    if (bucket) bucket.count++;
    const status = normalizeDeclarationStatus(dec.status);
    statuses.find(s => s.key === status)!.count++;
    if (status === "cancelado" || status === "devolvido") continue;
    for (const item of dec.itens) {
      const qty = Number(item.quantidade);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const current = gifts.get(item.brindeId) ?? { key: item.brindeId, label: item.brinde.nome || "Brinde sem nome", count: 0 };
      current.count += qty;
      gifts.set(item.brindeId, current);
    }
  }
  return { months, statuses, gifts: [...gifts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR")).slice(0, 6) };
}
