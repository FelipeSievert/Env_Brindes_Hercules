export type Page =
  | "dashboard"
  | "destinatarios"
  | "brindes"
  | "nova-declaracao"
  | "declaracoes"
  | "configuracoes"
  | "usuarios"
  | "declaracao-preview"
  | "importar-word";

export interface Destinatario {
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

export interface Brinde {
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

export interface Declaracao {
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
