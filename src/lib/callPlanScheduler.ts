import type { DataRow } from '@/types/metrics';

export function getBusinessDays(year: number, monthIdx: number): Date[] {
  // monthIdx: 0-11
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
  index: number; // index within the input clients array
  newDate: string; // YYYY-MM-DD
}

function asBoolLocal(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1' || v.toUpperCase() === 'SI';
  return false;
}

/**
 * Redistribuye FECHA_LLAMADA de TODOS los clientes pendientes (no realizados)
 * de forma uniforme (round-robin) entre los días hábiles (Lun-Vie) del mes.
 * Solo emite cambios cuando la fecha resultante difiere de la actual.
 */
export function assignCallDates(
  clients: DataRow[],
  year: number,
  monthIdx: number
): AssignedChange[] {
  const businessDays = getBusinessDays(year, monthIdx);
  if (businessDays.length === 0) return [];

  // Reasignar a todos los que NO han sido realizados
  const pending = clients
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !asBoolLocal(row.LLAMADA_REALIZADA));

  if (pending.length === 0) return [];

  // Orden estable por cliente/sucursal para que la distribución sea determinista
  pending.sort((a, b) => {
    const ca = `${a.row.CLIENTE || ''}|${a.row.SUCURSAL || ''}`.toUpperCase();
    const cb = `${b.row.CLIENTE || ''}|${b.row.SUCURSAL || ''}`.toUpperCase();
    return ca.localeCompare(cb);
  });

  const changes: AssignedChange[] = [];
  pending.forEach((item, i) => {
    // Round-robin: el cliente i va al día (i % díasHábiles)
    const dayIdx = i % businessDays.length;
    const newDate = formatYMD(businessDays[dayIdx]);
    const current = String(item.row.FECHA_LLAMADA || '').trim();
    if (current !== newDate) {
      changes.push({ row: item.row, index: item.index, newDate });
    }
  });
  return changes;
}
