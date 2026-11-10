export const DEFAULT_TRACKING_MESSAGE = "Bom dia, tudo bem?\nSegue aqui o código de rastreio: (CÓDIGO)\nEnviado para: (DESTINATÁRIO)";

export function renderTrackingMessage(message: string, code: string, declaration: string, responsible: string, recipientName: string): string {
  const template = message.trim() || DEFAULT_TRACKING_MESSAGE;
  const hasCodePlaceholder = template.includes("(CÓDIGO)");
  const formattedTemplate = template.split("(CÓDIGO)").join(code).split("(DESTINATÁRIO)").join(recipientName);
  const body = hasCodePlaceholder
    ? formattedTemplate
    : `Olá, ${responsible}!\n\n${formattedTemplate}\n\nCódigo de rastreio: ${code}`;
  const withRecipient = template.includes("(DESTINATÁRIO)") ? body : `${body}\nEnviado para: ${recipientName}`;
  return `${withRecipient}\n\nDeclaração: ${declaration}\n\nHercules — Envio de Brindes`;
}
