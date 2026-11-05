import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

type Party = { nome?: string; endereco?: string; numero?: string; complemento?: string; cidade?: string; uf?: string; cep?: string; cnpj?: string; cpf_cnpj?: string; aos_cuidados?: string };
type Gift = { nome?: string; valor?: number | string };
export type PdfDeclaration = {
  numero: string; data: string; local?: string; peso_total: number | string; total_itens: number;
  destinatario?: Party; destinatario_snapshot?: Party; remetente_snapshot?: Party;
  itens: { quantidade: number; brinde_snapshot?: Gift; brinde?: Gift }[];
};

/** Generates a real A4 PDF from the declaration's saved recipient and gift snapshots. */
export async function buildDeclarationPdf(declaration: PdfDeclaration, sender: Party): Promise<Uint8Array> {
  if (!declaration.itens?.length) throw new Error("A declaração não possui itens para gerar o PDF.");
  const recipient = { ...declaration.destinatario, ...declaration.destinatario_snapshot,
    aos_cuidados: declaration.destinatario_snapshot?.aos_cuidados ?? "" };
  const origin = { ...sender, ...declaration.remetente_snapshot };
  if (!recipient.nome || !origin?.nome) throw new Error("Dados incompletos para gerar a declaração em PDF.");
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Declaração de Conteúdo - ${declaration.numero}`);
  pdf.setAuthor("Hercules - Envio de Brindes");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, margin = 22.68, width = W - margin * 2;
  const black = rgb(0, 0, 0), shade = rgb(208 / 255, 206 / 255, 206 / 255);
  let page = pdf.addPage([W, H]);
  const clean = (value: unknown) => Array.from(String(value ?? "").replace(/[\r\n\t]+/g, " ")).map(char => {
    try { regular.encodeText(char); return char; } catch { return "?"; }
  }).join("");
  const wrap = (value: unknown, maxWidth: number, size = 8, heavy = false) => {
    const font = heavy ? bold : regular;
    const words = clean(value).split(/\s+/).filter(Boolean), lines: string[] = [];
    let line = "";
    for (let word of words) {
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        if (line) { lines.push(line); line = ""; }
        while (font.widthOfTextAtSize(word, size) > maxWidth) {
          let cut = word.length;
          while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > maxWidth) cut--;
          lines.push(word.slice(0, cut)); word = word.slice(cut);
        }
      }
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) { lines.push(line); line = word; }
      else line = candidate;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };
  const box = (x: number, top: number, w: number, height: number, fill = false) => page.drawRectangle({
    x, y: H - top - height, width: w, height, borderColor: black, borderWidth: 0.6, ...(fill ? { color: shade } : {}) });
  const text = (value: unknown, x: number, top: number, size = 8, heavy = false) => page.drawText(clean(value), { x, y: H - top - size, size, font: heavy ? bold : regular, color: black });
  const centered = (value: unknown, x: number, top: number, w: number, size = 8, heavy = false) => {
    const content = clean(value), font = heavy ? bold : regular;
    text(content, x + Math.max(3, (w - font.widthOfTextAtSize(content, size)) / 2), top, size, heavy);
  };
  const cell = (value: unknown, x: number, top: number, w: number, h: number, heavy = false, fill = false, align = "left", size = 8) => {
    box(x, top, w, h, fill);
    const lines = wrap(value, w - 10, size, heavy);
    lines.forEach((line, index) => {
      const offset = align === "center" ? (w - (heavy ? bold : regular).widthOfTextAtSize(line, size)) / 2
        : align === "right" ? w - 5 - (heavy ? bold : regular).widthOfTextAtSize(line, size) : 5;
      text(line, x + offset, top + 3 + index * (size + 3), size, heavy);
    });
  };
  const partyRows = (p: Party, recipientBox: boolean) => {
    const address = `${p.endereco ?? ""}, ${p.numero ?? ""}${p.complemento ? ` - ${p.complemento}` : ""}`;
    return [ `NOME: ${p.nome ?? ""}`, ...(recipientBox && p.aos_cuidados?.trim() ? [`A/C: ${p.aos_cuidados.trim()}`] : []),
      `ENDEREÇO: ${address}`, `CIDADE: ${p.cidade ?? ""}    UF: ${p.uf ?? ""}`,
      `CEP: ${p.cep ?? ""}    ${recipientBox ? "CPF/CNPJ" : "CNPJ"}: ${p.cpf_cnpj ?? p.cnpj ?? ""}` ].map(s => s.toUpperCase());
  };
  const leftW = width * 0.48, gap = width * 0.01, rightW = width - leftW - gap;
  const senderRows = partyRows(origin, false), recipientRows = partyRows(recipient, true);
  const rowHeights = (rows: string[], w: number) => rows.map((row, index) => Math.max(row.startsWith("ENDEREÇO") ? 28 : 18, wrap(row, w - 10).length * 11 + 6));
  const senderHeights = rowHeights(senderRows, leftW), recipientHeights = rowHeights(recipientRows, rightW);
  const partyHeight = Math.max(senderHeights.reduce((a,b)=>a+b,0),recipientHeights.reduce((a,b)=>a+b,0)) + 18;
  const columns = [width * 0.08, width * 0.59, width * 0.165, width * 0.165];
  const offsets = [margin, margin + columns[0], margin + columns[0] + columns[1], margin + columns[0] + columns[1] + columns[2]];
  function heading() {
    const top = 14.17, headerW = width * 0.83;
    box(margin, top, headerW, 48.19);
    centered("DECLARAÇÃO DE CONTEÚDO", margin, top + 17, headerW, 12, true);
    cell("CAMPOS EXCLUSIVOS DOS CORREIOS", margin, top + 48.19, headerW, 15, true, true);
    cell("UNIDADE DE POSTAGEM", margin, top + 63.19, headerW * 0.57, 27, false, false, "left", 7);
    cell("NÚMERO DO REGISTRO", margin + headerW * 0.57, top + 63.19, headerW * 0.43, 27, false, false, "left", 7);
    cell("CARIMBO DA UNIDADE", margin + width * 0.84, top, width * 0.16, 90.19, true, false, "left", 7);
    const partiesTop = top + 96;
    const renderParty = (rows: string[], heights: number[], title: string, x: number, w: number) => {
      cell(title, x, partiesTop, w, 18, true, false, "center");
      let y = partiesTop + 18;
      rows.forEach((row, index) => {
        const height = index === rows.length - 1 ? partiesTop + partyHeight - y : heights[index];
        cell(row, x, y, w, height); y += height;
      });
    };
    renderParty(senderRows, senderHeights, "R E M E T E N T E", margin, leftW);
    renderParty(recipientRows, recipientHeights, "D E S T I N A T Á R I O", margin + leftW + gap, rightW);
    let y = partiesTop + partyHeight + 5;
    cell("I D E N T I F I C A Ç Ã O   D O S   B E N S", margin, y, width, 17, true, false, "center"); y += 17;
    ["ITEM", "CONTEÚDO", "QUANT.", "VALOR"].forEach((label,i)=>cell(label,offsets[i],y,columns[i],18,true,true,"center"));
    return y + 18;
  }
  const values = declaration.itens.map((item, index) => {
    const gift = item.brinde_snapshot ?? item.brinde;
    if (!gift?.nome) throw new Error("Item sem descrição na declaração em PDF.");
    const qty = Number(item.quantidade), value = Number(gift.valor ?? 0) * qty;
    if (!Number.isFinite(qty) || !Number.isFinite(value)) throw new Error("Valores inválidos na declaração em PDF.");
    const name = gift.nome.toUpperCase();
    return { index: index + 1, name, qty, value, height: Math.max(18, wrap(name, columns[1] - 10).length * 11 + 6) };
  });
  const money = (value: number) => value.toFixed(2).replace(".", ",");
  let y = heading(), rowsThisPage = 0;
  for (const row of values) {
    if (y + row.height > H - 225) {
      if (!rowsThisPage) throw new Error("Descrição ou endereço muito extenso para gerar o PDF.");
      text("Continua na próxima página.",margin,y+5,8);
      page = pdf.addPage([W,H]); y = heading(); rowsThisPage = 0;
      if (y + row.height > H - 225) throw new Error("Descrição ou endereço muito extenso para gerar o PDF.");
    }
    [row.index, row.name, row.qty, money(row.value)].forEach((value,i)=>cell(value,offsets[i],y,columns[i],row.height,false,false,i===1?"left":i===3?"right":"center"));
    y += row.height; rowsThisPage++;
  }
  while (rowsThisPage < 6 && y + 18 <= H - 225) {
    columns.forEach((w,i)=>cell("",offsets[i],y,w,18)); y+=18; rowsThisPage++;
  }
  const labelW = columns[0] + columns[1];
  cell("TOTAIS",margin,y,labelW,18,true,true);
  cell(values.reduce((sum,row)=>sum+row.qty,0),offsets[2],y,columns[2],18,true,true,"center");
  cell(money(values.reduce((sum,row)=>sum+row.value,0)),offsets[3],y,columns[3],18,true,true,"right"); y+=18;
  cell("PESO TOTAL (kg)",margin,y,labelW,18,true,true);
  cell(`${Number(declaration.peso_total).toFixed(3).replace(".",",")} kg`,offsets[2],y,columns[2]+columns[3],18,true,false,"center"); y+=23;
  cell("D E C L A R A Ç Ã O",margin,y,width,18,true,false,"center"); y+=18;
  const legal = "Declaro que não me enquadro no conceito de contribuinte previsto no art. 4º da Lei Complementar nº 87/1996, uma vez que não realizo, com habitualidade ou em volume que caracterize intuito comercial, operações de circulação de mercadoria, ainda que se iniciem no exterior, ou estou dispensado da emissão da nota fiscal por força da legislação tributária vigente, responsabilizando-me, nos termos da lei e a quem de direito, por informações inverídicas.";
  const legalLines = wrap(legal,width-16,8.5), legalHeight=legalLines.length*12+53;
  box(margin,y,width,legalHeight);
  legalLines.forEach((line,i)=>text(line,margin+8,y+6+i*12,8.5));
  const months = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
  const parts = declaration.data.split("/");
  const date = parts.length===3 ? `${Number(parts[0])} de ${months[Number(parts[1])-1] ?? parts[1]} de ${parts[2]}` : declaration.data;
  const dateLines = wrap(`${origin.cidade ?? declaration.local ?? ""}, ${date}`,width-225,8.5);
  dateLines.forEach((line,i)=>text(line,margin+8,y+legalHeight-28+i*11,8.5));
  page.drawLine({start:{x:W-margin-210,y:H-y-legalHeight+29},end:{x:W-margin-8,y:H-y-legalHeight+29},thickness:0.6,color:black});
  text("Assinatura do Declarante/Remetente",W-margin-204,y+legalHeight-25,8); y+=legalHeight+5;
  cell("O B S E R V A Ç Ã O",margin,y,width,18,true,false,"center"); y+=18;
  const note="Constitui crime contra a ordem tributária suprimir ou reduzir tributo, ou contribuição social e qualquer acessório (Lei 8.137/90 Art. 1º, V).";
  const noteLines=wrap(note,width-16,8);
  box(margin,y,width,noteLines.length*11+12);
  noteLines.forEach((line,i)=>text(line,margin+8,y+5+i*11,8));
  if(y+noteLines.length*11+12>H-18)throw new Error("Declaração extensa demais para o PDF. Revise os dados antes do envio.");
  pdf.getPages().forEach((p,index)=>p.drawText(`${declaration.numero} - ${index+1}/${pdf.getPageCount()}`,{x:margin,y:10,size:7,font:regular,color:black}));
  return pdf.save();
}
