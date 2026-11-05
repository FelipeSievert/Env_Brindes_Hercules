import { useState } from "react";
import type { Configuracoes as ConfigType } from "../types";
import CompanySettings from "./CompanySettings";
import PersonalSettings from "./PersonalSettings";
export default function Configuracoes({ config, onSave }: { config: ConfigType; onSave: (value: ConfigType)=>Promise<void> }) {
  const [area,setArea]=useState<"empresa"|"pessoal">("empresa");
  return <div className="p-4 md:p-8 space-y-6 max-w-3xl">
    <div><h1 className="text-2xl font-semibold text-[#1E293B]">Configurações</h1><p className="text-sm text-[#64748B] mt-1">Dados da empresa e da sua conta.</p></div>
    <nav aria-label="Áreas de configurações" className="flex gap-2 border-b border-[#DDE3EC] pb-3">{(["empresa","pessoal"] as const).map(value=><button key={value} type="button" aria-pressed={area===value} onClick={()=>setArea(value)} className={`px-5 py-2 rounded text-sm ${area===value?"bg-[#1A3A6B] text-white":"bg-white border text-[#475569]"}`}>{value==="empresa"?"Empresa":"Pessoal"}</button>)}</nav>
    <section aria-label="Configurações da empresa" hidden={area!=="empresa"}><CompanySettings config={config} onSave={onSave}/></section>
    <section aria-label="Configurações pessoais" hidden={area!=="pessoal"}><PersonalSettings/></section>
  </div>;
}
