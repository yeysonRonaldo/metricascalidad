import React, { useRef, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { getYears, MONTH_NAMES } from '@/lib/dataProcessing';
import { FileSpreadsheet, BarChart3, Briefcase, Scale, ListChecks, LogOut, RefreshCw, UserPlus } from 'lucide-react';
import type { TabName } from '@/types/metrics';
import AddUserDialog from '@/components/AddUserDialog';

const tabs: { id: TabName; label: string; icon: React.ReactNode; field: 'sup' | 'ejec' | 'both' }[] = [
  { id: 'dashboard', label: 'Supervisores', icon: <BarChart3 className="w-4 h-4" />, field: 'sup' },
  { id: 'ejecutivos', label: 'Ejecutivos', icon: <Briefcase className="w-4 h-4" />, field: 'ejec' },
  { id: 'balance', label: 'Balance', icon: <Scale className="w-4 h-4" />, field: 'both' },
  { id: 'report', label: 'Lista', icon: <ListChecks className="w-4 h-4" />, field: 'both' },
];

export default function Header() {
  const { activeTab, setActiveTab, yearFilter, setYearFilter, monthFilter, setMonthFilter, handleFileUpload, syncFromGoogleSheets, supData, ejecData, hasData, lastSync, isLoading } = useAppContext();
  const { user, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showAddUser, setShowAddUser] = useState(false);
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
    <>
      <nav className="header-gradient text-primary-foreground px-4 py-2 shadow-xl shrink-0 z-40">
        <div className="container mx-auto">
          {/* Top row: Logo + Actions */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="bg-primary-foreground/20 p-1.5 rounded-lg">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold tracking-tight">Métricas Calidad</h1>
            </div>

            <div className="flex items-center gap-1.5">
              {lastSync && (
                <span className="text-[10px] text-primary-foreground/60 hidden sm:inline mr-1">
                  {lastSync.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })} {lastSync.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button onClick={() => syncFromGoogleSheets()} disabled={isLoading} className="bg-primary-foreground/15 hover:bg-primary-foreground/25 p-2 rounded-lg text-sm transition active:scale-95 disabled:opacity-50" title="Sincronizar desde Google Sheets">
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => fileRef.current?.click()} className="bg-primary-foreground/15 hover:bg-primary-foreground/25 px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 active:scale-95">
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Cargar</span>
              </button>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={onFile} className="hidden" />
              {user && (
                <>
                  <button onClick={() => setShowAddUser(true)} className="bg-primary-foreground/15 hover:bg-primary-foreground/25 p-2 rounded-lg text-sm transition active:scale-95" title="Agregar usuario">
                    <UserPlus className="w-4 h-4" />
                  </button>
                  <button onClick={signOut} className="bg-primary-foreground/15 hover:bg-primary-foreground/25 p-2 rounded-lg text-sm transition active:scale-95 text-red-200 hover:text-red-100" title="Cerrar sesión">
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Bottom row: Tabs + Filters */}
          {hasData && (
            <div className="flex items-center justify-between gap-3 mt-2">
              <div className="flex space-x-0.5 bg-primary-foreground/10 p-0.5 rounded-lg">
                {visibleTabs.map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)} className={`nav-tab ${activeTab === t.id ? 'active-tab' : ''}`}>
                    {t.icon}
                    <span className="hidden md:inline ml-1.5 text-xs">{t.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="bg-card text-foreground border border-primary-foreground/20 rounded-lg px-2 py-1 text-xs focus:outline-none cursor-pointer shadow-sm">
                  <option value="all">Todos los años</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="bg-card text-foreground border border-primary-foreground/20 rounded-lg px-2 py-1 text-xs focus:outline-none cursor-pointer shadow-sm">
                  <option value="all">Todos los meses</option>
                  {MONTH_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </nav>

      <AddUserDialog open={showAddUser} onOpenChange={setShowAddUser} />
    </>
  );
}
