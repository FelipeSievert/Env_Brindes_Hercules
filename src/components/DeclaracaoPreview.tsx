import { Printer, Download, Edit, ArrowLeft } from "lucide-react";
import { Declaracao, Configuracoes } from "../types";

interface Props {
  declaracao: Declaracao;
  config: Configuracoes;
  onBack: () => void;
  onEdit: () => void;
}

const MESES = [
  "JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO",
  "JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO",
];

function formatDateLong(dateStr: string): string {
  const [day, month, year] = dateStr.split("/");
  return `${parseInt(day)} de ${MESES[parseInt(month) - 1]} de ${year}`;
}

export default function DeclaracaoPreview({ declaracao, config, onBack, onEdit }: Props) {
  const r = config.remetente;
  const d = declaracao.destinatario;

  const valorTotal = declaracao.itens.reduce(
    (s, i) => s + i.brinde.valor * i.quantidade,
    0
  );

  return (
    <>
      {/* ── Toolbar (hidden on print) ── */}
      <div
        className="print:hidden bg-[#1A3A6B] text-white px-8 py-3 flex items-center justify-between"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
          <span className="text-white/30">|</span>
          <span className="text-sm text-white/70">
            Declaração{" "}
            <span className="font-semibold text-white">{declaracao.numero}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded text-sm font-medium transition-colors"
          >
            <Edit size={15} />
            Editar
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white text-[#1A3A6B] rounded text-sm font-semibold hover:bg-white/90 transition-colors"
          >
            <Printer size={15} />
            Imprimir
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-[#D42B1E] text-white rounded text-sm font-semibold hover:bg-[#b82318] transition-colors"
          >
            <Download size={15} />
            Gerar PDF
          </button>
        </div>
      </div>

      {/* ── Page background (hidden on print) ── */}
      <div className="print:hidden bg-[#e8e8e8] min-h-screen py-10 flex justify-center">
        <DeclaracaoA4
          declaracao={declaracao}
          r={r}
          d={d}
          valorTotal={valorTotal}
          formatDateLong={formatDateLong}
        />
      </div>

      {/* ── Print-only output ── */}
      <div className="hidden print:block">
        <DeclaracaoA4
          declaracao={declaracao}
          r={r}
          d={d}
          valorTotal={valorTotal}
          formatDateLong={formatDateLong}
        />
      </div>
    </>
  );
}

// ── The actual A4 document ────────────────────────────────────────────────────
function DeclaracaoA4({
  declaracao,
  r,
  d,
  valorTotal,
  formatDateLong,
}: {
  declaracao: Declaracao;
  r: Configuracoes["remetente"];
  d: Declaracao["destinatario"];
  valorTotal: number;
  formatDateLong: (s: string) => string;
}) {
  const docStyle: React.CSSProperties = {
    width: "210mm",
    minHeight: "297mm",
    background: "#fff",
    fontFamily: "'Arial', 'Helvetica', sans-serif",
    fontSize: "10pt",
    color: "#000",
    padding: "5mm 8mm 8mm",
    boxSizing: "border-box",
    boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
    lineHeight: 1.3,
    position: "relative",
  };

  const thStyle: React.CSSProperties = {
    border: "1px solid #000",
    padding: "3px 5px",
    textAlign: "center" as const,
    fontWeight: "bold",
    fontSize: "9pt",
    background: "#d0cece",
  };

  const tdStyle: React.CSSProperties = {
    border: "1px solid #000",
    padding: "3px 5px",
    fontSize: "9pt",
  };

  const shade = "#d0cece";

  return (
    <div id="print-area" style={docStyle}>
      {/* ── TITLE + CARIMBO ── */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "1.8mm",
          tableLayout: "fixed",
        }}
      >
        <tbody>
          <tr>
            {/* Left block: title + campos exclusivos */}
            <td style={{ width: "83%", padding: 0, verticalAlign: "top" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <tbody>
                  {/* Title */}
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        border: "1px solid #000",
                        textAlign: "center",
                        verticalAlign: "middle",
                        fontWeight: "bold",
                        fontSize: "11pt",
                        letterSpacing: "0.14em",
                        height: "17mm",
                      }}
                    >
                      DECLARAÇÃO DE CONTEÚDO
                    </td>
                  </tr>
                  {/* Campos exclusivos bar */}
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        border: "1px solid #000",
                        padding: "2px 6px",
                        fontSize: "8pt",
                        fontWeight: "bold",
                        letterSpacing: "0.05em",
                        background: shade,
                      }}
                    >
                      CAMPOS EXCLUSIVOS DOS CORREIOS
                    </td>
                  </tr>
                  {/* Unidade de postagem / Número do registro */}
                  <tr>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "3px 6px 12px",
                        fontSize: "7.5pt",
                        width: "57%",
                        verticalAlign: "top",
                      }}
                    >
                      UNIDADE DE POSTAGEM
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "3px 6px 12px",
                        fontSize: "7.5pt",
                        width: "43%",
                        verticalAlign: "top",
                      }}
                    >
                      NÚMERO DO REGISTRO
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            {/* Spacer */}
            <td style={{ width: "1%", padding: 0 }} />
            {/* Carimbo da unidade (tall) */}
            <td
              style={{
                width: "16%",
                border: "1px solid #000",
                padding: "3px 5px",
                fontSize: "7.5pt",
                fontWeight: "bold",
                letterSpacing: "0.03em",
                verticalAlign: "top",
              }}
            >
              CARIMBO DA UNIDADE
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── REMETENTE / DESTINATÁRIO ── */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "1.8mm",
          tableLayout: "fixed",
        }}
      >
        <tbody>
          <tr style={{ verticalAlign: "top" }}>
            {/* Remetente box */}
            <td style={{ width: "48%", padding: 0 }}>
              <PartyBox
                title="R E M E T E N T E"
                nome={r.nome}
                endereco={`${r.endereco}, ${r.numero}`}
                cidade={r.cidade}
                uf={r.uf}
                cep={r.cep}
                doc={r.cnpj}
                docLabel="CNPJ"
              />
            </td>
            {/* Gap */}
            <td style={{ width: "1%", padding: 0 }} />
            {/* Destinatário box */}
            <td style={{ width: "51%", padding: 0 }}>
              <PartyBox
                title="D E S T I N A T Á R I O"
                nome={d.nome.toUpperCase()}
                aosCuidados={d.aosCuidados}
                endereco={`${d.endereco}, ${d.numero}${d.complemento ? ` – ${d.complemento}` : ""}`.toUpperCase()}
                cidade={d.cidade.toUpperCase()}
                uf={d.uf.toUpperCase()}
                cep={d.cep}
                doc={d.cpfCnpj}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── IDENTIFICAÇÃO DOS BENS ── */}
      <div
        style={{
          fontWeight: "bold",
          letterSpacing: "0.12em",
          fontSize: "7.5pt",
          border: "1px solid #000",
          padding: "3px 6px",
          borderBottom: "none",
          textAlign: "center",
        }}
      >
        I D E N T I F I C A Ç Ã O &nbsp; D O S &nbsp; B E N S
      </div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "1.8mm",
        }}
      >
        <thead>
          <tr>
            <th style={{ ...thStyle, width: "8%" }}>ITEM</th>
            <th style={{ ...thStyle, width: "59%" }}>CONTEÚDO</th>
            <th style={{ ...thStyle, width: "16.5%" }}>QUANT.</th>
            <th style={{ ...thStyle, width: "16.5%" }}>VALOR</th>
          </tr>
        </thead>
        <tbody>
          {declaracao.itens.map((item, i) => (
            <tr key={item.brindeId}>
              <td style={{ ...tdStyle, textAlign: "center" }}>{i + 1}</td>
              <td style={tdStyle}>{item.brinde.nome.toUpperCase()}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{item.quantidade}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>
                {(item.brinde.valor * item.quantidade).toFixed(2).replace(".", ",")}
              </td>
            </tr>
          ))}
          {/* Empty rows to fill table */}
          {Array.from({ length: Math.max(0, 6 - declaracao.itens.length) }).map((_, i) => (
            <tr key={`empty-${i}`}>
              <td style={{ ...tdStyle, height: "6mm" }}>&nbsp;</td>
              <td style={tdStyle}>&nbsp;</td>
              <td style={tdStyle}>&nbsp;</td>
              <td style={tdStyle}>&nbsp;</td>
            </tr>
          ))}
          {/* Totals row */}
          <tr>
            <td
              colSpan={2}
              style={{
                ...tdStyle,
                fontWeight: "bold",
                background: shade,
              }}
            >
              TOTAIS
            </td>
            <td
              style={{
                ...tdStyle,
                fontWeight: "bold",
                textAlign: "center",
                background: shade,
              }}
            >
              {declaracao.totalItens}
            </td>
            <td
              style={{
                ...tdStyle,
                fontWeight: "bold",
                textAlign: "right",
                background: shade,
              }}
            >
              {valorTotal.toFixed(2).replace(".", ",")}
            </td>
          </tr>
          {/* Peso total row */}
          <tr>
            <td
              colSpan={2}
              style={{
                ...tdStyle,
                fontWeight: "bold",
                background: shade,
              }}
            >
              PESO TOTAL (kg)
            </td>
            <td
              colSpan={2}
              style={{
                ...tdStyle,
                fontWeight: "bold",
                textAlign: "center",
              }}
            >
              {declaracao.pesoTotal.toFixed(3).replace(".", ",")} kg
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── DECLARAÇÃO ── */}
      <div
        style={{
          fontWeight: "bold",
          letterSpacing: "0.12em",
          fontSize: "9pt",
          border: "1px solid #000",
          padding: "3px 6px",
          borderBottom: "none",
          textAlign: "center",
        }}
      >
        D E C L A R A Ç Ã O
      </div>
      <div
        style={{
          border: "1px solid #000",
          padding: "5px 8px 8px",
        }}
      >
        <p
          style={{
            fontSize: "8.5pt",
            textAlign: "justify",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Declaro que não me enquadro no conceito de contribuinte previsto no art. 4º da Lei Complementar nº
          87/1996, uma vez que não realizo, com habitualidade ou em volume que caracterize intuito comercial,
          operações de circulação de mercadoria, ainda que se iniciem no exterior, ou estou dispensado da
          emissão da nota fiscal por força da legislação tributária vigente, responsabilizando-me, nos termos
          da lei e a quem de direito, por informações inverídicas.
        </p>

        {/* ── DATA E ASSINATURA (mesma linha) ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: "4mm",
            gap: "8mm",
          }}
        >
          <div style={{ fontSize: "9pt", whiteSpace: "nowrap", paddingBottom: "3px" }}>
            {r.cidade}, {formatDateLong(declaracao.data)}
          </div>
          <div style={{ width: "72mm", textAlign: "center" }}>
            <div
              style={{
                borderTop: "1px solid #000",
                paddingTop: "3px",
                fontSize: "8pt",
              }}
            >
              Assinatura do Declarante/Remetente
            </div>
          </div>
        </div>
      </div>

      {/* ── OBSERVAÇÃO ── */}
      <div
        style={{
          fontWeight: "bold",
          letterSpacing: "0.12em",
          fontSize: "9pt",
          border: "1px solid #000",
          borderBottom: "none",
          padding: "3px 6px",
          textAlign: "center",
          marginTop: "1.8mm",
        }}
      >
        O B S E R V A Ç Ã O
      </div>
      <div style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "8pt", lineHeight: 1.4 }}>
        Constitui crime contra a ordem tributária suprimir ou reduzir tributo, ou contribuição social e
        qualquer acessório (Lei 8.137/90 Art. 1º, V).
      </div>

      {/* Linha de corte em 18,5cm — visível apenas na tela, não imprime */}
      <div
        className="print:hidden"
        style={{
          position: "absolute",
          top: "185mm",
          left: 0,
          width: "100%",
          borderTop: "1.5px dashed #94a3b8",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ── Remetente / Destinatário box ──────────────────────────────────────────────
function PartyBox({
  title,
  nome,
  endereco,
  cidade,
  uf,
  cep,
  doc,
  docLabel = "CPF/CNPJ",
  docFontSize,
  aosCuidados,
}: {
  title: string;
  nome: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  doc: string;
  docLabel?: string;
  docFontSize?: string;
  aosCuidados?: string;
}) {
  const cell: React.CSSProperties = {
    border: "1px solid #000",
    padding: "3px 6px",
    fontSize: "8pt",
    fontFamily: "Times New Roman, Times, serif",
    verticalAlign: "top",
  };
  // Linhas de uma só linha: nunca quebram (exceto o endereço)
  const oneLine: React.CSSProperties = {
    ...cell,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", height: "100%" }}>
      <tbody>
        <tr>
          <td
            colSpan={2}
            style={{
              ...cell,
              fontWeight: "bold",
              letterSpacing: "0.18em",
              fontSize: "8pt",
              textAlign: "center",
            }}
          >
            {title}
          </td>
        </tr>
        <tr>
          <td colSpan={2} style={oneLine}>
            <b>NOME:</b> {nome}
          </td>
        </tr>
        {aosCuidados?.trim() && (
          <tr>
            <td colSpan={2} style={{ ...cell, overflowWrap: "anywhere" }}>
              <b>A/C:</b> {aosCuidados.trim().toUpperCase()}
            </td>
          </tr>
        )}
        <tr>
          <td colSpan={2} style={{ ...cell, height: "10mm" }}>
            <b>ENDEREÇO:</b> {endereco}
          </td>
        </tr>
        <tr>
          <td style={{ ...oneLine, width: "80%" }}>
            <b>CIDADE:</b> {cidade}
          </td>
          <td style={{ ...oneLine, width: "20%" }}>
            <b>UF:</b> {uf}
          </td>
        </tr>
        <tr>
          <td style={{ ...oneLine, width: "42%" }}>
            <b>CEP:</b> {cep}
          </td>
          <td style={{ ...cell, width: "58%", ...(docFontSize ? { fontSize: docFontSize } : {}), whiteSpace: "normal" }}>
            <b>{docLabel}:</b> {doc}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
