import type { Destinatario } from "../types";
import { mapAuthorship } from "./authorship";

export function toDbDestinatario(d: Omit<Destinatario, "id"> | Destinatario) {
  return {
    nome: d.nome, cpf_cnpj: d.cpfCnpj, cep: d.cep, endereco: d.endereco,
    numero: d.numero, complemento: d.complemento ?? "", bairro: d.bairro,
    cidade: d.cidade, uf: d.uf, categorias: d.categorias ?? [],
    aos_cuidados: (d.aosCuidados ?? "").trim(),
  };
}

export function mapDestinatario(row: Record<string, unknown>): Destinatario {
  const raw = row.categorias;
  const categorias = Array.isArray(raw) ? raw.map(String).filter(Boolean)
    : typeof raw === "string" && raw ? raw.replace(/^\{|\}$/g, "").split(",").map(s => s.trim().replace(/^"|"$/g, "")).filter(Boolean) : [];
  return {
    id: String(row.id ?? ""), nome: String(row.nome ?? ""), cpfCnpj: String(row.cpf_cnpj ?? ""),
    cep: String(row.cep ?? ""), endereco: String(row.endereco ?? ""), numero: String(row.numero ?? ""),
    complemento: String(row.complemento ?? ""), bairro: String(row.bairro ?? ""),
    cidade: String(row.cidade ?? ""), uf: String(row.uf ?? ""), categorias,
    aosCuidados: String(row.aos_cuidados ?? ""),
    ...mapAuthorship(row),
  };
}

export function declarationRecipient(row: Record<string, unknown>): Destinatario {
  const current = (row.destinatario as Record<string, unknown>) ?? {};
  const snapshot = row.destinatario_snapshot;
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
    const saved = snapshot as Record<string, unknown>;
    return mapDestinatario({ ...current, ...saved, id: row.destinatario_id ?? saved.id ?? current.id, aos_cuidados: saved.aos_cuidados ?? "" });
  }
  // Older documents without a snapshot must not acquire a newly edited A/C.
  return mapDestinatario({ ...current, aos_cuidados: "" });
}
