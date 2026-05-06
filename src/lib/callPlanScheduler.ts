import type { DataRow } from '@/types/metrics';

export function getBusinessDays(year: number, monthIdx: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, monthIdx, 1);
  while (d.getMonth() === monthIdx) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface AssignedChange {
  row: DataRow;
  index: number;
  newDate: string; // '' significa limpiar la fecha
}

function asBoolLocal(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1' || v.toUpperCase() === 'SI';
  return false;
}

function clientKey(row: DataRow): string {
  return `${String(row.CLIENTE || '').trim().toUpperCase()}|${String(row.SUCURSAL || '').trim().toUpperCase()}`;
}

/**
 * Distribuye FECHA_LLAMADA uniformemente (round-robin) entre los días hábiles
 * del mes que sean >= fromDate (default: hoy).
 *
 * - Deduplica por CLIENTE+SUCURSAL: solo el primer registro de cada cliente
 *   recibe fecha; los duplicados se limpian (FECHA_LLAMADA = '').
 * - Solo considera registros NO realizados.
 */
export function assignCallDates(
  clients: DataRow[],
  year: number,
  monthIdx: number,
  fromDate?: Date
): AssignedChange[] {
  const allBusinessDays = getBusinessDays(year, monthIdx);
  const cutoff = fromDate ? formatYMD(fromDate) : formatYMD(new Date());
  const businessDays = allBusinessDays.filter(d => formatYMD(d) >= cutoff);
  if (businessDays.length === 0) return [];

  const pending = clients
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !asBoolLocal(row.LLAMADA_REALIZADA));

  if (pending.length === 0) return [];

  // Orden estable por cliente/sucursal
  pending.sort((a, b) => clientKey(a.row).localeCompare(clientKey(b.row)));

  // Deduplicar por cliente+sucursal: primero gana
  const seen = new Set<string>();
  const unique: typeof pending = [];
  const duplicates: typeof pending = [];
  for (const p of pending) {
    const k = clientKey(p.row);
    if (seen.has(k)) {
      duplicates.push(p);
    } else {
      seen.add(k);
      unique.push(p);
    }
  }

  const changes: AssignedChange[] = [];

  // Asignar fechas round-robin a únicos
  unique.forEach((item, i) => {
    const dayIdx = i % businessDays.length;
    const newDate = formatYMD(businessDays[dayIdx]);
    const current = String(item.row.FECHA_LLAMADA || '').trim();
    if (current !== newDate) {
      changes.push({ row: item.row, index: item.index, newDate });
    }
  });

  // Limpiar duplicados
  duplicates.forEach((item) => {
    const current = String(item.row.FECHA_LLAMADA || '').trim();
    if (current !== '') {
      changes.push({ row: item.row, index: item.index, newDate: '' });
    }
  });

  return changes;
}
