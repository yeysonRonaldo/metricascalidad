import { useState, useMemo } from 'react';
import { capitalizeWords, isProgrammed, isRealized } from '@/lib/dataProcessing';
import type { SupervisorStats, DataRow } from '@/types/metrics';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CheckCircle2, Clock, ListChecks } from 'lucide-react';

interface GoalCardsProps {
  stats: SupervisorStats;
  data?: DataRow[];
  field?: 'SUPERVISOR' | 'EJECUTIVO';
}

export default function GoalCards({ stats, data = [], field = 'SUPERVISOR' }: GoalCardsProps) {
  const sorted = Object.keys(stats).sort();
  const [selected, setSelected] = useState<string | null>(null);

  const detail = useMemo(() => {
    if (!selected) return { programmed: [], realized: [], pending: [] };
    const rows = data.filter(r => String(r[field] ?? '').trim().toUpperCase() === selected);
    const programmed: DataRow[] = [];
    const realized: DataRow[] = [];
    const pending: DataRow[] = [];
    for (const r of rows) {
      const prog = isProgrammed(r.STATUS);
      const real = isRealized(r.STATUS);
      if (prog) programmed.push(r);
      if (real) realized.push(r);
      if (prog && !real) pending.push(r);
    }
    return { programmed, realized, pending };
  }, [selected, data, field]);

  return (
    <div className="metric-card">
      <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
        🎯 Metas de Cumplimiento
        <span className="text-xs font-normal text-muted-foreground">(haz clic en una tarjeta para ver el detalle)</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sorted.map(sup => {
          const s = stats[sup];
          const missing = Math.max(0, s.meta - s.realized);
          const pct = s.meta > 0 ? Math.round((s.realized / s.meta) * 100) : 0;
          const barColor = pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-destructive';
          return (
            <button
              key={sup}
              type="button"
              onClick={() => setSelected(sup)}
              className="text-left bg-secondary rounded-lg p-4 border border-border hover:border-primary hover:shadow-md transition cursor-pointer active:scale-[0.98]"
            >
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
            </button>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-primary" />
              {selected ? capitalizeWords(selected) : ''}
            </DialogTitle>
            <DialogDescription>
              Detalle de asignaciones y gestiones realizadas
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 my-2">
            <div className="bg-primary/10 rounded-lg p-3 text-center border border-primary/20">
              <div className="text-2xl font-bold text-primary">{detail.programmed.length}</div>
              <div className="text-xs text-muted-foreground">Asignados</div>
            </div>
            <div className="bg-success/10 rounded-lg p-3 text-center border border-success/20">
              <div className="text-2xl font-bold text-success">{detail.realized.length}</div>
              <div className="text-xs text-muted-foreground">Realizados</div>
            </div>
            <div className="bg-warning/10 rounded-lg p-3 text-center border border-warning/20">
              <div className="text-2xl font-bold text-warning">{detail.pending.length}</div>
              <div className="text-xs text-muted-foreground">Pendientes</div>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 space-y-4 pr-2">
            <DetailList
              title="Realizados"
              icon={<CheckCircle2 className="w-4 h-4 text-success" />}
              rows={detail.realized}
              tone="success"
            />
            <DetailList
              title="Pendientes (asignados sin realizar)"
              icon={<Clock className="w-4 h-4 text-warning" />}
              rows={detail.pending}
              tone="warning"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailList({ title, icon, rows, tone }: { title: string; icon: React.ReactNode; rows: DataRow[]; tone: 'success' | 'warning' }) {
  if (rows.length === 0) {
    return (
      <div>
        <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">{icon}{title} (0)</h4>
        <p className="text-xs text-muted-foreground italic px-2">Sin registros</p>
      </div>
    );
  }
  const borderTone = tone === 'success' ? 'border-l-success' : 'border-l-warning';
  return (
    <div>
      <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">{icon}{title} ({rows.length})</h4>
      <div className="space-y-1.5">
        {rows.map((r, idx) => (
          <div key={idx} className={`bg-secondary/50 border border-border border-l-4 ${borderTone} rounded px-3 py-2 text-xs`}>
            <div className="flex justify-between items-start gap-2 flex-wrap">
              <div className="font-medium text-foreground">
                {capitalizeWords(String(r.CLIENTE ?? '—'))}
                {r.SUCURSAL ? <span className="text-muted-foreground font-normal"> · {capitalizeWords(String(r.SUCURSAL))}</span> : null}
              </div>
              <div className="text-muted-foreground whitespace-nowrap">
                {r.FECHA ? String(r.FECHA) : ''} {r.MES ? `· ${r.MES}` : ''}
              </div>
            </div>
            <div className="mt-0.5 text-muted-foreground">
              <span className="font-medium">Status:</span> {String(r.STATUS ?? '—')}
              {r['TIPO DE VISITA'] ? <span> · <span className="font-medium">Tipo:</span> {String(r['TIPO DE VISITA'])}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
