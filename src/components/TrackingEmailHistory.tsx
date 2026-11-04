import { useEffect, useState } from "react";
import { fetchTrackingEmails, sendTrackingEmail } from "../lib/db";
export default function TrackingEmailHistory(){
 const [rows,setRows]=useState<Awaited<ReturnType<typeof fetchTrackingEmails>>>([]),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 async function refresh(){try{setRows(await fetchTrackingEmails());}catch(e){setNotice(e instanceof Error?e.message:"Falha ao carregar.");}}
 useEffect(()=>{void refresh();},[]);
 return <section className="bg-white rounded border p-5 space-y-3"><h2 className="font-bold">Histórico de e-mails de rastreio</h2><button onClick={refresh} className="underline text-blue-800">Atualizar histórico</button>{notice&&<p role="status">{notice}</p>}<div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>E-mail</th><th>Rastreio</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t"><td className="py-3">{r.email}</td><td>{r.codigo}</td><td>{r.status}{r.erro&&<p className="text-red-700">{r.erro}</p>}</td><td>{["pendente","erro"].includes(r.status)&&<button disabled={busy} className="underline text-blue-800" onClick={async()=>{setBusy(true);try{setNotice(await sendTrackingEmail(r.id));await refresh();}finally{setBusy(false);}}}>Tentar enviar</button>}{["incerto","enviando"].includes(r.status)&&"Confirme no remetente antes de repetir."}</td></tr>)}{!rows.length&&<tr><td colSpan={4} className="py-4">Nenhum aviso registrado.</td></tr>}</tbody></table></div></section>;
}
