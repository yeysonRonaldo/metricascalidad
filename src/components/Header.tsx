import React, { useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { getYears, MONTH_NAMES } from '@/lib/dataProcessing';
import { FileSpreadsheet, BarChart3, Briefcase, Scale, ListChecks, LogOut, RefreshCw } from 'lucide-react';
import type { TabName } from '@/types/metrics';

const tabs: { id: TabName; label: string; icon: React.ReactNode; field: 'sup' | 'ejec' | 'both' }[] = [
  { id: 'dashboard', label: 'Dash. Sup', icon: <BarChart3 className="w-4 h-4" />, field: 'sup' },
  { id: 'ejecutivos', label: 'Dash. Ejec', icon: <Briefcase className="w-4 h-4" />, field: 'ejec' },
  { id: 'balance', label: 'Balance', icon: <Scale className="w-4 h-4" />, field: 'both' },
  { id: 'report', label: 'Lista', icon: <ListChecks className="w-4 h-4" />, field: 'both' },
];

export default function Header() {
  const { activeTab, setActiveTab, yearFilter, setYearFilter, monthFilter, setMonthFilter, handleFileUpload, loadFromFirestore, supData, ejecData, hasData } = useAppContext();
  const { user, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const years = getYears(supData, ejecData);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  const visibleTabs = tabs.filter(t => {
    if (!hasData) return false;
    if (t.field === 'sup') return supData.length > 0;
    if (t.field === 'ejec') return ejecData.length > 0;
    return true;
  });

  return (
    <nav className="header-gradient text-primary-foreground p-4 shadow-xl shrink-0 z-40">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary-foreground/20 p-2 rounded-lg">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Métricas Calidad</h1>
              <p className="text-xs opacity-80">Monitor de Supervisión & Ejecutivos</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-primary-foreground/10 p-2 rounded-xl backdrop-blur-sm">
            <button onClick={() => loadFromFirestore()} className="bg-card/80 text-primary hover:bg-card px-3 py-2 rounded-lg text-sm font-bold shadow-md transition flex items-center gap-2 active:scale-95" title="Recargar desde Firebase">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => fileRef.current?.click()} className="bg-card text-primary hover:bg-card/90 px-5 py-2 rounded-lg text-sm font-bold shadow-md transition flex items-center gap-2 active:scale-95">
              <FileSpreadsheet className="w-5 h-5 text-success" />
              <span>Cargar Datos</span>
            </button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={onFile} className="hidden" />
            {user && (
              <button onClick={signOut} className="bg-card/80 text-destructive hover:bg-card px-3 py-2 rounded-lg text-sm font-bold shadow-md transition flex items-center gap-2 active:scale-95" title="Cerrar sesión">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {hasData && (
          <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div className="flex space-x-1 bg-foreground/20 p-1 rounded-lg">
              {visibleTabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className={`nav-tab ${activeTab === t.id ? 'active-tab' : ''}`}>
                  {t.icon}
                  <span className="hidden md:inline ml-2">{t.label}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="bg-foreground/20 text-primary-foreground border border-primary-foreground/20 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-foreground/50 cursor-pointer">
                <option value="all">Todos los años</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="bg-foreground/20 text-primary-foreground border border-primary-foreground/20 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-foreground/50 cursor-pointer">
                <option value="all">Todos los meses</option>
                {MONTH_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
