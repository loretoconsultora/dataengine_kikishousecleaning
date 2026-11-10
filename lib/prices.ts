/** Lista de precios vigente (PDF "pricing_table", noviembre 2026). Standard Clean. */
export const PRICE_LIST = [
  { label: "1 rec / 1 baño", bd: 1, ba: 1, hours: 3.0, oneTime: 165, monthly: 165, recurring: 165, deep: 245 },
  { label: "2 rec / 1 baño", bd: 2, ba: 1, hours: 3.5, oneTime: 195, monthly: 165, recurring: 165, deep: 295 },
  { label: "2 rec / 2 baños", bd: 2, ba: 2, hours: 4.0, oneTime: 225, monthly: 195, recurring: 175, deep: 345 },
  { label: "3 rec / 2 baños", bd: 3, ba: 2, hours: 4.5, oneTime: 245, monthly: 225, recurring: 195, deep: 445 },
  { label: "3 rec / 3 baños", bd: 3, ba: 3, hours: 5.0, oneTime: 295, monthly: 245, recurring: 225, deep: 545 },
  { label: "4 rec / 3 baños", bd: 4, ba: 3, hours: 5.5, oneTime: 345, monthly: 295, recurring: 245, deep: 645 },
  { label: "4 rec / 4 baños", bd: 4, ba: 4, hours: 6.0, oneTime: 395, monthly: 345, recurring: 295, deep: 745 },
  { label: "5 rec / 4 baños", bd: 5, ba: 4, hours: 7.0, oneTime: 445, monthly: 395, recurring: 345, deep: 895 },
  { label: "5 rec / 5 baños", bd: 5, ba: 5, hours: 8.0, oneTime: 495, monthly: 445, recurring: 395, deep: 995 },
];

/** Fila de la lista más cercana a una casa (recámaras y baños redondeados hacia abajo, con tope). */
export function listRow(bd: number | null, ba: number | null) {
  if (bd === null || ba === null || !(bd > 0)) return null;
  const b = Math.min(5, Math.max(1, Math.floor(bd)));
  const bath = Math.max(1, Math.floor(ba));
  const rows = PRICE_LIST.filter((r) => r.bd === b);
  return rows.filter((r) => r.ba <= bath).pop() ?? rows[0] ?? null;
}

export function listPrice(row: (typeof PRICE_LIST)[number], frequency: string | null) {
  if (frequency === "Mensual") return row.monthly;
  if (frequency === "Semanal" || frequency === "Quincenal") return row.recurring;
  return row.oneTime;
}
