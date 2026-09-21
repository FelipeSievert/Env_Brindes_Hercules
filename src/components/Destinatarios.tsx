import { useState, useRef, KeyboardEvent } from "react";
import { Search, Plus, Upload, Edit2, Trash2, Eye, X, Save, AlertCircle, Tag, CheckSquare, Square, Tags } from "lucide-react";
import { Destinatario } from "../types";

interface Props {
  destinatarios: Destinatario[];
  onAdd: (d: Omit<Destinatario, "id">) => Promise<void>;
  onEdit: (d: Destinatario) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onImport: (rows: Omit<Destinatario, "id">[]) => Promise<void>;
}

const emptyForm = (): Omit<Destinatario, "id"> => ({
  nome: "",
  cpfCnpj: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  categorias: [],
});

function parseCatRaw(raw: string): string[] {
  return raw
    .split(/[,;|\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function CategoriaBadge({ cat, onRemove }: { cat: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EEF2F7] text-[#1A3A6B] text-[11px] font-['Inter'] font-500 border border-[#C7D4E8]">
      {cat}
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:text-[#D42B1E] transition-colors ml-0.5">
          <X size={10} />
        </button>
      )}
    </span>
  );
}

function CatTagInput({
  value,
  onChange,
  onCommit,
  placeholder,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: (raw: string) => void;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); onCommit(value); }
  }
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (/[,;|\n]/.test(text)) { e.preventDefault(); onCommit(value + text); }
  }
  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onBlur={() => onCommit(value)}
      placeholder={placeholder}
      className="flex-1 min-w-[160px] text-sm font-['Inter'] text-[#1E293B] outline-none bg-transparent placeholder:text-[#CBD5E1]"
    />
  );
}

export default function Destinatarios({ destinatarios, onAdd, onEdit, onDelete, onImport }: Props) {
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Destinatario | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [catInput, setCatInput] = useState("");
  const catInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // View
  const [viewing, setViewing] = useState<Destinatario | null>(null);

  // Bulk category assignment
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCatInput, setBulkCatInput] = useState("");
  const [bulkMode2, setBulkMode2] = useState<"add" | "replace">("add");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [bulkPendingCats, setBulkPendingCats] = useState<string[]>([]);

  // Import
  const [importPreview, setImportPreview] = useState<Omit<Destinatario, "id">[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const allCategorias = Array.from(
    new Set(destinatarios.flatMap((d) => d.categorias ?? []))
  ).sort();

  const filtered = destinatarios.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch =
      d.nome.toLowerCase().includes(q) ||
      (d.cpfCnpj ?? "").includes(q) ||
      (d.cidade ?? "").toLowerCase().includes(q);
    const matchCat = !filterCategoria || (d.categorias ?? []).includes(filterCategoria);
    return matchSearch && matchCat;
  });

  // ── Form helpers ─────────────────────────────────────────────────────────────

  function openNew() {
    setEditing(null);
    setForm(emptyForm());
    setCatInput("");
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(d: Destinatario) {
    setEditing(d);
    setForm({ ...d, categorias: [...(d.categorias ?? [])] });
    setCatInput("");
    setFormError(null);
    setShowForm(true);
  }

  function commitFormCats(raw: string) {
    const novos = parseCatRaw(raw);
    if (!novos.length) return;
    setForm((f) => {
      const ex = f.categorias ?? [];
      return { ...f, categorias: [...ex, ...novos.filter((n) => !ex.includes(n))] };
    });
    setCatInput("");
    catInputRef.current?.focus();
  }

  function removeFormCat(cat: string) {
    setForm((f) => ({ ...f, categorias: (f.categorias ?? []).filter((c) => c !== cat) }));
  }

  function handleFormCatKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !catInput && (form.categorias ?? []).length > 0) {
      setForm((f) => ({ ...f, categorias: (f.categorias ?? []).slice(0, -1) }));
    }
  }

  async function handleSave() {
    if (!form.nome.trim()) { setFormError("O campo Nome é obrigatório."); return; }
    setSaving(true);
    setFormError(null);
    try {
      if (editing) await onEdit({ ...form, id: editing.id });
      else await onAdd(form);
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este destinatário?")) return;
    try { await onDelete(id); }
    catch (e) { alert(e instanceof Error ? e.message : "Erro ao excluir."); }
  }

  // ── Bulk mode ─────────────────────────────────────────────────────────────────

  function toggleBulkMode() {
    setBulkMode((v) => {
      if (v) { setSelectedIds(new Set()); setBulkPendingCats([]); setBulkCatInput(""); setBulkError(null); }
      return !v;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((d) => d.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function commitBulkCats(raw: string) {
    const novos = parseCatRaw(raw);
    if (!novos.length) return;
    setBulkPendingCats((prev) => [...prev, ...novos.filter((n) => !prev.includes(n))]);
    setBulkCatInput("");
    bulkInputRef.current?.focus();
  }

  function removeBulkPendingCat(cat: string) {
    setBulkPendingCats((prev) => prev.filter((c) => c !== cat));
  }

  async function applyBulkCats() {
    if (!selectedIds.size || !bulkPendingCats.length) return;
    setBulkSaving(true);
    setBulkError(null);
    try {
      const targets = destinatarios.filter((d) => selectedIds.has(d.id));
      await Promise.all(
        targets.map((d) => {
          const base = bulkMode2 === "replace" ? [] : (d.categorias ?? []);
          const merged = [...base, ...bulkPendingCats.filter((c) => !base.includes(c))];
          return onEdit({ ...d, categorias: merged });
        })
      );
      setSelectedIds(new Set());
      setBulkPendingCats([]);
      setBulkCatInput("");
      setBulkMode(false);
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Erro ao salvar categorias.");
    } finally {
      setBulkSaving(false);
    }
  }

  // ── CSV Import ────────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) throw new Error("Arquivo sem dados.");
        const headers = lines[0].split(/[,;]/).map((h) => h.trim().toLowerCase());
        const colMap: Record<string, number> = {};
        const aliases: Record<string, string[]> = {
          nome: ["nome", "name", "razao social", "razão social"],
          cpfCnpj: ["cpf", "cnpj", "cpf/cnpj", "cpf_cnpj", "documento"],
          cep: ["cep"],
          endereco: ["endereco", "endereço", "address", "rua", "logradouro"],
          numero: ["numero", "número", "num", "nº"],
          complemento: ["complemento", "comp"],
          bairro: ["bairro", "district"],
          cidade: ["cidade", "city"],
          uf: ["uf", "estado", "state"],
          categorias: ["categorias", "categoria", "category", "tipo"],
        };
        for (const [field, names] of Object.entries(aliases)) {
          for (const name of names) {
            const idx = headers.indexOf(name);
            if (idx !== -1) { colMap[field] = idx; break; }
          }
        }
        if (colMap["nome"] === undefined) throw new Error('Coluna "nome" não encontrada.');
        const rows: Omit<Destinatario, "id">[] = lines.slice(1).map((line) => {
          const cols = line.split(/[,;]/);
          const get = (field: string) => cols[colMap[field] ?? -1]?.trim() ?? "";
          const catRaw = get("categorias");
          const categorias = catRaw ? catRaw.split("|").map((c) => c.trim()).filter(Boolean) : [];
          return {
            nome: get("nome"), cpfCnpj: get("cpfCnpj"), cep: get("cep"),
            endereco: get("endereco"), numero: get("numero"), complemento: get("complemento"),
            bairro: get("bairro"), cidade: get("cidade"), uf: get("uf"), categorias,
          };
        }).filter((r) => r.nome);
        if (rows.length === 0) throw new Error("Nenhum registro válido encontrado.");
        setImportPreview(rows);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Erro ao processar arquivo.");
      }
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  async function confirmImport() {
    if (!importPreview) return;
    setImporting(true);
    try { await onImport(importPreview); setImportPreview(null); }
    catch (e) { setImportError(e instanceof Error ? e.message : "Erro ao importar."); }
    finally { setImporting(false); }
  }

  const Field = ({ label, field, half }: { label: string; field: keyof Omit<Destinatario, "id" | "categorias">; half?: boolean }) => (
    <div className={half ? "col-span-1" : "col-span-2"}>
      <label className="block text-[11px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B] mb-1">{label}</label>
      <input
        value={form[field] as string}
        onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
        className="w-full border border-[#DDE3EC] rounded px-3 py-2 text-sm font-['Inter'] text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30 focus:border-[#1A3A6B]"
      />
    </div>
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((d) => selectedIds.has(d.id));
  const someSelected = selectedIds.size > 0;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-['Outfit'] font-700 text-[#1E293B]">Destinatários</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{destinatarios.length} cadastrados</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleBulkMode}
            className={`flex items-center gap-2 px-4 py-2.5 rounded text-sm font-['Inter'] font-500 border transition-colors ${
              bulkMode
                ? "bg-[#1A3A6B] text-white border-[#1A3A6B]"
                : "bg-white border-[#DDE3EC] text-[#1E293B] hover:bg-[#F1F4F8]"
            }`}
          >
            <Tags size={16} />
            {bulkMode ? "Cancelar seleção" : "Categorias em massa"}
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1A3A6B] text-white rounded text-sm font-['Inter'] font-500 hover:bg-[#15305a] transition-colors"
          >
            <Plus size={16} />
            Novo Destinatário
          </button>
          <label className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#DDE3EC] text-[#1E293B] rounded text-sm font-['Inter'] font-500 hover:bg-[#F1F4F8] transition-colors cursor-pointer">
            <Upload size={16} />
            Importar CSV/Excel
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
          </label>
        </div>
      </div>

      {importError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 font-['Inter']">
          <AlertCircle size={15} />{importError}
        </div>
      )}

      {/* Bulk action panel */}
      {bulkMode && (
        <div className="bg-[#F0F4FA] border border-[#C7D4E8] rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Tags size={16} className="text-[#1A3A6B]" />
            <span className="font-['Outfit'] font-600 text-[#1A3A6B] text-sm">
              Aplicar categorias em massa
            </span>
            <span className="ml-auto text-xs font-['Inter'] text-[#64748B]">
              {selectedIds.size} destinatário{selectedIds.size !== 1 ? "s" : ""} selecionado{selectedIds.size !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Categories to apply */}
          <div>
            <p className="text-[11px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B] mb-1.5">
              Categorias a aplicar
            </p>
            <div
              className="min-h-[40px] flex flex-wrap gap-1.5 items-center bg-white border border-[#DDE3EC] rounded px-3 py-2 focus-within:ring-2 focus-within:ring-[#1A3A6B]/30 focus-within:border-[#1A3A6B] cursor-text"
              onClick={() => bulkInputRef.current?.focus()}
            >
              {bulkPendingCats.map((cat) => (
                <CategoriaBadge key={cat} cat={cat} onRemove={() => removeBulkPendingCat(cat)} />
              ))}
              <CatTagInput
                value={bulkCatInput}
                onChange={setBulkCatInput}
                onCommit={commitBulkCats}
                placeholder={bulkPendingCats.length === 0 ? "Ex: Representante, Cliente VIP, Parceiro..." : ""}
                inputRef={bulkInputRef}
              />
            </div>
            <p className="text-[10px] text-[#94A3B8] font-['Inter'] mt-1">
              Separe por vírgula ou cole uma lista para adicionar várias de uma vez.
            </p>

            {/* Quick-pick from existing */}
            {allCategorias.filter((c) => !bulkPendingCats.includes(c)).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="text-[10px] text-[#94A3B8] font-['Inter'] self-center mr-1">Existentes:</span>
                {allCategorias
                  .filter((c) => !bulkPendingCats.includes(c))
                  .map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBulkPendingCats((prev) => [...prev, c])}
                      className="px-2 py-0.5 rounded-full text-[11px] font-['Inter'] border border-dashed border-[#C7D4E8] text-[#64748B] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
                    >
                      + {c}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B]">Modo:</span>
            {(["add", "replace"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setBulkMode2(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-['Inter'] font-500 border transition-colors ${
                  bulkMode2 === m
                    ? "bg-[#1A3A6B] text-white border-[#1A3A6B]"
                    : "bg-white text-[#64748B] border-[#DDE3EC] hover:border-[#1A3A6B]"
                }`}
              >
                {m === "add" ? "Adicionar às existentes" : "Substituir todas"}
              </button>
            ))}
          </div>

          {bulkError && (
            <p className="text-sm text-red-600 font-['Inter'] flex items-center gap-1.5">
              <AlertCircle size={14} />{bulkError}
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-[#64748B] font-['Inter']">
              Marque os destinatários na tabela abaixo e clique em Aplicar.
            </p>
            <button
              onClick={applyBulkCats}
              disabled={!someSelected || !bulkPendingCats.length || bulkSaving}
              className="flex items-center gap-2 px-5 py-2 bg-[#1A3A6B] text-white rounded text-sm font-['Inter'] font-500 hover:bg-[#15305a] disabled:opacity-40 transition-colors"
            >
              <Save size={14} />
              {bulkSaving
                ? "Salvando..."
                : `Aplicar a ${selectedIds.size} destinatário${selectedIds.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* Search + category filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, CPF, CNPJ ou cidade..."
            className="w-full pl-9 pr-4 py-2.5 border border-[#DDE3EC] rounded text-sm font-['Inter'] text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30 focus:border-[#1A3A6B] bg-white"
          />
        </div>
        <div className="relative">
          <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none" />
          <select
            value={filterCategoria}
            onChange={(e) => setFilterCategoria(e.target.value)}
            className="pl-8 pr-8 py-2.5 border border-[#DDE3EC] rounded text-sm font-['Inter'] text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30 focus:border-[#1A3A6B] bg-white appearance-none min-w-[180px]"
          >
            <option value="">Todas as categorias</option>
            {allCategorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[6px] border border-[#DDE3EC] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#DDE3EC] bg-[#F8FAFC]">
              {bulkMode && (
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleSelectAll} className="text-[#64748B] hover:text-[#1A3A6B] transition-colors">
                    {allFilteredSelected
                      ? <CheckSquare size={16} className="text-[#1A3A6B]" />
                      : <Square size={16} />}
                  </button>
                </th>
              )}
              {["Nome", "Categorias", "CPF/CNPJ", "Endereço", "Cidade", "UF", "CEP", "Ações"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => {
              const isSelected = selectedIds.has(d.id);
              return (
                <tr
                  key={d.id}
                  onClick={bulkMode ? () => toggleSelect(d.id) : undefined}
                  className={`border-b border-[#DDE3EC]/60 transition-colors ${
                    bulkMode ? "cursor-pointer" : ""
                  } ${
                    isSelected
                      ? "bg-[#EEF2F7]"
                      : i % 2 === 0
                      ? "hover:bg-[#FAFBFC]"
                      : "bg-[#F8FAFC]/50 hover:bg-[#F1F4F8]"
                  }`}
                >
                  {bulkMode && (
                    <td className="px-4 py-3.5">
                      {isSelected
                        ? <CheckSquare size={16} className="text-[#1A3A6B]" />
                        : <Square size={16} className="text-[#CBD5E1]" />}
                    </td>
                  )}
                  <td className="px-5 py-3.5 text-sm text-[#1E293B] font-['Inter'] font-500">{d.nome}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {(d.categorias ?? []).length > 0
                        ? (d.categorias ?? []).map((c) => <CategoriaBadge key={c} cat={c} />)
                        : <span className="text-[#CBD5E1] text-xs font-['Inter']">—</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-['JetBrains_Mono',monospace] text-[#64748B]">{d.cpfCnpj}</td>
                  <td className="px-5 py-3.5 text-sm text-[#64748B] font-['Inter']">{d.endereco}, {d.numero}</td>
                  <td className="px-5 py-3.5 text-sm text-[#64748B] font-['Inter']">{d.cidade}</td>
                  <td className="px-5 py-3.5 text-sm font-['JetBrains_Mono',monospace] text-[#64748B]">{d.uf}</td>
                  <td className="px-5 py-3.5 text-sm font-['JetBrains_Mono',monospace] text-[#64748B]">{d.cep}</td>
                  <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setViewing(d)} className="p-1.5 rounded hover:bg-[#EEF2F7] text-[#64748B] hover:text-[#1A3A6B] transition-colors" title="Visualizar"><Eye size={15} /></button>
                      <button onClick={() => openEdit(d)} className="p-1.5 rounded hover:bg-[#EEF2F7] text-[#64748B] hover:text-[#1A3A6B] transition-colors" title="Editar"><Edit2 size={15} /></button>
                      <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-red-50 text-[#64748B] hover:text-[#D42B1E] transition-colors" title="Excluir"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={bulkMode ? 9 : 8} className="px-5 py-10 text-center text-sm text-[#64748B] font-['Inter']">
                  Nenhum destinatário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[6px] border border-[#DDE3EC] w-full max-w-xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDE3EC]">
              <h2 className="font-['Outfit'] font-600 text-[#1E293B]">{editing ? "Editar Destinatário" : "Novo Destinatário"}</h2>
              <button onClick={() => setShowForm(false)} className="text-[#64748B] hover:text-[#1E293B]"><X size={18} /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 overflow-y-auto">
              <Field label="Nome completo / Razão Social" field="nome" />
              <Field label="CPF ou CNPJ" field="cpfCnpj" half />
              <Field label="CEP" field="cep" half />
              <Field label="Endereço" field="endereco" />
              <Field label="Número" field="numero" half />
              <Field label="Complemento" field="complemento" half />
              <Field label="Bairro" field="bairro" />
              <Field label="Cidade" field="cidade" half />
              <Field label="Estado (UF)" field="uf" half />

              <div className="col-span-2">
                <label className="block text-[11px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B] mb-1">Categorias</label>
                <div
                  className="min-h-[40px] flex flex-wrap gap-1.5 items-center border border-[#DDE3EC] rounded px-3 py-2 focus-within:ring-2 focus-within:ring-[#1A3A6B]/30 focus-within:border-[#1A3A6B] cursor-text"
                  onClick={() => catInputRef.current?.focus()}
                >
                  {(form.categorias ?? []).map((cat) => (
                    <CategoriaBadge key={cat} cat={cat} onRemove={() => removeFormCat(cat)} />
                  ))}
                  <input
                    ref={catInputRef}
                    value={catInput}
                    onChange={(e) => setCatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); commitFormCats(catInput); }
                      else handleFormCatKeyDown(e);
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (/[,;|\n]/.test(text)) { e.preventDefault(); commitFormCats(catInput + text); }
                    }}
                    onBlur={() => commitFormCats(catInput)}
                    placeholder={(form.categorias ?? []).length === 0 ? "Ex: Representante, Cliente VIP..." : ""}
                    className="flex-1 min-w-[140px] text-sm font-['Inter'] text-[#1E293B] outline-none bg-transparent placeholder:text-[#CBD5E1]"
                  />
                </div>
                <p className="text-[10px] text-[#94A3B8] font-['Inter'] mt-1">
                  Separe por vírgula para adicionar várias de uma vez. Cole uma lista ou pressione Enter. Backspace remove a última.
                </p>
                {allCategorias.filter((c) => !(form.categorias ?? []).includes(c)).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-[10px] text-[#94A3B8] font-['Inter'] self-center mr-1">Existentes:</span>
                    {allCategorias
                      .filter((c) => !(form.categorias ?? []).includes(c))
                      .map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, categorias: [...(f.categorias ?? []), c] }))}
                          className="px-2 py-0.5 rounded-full text-[11px] font-['Inter'] border border-dashed border-[#C7D4E8] text-[#64748B] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
                        >
                          + {c}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
            {formError && <p className="px-6 pb-2 text-sm text-red-600 font-['Inter']">{formError}</p>}
            <div className="px-6 py-4 border-t border-[#DDE3EC] flex justify-end gap-2 shrink-0">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-['Inter'] font-500 text-[#64748B]">Cancelar</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-[#1A3A6B] text-white rounded text-sm font-['Inter'] font-500 hover:bg-[#15305a] disabled:opacity-50 transition-colors"
              >
                <Save size={15} />
                {saving ? "Salvando..." : "Salvar Destinatário"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[6px] border border-[#DDE3EC] w-full max-w-2xl shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDE3EC]">
              <h2 className="font-['Outfit'] font-600 text-[#1E293B]">Prévia da Importação ({importPreview.length} registros)</h2>
              <button onClick={() => setImportPreview(null)}><X size={18} className="text-[#64748B]" /></button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#DDE3EC]">
                    {["Nome","CPF/CNPJ","Endereço","Cidade","UF","Categorias"].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-[10px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importPreview.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-b border-[#DDE3EC]/50">
                      <td className="px-4 py-2 font-['Inter'] text-[#1E293B]">{r.nome}</td>
                      <td className="px-4 py-2 font-['JetBrains_Mono',monospace] text-[#64748B]">{r.cpfCnpj}</td>
                      <td className="px-4 py-2 text-[#64748B]">{r.endereco}</td>
                      <td className="px-4 py-2 text-[#64748B]">{r.cidade}</td>
                      <td className="px-4 py-2 text-[#64748B]">{r.uf}</td>
                      <td className="px-4 py-2"><div className="flex flex-wrap gap-1">{(r.categorias ?? []).map((c) => <CategoriaBadge key={c} cat={c} />)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importPreview.length > 50 && <p className="px-4 py-2 text-xs text-[#64748B] font-['Inter']">... e mais {importPreview.length - 50} registros</p>}
            </div>
            <div className="px-6 py-4 border-t border-[#DDE3EC] flex justify-end gap-2">
              <button onClick={() => setImportPreview(null)} className="px-4 py-2 text-sm font-['Inter'] text-[#64748B]">Cancelar</button>
              <button
                onClick={confirmImport}
                disabled={importing}
                className="flex items-center gap-2 px-5 py-2 bg-[#1A3A6B] text-white rounded text-sm font-['Inter'] font-500 disabled:opacity-50"
              >
                {importing ? "Importando..." : `Importar ${importPreview.length} registros`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[6px] border border-[#DDE3EC] w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDE3EC]">
              <h2 className="font-['Outfit'] font-600 text-[#1E293B]">Dados do Destinatário</h2>
              <button onClick={() => setViewing(null)}><X size={18} className="text-[#64748B]" /></button>
            </div>
            <div className="p-6 space-y-3">
              {[
                ["Nome", viewing.nome],
                ["CPF/CNPJ", viewing.cpfCnpj],
                ["Endereço", `${viewing.endereco}, ${viewing.numero}${viewing.complemento ? ` – ${viewing.complemento}` : ""}`],
                ["Bairro", viewing.bairro],
                ["Cidade", viewing.cidade],
                ["UF", viewing.uf],
                ["CEP", viewing.cep],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B]">{label}</p>
                  <p className="text-sm text-[#1E293B] font-['Inter'] mt-0.5">{value}</p>
                </div>
              ))}
              <div>
                <p className="text-[10px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B]">Categorias</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(viewing.categorias ?? []).length > 0
                    ? (viewing.categorias ?? []).map((c) => <CategoriaBadge key={c} cat={c} />)
                    : <span className="text-sm text-[#94A3B8] font-['Inter']">Nenhuma</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
