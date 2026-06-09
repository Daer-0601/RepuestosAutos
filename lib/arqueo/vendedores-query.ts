/** Parsea `vendedores=1,2,3` desde query string (ids de usuario vendedor). */
export function parseVendedoresIdsQuery(raw: string | null | undefined): number[] | null {
  if (raw == null || raw.trim() === "") return null;
  const ids = raw
    .split(",")
    .map((s) => Math.trunc(Number(s.trim())))
    .filter((id) => Number.isFinite(id) && id > 0);
  const unique = [...new Set(ids)];
  return unique.length > 0 ? unique : null;
}

export function appendVendedoresIdsQuery(q: URLSearchParams, ids: number[] | null | undefined): void {
  if (!ids?.length) return;
  q.set("vendedores", ids.join(","));
}
