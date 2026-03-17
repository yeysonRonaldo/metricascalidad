import { capitalizeWords } from '@/lib/dataProcessing';
import type { SupervisorStats } from '@/types/metrics';

interface KPICardsProps {
  metaCount: number;
  realizedCount: number;
  missingCount: number;
  realizedPct: number;
  topPerson: string;
  topLabel: string;
}

export default function KPICards({ metaCount, realizedCount, missingCount, realizedPct, topPerson, topLabel }: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="metric-card border-l-8 border-l-info">
        <div className="text-info text-xs font-bold uppercase tracking-wider mb-1">Meta Total (Programados)</div>
        <div className="text-4xl font-extrabold text-foreground">{metaCount}</div>
        <div className="text-xs text-muted-foreground mt-2 font-medium">Registros con estatus "Programado"</div>
      </div>
      <div className="metric-card border-l-8 border-l-success">
        <div className="text-success text-xs font-bold uppercase tracking-wider mb-1">Gestiones Realizadas</div>
        <div className="text-4xl font-extrabold text-foreground">{realizedCount}</div>
        <span className="inline-block bg-success/10 text-success text-xs px-2 py-1 rounded-full mt-2 font-bold">{realizedPct}% de Meta</span>
      </div>
      <div className="metric-card border-l-8 border-l-warning">
        <div className="text-warning text-xs font-bold uppercase tracking-wider mb-1">Faltan para Meta</div>
        <div className="text-4xl font-extrabold text-foreground">{missingCount}</div>
        <div className="text-xs text-muted-foreground mt-2 font-medium">Meta Total - Realizadas</div>
      </div>
      <div className="metric-card border-l-8 border-l-accent">
        <div className="text-accent text-xs font-bold uppercase tracking-wider mb-1">{topLabel}</div>
        <div className="text-xl font-extrabold text-foreground truncate leading-tight">{capitalizeWords(topPerson) || '---'}</div>
        <div className="text-xs text-accent/70 mt-2 font-medium">Más activo en el periodo</div>
      </div>
    </div>
  );
}
