import { useEffect, useRef, useState, type PointerEvent } from "react";
import { loadSignature, saveSignature, deleteSignature, type PersonalSignature } from "../lib/signature";

export default function SignatureSettings() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const active = useRef<number | null>(null);
  const [saved, setSaved] = useState<PersonalSignature | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let mounted = true;
    loadSignature().then(value => { if (mounted) setSaved(value); })
      .catch(e => { if (mounted) setError(e.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  function point(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - rect.left) * e.currentTarget.width / rect.width,
      (e.clientY - rect.top) * e.currentTarget.height / rect.height] as const;
  }
  function start(e: PointerEvent<HTMLCanvasElement>) {
    if (loading || active.current !== null || e.button !== 0) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    active.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x,y] = point(e);
    ctx.strokeStyle = "#152943"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(x,y);
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (active.current !== e.pointerId) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const [x,y] = point(e);
    ctx.lineTo(x,y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x,y); setDrawn(true);
  }
  function end(e: PointerEvent<HTMLCanvasElement>) { if (active.current === e.pointerId) active.current = null; }
  function clear() {
    canvas.current?.getContext("2d")?.clearRect(0,0,600,180);
    active.current = null; setDrawn(false);
  }
  async function save() {
    if (!drawn || !consent || !canvas.current || loading) return;
    setLoading(true); setError(""); setNotice("");
    try {
      await saveSignature(canvas.current.toDataURL("image/png"));
      setSaved(await loadSignature()); setEditing(false); setConsent(false); setDrawn(false);
      setNotice("Assinatura cadastrada.");
    } catch(e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setLoading(false); }
  }
  async function remove() {
    if (loading || !window.confirm("Excluir a assinatura cadastrada? Declarações já assinadas permanecerão intactas.")) return;
    setLoading(true); setError(""); setNotice("");
    try { await deleteSignature(); setSaved(null); setEditing(false); setConsent(false); setDrawn(false); setNotice("Assinatura excluída."); }
    catch(e) { setError(e instanceof Error ? e.message : "Não foi possível excluir."); }
    finally { setLoading(false); }
  }
  const button = "px-4 py-2 border border-[#DDE3EC] rounded text-sm disabled:opacity-50";
  return <section className="bg-white border border-[#DDE3EC] rounded-md p-6 space-y-4">
    <h3 className="font-semibold">Minha assinatura</h3>
    <p className="text-sm text-[#64748B]">Cadastre uma assinatura própria para utilizar nas novas declarações mediante confirmação. Documentos assinados ficam disponíveis aos usuários autorizados e podem ser enviados como PDF por e-mail.</p>
    {saved && !editing && <><img src={saved.image} alt="Minha assinatura cadastrada" className="border rounded max-w-full w-72" /><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={loading} onClick={()=>{setEditing(true);setConsent(false);setDrawn(false);}}>Alterar assinatura</button><button type="button" className={button+" text-red-700"} disabled={loading} onClick={remove}>Excluir assinatura</button></div></>}
    {!saved && !editing && <button type="button" className={button} disabled={loading} onClick={()=>{setEditing(true);setConsent(false);setDrawn(false);}}>Cadastrar assinatura</button>}
    {editing && <div className="space-y-3"><canvas ref={canvas} width={600} height={180} aria-label="Área para desenhar sua assinatura" className="w-full max-w-[600px] border border-dashed rounded bg-white touch-none cursor-crosshair" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} />
      <button type="button" className={button} disabled={loading} onClick={clear}>Limpar</button>
      <label className="flex gap-2 text-sm items-start"><input type="checkbox" checked={consent} disabled={loading} onChange={e=>setConsent(e.target.checked)} /> Autorizo guardar minha assinatura para uso nas declarações que eu confirmar. Posso excluir o cadastro posteriormente.</label>
      <div className="flex flex-wrap gap-2"><button type="button" className="bg-[#1A3A6B] text-white px-4 py-2 rounded text-sm disabled:opacity-50" disabled={loading||!drawn||!consent} onClick={save}>Salvar assinatura</button><button type="button" className={button} disabled={loading} onClick={()=>{setEditing(false);setDrawn(false);setConsent(false);}}>Cancelar</button></div>
    </div>}
    {loading && <p role="status" className="text-sm">Carregando…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
  </section>;
}
