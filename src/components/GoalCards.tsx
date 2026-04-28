import { useState, useMemo } from 'react';
import { capitalizeWords, isProgrammed, isRealized } from '@/lib/dataProcessing';
import type { SupervisorStats, DataRow } from '@/types/metrics';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CheckCircle2, Clock, ListChecks, Users } from 'lucide-react';

interface GoalCardsProps {
  stats: SupervisorStats;
  data?: DataRow[];
  field?: 'SUPERVISOR' | 'EJECUTIVO';
}

type FilterTab = 'all' | 'programmed' | 'realized' | 'pending';

export default function GoalCards({ stats, data = [], field = 'SUPERVISOR' }: GoalCardsProps) {
  const sorted = Object.keys(stats).sort();
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>('all');

  const detail = useMemo(() => {
    if (!selected) return { all: [], programmed: [], realized: [], pending: [] };
    const all = data.filter(r => String(r[field] ?? '').trim().toUpperCase() === selected);
    const programmed: DataRow[] = [];
    const realized: DataRow[] = [];
    const pending: DataRow[] = [];
    for (const r of all) {
      const prog = isProgrammed(r.STATUS);
      const real = isRealized(r.STATUS);
      if (prog) programmed.push(r);
      if (real) realized.push(r);
      if (prog && !real) pending.push(r);
    }
    return { all, programmed, realized, pending };
  }, [selected, data, field]);

  const visibleRows =
    tab === 'all' ? detail.all :
    tab === 'programmed' ? detail.programmed :
    tab === 'realized' ? detail.realized :
    detail.pending;

  const openCard = (sup: string) => { setSelected(sup); setTab('all'); };

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
              onClick={() => openCard(sup)}
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
              Haz clic en una tarjeta para filtrar el detalle. Total de registros: <b>{detail.all.length}</b>
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-4 gap-2 my-2">
            <SummaryCard active={tab === 'all'} onClick={() => setTab('all')} value={detail.all.length} label="Todos" tone="muted" icon={<Users className="w-4 h-4" />} />
            <SummaryCard active={tab === 'programmed'} onClick={() => setTab('programmed')} value={detail.programmed.length} label="Asignados" tone="primary" icon={<ListChecks className="w-4 h-4" />} />
            <SummaryCard active={tab === 'realized'} onClick={() => setTab('realized')} value={detail.realized.length} label="Realizados" tone="success" icon={<CheckCircle2 className="w-4 h-4" />} />
            <SummaryCard active={tab === 'pending'} onClick={() => setTab('pending')} value={detail.pending.length} label="Pendientes" tone="warning" icon={<Clock className="w-4 h-4" />} />
          </div>

          <div className="overflow-y-auto flex-1 pr-2">
            {visibleRows.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-8">Sin registros en esta categoría</p>
            ) : (
              <div className="space-y-1.5">
                {visibleRows.map((r, idx) => {
                  const real = isRealized(r.STATUS);
                  const prog = isProgrammed(r.STATUS);
                  const tone = real ? 'border-l-success' : prog ? 'border-l-warning' : 'border-l-muted-foreground';
                  return (
                    <div key={idx} className={`bg-secondary/50 border border-border border-l-4 ${tone} rounded px-3 py-2 text-xs`}>
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
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ active, onClick, value, label, tone, icon }: {
  active: boolean; onClick: () => void; value: number; label: string;
  tone: 'muted' | 'primary' | 'success' | 'warning'; icon: React.ReactNode;
}) {
  const toneMap = {
    muted: { bg: 'bg-muted', text: 'text-foreground', border: 'border-muted-foreground/20', ring: 'ring-muted-foreground' },
    primary: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', ring: 'ring-primary' },
    success: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', ring: 'ring-success' },
    warning: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', ring: 'ring-warning' },
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${toneMap.bg} rounded-lg p-3 text-center border ${toneMap.border} transition active:scale-95 hover:shadow ${active ? `ring-2 ${toneMap.ring}` : 'opacity-80 hover:opacity-100'}`}
    >
      <div className={`flex items-center justify-center gap-1 ${toneMap.text}`}>
        {icon}
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </button>
  );
}
