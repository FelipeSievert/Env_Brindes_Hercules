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
  const gifts = new Map<string, { key: string; label: string; count: number; occurrences: number; average: number }>();
  for (const dec of declaracoes) {
    const date = parseDeclarationDate(dec.data);
    const bucket = date && months.find(m => m.key === `${date.getFullYear()}-${date.getMonth()}`);
    if (bucket) bucket.count++;
    const status = normalizeDeclarationStatus(dec.status);
    statuses.find(s => s.key === status)!.count++;
    if (status === "cancelado" || status === "devolvido") continue;
    const perDeclaration = new Map<string, { label: string; qty: number }>();
    for (const item of dec.itens) {
      const qty = Number(item.quantidade);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const previous = perDeclaration.get(item.brindeId);
      perDeclaration.set(item.brindeId, { label: item.brinde.nome || "Brinde sem nome", qty: (previous?.qty ?? 0) + qty });
    }
    for (const [key, item] of perDeclaration) {
      const current = gifts.get(key) ?? { key, label: item.label, count: 0, occurrences: 0, average: 0 };
      current.count += item.qty; current.occurrences++;
      current.average = current.count / current.occurrences;
      gifts.set(key, current);
    }
  }
  return { months, statuses, gifts: [...gifts.values()].sort((a, b) => b.average - a.average || b.count - a.count || a.label.localeCompare(b.label, "pt-BR")).slice(0, 6) };
}


export function dashboardRange(preset: "month" | "6" | "12", now = new Date()) {
  const end = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(now);
  const [year, month] = end.split("-").map(Number);
  const first = new Date(year, month - (preset === "month" ? 1 : Number(preset)), 1, 12);
  const start = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

export function buildDashboardPeriodStats(declaracoes: Declaracao[], start: string, end: string) {
  const first = parseDeclarationDate(start), last = parseDeclarationDate(end);
  const monthCount = first && last ? (last.getFullYear() - first.getFullYear()) * 12 + last.getMonth() - first.getMonth() + 1 : 0;
  const error = !first || !last ? "Informe a data inicial e a data final." : first > last ? "A data inicial deve ser anterior ou igual à data final." : monthCount > 60 ? "Selecione um período de até cinco anos." : "";
  const filtered = error ? [] : declaracoes.filter(dec => {
    const date = parseDeclarationDate(dec.data);
    return date && date >= first! && date <= last!;
  });
  const stats = buildDashboardStats(filtered, error ? 1 : monthCount, last ?? new Date());
  const format = (date: Date | null) => date?.toLocaleDateString("pt-BR") ?? "";
  return { ...stats, count: filtered.length, error, label: error ? "Período inválido" : `${format(first)} a ${format(last)}` };
}
