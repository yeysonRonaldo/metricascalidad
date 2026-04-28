import { useState, useMemo, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { filterByYearMonth, computeSupervisorStats, computeMonthlyData, groupDataByTime, isProgrammed, isRealized } from '@/lib/dataProcessing';
import KPICards from '@/components/KPICards';
import GoalCards from '@/components/GoalCards';
import { MonthlyBarChart, ParticipationDoughnut, SupervisorStackChart, TimeLineChart, GestionPieChart, IndividualGestionPies } from '@/components/Charts';
import type { TimeUnit } from '@/types/metrics';
import { exportDashboardToPdf } from '@/lib/exportPdf';
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';

interface DashboardSectionProps {
  type: 'SUPERVISOR' | 'EJECUTIVO';
}

export default function DashboardSection({ type }: DashboardSectionProps) {
  const { supData, ejecData, yearFilter, monthFilter } = useAppContext();
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('month');
  const [exporting, setExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const rawData = type === 'SUPERVISOR' ? supData : ejecData;
  const field = type === 'SUPERVISOR' ? 'SUPERVISOR' as const : 'EJECUTIVO' as const;
  const filteredData = useMemo(() => filterByYearMonth(rawData, yearFilter, monthFilter), [rawData, yearFilter, monthFilter]);

  const { stats, gestionGlobal, gestionIndividual } = useMemo(() => computeSupervisorStats(filteredData, field), [filteredData, field]);
  const monthlyData = useMemo(() => computeMonthlyData(filteredData), [filteredData]);
  const timeData = useMemo(() => groupDataByTime(filteredData, timeUnit), [filteredData, timeUnit]);

  const metaCount = filteredData.filter(r => isProgrammed(r.STATUS)).length;
  const realizedCount = filteredData.filter(r => isRealized(r.STATUS)).length;
  const missingCount = Math.max(0, metaCount - realizedCount);
  const realizedPct = metaCount > 0 ? Math.round((realizedCount / metaCount) * 100) : 0;

  let topPerson = '---';
  let topCount = 0;
  for (const [name, s] of Object.entries(stats)) {
    if (s.realized > topCount) { topCount = s.realized; topPerson = name; }
  }

  const sectionTitle = type === 'SUPERVISOR' ? 'Rendimiento de Supervisores' : 'Rendimiento de Ejecutivos';
  const icon = type === 'SUPERVISOR' ? '👔' : '💼';

  const handleExportPdf = async () => {
    if (!containerRef.current) return;
    setExporting(true);
    toast.info('Generando PDF...');
    try {
      const filterLabel = `${yearFilter === 'all' ? 'Todos' : yearFilter} - ${monthFilter === 'all' ? 'Todos los meses' : monthFilter}`;
      await exportDashboardToPdf(containerRef.current, `${sectionTitle} (${filterLabel})`);
      toast.success('PDF descargado ✅');
    } catch (err) {
      console.error(err);
      toast.error('Error al generar el PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-8 pb-10">
      <div className="border-b-2 border-primary/10 pb-2 mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{icon} {sectionTitle}</h1>
        <button
          onClick={handleExportPdf}
          disabled={exporting}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition active:scale-95 disabled:opacity-50 print:hidden"
        >
          <FileDown className="w-4 h-4" />
          {exporting ? 'Generando...' : 'Exportar PDF'}
        </button>
      </div>

      <KPICards metaCount={metaCount} realizedCount={realizedCount} missingCount={missingCount} realizedPct={realizedPct} topPerson={topPerson} topLabel={type === 'SUPERVISOR' ? 'Supervisor Top' : 'Ejecutivo Top'} />
      <GoalCards stats={stats} data={filteredData} field={field} />
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
