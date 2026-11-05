export type Page =
  | "responsaveis"
  | "dashboard"
  | "destinatarios"
  | "brindes"
  | "nova-declaracao"
  | "declaracoes"
  | "configuracoes"
  | "usuarios"
  | "declaracao-preview"
  | "importar-word";

export interface Authorship {
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: string;
}

export interface Destinatario extends Authorship {
  id: string;
  nome: string;
  aosCuidados?: string;
  cpfCnpj: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  categorias: string[];
}

export interface Brinde extends Authorship {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  pesoUnitario: number;
  valor: number;
}

export interface ItemDeclaracao {
  brindeId: string;
  brinde: Brinde;
  quantidade: number;
  pesoTotal: number;
}

export type StatusDeclaracao = "gerado" | "informado" | "devolvido" | "cancelado";

export type StatusRastreio = "informado" | "aguardando" | "pendente";

export interface Responsavel extends Authorship { id: string; nome: string; email: string; }

export interface Declaracao extends Authorship {
  id: string;
  numero: string;
  destinatario: Destinatario;
  itens: ItemDeclaracao[];
  data: string;
  local: string;
  status: StatusDeclaracao;
  totalItens: number;
  pesoTotal: number;
  responsavel?: string;
  responsavelId?: string;
  responsavelEmail?: string;
  mensagemRastreio?: string;
  codigoRastreio?: string;
  lembreteRastreioEnviado?: boolean;
  dataLembreteRastreio?: string;
  createdAt?: string;
}

export interface Notificacao {
  id: string;
  declaracaoId: string;
  tipo: string;
  mensagem: string;
  lida: boolean;
  createdAt: string;
}

export interface Configuracoes {
  remetente: {
    nome: string;
    endereco: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    cnpj: string;
  };
  lembretes: {
    ativo: boolean;
    emailDestinatario: string;
    emailAtivo?: boolean;
  };
}

export function calcStatusRastreio(dec: Declaracao): StatusRastreio {
  if (dec.codigoRastreio) return "informado";
  if (!dec.createdAt) return "aguardando";
  const criado = new Date(dec.createdAt).getTime();
  const agora = Date.now();
  const diasPassados = (agora - criado) / (1000 * 60 * 60 * 24);
  return diasPassados >= 2 ? "pendente" : "aguardando";
}
