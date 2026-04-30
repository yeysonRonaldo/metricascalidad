export interface DataRow {
  FECHA?: string;
  AÑO?: string;
  MES?: string;
  CLIENTE?: string;
  SUCURSAL?: string;
  SUPERVISOR?: string;
  EJECUTIVO?: string;
  STATUS?: string;
  'TIPO DE VISITA'?: string;
  OBSERVACIONES?: string;
  _ROLE?: 'SUPERVISOR' | 'EJECUTIVO';
  [key: string]: unknown;
}

export interface SupervisorStats {
  [name: string]: { meta: number; realized: number };
}

export interface GestionStats {
  [type: string]: number;
}

export interface GestionIndividual {
  [person: string]: GestionStats;
}

export interface MonthData {
  realized: number;
  other: number;
  meta: number;
}

export interface BalanceRow {
  period: string;
  responsible: string;
  programmed: number;
  gestiones: number;
  missing: number;
  percentage: number;
}

export type TimeUnit = 'day' | 'week' | 'month' | 'year';
export type TabName = 'dashboard' | 'ejecutivos' | 'ejecutivos2' | 'balance' | 'report' | 'datos';
