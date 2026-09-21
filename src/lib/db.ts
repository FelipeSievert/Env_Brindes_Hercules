import { supabase } from "./supabase";
import { Destinatario, Brinde, Declaracao, Configuracoes, Notificacao } from "../types";

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1500): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      const isTransient =
        msg.includes("shutting down") ||
        msg.includes("starting up") ||
        msg.includes("connection") ||
        msg.includes("timeout") ||
        msg.includes("network");
      if (!isTransient || i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastError;
}

// ─── DESTINATÁRIOS ────────────────────────────────────────────────────────────

export async function fetchDestinatarios(): Promise<Destinatario[]> {
  return withRetry(async () => {
    const { data, error } = await supabase.from("destinatarios").select("*").order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapDestinatario);
  });
}

export async function insertDestinatario(d: Omit<Destinatario, "id">): Promise<Destinatario> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("destinatarios").insert(toDbDestinatario(d)).select().single();
    if (error) throw new Error(error.message);
    return mapDestinatario(data);
  });
}

export async function updateDestinatario(d: Destinatario): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("destinatarios").update(toDbDestinatario(d)).eq("id", d.id);
    if (error) throw new Error(error.message);
  });
}

export async function deleteDestinatario(id: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from("destinatarios").delete().eq("id", id);
    if (error) throw new Error(error.message);
  });
}

export async function upsertDestinatarios(
  rows: (Omit<Destinatario, "id"> & { id?: string })[]
): Promise<void> {
  const toInsert = rows.filter((r) => !r.id);
  const toUpdate = rows.filter((r) => !!r.id) as Destinatario[];
  await Promise.all([
    toInsert.length > 0
      ? withRetry(async () => {
          const { error } = await supabase.from("destinatarios").insert(toInsert.map(toDbDestinatario));
          if (error) throw new Error(error.message);
        })
      : Promise.resolve(),
    ...toUpdate.map((d) => updateDestinatario(d)),
  ]);
}

function toDbDestinatario(d: Omit<Destinatario, "id"> | Destinatario) {
  return {
    nome: d.nome,
    cpf_cnpj: d.cpfCnpj,
    cep: d.cep,
    endereco: d.endereco,
    numero: d.numero,
    complemento: d.complemento ?? "",
    bairro: d.bairro,
    cidade: d.cidade,
    uf: d.uf,
    categorias: d.categorias ?? [],
  };
}

function mapDestinatario(row: Record<string, unknown>): Destinatario {
  const raw = row.categorias;
  const categorias: string[] = Array.isArray(raw)
    ? raw.map(String).filter(Boolean)
    : typeof raw === "string" && raw
      ? raw.replace(/^\{|\}$/g, "").split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean)
      : [];
  return {
    id: String(row.id),
    nome: String(row.nome ?? ""),
    cpfCnpj: String(row.cpf_cnpj ?? ""),
    cep: String(row.cep ?? ""),
    endereco: String(row.endereco ?? ""),
    numero: String(row.numero ?? ""),
    complemento: String(row.complemento ?? ""),
    bairro: String(row.bairro ?? ""),
    cidade: String(row.cidade ?? ""),
    uf: String(row.uf ?? ""),
    categorias,
  };
}

// ─── BRINDES / ESTOQUE ───────────────────────────────────────────────────────

export async function fetchBrindes(): Promise<Brinde[]> {
  return withRetry(async () => {
    const { data, error } = await supabase.from("brindes").select("*").order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapBrinde);
  });
}

export async function insertBrinde(b: Omit<Brinde, "id">): Promise<Brinde> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("brindes").insert(toDbBrinde(b)).select().single();
    if (error) throw new Error(error.message);
    return mapBrinde(data);
  });
}

export async function updateBrinde(b: Brinde): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from("brindes").update(toDbBrinde(b)).eq("id", b.id);
    if (error) throw new Error(error.message);
  });
}

export async function deleteBrinde(id: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from("brindes").delete().eq("id", id);
    if (error) throw new Error(error.message);
  });
}

function toDbBrinde(b: Omit<Brinde, "id">) {
  return {
    nome: b.nome,
    categoria: b.categoria,
    quantidade: b.quantidade,
    peso_unitario: b.pesoUnitario,
    valor: b.valor,
  };
}

function mapBrinde(row: Record<string, unknown>): Brinde {
  return {
    id: String(row.id),
    nome: String(row.nome ?? ""),
    categoria: String(row.categoria ?? ""),
    quantidade: Number(row.quantidade ?? 0),
    pesoUnitario: Number(row.peso_unitario ?? 0),
    valor: Number(row.valor ?? 0),
  };
}

// ─── CONFIGURAÇÕES ────────────────────────────────────────────────────────────

export async function fetchConfig(): Promise<Configuracoes | null> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("configuracoes").select("*").eq("id", 1).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      remetente: {
        nome: String(data.nome ?? ""),
        endereco: String(data.endereco ?? ""),
        numero: String(data.numero ?? ""),
        bairro: String(data.bairro ?? ""),
        cidade: String(data.cidade ?? ""),
        uf: String(data.uf ?? ""),
        cep: String(data.cep ?? ""),
        cnpj: String(data.cnpj ?? ""),
      },
      lembretes: {
        ativo: data.lembretes_ativos !== false,
        emailDestinatario: String(data.email_lembretes ?? ""),
      },
    };
  });
}

export async function saveConfig(c: Configuracoes): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from("configuracoes").upsert({
      id: 1,
      nome: c.remetente.nome,
      cnpj: c.remetente.cnpj,
      endereco: c.remetente.endereco,
      numero: c.remetente.numero,
      bairro: c.remetente.bairro,
      cidade: c.remetente.cidade,
      uf: c.remetente.uf,
      cep: c.remetente.cep,
      lembretes_ativos: c.lembretes.ativo,
      email_lembretes: c.lembretes.emailDestinatario,
    });
    if (error) throw new Error(error.message);
  });
}

// ─── DECLARAÇÕES ─────────────────────────────────────────────────────────────

export async function fetchDeclaracoes(): Promise<Declaracao[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("declaracoes")
      .select(`
        *,
        destinatario:destinatarios(*),
        itens:declaracao_itens(*, brinde:brindes(*))
      `)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapDeclaracao);
  });
}

export async function insertDeclaracao(dec: Omit<Declaracao, "id">): Promise<Declaracao> {
  return withRetry(async () => {
    const { data: decData, error: decError } = await supabase
      .from("declaracoes")
      .insert({
        numero: dec.numero,
        destinatario_id: dec.destinatario.id,
        data: dec.data,
        local: dec.local,
        status: dec.status,
        total_itens: dec.totalItens,
        peso_total: dec.pesoTotal,
        responsavel: dec.responsavel ?? "",
        codigo_rastreio: dec.codigoRastreio ?? "",
      })
      .select()
      .single();
    if (decError) throw new Error(decError.message);

    const itens = dec.itens.map((item) => ({
      declaracao_id: decData.id,
      brinde_id: item.brindeId,
      quantidade: item.quantidade,
      peso_total: item.pesoTotal,
    }));

    const { error: itensError } = await supabase.from("declaracao_itens").insert(itens);
    if (itensError) throw new Error(itensError.message);

    for (const item of dec.itens) {
      const { error: stockError } = await supabase.rpc("decrease_stock", {
        p_brinde_id: item.brindeId,
        p_quantidade: item.quantidade,
      });
      if (stockError) throw new Error(stockError.message);
    }

    return { ...dec, id: String(decData.id), createdAt: String(decData.created_at ?? "") };
  });
}

export async function deleteDeclaracao(dec: Declaracao): Promise<void> {
  return withRetry(async () => {
    for (const item of dec.itens) {
      const { error: stockError } = await supabase.rpc("increase_stock", {
        p_brinde_id: item.brindeId,
        p_quantidade: item.quantidade,
      });
      if (stockError) throw new Error(stockError.message);
    }
    const { error } = await supabase.from("declaracoes").delete().eq("id", dec.id);
    if (error) throw new Error(error.message);
  });
}

export async function updateDeclaracaoStatus(id: string, status: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from("declaracoes").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
  });
}

export async function updateCodigoRastreio(id: string, codigo: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("declaracoes")
      .update({ codigo_rastreio: codigo })
      .eq("id", id);
    if (error) throw new Error(error.message);
  });
}

function mapDeclaracao(row: Record<string, unknown>): Declaracao {
  const dest = row.destinatario as Record<string, unknown>;
  const rawCat = dest?.categorias;
  const categorias: string[] = Array.isArray(rawCat)
    ? rawCat.map(String).filter(Boolean)
    : [];

  const itens = ((row.itens as unknown[]) ?? []).map((i) => {
    const item = i as Record<string, unknown>;
    const br = (item.brinde as Record<string, unknown>) ?? {};
    return {
      brindeId: String(item.brinde_id),
      brinde: {
        id: String(br.id ?? ""),
        nome: String(br.nome ?? ""),
        categoria: String(br.categoria ?? ""),
        quantidade: Number(br.quantidade ?? 0),
        pesoUnitario: Number(br.peso_unitario ?? 0),
        valor: Number(br.valor ?? 0),
      },
      quantidade: Number(item.quantidade ?? 0),
      pesoTotal: Number(item.peso_total ?? 0),
    };
  });

  return {
    id: String(row.id),
    numero: String(row.numero ?? ""),
    destinatario: {
      id: String(dest?.id ?? ""),
      nome: String(dest?.nome ?? ""),
      cpfCnpj: String(dest?.cpf_cnpj ?? ""),
      cep: String(dest?.cep ?? ""),
      endereco: String(dest?.endereco ?? ""),
      numero: String(dest?.numero ?? ""),
      complemento: String(dest?.complemento ?? ""),
      bairro: String(dest?.bairro ?? ""),
      cidade: String(dest?.cidade ?? ""),
      uf: String(dest?.uf ?? ""),
      categorias,
    },
    itens,
    data: String(row.data ?? ""),
    local: String(row.local ?? ""),
    status: (row.status as Declaracao["status"]) ?? "gerada",
    totalItens: Number(row.total_itens ?? 0),
    pesoTotal: Number(row.peso_total ?? 0),
    responsavel: row.responsavel ? String(row.responsavel) : undefined,
    codigoRastreio: String(row.codigo_rastreio ?? ""),
    lembreteRastreioEnviado: Boolean(row.lembrete_rastreio_enviado),
    dataLembreteRastreio: row.data_lembrete_rastreio ? String(row.data_lembrete_rastreio) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

// ─── NOTIFICAÇÕES ─────────────────────────────────────────────────────────────

export async function fetchNotificacoes(): Promise<Notificacao[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("notificacoes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapNotificacao);
  });
}

export async function markNotificacaoLida(id: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    if (error) throw new Error(error.message);
  });
}

export async function markAllNotificacoesLidas(): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("notificacoes").update({ lida: true }).eq("lida", false);
    if (error) throw new Error(error.message);
  });
}

export async function triggerRastreioCheck(): Promise<number> {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc("run_rastreio_check");
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  });
}

function mapNotificacao(row: Record<string, unknown>): Notificacao {
  return {
    id: String(row.id),
    declaracaoId: String(row.declaracao_id ?? ""),
    tipo: String(row.tipo ?? ""),
    mensagem: String(row.mensagem ?? ""),
    lida: Boolean(row.lida),
    createdAt: String(row.created_at ?? ""),
  };
}
