import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Info,
  Loader2,
  Trash2,
  Save,
} from "lucide-react";
import { Destinatario } from "../types";
import * as db from "../lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtractedDestinatario {
  nome: string;
  cpfCnpj: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

type RowStatus = "pendente" | "novo" | "existente" | "atualizar" | "erro";

interface FileRow {
  id: string;
  fileName: string;
  status: RowStatus;
  errorMsg?: string;
  extracted?: ExtractedDestinatario;
  existingId?: string;
  edited: ExtractedDestinatario;
}

// ── Docx XML parsing ─────────────────────────────────────────────────────────

const DEBUG = false;
function dbg(...args: unknown[]) {
  if (DEBUG) console.log("[ImportarDocx]", ...args);
}

/** Remove acentos, maiúsculas, colapsa espaços */
function normalize(text: string): string {
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Versão sem NENHUM espaço, usada para comparar títulos/rótulos.
 * "D E S T I N A T Á R I O" → "DESTINATARIO"
 */
function normalizeNoSpace(text: string): string {
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

/** Acesso robusto a elementos por nome local, ignorando o prefixo "w:". */
function byTag(root: Element | Document, local: string): Element[] {
  const ns = (root as Element).getElementsByTagNameNS
    ? Array.from((root as Element).getElementsByTagNameNS("*", local))
    : [];
  if (ns.length) return ns;
  const qualified = Array.from(root.getElementsByTagName("w:" + local));
  if (qualified.length) return qualified;
  return Array.from(root.getElementsByTagName(local));
}

/**
 * Texto de uma célula/nó preservando a estrutura de parágrafos:
 * cada <w:p> vira uma linha, <w:tab> vira espaço, <w:br> vira quebra.
 */
function nodeText(el: Element): string {
  const paras = byTag(el, "p");
  if (paras.length === 0) {
    return byTag(el, "t")
      .map((t) => t.textContent ?? "")
      .join("")
      .trim();
  }
  return paras
    .map((p) => {
      let line = "";
      // percorre em ordem os nós de texto, tabs e quebras
      const nodes = p.querySelectorAll("*");
      const relevant = Array.from(nodes).filter((n) => {
        const name = n.localName || n.nodeName.replace(/^w:/, "");
        return name === "t" || name === "tab" || name === "br";
      });
      for (const n of relevant) {
        const name = n.localName || n.nodeName.replace(/^w:/, "");
        if (name === "t") line += n.textContent ?? "";
        else if (name === "tab") line += " ";
        else if (name === "br") line += "\n";
      }
      return line.trim();
    })
    .filter((l) => l.length > 0)
    .join("\n");
}

/** Lê todas as linhas de uma tabela: matriz de strings por célula */
function tableRows(tbl: Element): string[][] {
  return byTag(tbl, "tr").map((tr) => byTag(tr, "tc").map((tc) => nodeText(tc)));
}

/**
 * Procura um rótulo no bloco de texto e retorna o valor correspondente,
 * tolerante a letras separadas por espaços ("N O M E") e a valores em
 * linha separada do rótulo.
 */
function fieldAfterLabel(cellText: string, labelNoSpace: string): string {
  const lines = cellText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const key = normalizeNoSpace(raw);
    if (!key.startsWith(labelNoSpace)) continue;

    // valor na mesma linha, após ":"
    const colon = raw.indexOf(":");
    if (colon >= 0) {
      const val = raw.slice(colon + 1).trim();
      if (val) return val;
    }
    // valor na próxima linha não vazia
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].trim();
      if (!next) continue;
      // se a próxima linha for outro rótulo, o valor está vazio
      if (/:/.test(next) && normalizeNoSpace(next).length < 14) break;
      return next;
    }
  }
  return "";
}

/** Extrai campos do texto do bloco do destinatário */
function extractFieldsFromText(text: string): ExtractedDestinatario | null {
  const block = text.replace(/\t/g, " ");

  const nome = fieldAfterLabel(block, "NOME");
  if (!nome) return null;

  const cpfCnpj = fieldAfterLabel(block, "CPF/CNPJ") || fieldAfterLabel(block, "CPFCNPJ");
  const cep = fieldAfterLabel(block, "CEP");
  const uf = fieldAfterLabel(block, "UF").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2);
  const cidade = fieldAfterLabel(block, "CIDADE");
  const fullEndereco = fieldAfterLabel(block, "ENDERECO");

  const { endereco, numero, complemento, bairro } = parseAddressParts(fullEndereco);

  return { nome, cpfCnpj, endereco, numero, complemento, bairro, cidade, uf, cep };
}

function parseAddressParts(fullAddress: string): {
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
} {
  const numMatch = fullAddress.match(/,\s*[Nn]?[°º]?\s*(\d+[A-Za-z]?)\s*(?:[-–]|$)/);
  const numero = numMatch ? numMatch[1] : "";
  const afterNum = numMatch
    ? fullAddress.slice(fullAddress.indexOf(numMatch[0]) + numMatch[0].length).trim()
    : "";
  const dashIdx = afterNum.search(/[-–]/);
  const complemento = dashIdx >= 0 ? afterNum.slice(0, dashIdx).trim() : "";
  const bairro = dashIdx >= 0 ? afterNum.slice(dashIdx + 1).trim() : afterNum.trim();
  const enderecoBase = numMatch
    ? fullAddress.slice(0, fullAddress.indexOf(numMatch[0])).trim().replace(/,$/, "").trim()
    : fullAddress;
  return { endereco: enderecoBase || fullAddress, numero, complemento, bairro };
}

/** Um destinatário é aceitável com Nome + (Cidade ou CEP). CPF/CNPJ e endereço são opcionais. */
function isValidExtract(e: ExtractedDestinatario | null): e is ExtractedDestinatario {
  return !!e && !!e.nome && (!!e.cidade || !!e.cep);
}

/** Célula contém um bloco de cadastro (tem NOME + ao menos um campo de endereço) */
function looksLikeBlock(cellText: string): boolean {
  const n = normalizeNoSpace(cellText);
  return n.includes("NOME") && (n.includes("CEP") || n.includes("ENDERECO") || n.includes("CIDADE"));
}

/**
 * No modelo dos Correios, remetente e destinatário ficam lado a lado na
 * MESMA linha, separados por uma célula vazia (espaçadora). Retorna as
 * células à DIREITA dessa espaçadora — o lado do destinatário.
 * Ex.: ["CIDADE: TIMBÓ", "UF: SC", "", "CIDADE: BELÉM", "UF: PA"] → as 2 últimas.
 */
function rightSideCells(cells: string[]): string[] {
  let divider = -1;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].trim() !== "") continue;
    const hasLeft = cells.slice(0, i).some((c) => c.trim() !== "");
    const hasRight = cells.slice(i + 1).some((c) => c.trim() !== "");
    if (hasLeft && hasRight) divider = i; // usa a espaçadora mais à direita
  }
  return divider >= 0 ? cells.slice(divider + 1) : [];
}

type ExtractOutcome =
  | { ok: true; data: ExtractedDestinatario }
  | { ok: false; reason: string };

/**
 * Cadeia de estratégias para extrair o DESTINATÁRIO de uma Declaração de
 * Conteúdo em .docx. Mantém a lógica de tabela (que já processa o modelo
 * padrão) e adiciona fallbacks para variações da mesma estrutura.
 */
async function extrairDestinatarioDoDocx(arrayBuffer: ArrayBuffer): Promise<ExtractOutcome> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) return { ok: false, reason: "Arquivo Word inválido ou sem conteúdo (document.xml)." };

  const parser = new DOMParser();
  const doc = parser.parseFromString(docXml, "application/xml");

  const tables = byTag(doc, "tbl");
  dbg("Tabelas encontradas:", tables.length);

  const hasRem = (s: string) => normalizeNoSpace(s).includes("REMETENTE");
  const hasDst = (s: string) => normalizeNoSpace(s).includes("DESTINATARIO");

  let sawFields = false; // encontrou campos de cadastro em algum lugar
  let partial: ExtractedDestinatario | null = null; // melhor tentativa com nome mas incompleta

  const consider = (e: ExtractedDestinatario | null): ExtractedDestinatario | null => {
    if (e && e.nome && !partial) partial = e;
    return isValidExtract(e) ? e : null;
  };

  const isSectionEnd = (row: string[]) => {
    const n = normalizeNoSpace(row.join(" "));
    return (
      n.includes("IDENTIFICACAO") ||
      n.includes("DISCRIMINACAO") ||
      n.includes("DECLARACAO") ||
      n.includes("DECLARO")
    );
  };

  // ── Estratégia 1: modelo Correios — remetente | espaçadora | destinatário ──
  // Localiza a linha de cabeçalho (R E M E T E N T E … D E S T I N A T Á R I O)
  // e, nas linhas seguintes, coleta apenas as células à direita da espaçadora.
  for (const tbl of tables) {
    const rows = tableRows(tbl);
    dbg("Linhas na tabela:", rows.length);

    const headerIdx = rows.findIndex((r) => r.some(hasRem) && r.some(hasDst));
    if (headerIdx === -1) continue;
    sawFields = true;
    dbg("Cabeçalho REMETENTE/DESTINATÁRIO na linha:", headerIdx);

    const destLines: string[] = [];
    for (let ri = headerIdx + 1; ri < rows.length; ri++) {
      if (isSectionEnd(rows[ri])) break;
      for (const cell of rightSideCells(rows[ri])) {
        if (cell.trim()) destLines.push(cell.trim());
      }
    }
    dbg("Linhas do destinatário:", destLines);

    const result = consider(extractFieldsFromText(destLines.join("\n")));
    if (result) {
      dbg("Dados extraídos (estrutura Correios):", result);
      return { ok: true, data: result };
    }
  }

  // ── Estratégia 2: célula única contendo todo o bloco do destinatário ───────
  for (const tbl of tables) {
    for (const row of tableRows(tbl)) {
      for (const cell of row) {
        if (looksLikeBlock(cell) && hasDst(cell) && !hasRem(cell)) {
          const result = consider(extractFieldsFromText(cell));
          if (result) {
            dbg("Dados extraídos (célula única):", result);
            return { ok: true, data: result };
          }
        }
      }
    }
  }

  // ── Estratégia 3: dois blocos completos lado a lado (direita = destinatário)
  for (const tbl of tables) {
    for (const row of tableRows(tbl)) {
      const blockCells = row.filter(looksLikeBlock);
      if (blockCells.length >= 2) {
        sawFields = true;
        const result = consider(extractFieldsFromText(blockCells[blockCells.length - 1]));
        if (result) {
          dbg("Dados extraídos (blocos lado a lado):", result);
          return { ok: true, data: result };
        }
      }
    }
  }

  // ── Estratégia 4: texto linear — só quando NÃO há remetente para confundir ─
  const rawLines = byTag(doc, "p")
    .map((p) => nodeText(p))
    .filter((l) => l.length > 0);
  const docHasRem = rawLines.some(hasRem);

  const dstLineIdx = rawLines.findIndex((l) => hasDst(l) && !hasRem(l));
  if (dstLineIdx >= 0 && !docHasRem) {
    dbg("DESTINATÁRIO encontrado (fallback linear): SIM na linha", dstLineIdx);
    const stopIdx = rawLines.findIndex(
      (l, i) =>
        i > dstLineIdx &&
        (normalizeNoSpace(l).includes("DECLARO") ||
          normalizeNoSpace(l).includes("DISCRIMINACAO") ||
          normalizeNoSpace(l).includes("CONTEUDO"))
    );
    const section = rawLines
      .slice(dstLineIdx, stopIdx === -1 ? undefined : stopIdx)
      .join("\n");
    const result = consider(extractFieldsFromText(section));
    if (result) {
      dbg("Dados extraídos (fallback linear):", result);
      return { ok: true, data: result };
    }
  }

  // ── Falha: montar mensagem específica ─────────────────────────────────────
  if (partial) {
    dbg("Falha: nome encontrado mas sem cidade/CEP", partial);
    return {
      ok: false,
      reason: "Dados insuficientes: encontramos o nome, mas não foi possível extrair cidade ou CEP do destinatário.",
    };
  }
  if (sawFields) {
    return {
      ok: false,
      reason: "Foram encontrados campos, mas não foi possível separar remetente e destinatário.",
    };
  }
  if (tables.length === 0) {
    return { ok: false, reason: "Não foi encontrada uma estrutura de tabela compatível no documento." };
  }
  return { ok: false, reason: "Seção DESTINATÁRIO não encontrada no documento." };
}

// ── Duplicate check ───────────────────────────────────────────────────────────

function findDuplicate(
  ext: ExtractedDestinatario,
  existing: Destinatario[]
): Destinatario | undefined {
  if (ext.cpfCnpj) {
    const found = existing.find(
      (d) => d.cpfCnpj && d.cpfCnpj.replace(/\D/g, "") === ext.cpfCnpj.replace(/\D/g, "")
    );
    if (found) return found;
  }
  if (ext.cep) {
    const found = existing.find(
      (d) =>
        d.nome.toUpperCase() === ext.nome.toUpperCase() &&
        d.cep.replace(/\D/g, "") === ext.cep.replace(/\D/g, "")
    );
    if (found) return found;
  }
  return existing.find(
    (d) =>
      d.nome.toUpperCase() === ext.nome.toUpperCase() &&
      d.endereco.toUpperCase() === ext.endereco.toUpperCase() &&
      d.cidade.toUpperCase() === ext.cidade.toUpperCase()
  );
}

function hasDiff(ext: ExtractedDestinatario, existing: Destinatario): boolean {
  return (
    ext.cidade.toUpperCase() !== existing.cidade.toUpperCase() ||
    ext.uf.toUpperCase() !== existing.uf.toUpperCase() ||
    ext.cep.replace(/\D/g, "") !== existing.cep.replace(/\D/g, "") ||
    ext.endereco.toUpperCase() !== existing.endereco.toUpperCase()
  );
}

function emptyExtracted(): ExtractedDestinatario {
  return { nome: "", cpfCnpj: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", cep: "" };
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RowStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: "Aguardando", color: "bg-[#F1F4F8] text-[#64748B]", icon: <Loader2 size={13} className="animate-spin" /> },
  novo: { label: "Novo destinatário", color: "bg-green-50 text-green-700", icon: <CheckCircle size={13} /> },
  existente: { label: "Já existe", color: "bg-blue-50 text-blue-700", icon: <Info size={13} /> },
  atualizar: { label: "Possível atualização", color: "bg-yellow-50 text-yellow-700", icon: <Info size={13} /> },
  erro: { label: "Erro na leitura", color: "bg-red-50 text-red-700", icon: <AlertCircle size={13} /> },
};

function StatusBadge({ status }: { status: RowStatus }) {
  const { label, color, icon } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-['Inter'] font-500 ${color}`}>
      {icon}{label}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  destinatarios: Destinatario[];
  onImported: (updated: Destinatario[]) => void;
}

export default function ImportarDeclaracoesWord({ destinatarios, onImported }: Props) {
  const [rows, setRows] = useState<FileRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── File processing ──────────────────────────────────────────────────────

  async function processFiles(files: File[]) {
    const docxFiles = files.filter((f) => f.name.toLowerCase().endsWith(".docx"));
    if (!docxFiles.length) return;

    setProcessing(true);
    setSaved(false);

    const newRows: FileRow[] = docxFiles.map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      fileName: f.name,
      status: "pendente",
      edited: emptyExtracted(),
    }));
    setRows((prev) => [...prev, ...newRows]);

    for (let i = 0; i < docxFiles.length; i++) {
      const file = docxFiles[i];
      const rowId = newRows[i].id;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const outcome = await extrairDestinatarioDoDocx(arrayBuffer);

        if (!outcome.ok) {
          setRows((prev) =>
            prev.map((r) =>
              r.id === rowId
                ? { ...r, status: "erro", errorMsg: outcome.reason, edited: emptyExtracted() }
                : r
            )
          );
          continue;
        }

        const extracted = outcome.data;
        const dup = findDuplicate(extracted, destinatarios);
        let status: RowStatus = "novo";
        let existingId: string | undefined;
        if (dup) {
          existingId = dup.id;
          status = hasDiff(extracted, dup) ? "atualizar" : "existente";
        }

        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? { ...r, status, extracted, edited: { ...extracted }, existingId }
              : r
          )
        );
      } catch (e) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? { ...r, status: "erro", errorMsg: "Não foi possível ler o arquivo Word.", edited: emptyExtracted() }
              : r
          )
        );
      }
    }

    setProcessing(false);
  }

  // ── Drag and drop ────────────────────────────────────────────────────────

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [destinatarios, rows]
  );

  // ── Edit field ───────────────────────────────────────────────────────────

  function editRow(id: string, field: keyof ExtractedDestinatario, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, edited: { ...r.edited, [field]: value } } : r))
    );
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  // ── Save to Supabase ─────────────────────────────────────────────────────

  async function handleSave() {
    const saveable = rows.filter((r) => r.status === "novo" || r.status === "atualizar");
    if (!saveable.length) return;

    setSaving(true);
    try {
      const toUpsert = saveable.map((r) => ({
        ...(r.existingId ? { id: r.existingId } : {}),
        nome: r.edited.nome,
        cpfCnpj: r.edited.cpfCnpj,
        endereco: r.edited.endereco,
        numero: r.edited.numero,
        complemento: r.edited.complemento,
        bairro: r.edited.bairro,
        cidade: r.edited.cidade,
        uf: r.edited.uf,
        cep: r.edited.cep,
        categorias: [] as string[],
      }));

      await db.upsertDestinatarios(toUpsert);
      const updated = await db.fetchDestinatarios();
      onImported(updated);

      setRows((prev) =>
        prev.map((r) =>
          r.status === "novo" || r.status === "atualizar" ? { ...r, status: "existente" } : r
        )
      );
      setSaved(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao salvar no banco.");
    } finally {
      setSaving(false);
    }
  }

  // ── Summary counts ───────────────────────────────────────────────────────

  const counts = {
    total: rows.length,
    novos: rows.filter((r) => r.status === "novo").length,
    existentes: rows.filter((r) => r.status === "existente").length,
    atualizar: rows.filter((r) => r.status === "atualizar").length,
    erros: rows.filter((r) => r.status === "erro").length,
  };

  const saveable = counts.novos + counts.atualizar;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-[#DDE3EC] pb-5">
        <h1 className="font-['Outfit'] font-700 text-2xl text-[#1E293B]">
          Importar Declarações Word
        </h1>
        <p className="text-sm font-['Inter'] text-[#64748B] mt-1">
          Importe arquivos Word de Declarações de Conteúdo e cadastre automaticamente os destinatários encontrados.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-[#1A3A6B] bg-[#EEF2F7]"
            : "border-[#CBD5E1] bg-white hover:border-[#1A3A6B] hover:bg-[#F8FAFC]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".docx"
          className="hidden"
          onChange={(e) => processFiles(Array.from(e.target.files ?? []))}
        />
        <Upload size={36} className="mx-auto text-[#94A3B8] mb-3" />
        <p className="font-['Outfit'] font-600 text-[#1E293B] text-lg">
          Arraste arquivos Word aqui
        </p>
        <p className="text-sm text-[#64748B] font-['Inter'] mt-1">ou</p>
        <button
          type="button"
          className="mt-3 px-5 py-2 bg-[#1A3A6B] text-white rounded text-sm font-['Inter'] font-500 hover:bg-[#15305a] transition-colors"
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        >
          Selecionar arquivos
        </button>
        <p className="text-xs text-[#94A3B8] font-['Inter'] mt-3">Apenas arquivos .docx</p>
      </div>

      {/* Processing indicator */}
      {processing && (
        <div className="flex items-center gap-2 text-sm text-[#64748B] font-['Inter']">
          <Loader2 size={16} className="animate-spin text-[#1A3A6B]" />
          Processando arquivos…
        </div>
      )}

      {/* Summary */}
      {rows.length > 0 && !processing && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Processados", value: counts.total, color: "text-[#1E293B]" },
            { label: "Novos destinatários", value: counts.novos, color: "text-green-700" },
            { label: "Já existentes", value: counts.existentes + counts.atualizar, color: "text-blue-700" },
            { label: "Com problemas", value: counts.erros, color: "text-red-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-[#DDE3EC] rounded p-4 text-center">
              <p className={`font-['Outfit'] font-700 text-2xl ${s.color}`}>{s.value}</p>
              <p className="text-xs text-[#64748B] font-['Inter'] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Success banner */}
      {saved && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800 font-['Inter']">
          <CheckCircle size={16} />
          Destinatários salvos com sucesso no banco de dados.
        </div>
      )}

      {/* Results table */}
      {rows.length > 0 && (
        <div className="bg-white border border-[#DDE3EC] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-['Inter']">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F8FAFC]">
                  {["Arquivo", "Nome", "CPF/CNPJ", "Endereço", "Cidade", "UF", "CEP", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-600 uppercase tracking-[0.08em] text-[#64748B] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} className={`border-b border-[#DDE3EC]/60 ${i % 2 === 0 ? "" : "bg-[#F8FAFC]/40"}`}>
                    {/* Arquivo */}
                    <td className="px-4 py-3 text-[#64748B] text-xs whitespace-nowrap max-w-[140px] truncate">
                      <div className="flex items-center gap-1.5">
                        <FileText size={13} className="shrink-0 text-[#94A3B8]" />
                        <span title={row.fileName}>{row.fileName}</span>
                      </div>
                      {row.errorMsg && (
                        <p className="text-red-600 text-[10px] mt-0.5">{row.errorMsg}</p>
                      )}
                    </td>

                    {row.status === "erro" ? (
                      <td colSpan={6} className="px-4 py-3 text-[#94A3B8] text-xs italic">
                        Não foi possível extrair dados.
                      </td>
                    ) : (
                      <>
                        {(["nome", "cpfCnpj", "endereco", "cidade", "uf", "cep"] as (keyof ExtractedDestinatario)[]).map((f) => (
                          <td key={f} className="px-2 py-2">
                            <input
                              type="text"
                              value={row.edited[f]}
                              onChange={(e) => editRow(row.id, f, e.target.value)}
                              disabled={row.status === "existente"}
                              className="w-full min-w-[80px] border border-transparent rounded px-2 py-1 text-xs text-[#1E293B] bg-transparent focus:outline-none focus:border-[#1A3A6B] focus:bg-white disabled:text-[#94A3B8] transition-colors"
                            />
                          </td>
                        ))}
                      </>
                    )}

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={row.status} />
                    </td>

                    {/* Remove */}
                    <td className="px-3 py-3">
                      <button
                        onClick={() => removeRow(row.id)}
                        className="p-1 rounded hover:bg-red-50 text-[#94A3B8] hover:text-[#D42B1E] transition-colors"
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Save button */}
          {saveable > 0 && (
            <div className="px-5 py-4 border-t border-[#DDE3EC] flex items-center justify-between">
              <p className="text-sm text-[#64748B] font-['Inter']">
                {saveable} destinatário{saveable > 1 ? "s" : ""} pronto{saveable > 1 ? "s" : ""} para salvar.
              </p>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1A3A6B] text-white rounded text-sm font-['Inter'] font-500 hover:bg-[#15305a] disabled:opacity-60 transition-colors"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Salvar destinatários no banco
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
