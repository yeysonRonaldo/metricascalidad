import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getDedupedData, isRealized, getTaskType, capitalizeWords, getAllResponsibles } from '@/lib/dataProcessing';
import { Search, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ReportSection() {
  const { supData, ejecData, yearFilter, monthFilter } = useAppContext();
  const [search, setSearch] = useState('');
  const [supFilter, setSupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const responsibles = useMemo(() => getAllResponsibles(supData, ejecData), [supData, ejecData]);

  const filteredData = useMemo(() => {
    let data = getDedupedData(supData, ejecData, yearFilter, monthFilter);
    const searchLower = search.toLowerCase();
    data = data.filter(row => {
      const client = ((row.CLIENTE as string) || '').toLowerCase();
      const branch = ((row.SUCURSAL as string) || '').toLowerCase();
      if (searchLower && !client.includes(searchLower) && !branch.includes(searchLower)) return false;
      if (supFilter !== 'all' && ((row.SUPERVISOR as string) || '').trim().toUpperCase() !== supFilter) return false;
      const isDone = isRealized(row.STATUS);
      if (statusFilter === 'pending' && isDone) return false;
      if (statusFilter === 'done' && !isDone) return false;
      return true;
    });
    return data;
  }, [supData, ejecData, yearFilter, monthFilter, search, supFilter, statusFilter]);

  const pendingCount = filteredData.filter(r => !isRealized(r.STATUS)).length;
  const displayData = filteredData.slice(0, 500);

  const exportTable = () => {
    if (!filteredData.length) return;
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte_Filtrado');
    XLSX.writeFile(wb, 'Reporte_Cumplimiento.xlsx');
  };

  return (
    <div className="metric-card flex flex-col h-full">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 border-b border-border pb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">📋 Lista de Cumplimiento</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Mostrando <b>{filteredData.length}</b> visitas únicas. <span className="text-warning font-bold ml-2">{pendingCount} Pendientes</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="relative grow xl:grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar Cliente..." className="w-full xl:w-64 pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm bg-card" />
          </div>
          <select value={supFilter} onChange={e => setSupFilter(e.target.value)} className="py-2 pl-3 pr-8 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-card">
            <option value="all">Todos los Responsables</option>
            {responsibles.map(r => <option key={r} value={r}>{capitalizeWords(r)}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="py-2 pl-3 pr-8 border border-border rounded-lg text-sm font-bold text-primary bg-primary/5 focus:ring-2 focus:ring-primary">
            <option value="all">Todo el Estatus</option>
            <option value="pending">⚠️ Solo Pendientes</option>
            <option value="done">✅ Solo Realizados</option>
          </select>
          <button onClick={exportTable} className="bg-success hover:bg-success/90 text-success-foreground px-4 py-2 rounded-lg text-sm font-bold shadow transition flex items-center gap-2">
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto custom-scroll border border-border rounded-lg">
        <table className="min-w-full divide-y divide-border relative">
          <thead className="bg-secondary sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Cliente / Sucursal</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Responsable</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-muted-foreground uppercase">Estatus / Gestión</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Observaciones</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border/50">
            {displayData.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground italic">No se encontraron registros.</td></tr>
            ) : displayData.map((row, i) => {
              const isReal = isRealized(row.STATUS);
              const badgeClass = isReal ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20';
              return (
                <tr key={i} className="hover:bg-secondary/50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{(row.FECHA as string) || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="font-bold text-foreground">{(row.CLIENTE as string) || '-'}</div>
                    <div className="text-xs text-muted-foreground">{(row.SUCURSAL as string) || ''}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{capitalizeWords(row.SUPERVISOR as string)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${badgeClass} items-center gap-1`}>
                      {isReal ? '✅' : '⏳'} {getTaskType(row)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground italic truncate max-w-xs">{(row['TIPO DE VISITA'] as string) || (row.OBSERVACIONES as string) || '-'}</td>
                </tr>
              );
            })}
            {filteredData.length > 500 && (
              <tr><td colSpan={5} className="px-6 py-3 text-center text-xs font-bold text-muted-foreground bg-secondary">... Visualizando 500 de {filteredData.length}. Exporta para ver todo. ...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
