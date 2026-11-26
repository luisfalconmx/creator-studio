/** true cuando corre dentro de Tauri (no en un navegador normal). */
export const inTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const errMsg = (e: unknown) =>
  typeof e === 'string' ? e : e instanceof Error ? e.message : String(e)

export function formatBytes(n: number): string {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`
}
