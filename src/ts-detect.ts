// TypeScript detection utility for amaro loader
export function isTypeScript(url: string, source?: string): boolean {
  if (url.endsWith('.ts') || url.endsWith('.tsx')) return true;
  if (source && /\b(interface|type|enum)\b/.test(source)) return true;
  if (source && source.startsWith('// @amaro-transform')) return true;
  return false;
}
