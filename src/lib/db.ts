import { supabase } from "./supabase";
import { mapAuthorship } from "./authorship";
import { Destinatario, Brinde, Declaracao, Configuracoes, Notificacao, Responsavel, SaidaAvulsa } from "../types";
import { toDbDestinatario, mapDestinatario, declarationRecipient } from "./recipient";
import { normalizeDeclarationStatus } from "./declarationStatus";

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

export async function updateDestinatario(d: Destinatario): Promise<Destinatario> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("destinatarios").update(toDbDestinatario(d)).eq("id", d.id).select().single();
    if (error) throw new Error(error.message);
    return mapDestinatario(data);
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

export async function updateBrinde(b: Brinde): Promise<Brinde> {
  return withRetry(async () => {
    const { data, error } = await supabase.from("brindes").update(toDbBrinde(b)).eq("id", b.id).select().single();
    if (error) throw new Error(error.message);
    return mapBrinde(data);
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
    ...mapAuthorship(row),
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
        emailDestinatario: String(data.email_destino ?? ""),
        emailAtivo: Boolean(data.email_lembretes),
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
      email_lembretes: Boolean(c.lembretes.emailAtivo),
      email_destino: c.lembretes.emailDestinatario,
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
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapDeclaracao);
  });
}

/** Save the whole batch in one database transaction, including stock and snapshots. */
export async function insertDeclaracoes(decs: Omit<Declaracao, "id">[]): Promise<Declaracao[]> {
  const payload = decs.map(dec => ({
    numero: dec.numero,
    destinatario_id: dec.destinatario.id,
    aos_cuidados: (dec.destinatario.aosCuidados ?? "").trim(),
    data: dec.data,
    local: dec.local,
    status: normalizeDeclarationStatus(dec.status),
    responsavel: dec.responsavel ?? "",
    responsavel_id: dec.responsavelId,
    mensagem_rastreio: dec.mensagemRastreio ?? "",
    itens: dec.itens.map(item => ({ brinde_id: item.brindeId, quantidade: item.quantidade })),
  }));
  // Never retry a mutation whose result may have been committed before a lost response.
  const { data, error } = await supabase.rpc("create_declaracoes", { p_declaracoes: payload });
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown>[]).map(mapDeclaracao);
}

export async function insertDeclaracao(dec: Omit<Declaracao, "id">): Promise<Declaracao> {
  const [saved] = await insertDeclaracoes([dec]);
  return saved;
}

export async function deleteDeclaracao(dec: Declaracao): Promise<void> {
  const { error } = await supabase.rpc("delete_declaration", { p_id: dec.id });
  if (error) throw new Error(error.message);
}

export async function updateDeclaracaoStatus(id: string, status: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from("declaracoes").update({ status: normalizeDeclarationStatus(status) }).eq("id", id);
    if (error) throw new Error(error.message);
  });
}

export async function updateCodigoRastreio(id: string, codigo: string, mensagem = "", emailCopia = ""): Promise<string> {
  const {data,error}=await supabase.rpc("save_tracking_notification",{p_id:id,p_codigo:codigo,p_mensagem:mensagem,p_email_copia:emailCopia.trim().toLowerCase()});
  if(error) throw new Error(error.message);
  if(!data.email_id) return "Rastreio salvo. Esta declaração não possui e-mail de responsável.";
  return sendTrackingEmail(data.email_id);
}
export async function sendTrackingEmail(id: string): Promise<string> {
  const {data,error}=await supabase.functions.invoke("send-tracking-email",{body:{id}});
  if(error || data?.error) return "Rastreio salvo. E-mail pendente: "+(data?.error || "não foi possível confirmar o envio. Consulte o histórico de e-mails.");
  return data.status === "enviado" ? "Rastreio salvo e e-mail enviado ao responsável." : "Rastreio salvo. Situação do e-mail: "+data.status;
}
export async function fetchResponsaveis(): Promise<Responsavel[]> {
 const {data,error}=await supabase.from("responsaveis_solicitacao").select("*").order("nome");
 if(error) throw new Error(error.message); return (data??[]).map(row => ({ id: row.id, nome: row.nome, email: row.email, ...mapAuthorship(row) }));
}
export async function saveResponsavel(row: {id?:string;nome:string;email:string}): Promise<void> {
 const result=row.id?await supabase.from("responsaveis_solicitacao").update({nome:row.nome,email:row.email}).eq("id",row.id):await supabase.from("responsaveis_solicitacao").insert({nome:row.nome,email:row.email});
 if(result.error) throw new Error(result.error.code==="23505"?"Este e-mail já está cadastrado.":result.error.message);
}
export async function fetchTrackingEmails() {
 const {data,error}=await supabase.from("rastreio_emails").select("id,email,email_copia,codigo,status,erro,declaracao_id").order("created_at",{ascending:false}).limit(100);
 if(error) throw new Error(error.message);return data??[];
}

function mapDeclaracao(row: Record<string, unknown>): Declaracao {
  const itens = ((row.itens as unknown[]) ?? []).map((i) => {
    const item = i as Record<string, unknown>;
    const br = (item.brinde_snapshot as Record<string, unknown>) ?? (item.brinde as Record<string, unknown>) ?? {};
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
    ...mapAuthorship(row),
    id: String(row.id),
    numero: String(row.numero ?? ""),
    destinatario: declarationRecipient(row),
    itens,
    data: String(row.data ?? ""),
    local: String(row.local ?? ""),
    status: normalizeDeclarationStatus(row.status),
    totalItens: Number(row.total_itens ?? 0),
    pesoTotal: Number(row.peso_total ?? 0),
    responsavel: row.responsavel ? String(row.responsavel) : undefined,
    responsavelId: row.responsavel_id ? String(row.responsavel_id) : undefined,
    responsavelEmail: String(row.responsavel_email ?? ""),
    emailCopia: String(row.email_copia ?? ""),
    mensagemRastreio: String(row.mensagem_rastreio ?? ""),
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
    const { error } = await supabase.from("notificacoes").update({ data_leitura: new Date().toISOString() }).eq("id", id).select("id").single();
    if (error) throw new Error(error.message);
  });
}

export async function markAllNotificacoesLidas(): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("notificacoes").update({ data_leitura: new Date().toISOString() }).is("data_leitura", null);
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

export function mapNotificacao(row: Record<string, unknown>): Notificacao {
  return {
    id: String(row.id),
    declaracaoId: String(row.declaracao_id ?? ""),
    tipo: String(row.tipo_notificacao ?? ""),
    mensagem: String(row.conteudo ?? "").trim() || "Há uma atualização nesta declaração.",
    lida: Boolean(row.data_leitura),
    createdAt: String(row.created_at ?? ""),
  };
}

export async function fetchStockMovements(giftId: string) {
  const { data, error } = await supabase.from("estoque_movimentacoes")
    .select("id,tipo,quantidade,saldo_apos,motivo,created_by,created_by_name,created_at,updated_by,updated_by_name,updated_at")
    .eq("brinde_id", giftId).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map(row => ({ id: String(row.id), tipo: String(row.tipo), quantidade: Number(row.quantidade),
    saldo: Number(row.saldo_apos), motivo: String(row.motivo), ...mapAuthorship(row) }));
}

// ─── SAÍDAS AVULSAS ───────────────────────────────────────────────────────────

export async function fetchSaidasAvulsas(): Promise<SaidaAvulsa[]> {
  const { data, error } = await supabase
    .from("saidas_avulsas")
    .select("id,destino,motivo,created_at,created_by,created_by_name,movimentos:estoque_movimentacoes(brinde_id,brinde_nome,quantidade,saldo_apos)")
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map(row => ({
    id: String(row.id),
    destino: String(row.destino),
    motivo: String(row.motivo),
    createdAt: String(row.created_at),
    createdBy: String(row.created_by ?? ""),
    createdByName: String(row.created_by_name ?? ""),
    itens: (row.movimentos ?? []).map((movement: Record<string, unknown>) => ({
      brindeId: String(movement.brinde_id ?? ""),
      nome: String(movement.brinde_nome ?? ""),
      quantidade: Math.abs(Number(movement.quantidade ?? 0)),
      saldoApos: Number(movement.saldo_apos ?? 0),
    })),
  }));
}

/** Inserção, baixa e histórico ocorrem na mesma transação do Supabase.
 * Não repetir automaticamente após erros de rede: a operação pode ter sido gravada.
 */
export async function insertSaidaAvulsa(input: {
  destino: string;
  motivo: string;
  itens: { brindeId: string; quantidade: number }[];
}): Promise<void> {
  const { error } = await supabase.from("saidas_avulsas").insert({
    destino: input.destino.trim(),
    motivo: input.motivo.trim(),
    itens: input.itens.map(item => ({ brinde_id: item.brindeId, quantidade: item.quantidade })),
  });
  if (error) throw new Error(error.message);
}
