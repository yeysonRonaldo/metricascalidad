import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { filterByYearMonth, computeSupervisorStats, computeMonthlyData, groupDataByTime } from '@/lib/dataProcessing';
import KPICards from '@/components/KPICards';
import GoalCards from '@/components/GoalCards';
import { MonthlyBarChart, ParticipationDoughnut, SupervisorStackChart, TimeLineChart, GestionPieChart, IndividualGestionPies } from '@/components/Charts';
import type { TimeUnit } from '@/types/metrics';

interface DashboardSectionProps {
  type: 'SUPERVISOR' | 'EJECUTIVO';
}

export default function DashboardSection({ type }: DashboardSectionProps) {
  const { supData, ejecData, yearFilter, monthFilter } = useAppContext();
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('month');

  const rawData = type === 'SUPERVISOR' ? supData : ejecData;
  const field = type === 'SUPERVISOR' ? 'SUPERVISOR' as const : 'EJECUTIVO' as const;
  const filteredData = useMemo(() => filterByYearMonth(rawData, yearFilter, monthFilter), [rawData, yearFilter, monthFilter]);

  const { stats, gestionGlobal, gestionIndividual } = useMemo(() => computeSupervisorStats(filteredData, field), [filteredData, field]);
  const monthlyData = useMemo(() => computeMonthlyData(filteredData), [filteredData]);
  const timeData = useMemo(() => groupDataByTime(filteredData, timeUnit), [filteredData, timeUnit]);

  const metaCount = filteredData.filter(r => r.STATUS && String(r.STATUS).toUpperCase().includes('PROGRAMADO')).length;
  const realizedCount = filteredData.filter(r => {
    const s = String(r.STATUS || '').toUpperCase();
    return s.includes('REALIZADO') || s.includes('EJECUTADO') || s.includes('ENVIADO') || s.includes('REUNI') || s.includes('SUPERVISI') || s === 'SI';
  }).length;
  const missingCount = Math.max(0, metaCount - realizedCount);
  const realizedPct = metaCount > 0 ? Math.round((realizedCount / metaCount) * 100) : 0;

  let topPerson = '---';
  let topCount = 0;
  for (const [name, s] of Object.entries(stats)) {
    if (s.realized > topCount) { topCount = s.realized; topPerson = name; }
  }

  const sectionTitle = type === 'SUPERVISOR' ? 'Rendimiento de Supervisores' : 'Rendimiento de Ejecutivos';
  const icon = type === 'SUPERVISOR' ? '👔' : '💼';

  return (
    <div className="space-y-8 pb-10">
      <div className="border-b-2 border-primary/10 pb-2 mb-4">
        <h1 className="text-2xl font-bold text-foreground">{icon} {sectionTitle}</h1>
      </div>

      <KPICards metaCount={metaCount} realizedCount={realizedCount} missingCount={missingCount} realizedPct={realizedPct} topPerson={topPerson} topLabel={type === 'SUPERVISOR' ? 'Supervisor Top' : 'Ejecutivo Top'} />
      <GoalCards stats={stats} />
      <TimeLineChart data={timeData} title="📈 Evolución de Visitas" unit={timeUnit} onUnitChange={setTimeUnit} />
      <SupervisorStackChart stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MonthlyBarChart data={monthlyData} />
        <ParticipationDoughnut stats={stats} />
      </div>

      <div className="mt-10 mb-4 border-b-2 border-primary/10 pb-2">
        <h2 className="text-2xl font-bold text-foreground">🔍 Desglose Exacto de Gestiones (Solo Realizados)</h2>
        <p className="text-sm text-muted-foreground mt-1">Gráficas circulares con el detalle de qué fue lo que hizo exactamente cada persona.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GestionPieChart data={gestionGlobal} title="🌐 Global Equipo" />
        <div className="lg:col-span-2">
          <IndividualGestionPies data={gestionIndividual} />
        </div>
      </div>
    </div>
  );
}
