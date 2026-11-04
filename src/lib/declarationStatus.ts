import type { StatusDeclaracao } from "../types";

export const declarationStatuses: Record<StatusDeclaracao, { label: string; color: string; hex: string }> = {
  gerado: { label: "Gerado", color: "bg-blue-100 text-blue-700", hex: "#1A3A6B" },
  informado: { label: "Informado", color: "bg-green-100 text-green-700", hex: "#059669" },
  devolvido: { label: "Devolvido", color: "bg-orange-100 text-orange-700", hex: "#D97706" },
  cancelado: { label: "Cancelado", color: "bg-slate-100 text-slate-700", hex: "#94A3B8" },
};

export function normalizeDeclarationStatus(value: unknown): StatusDeclaracao {
  const status = String(value ?? "gerado").trim().toLowerCase();
  if (status === "gerada" || status === "impressa") return "gerado";
  if (status === "enviada") return "informado";
  if (status === "devolvida") return "devolvido";
  if (Object.prototype.hasOwnProperty.call(declarationStatuses, status)) return status as StatusDeclaracao;
  throw new Error("Status da declaração não reconhecido.");
}
