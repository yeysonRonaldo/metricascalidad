import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, LabelList } from 'recharts';
import { PALETTE, capitalizeWords, MONTH_NAMES } from '@/lib/dataProcessing';
import type { SupervisorStats, GestionStats, TimeUnit } from '@/types/metrics';

interface MonthlyBarProps {
  data: Record<string, { realized: number; other: number; meta: number }>;
}

export function MonthlyBarChart({ data }: MonthlyBarProps) {
  const chartData = MONTH_NAMES.map(m => ({
    name: m.substring(0, 3),
    Gestiones: data[m]?.realized || 0,
    Faltante: data[m]?.other || 0,
  }));
  return (
    <div className="metric-card chart-block">
      <h2 className="text-lg font-bold text-foreground mb-4 border-b border-border pb-2">📊 Resumen Mensual</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip />
          <Legend />
          <Bar dataKey="Gestiones" stackId="a" fill={PALETTE.green} radius={[4, 4, 0, 0]}>
            <LabelList dataKey="Gestiones" position="inside" fill="#fff" fontSize={10} formatter={(v: number) => v > 0 ? v : ''} />
          </Bar>
          <Bar dataKey="Faltante" stackId="a" fill={PALETTE.orange} radius={[4, 4, 0, 0]}>
            <LabelList dataKey="Faltante" position="inside" fill="#fff" fontSize={10} formatter={(v: number) => v > 0 ? v : ''} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DoughnutProps {
  stats: SupervisorStats;
}

export function ParticipationDoughnut({ stats }: DoughnutProps) {
  const data = Object.entries(stats).map(([name, s]) => ({ name: capitalizeWords(name), value: s.meta }));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="metric-card chart-block">
      <h2 className="text-lg font-bold text-foreground mb-4 border-b border-border pb-2">🥧 Participación Total (Meta)</h2>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine fontSize={12}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE.multi[i % PALETTE.multi.length]} />)}
          </Pie>
          <Tooltip formatter={(value: number) => [`${value} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`, 'Meta']} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface StackBarProps {
  stats: SupervisorStats;
}

export function SupervisorStackChart({ stats }: StackBarProps) {
  const data = Object.keys(stats).sort().map(name => ({
    name: capitalizeWords(name),
    Gestiones: stats[name].realized,
    Faltante: Math.max(0, stats[name].meta - stats[name].realized),
  }));
  return (
    <div className="metric-card chart-block">
      <h2 className="text-xl font-bold text-foreground mb-6">👥 Balance de Carga</h2>
      <ResponsiveContainer width="100%" height={Math.max(300, data.length * 50)}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" fontSize={12} />
          <YAxis type="category" dataKey="name" fontSize={12} width={120} />
          <Tooltip />
          <Legend />
          <Bar dataKey="Gestiones" stackId="a" fill={PALETTE.green} radius={[0, 4, 4, 0]}>
            <LabelList dataKey="Gestiones" position="inside" fill="#fff" fontSize={11} formatter={(v: number) => v > 0 ? v : ''} />
          </Bar>
          <Bar dataKey="Faltante" stackId="a" fill={PALETTE.orange} radius={[0, 4, 4, 0]}>
            <LabelList dataKey="Faltante" position="inside" fill="#fff" fontSize={11} formatter={(v: number) => v > 0 ? v : ''} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TimeLineProps {
  data: Record<string, { realized: number; meta: number }>;
  title: string;
  unit: TimeUnit;
  onUnitChange: (u: TimeUnit) => void;
}

export function TimeLineChart({ data, title, unit, onUnitChange }: TimeLineProps) {
  const sortedKeys = Object.keys(data).sort();
  const chartData = sortedKeys.map(k => ({
    name: k,
    Gestiones: data[k].realized,
    Meta: data[k].meta,
  }));
  const units: TimeUnit[] = ['day', 'week', 'month', 'year'];
  const unitLabels: Record<TimeUnit, string> = { day: 'Día', week: 'Semana', month: 'Mes', year: 'Año' };

  return (
    <div className="metric-card chart-block">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <div className="bg-secondary p-1 rounded-lg flex space-x-1">
          {units.map(u => (
            <button key={u} onClick={() => onUnitChange(u)} className={`time-btn ${unit === u ? 'active' : 'text-muted-foreground'}`}>
              {unitLabels[u]}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" fontSize={11} angle={-20} textAnchor="end" height={60} />
          <YAxis fontSize={12} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="Gestiones" stroke={PALETTE.green} strokeWidth={2} dot={{ r: 4 }}>
            <LabelList dataKey="Gestiones" position="top" fontSize={9} fill={PALETTE.green} />
          </Line>
          <Line type="monotone" dataKey="Meta" stroke={PALETTE.blue} strokeWidth={2} dot={{ r: 4 }}>
            <LabelList dataKey="Meta" position="top" fontSize={9} fill={PALETTE.blue} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface GestionPieProps {
  data: GestionStats;
  title: string;
}

export function GestionPieChart({ data, title }: GestionPieProps) {
  const chartData = Object.entries(data).map(([name, value]) => ({ name, value }));
  if (chartData.length === 0) return null;
  const total = chartData.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="metric-card border-2 border-primary/10 chart-block">
      <h3 className="text-lg font-bold text-foreground text-center mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value, percent }) => `${name} ${value} (${(percent * 100).toFixed(0)}%)`} labelLine fontSize={10}>
            {chartData.map((_, i) => <Cell key={i} fill={PALETTE.multi[i % PALETTE.multi.length]} />)}
          </Pie>
          <Tooltip formatter={(value: number) => [`${value} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`, '']} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface IndividualPiesProps {
  data: Record<string, GestionStats>;
}

export function IndividualGestionPies({ data }: IndividualPiesProps) {
  const people = Object.keys(data).sort();
  if (people.length === 0) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {people.map(person => {
        const stats = data[person];
        if (Object.keys(stats).length === 0) return null;
        const chartData = Object.entries(stats).map(([name, value]) => ({ name, value }));
        return (
          <div key={person} className="metric-card flex flex-col border border-border chart-block">
            <h3 className="text-sm font-bold text-foreground border-b border-border pb-2 mb-3 text-center truncate">
              👤 {capitalizeWords(person)}
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ value, percent }) => `${value} (${(percent * 100).toFixed(0)}%)`} labelLine={false} fontSize={10}>
                  {chartData.map((_, i) => <Cell key={i} fill={PALETTE.multi[i % PALETTE.multi.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}
