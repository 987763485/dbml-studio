export type Eol = '\n' | '\r\n';

export function detectEol(text: string): Eol {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

export function normalizeEol(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

export function applyEol(text: string, eol: Eol): string {
  return eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
}
