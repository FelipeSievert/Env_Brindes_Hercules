import type { Authorship } from "../types";

export function mapAuthorship(row: Record<string, unknown>): Authorship {
  const value = (key: string) => row[key] ? String(row[key]) : undefined;
  return { createdBy: value("created_by"), createdByName: value("created_by_name"),
    createdAt: value("created_at"), updatedBy: value("updated_by"),
    updatedByName: value("updated_by_name"), updatedAt: value("updated_at") };
}

export function authorName(name?: string): string {
  return name?.trim() || "Autor não identificado";
}

export function formatAuthorDate(value?: string): string {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}
