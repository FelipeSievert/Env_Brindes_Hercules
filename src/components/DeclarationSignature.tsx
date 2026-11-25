import { useEffect, useState } from "react";
import { inkBounds } from "../../supabase/functions/send-tracking-email/signature-layout";

export default function DeclarationSignature({ image }: { image: string }) {
  const [cropped,setCropped]=useState<{source:string;image:string}|null>(null);
  useEffect(()=>{
    let cancelled=false;
    const source=new Image();
    source.onload=()=>{
      if(cancelled)return;
      try {
        const original=document.createElement("canvas");
        original.width=source.naturalWidth; original.height=source.naturalHeight;
        if(!original.width||!original.height||original.width>600||original.height>180)return;
        const ctx=original.getContext("2d");
        if(!ctx)return;
        ctx.drawImage(source,0,0);
        const bounds=inkBounds(ctx.getImageData(0,0,original.width,original.height).data,original.width,original.height);
        const output=document.createElement("canvas");
        output.width=bounds.width; output.height=bounds.height;
        const out=output.getContext("2d");
        if(!out)return;
        out.drawImage(original,bounds.x,bounds.y,bounds.width,bounds.height,0,0,bounds.width,bounds.height);
        setCropped({source:image,image:output.toDataURL("image/png")});
      } catch { /* Preserve original image if canvas is unavailable. */ }
    };
    source.src=image;
    return ()=>{cancelled=true;source.onload=null;};
  },[image]);
  return <div style={{width:"100%",height:"17mm",display:"flex",justifyContent:"center",alignItems:"flex-end",padding:"0 2mm 0.5mm",boxSizing:"border-box"}}>
    <img src={cropped?.source===image?cropped.image:image} alt="Assinatura do declarante" style={{display:"block",maxWidth:"100%",maxHeight:"100%",width:"auto",height:"auto",objectFit:"contain"}} />
  </div>;
}
