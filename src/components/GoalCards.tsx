import { capitalizeWords } from '@/lib/dataProcessing';
import type { SupervisorStats } from '@/types/metrics';

interface GoalCardsProps {
  stats: SupervisorStats;
}

export default function GoalCards({ stats }: GoalCardsProps) {
  const sorted = Object.keys(stats).sort();
  return (
    <div className="metric-card">
      <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
        🎯 Metas de Cumplimiento
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sorted.map(sup => {
          const s = stats[sup];
          const missing = Math.max(0, s.meta - s.realized);
          const pct = s.meta > 0 ? Math.round((s.realized / s.meta) * 100) : 0;
          const barColor = pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-destructive';
          return (
            <div key={sup} className="bg-secondary rounded-lg p-4 border border-border">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-foreground truncate max-w-[70%]" title={capitalizeWords(sup)}>{capitalizeWords(sup)}</h3>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${pct >= 100 ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{pct}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 mb-3">
                <div className={`${barColor} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>🏁 Meta: <b>{s.meta}</b></span>
                <span>✅ Gestiones: <b>{s.realized}</b></span>
              </div>
              <div className="mt-2 text-center text-xs font-bold py-1.5 rounded border bg-warning/10 text-warning border-warning/20">
                {missing === 0 ? <span className="text-success">¡Meta Cumplida! 🎉</span> : `Faltan para cumplir meta: ${missing}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
