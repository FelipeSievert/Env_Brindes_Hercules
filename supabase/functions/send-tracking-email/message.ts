export const DEFAULT_TRACKING_MESSAGE = "Bom dia, tudo bem?\nSegue aqui o código de rastreio: (CÓDIGO)";

export function renderTrackingMessage(message: string, code: string, declaration: string, responsible: string): string {
  const template = message.trim() || DEFAULT_TRACKING_MESSAGE;
  const hasCodePlaceholder = template.includes("(CÓDIGO)");
  const body = hasCodePlaceholder
    ? template.split("(CÓDIGO)").join(code)
    : `Olá, ${responsible}!\n\n${template}\n\nCódigo de rastreio: ${code}`;
  return `${body}\n\nDeclaração: ${declaration}\n\nHercules — Envio de Brindes`;
}
