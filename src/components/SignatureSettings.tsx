import { useCallback, useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from "react";
import DeclarationSignature from "./DeclarationSignature";
import { inkBounds } from "../../supabase/functions/send-tracking-email/signature-layout";
import { loadSignature, saveSignature, deleteSignature, type PersonalSignature } from "../lib/signature";

const WIDTH = 600;
const HEIGHT = 180;
const MAX_HISTORY = 30;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
type Frame = { pixels: ImageData; drawn: boolean };

export default function SignatureSettings() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const active = useRef<number | null>(null);
  const history = useRef<Frame[]>([]);
  const importLock = useRef(false);
  const mounted = useRef(true);
  const [historyCount, setHistoryCount] = useState(0);
  const [saved, setSaved] = useState<PersonalSignature | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    mounted.current = true;
    loadSignature().then(value => { if (mounted.current) setSaved(value); })
      .catch(e => { if (mounted.current) setError(e.message); })
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, []);

  function resetEditor() {
    history.current = [];
    active.current = null;
    setHistoryCount(0);
    setPreviewImage(null);
    setDrawn(false);
    setConsent(false);
    setError("");
  }
  function openEditor() {
    resetEditor();
    setNotice("");
    setEditing(true);
  }
  function remember(ctx: CanvasRenderingContext2D) {
    history.current.push({ pixels: ctx.getImageData(0, 0, WIDTH, HEIGHT), drawn });
    if (history.current.length > MAX_HISTORY) history.current.shift();
    setHistoryCount(history.current.length);
  }
  const undo = useCallback(() => {
    if (!editing || loading || importLock.current || active.current !== null) return;
    const ctx = canvas.current?.getContext("2d");
    const frame = history.current.pop();
    if (!ctx || !frame) return;
    ctx.putImageData(frame.pixels, 0, 0);
    setHistoryCount(history.current.length);
    setDrawn(frame.drawn);
    setPreviewImage(frame.drawn ? ctx.canvas.toDataURL("image/png") : null);
    setConsent(false);
    setError("");
  }, [editing, loading]);
  useEffect(() => {
    if (!editing) return;
    function handleKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "z") return;
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest("input:not([type=checkbox]),textarea,select"))) return;
      if (!history.current.length || loading || importLock.current || active.current !== null) return;
      event.preventDefault();
      undo();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [editing, loading, undo]);

  function point(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - rect.left) * WIDTH / rect.width,
      (e.clientY - rect.top) * HEIGHT / rect.height] as const;
  }
  function start(e: PointerEvent<HTMLCanvasElement>) {
    if (loading || importLock.current || active.current !== null || e.button !== 0) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    remember(ctx);
    active.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x,y] = point(e);
    ctx.strokeStyle = "#1f4ea3"; ctx.fillStyle = "#1f4ea3"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.arc(x,y,1.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x,y);
    setDrawn(true); setConsent(false);
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (active.current !== e.pointerId) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const [x,y] = point(e);
    ctx.lineTo(x,y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x,y);
  }
  function end(e: PointerEvent<HTMLCanvasElement>) {
    if (active.current !== e.pointerId) return;
    active.current = null;
    setPreviewImage(e.currentTarget.toDataURL("image/png"));
  }
  function clear() {
    if (loading || importLock.current || active.current !== null || !drawn) return;
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    remember(ctx);
    ctx.clearRect(0,0,WIDTH,HEIGHT);
    setPreviewImage(null);
    setDrawn(false); setConsent(false);
  }
  async function importImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || loading || importLock.current || active.current !== null) return;
    setError(""); setNotice("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > MAX_FILE_SIZE || !file.size) {
      setError("Selecione uma imagem PNG, JPG ou WebP de até 5 MB."); return;
    }
    importLock.current = true; setImporting(true);
    let bitmap: ImageBitmap | undefined;
    try {
      const header = new Uint8Array(await file.slice(0,12).arrayBuffer());
      const png = [137,80,78,71,13,10,26,10].every((v,i)=>header[i]===v);
      const jpeg = header[0]===255 && header[1]===216 && header[2]===255;
      const webp = String.fromCharCode(...header.slice(0,4))==="RIFF" && String.fromCharCode(...header.slice(8,12))==="WEBP";
      if (!(file.type==="image/png" && png || file.type==="image/jpeg" && jpeg || file.type==="image/webp" && webp)) throw new Error("O conteúdo do arquivo não corresponde ao formato da imagem.");
      bitmap = await createImageBitmap(file);
      if (!bitmap.width || !bitmap.height || bitmap.width>4096 || bitmap.height>4096) throw new Error("A imagem deve ter até 4096 × 4096 pixels.");
      const work = document.createElement("canvas");
      work.width = WIDTH; work.height = HEIGHT;
      const ctx = work.getContext("2d");
      if (!ctx) throw new Error("Não foi possível preparar a imagem.");
      // Crop before downsampling, so small ink on a large scanned page is not lost.
      const source=document.createElement("canvas");
      source.width=bitmap.width; source.height=bitmap.height;
      const sourceCtx=source.getContext("2d");
      if(!sourceCtx) throw new Error("Não foi possível analisar a imagem.");
      sourceCtx.drawImage(bitmap,0,0);
      const bounds=inkBounds(sourceCtx.getImageData(0,0,source.width,source.height).data,source.width,source.height);
      const scale=Math.min((WIDTH-12)/bounds.width,(HEIGHT-12)/bounds.height);
      const w=bounds.width*scale,h=bounds.height*scale;
      ctx.drawImage(source,bounds.x,bounds.y,bounds.width,bounds.height,(WIDTH-w)/2,(HEIGHT-h)/2,w,h);
      const pixels = ctx.getImageData(0,0,WIDTH,HEIGHT);
      let ink = false;
      for(let i=0;i<pixels.data.length;i+=4) {
        const [r,g,b,a] = [pixels.data[i],pixels.data[i+1],pixels.data[i+2],pixels.data[i+3]];
        if (a>16 && Math.min(r,g,b)<235) { ink=true; break; }
      }
      if (!ink) throw new Error("A imagem parece vazia. Selecione uma imagem com sua assinatura visível.");
      if (work.toDataURL("image/png").length>400000) throw new Error("A imagem normalizada ficou muito detalhada. Use uma imagem recortada da assinatura, com fundo simples.");
      if (!mounted.current || !canvas.current) return;
      const target = canvas.current.getContext("2d");
      if (!target) throw new Error("Não foi possível inserir a imagem.");
      remember(target);
      target.putImageData(pixels,0,0);
      setPreviewImage(target.canvas.toDataURL("image/png"));
      setDrawn(true); setConsent(false);
      setNotice("Imagem importada. Revise a assinatura antes de salvar.");
    } catch(e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Não foi possível importar a imagem.");
    } finally {
      bitmap?.close(); importLock.current = false;
      if (mounted.current) setImporting(false);
    }
  }
  async function save() {
    if (!drawn || !consent || !canvas.current || loading || importLock.current || active.current !== null) return;
    const image=canvas.current.toDataURL("image/png");
    if (image.length>400000) { setError("A imagem excede o limite permitido. Desfaça a alteração ou importe uma imagem mais simples."); return; }
    setLoading(true); setError(""); setNotice("");
    try {
      await saveSignature(image);
      setSaved(await loadSignature()); setEditing(false); resetEditor();
      setNotice("Assinatura cadastrada.");
    } catch(e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setLoading(false); }
  }
  async function remove() {
    if (loading || !window.confirm("Excluir a assinatura cadastrada? Declarações já assinadas permanecerão intactas.")) return;
    setLoading(true); setError(""); setNotice("");
    try { await deleteSignature(); setSaved(null); setEditing(false); resetEditor(); setNotice("Assinatura excluída."); }
    catch(e) { setError(e instanceof Error ? e.message : "Não foi possível excluir."); }
    finally { setLoading(false); }
  }
  const button = "px-4 py-2 border border-[#DDE3EC] rounded text-sm disabled:opacity-50";
  const busy = loading || importing;
  return <section className="bg-white border border-[#DDE3EC] rounded-md p-6 space-y-4">
    <h3 className="font-semibold">Minha assinatura</h3>
    <p className="text-sm text-[#64748B]">Cadastre uma assinatura própria para utilizar nas novas declarações mediante confirmação. Documentos assinados ficam disponíveis aos usuários autorizados e podem ser enviados como PDF por e-mail.</p>
    {saved && !editing && <><img src={saved.image} alt="Minha assinatura cadastrada" className="border rounded max-w-full w-72" /><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy} onClick={openEditor}>Alterar assinatura</button><button type="button" className={button+" text-red-700"} disabled={busy} onClick={remove}>Excluir assinatura</button></div></>}
    {!saved && !editing && <button type="button" className={button} disabled={busy} onClick={openEditor}>Cadastrar assinatura</button>}
    {editing && <div className="space-y-3">
      <p className="text-sm text-[#64748B]">Desenhe sua assinatura ou importe uma imagem já recortada. Use Ctrl+Z (Cmd+Z no Mac) para desfazer.</p>
      <canvas ref={canvas} width={WIDTH} height={HEIGHT} tabIndex={0} aria-label="Área para desenhar sua assinatura" className="w-full max-w-[600px] border border-dashed rounded bg-white touch-none cursor-crosshair" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={busy||!historyCount} onClick={undo} title="Ctrl+Z / Cmd+Z">Desfazer (Ctrl+Z)</button>
        <button type="button" className={button} disabled={busy||!drawn} onClick={clear}>Limpar</button>
        <button type="button" className={button} disabled={busy} onClick={()=>{if(active.current===null)fileInput.current?.click();}}>{importing?"Importando…":"Importar assinatura"}</button>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={importImage} className="hidden" aria-label="Importar imagem da assinatura" disabled={busy} />
      </div>
      {previewImage && <div className="rounded border border-[#DDE3EC] p-3 bg-white space-y-2">
        <p className="text-xs font-semibold text-[#64748B]">Prévia automática na declaração</p>
        <div style={{width:"72mm",maxWidth:"100%"}}>
          <DeclarationSignature image={previewImage}/>
          <div style={{borderTop:"1px solid #000",fontSize:"8pt",textAlign:"center",paddingTop:3}}>Assinatura do Declarante/Remetente</div>
        </div>
      </div>}
      <p className="text-xs text-[#64748B]">PNG, JPG ou WebP · até 5 MB · preferencialmente com fundo transparente ou branco.</p>
      <label className="flex gap-2 text-sm items-start"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)} /> Confirmo que esta assinatura é minha e autorizo guardá-la para uso nas declarações que eu confirmar. Posso excluir o cadastro posteriormente.</label>
      <div className="flex flex-wrap gap-2"><button type="button" className="bg-[#1A3A6B] text-white px-4 py-2 rounded text-sm disabled:opacity-50" disabled={busy||!drawn||!consent} onClick={save}>Salvar assinatura</button><button type="button" className={button} disabled={busy} onClick={()=>{setEditing(false);resetEditor();setNotice("");}}>Cancelar</button></div>
    </div>}
    {loading && <p role="status" className="text-sm">Carregando…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
  </section>;
}
