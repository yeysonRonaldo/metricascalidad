import type { DataRow, SupervisorStats, GestionStats, GestionIndividual, BalanceRow, TimeUnit } from '@/types/metrics';

export const MONTH_ORDER: Record<string, number> = {
  "Enero": 1, "Febrero": 2, "Marzo": 3, "Abril": 4, "Mayo": 5, "Junio": 6,
  "Julio": 7, "Agosto": 8, "Septiembre": 9, "Octubre": 10, "Noviembre": 11, "Diciembre": 12
};

export const MONTH_NAMES = Object.keys(MONTH_ORDER);

export const PALETTE = {
  blue: '#6366f1', green: '#10b981', orange: '#f59e0b', purple: '#8b5cf6',
  multi: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4']
};

export function normalizeMonth(m: unknown): string {
  if (!m) return '';
  const s = String(m).trim();
  const lower = s.toLowerCase();
  for (const name of MONTH_NAMES) {
    if (name.toLowerCase() === lower) return name;
  }
  return s;
}

export function capitalizeWords(str: string | undefined): string {
  if (!str) return '';
  return str.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
}

export function cleanString(str: string | undefined): string {
  if (!str) return '';
  return str.toString().toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/SA$/g, '').replace(/SOCIEDADANONIMA/g, '');
}

export function isRealized(s: unknown): boolean {
  if (!s) return false;
  const upper = String(s).toUpperCase();
  return upper.includes('REALIZADO') || upper.includes('EJECUTADO') || upper.includes('ENVIADO') || upper.includes('REUNI') || upper.includes('SUPERVISI') || upper === 'SI';
}

export function isProgrammed(s: unknown): boolean {
  return !!s && String(s).toUpperCase().includes('PROGRAMADO');
}

export function getTaskType(row: DataRow): string {
  const s = (row.STATUS || '').trim().toUpperCase();
  if (s === 'REALIZADO' || s === 'EJECUTADO' || s === 'SI') {
    const t = (row['TIPO DE VISITA'] || '').trim().toUpperCase();
    return t || 'REALIZADO (OTROS)';
  }
  if (s === 'ENVIADO') return 'ENVIADO (REPORTE)';
  return s || 'DESCONOCIDO';
}

export function convertDatesAndFill(data: Record<string, unknown>[]): DataRow[] {
  return data.map(row => {
    const finalRow: DataRow = {};
    Object.keys(row).forEach(key => { finalRow[key.trim().toUpperCase()] = row[key]; });

    let dateObj: Date | null = null;
    if (finalRow.FECHA && typeof finalRow.FECHA === 'object' && (finalRow.FECHA as unknown) instanceof Date) dateObj = finalRow.FECHA as unknown as Date;
    else if (typeof finalRow.FECHA === 'string') {
      const cleanStr = (finalRow.FECHA as string).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) dateObj = new Date(cleanStr + 'T00:00:00');
      else dateObj = new Date(cleanStr);
    } else if (typeof finalRow.FECHA === 'number') dateObj = new Date(finalRow.FECHA as number);

    if (dateObj && !isNaN(dateObj.getTime())) {
      finalRow.FECHA = dateObj.toISOString().split('T')[0];
      if (!finalRow.AÑO) finalRow.AÑO = dateObj.getFullYear().toString();
      if (!finalRow.MES) {
        finalRow.MES = MONTH_NAMES[dateObj.getMonth()];
      }
    }
    return finalRow;
  });
}

export function filterByYearMonth(data: DataRow[], year: string, month: string): DataRow[] {
  return data.filter(row => {
    const yearMatch = year === 'all' || (row.AÑO || '').toString().trim() === year;
    const monthMatch = month === 'all' || normalizeMonth(row.MES) === month;
    return yearMatch && monthMatch;
  });
}

export function computeSupervisorStats(data: DataRow[], field: 'SUPERVISOR' | 'EJECUTIVO'): {
  stats: SupervisorStats;
  gestionGlobal: GestionStats;
  gestionIndividual: GestionIndividual;
} {
  const stats: SupervisorStats = {};
  const gestionGlobal: GestionStats = {};
  const gestionIndividual: GestionIndividual = {};

  data.forEach(row => {
    const sup = ((row[field] as string) || 'Desconocido').trim().toUpperCase() || 'DESCONOCIDO';
    if (!stats[sup]) stats[sup] = { meta: 0, realized: 0 };
    if (isProgrammed(row.STATUS)) stats[sup].meta++;
    if (isRealized(row.STATUS)) {
      stats[sup].realized++;
      const taskType = getTaskType(row);
      gestionGlobal[taskType] = (gestionGlobal[taskType] || 0) + 1;
      if (!gestionIndividual[sup]) gestionIndividual[sup] = {};
      gestionIndividual[sup][taskType] = (gestionIndividual[sup][taskType] || 0) + 1;
    }
  });

  return { stats, gestionGlobal, gestionIndividual };
}

export function computeMonthlyData(data: DataRow[]) {
  const byMonth: Record<string, { realized: number; meta: number; other: number }> = {};
  MONTH_NAMES.forEach(m => { byMonth[m] = { realized: 0, meta: 0, other: 0 }; });
  data.forEach(row => {
    const mes = normalizeMonth(row.MES);
    if (byMonth[mes]) {
      if (isRealized(row.STATUS)) byMonth[mes].realized++;
      if (isProgrammed(row.STATUS)) byMonth[mes].meta++;
    }
  });
  MONTH_NAMES.forEach(m => { byMonth[m].other = Math.max(0, byMonth[m].meta - byMonth[m].realized); });
  return byMonth;
}

function getKeyForUnit(dateStr: string, unit: TimeUnit): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return 'Invalid';
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  switch (unit) {
    case 'day': return `${y}-${m}-${day}`;
    case 'week': {
      const startOfYear = new Date(y, 0, 1);
      const diff = d.getTime() - startOfYear.getTime();
      const week = Math.ceil((diff / 86400000 + startOfYear.getDay() + 1) / 7);
      return `${y}-W${week.toString().padStart(2, '0')}`;
    }
    case 'month': return `${y}-${m}`;
    case 'year': return `${y}`;
  }
}

export function groupDataByTime(data: DataRow[], unit: TimeUnit) {
  const grouped: Record<string, { realized: number; meta: number }> = {};
  data.forEach(row => {
    if (!row.FECHA) return;
    const key = getKeyForUnit(row.FECHA, unit);
    if (!grouped[key]) grouped[key] = { realized: 0, meta: 0 };
    if (isRealized(row.STATUS)) grouped[key].realized++;
    if (isProgrammed(row.STATUS)) grouped[key].meta++;
  });
  return grouped;
}

export function getDedupedData(supData: DataRow[], ejecData: DataRow[], year: string, month: string): DataRow[] {
  const filteredSup = filterByYearMonth(supData, year, month);
  const filteredEjec = filterByYearMonth(ejecData, year, month);

  const unified: DataRow[] = [];
  filteredSup.forEach(r => { unified.push({ ...r, _ROLE: 'SUPERVISOR' }); });
  filteredEjec.forEach(r => { unified.push({ ...r, _ROLE: 'EJECUTIVO', SUPERVISOR: r.EJECUTIVO as string }); });

  const uniqueMap = new Map<string, DataRow>();
  unified.forEach(row => {
    const mes = normalizeMonth(row.MES);
    const cliente = cleanString(row.CLIENTE as string);
    const supervisor = ((row.SUPERVISOR as string) || '').trim().toUpperCase();
    const key = `${mes}|${supervisor}|${cliente}`;
    const isCurrentDone = isRealized(row.STATUS);
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, row);
    } else {
      const existing = uniqueMap.get(key)!;
      if (isCurrentDone && !isRealized(existing.STATUS)) uniqueMap.set(key, row);
    }
  });
  return Array.from(uniqueMap.values());
}

export function computeBalanceData(data: DataRow[], unit: TimeUnit, supFilter: string, field: 'SUPERVISOR' | 'EJECUTIVO'): BalanceRow[] {
  const unified = data.map(r => ({
    ...r,
    RESPONSIBLE: ((r[field] as string) || '').trim().toUpperCase(),
  }));

  const filtered = supFilter === 'all' ? unified : unified.filter(r => r.RESPONSIBLE === supFilter);

  const grouped: Record<string, { programmed: number; gestiones: number }> = {};
  filtered.forEach(row => {
    if (!row.FECHA) return;
    const period = getKeyForUnit(row.FECHA, unit);
    const resp = row.RESPONSIBLE;
    const key = `${period}|${resp}`;
    if (!grouped[key]) grouped[key] = { programmed: 0, gestiones: 0 };
    if (isProgrammed(row.STATUS)) grouped[key].programmed++;
    if (isRealized(row.STATUS)) grouped[key].gestiones++;
  });

  return Object.entries(grouped).map(([key, val]) => {
    const [period, responsible] = key.split('|');
    const missing = Math.max(0, val.programmed - val.gestiones);
    const percentage = val.programmed > 0 ? Math.round((val.gestiones / val.programmed) * 100) : 0;
    return { period, responsible, programmed: val.programmed, gestiones: val.gestiones, missing, percentage };
  }).sort((a, b) => a.period.localeCompare(b.period) || a.responsible.localeCompare(b.responsible));
}

export function getYears(supData: DataRow[], ejecData: DataRow[]): string[] {
  const years = new Set<string>();
  supData.forEach(d => { if (d.AÑO) years.add(d.AÑO.toString()); });
  ejecData.forEach(d => { if (d.AÑO) years.add(d.AÑO.toString()); });
  return Array.from(years).sort();
}

export function getAllResponsibles(supData: DataRow[], ejecData: DataRow[]): string[] {
  const set = new Set<string>();
  supData.forEach(r => { const s = (r.SUPERVISOR as string || '').trim().toUpperCase(); if (s) set.add(s); });
  ejecData.forEach(r => { const e = (r.EJECUTIVO as string || '').trim().toUpperCase(); if (e) set.add(e); });
  return Array.from(set).sort();
}
