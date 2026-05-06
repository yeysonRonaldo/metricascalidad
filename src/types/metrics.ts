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
  // Plan de Llamadas
  FECHA_LLAMADA?: string;
  FECHA_LLAMADA_ORIGINAL?: string;
  MOTIVO_CAMBIO_FECHA?: string;
  PLAGA?: boolean | string;
  MEJORA_MANTENIMIENTO?: boolean | string;
  MEJORA_LIMPIEZA?: boolean | string;
  OBSERVACIONES_LLAMADA?: string;
  LLAMADA_REALIZADA?: boolean | string;
  FECHA_LLAMADA_REALIZADA?: string;
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
export type TabName = 'dashboard' | 'ejecutivos' | 'ejecutivos2' | 'plan' | 'balance' | 'report' | 'datos' | 'admin';
