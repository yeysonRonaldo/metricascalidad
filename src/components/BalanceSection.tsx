import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { filterByYearMonth, computeBalanceData, capitalizeWords, getAllResponsibles } from '@/lib/dataProcessing';
import type { TimeUnit } from '@/types/metrics';

export default function BalanceSection() {
  const { supData, ejecData, yearFilter, monthFilter } = useAppContext();
  const [unit, setUnit] = useState<TimeUnit>('month');
  const [supFilter, setSupFilter] = useState('all');

  const responsibles = useMemo(() => getAllResponsibles(supData, ejecData), [supData, ejecData]);

  const balanceData = useMemo(() => {
    const filteredSup = filterByYearMonth(supData, yearFilter, monthFilter);
    const filteredEjec = filterByYearMonth(ejecData, yearFilter, monthFilter).map(r => ({ ...r, SUPERVISOR: r.EJECUTIVO }));
    const all = [...filteredSup, ...filteredEjec];
    return computeBalanceData(all, unit, supFilter, 'SUPERVISOR');
  }, [supData, ejecData, yearFilter, monthFilter, unit, supFilter]);

  const units: TimeUnit[] = ['day', 'week', 'month', 'year'];
  const unitLabels: Record<TimeUnit, string> = { day: 'Día', week: 'Semana', month: 'Mes', year: 'Año' };

  return (
    <div className="metric-card flex flex-col h-full">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 border-b border-border pb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">⚖️ Tabla de Balance</h2>
          <p className="text-sm text-muted-foreground mt-1">Balance temporal de gestiones</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="bg-secondary p-1 rounded-lg flex space-x-1">
            {units.map(u => (
              <button key={u} onClick={() => setUnit(u)} className={`time-btn ${unit === u ? 'active' : 'text-muted-foreground'}`}>{unitLabels[u]}</button>
            ))}
          </div>
          <select value={supFilter} onChange={e => setSupFilter(e.target.value)} className="py-2 pl-3 pr-8 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-card">
            <option value="all">Todos los Responsables</option>
            {responsibles.map(r => <option key={r} value={r}>{capitalizeWords(r)}</option>)}
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-auto custom-scroll border border-border rounded-lg">
        <table className="min-w-full divide-y divide-border relative">
          <thead className="bg-secondary sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider bg-secondary">Período</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider bg-secondary">Responsable</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-info uppercase tracking-wider bg-info/5">Programados</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-success uppercase tracking-wider bg-success/5">Gestiones</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-warning uppercase tracking-wider bg-warning/5">Faltantes</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider bg-secondary">% Cump.</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border/50">
            {balanceData.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-muted-foreground italic">No se encontraron registros.</td></tr>
            ) : balanceData.map((row, i) => (
              <tr key={i} className="hover:bg-secondary/50 transition">
                <td className="px-6 py-4 text-sm font-medium text-foreground">{row.period}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{capitalizeWords(row.responsible)}</td>
                <td className="px-6 py-4 text-sm text-center font-bold text-info">{row.programmed}</td>
                <td className="px-6 py-4 text-sm text-center font-bold text-success">{row.gestiones}</td>
                <td className="px-6 py-4 text-sm text-center font-bold text-warning">{row.missing}</td>
                <td className="px-6 py-4 text-sm text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.percentage >= 80 ? 'bg-success/10 text-success' : row.percentage >= 50 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                    {row.percentage}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
