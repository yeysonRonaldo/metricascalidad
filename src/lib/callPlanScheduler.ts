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

/**
 * Asigna FECHA_LLAMADA a clientes que no la tengan, distribuyendo
 * uniformemente entre los días hábiles (Lun-Vie) del mes.
 */
export function assignCallDates(
  clients: DataRow[],
  year: number,
  monthIdx: number
): AssignedChange[] {
  const businessDays = getBusinessDays(year, monthIdx);
  if (businessDays.length === 0) return [];

  // Solo asignar a los que no tienen fecha
  const pending = clients
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !String(row.FECHA_LLAMADA || '').trim());

  if (pending.length === 0) return [];

  // Orden estable por cliente/sucursal
  pending.sort((a, b) => {
    const ca = `${a.row.CLIENTE || ''}|${a.row.SUCURSAL || ''}`.toUpperCase();
    const cb = `${b.row.CLIENTE || ''}|${b.row.SUCURSAL || ''}`.toUpperCase();
    return ca.localeCompare(cb);
  });

  const perDay = Math.ceil(pending.length / businessDays.length);
  const changes: AssignedChange[] = [];
  pending.forEach((item, i) => {
    const dayIdx = Math.min(Math.floor(i / perDay), businessDays.length - 1);
    changes.push({
      row: item.row,
      index: item.index,
      newDate: formatYMD(businessDays[dayIdx]),
    });
  });
  return changes;
}
