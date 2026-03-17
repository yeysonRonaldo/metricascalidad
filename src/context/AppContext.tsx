import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { DataRow, TabName, TimeUnit } from '@/types/metrics';
import { convertDatesAndFill } from '@/lib/dataProcessing';
import { fetchVisitasData, saveSupData, saveEjecData } from '@/lib/firestoreService';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface AppState {
  supData: DataRow[];
  ejecData: DataRow[];
  activeTab: TabName;
  yearFilter: string;
  monthFilter: string;
  isLoading: boolean;
}

interface AppContextType extends AppState {
  setActiveTab: (tab: TabName) => void;
  setYearFilter: (y: string) => void;
  setMonthFilter: (m: string) => void;
  handleFileUpload: (file: File) => void;
  loadFromFirestore: () => Promise<void>;
  hasData: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be inside AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    supData: [],
    ejecData: [],
    activeTab: 'dashboard',
    yearFilter: '2026',
    monthFilter: 'all',
    isLoading: false,
  });

  const setActiveTab = useCallback((tab: TabName) => setState(s => ({ ...s, activeTab: tab })), []);
  const setYearFilter = useCallback((y: string) => setState(s => ({ ...s, yearFilter: y })), []);
  const setMonthFilter = useCallback((m: string) => setState(s => ({ ...s, monthFilter: m })), []);

  const processData = useCallback((supData: DataRow[], ejecData: DataRow[]) => {
    const years = new Set<string>();
    supData.forEach(d => { if (d.AÑO) years.add(d.AÑO.toString()); });
    ejecData.forEach(d => { if (d.AÑO) years.add(d.AÑO.toString()); });
    const sortedYears = Array.from(years).sort();
    const latestYear = sortedYears.length ? sortedYears[sortedYears.length - 1] : '2026';

    const defaultTab: TabName = supData.length > 0 ? 'dashboard' : 'ejecutivos';
    setState(s => ({
      ...s,
      supData,
      ejecData,
      yearFilter: latestYear,
      activeTab: defaultTab,
      isLoading: false,
    }));
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    setState(s => ({ ...s, isLoading: true }));
    const name = file.name.toLowerCase();

    if (name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = convertDatesAndFill(results.data as Record<string, unknown>[]);
          if (data.length > 0 && data[0].EJECUTIVO !== undefined) {
            processData(state.supData, data);
          } else {
            processData(data, state.ejecData);
          }
        },
        error: () => setState(s => ({ ...s, isLoading: false })),
      });
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          let newSup: DataRow[] = [];
          let newEjec: DataRow[] = [];

          const sheetBD = workbook.SheetNames.find(n => n.toUpperCase() === 'BD');
          if (sheetBD) {
            newSup = convertDatesAndFill(XLSX.utils.sheet_to_json(workbook.Sheets[sheetBD], { defval: '' }));
          }
          const sheetEjec = workbook.SheetNames.find(n => n.toUpperCase() === 'EJECUTIVOS');
          if (sheetEjec) {
            newEjec = convertDatesAndFill(XLSX.utils.sheet_to_json(workbook.Sheets[sheetEjec], { defval: '' }));
          }
          if (!sheetBD && !sheetEjec && workbook.SheetNames.length > 0) {
            const raw = convertDatesAndFill(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' }));
            if (raw.length > 0 && raw[0].EJECUTIVO !== undefined) newEjec = raw;
            else newSup = raw;
          }
          processData(newSup, newEjec);
        } catch {
          setState(s => ({ ...s, isLoading: false }));
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }, [state.supData, state.ejecData, processData]);

  const loadFromFirestore = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true }));
    try {
      const { supData, ejecData } = await fetchCatalogoMetricas();
      processData(supData, ejecData);
    } catch (err) {
      console.error('Error loading from Firestore:', err);
      setState(s => ({ ...s, isLoading: false }));
    }
  }, [processData]);

  // Auto-load from Firestore on mount
  useEffect(() => {
    loadFromFirestore();
  }, [loadFromFirestore]);

  const hasData = state.supData.length > 0 || state.ejecData.length > 0;

  return (
    <AppContext.Provider value={{ ...state, setActiveTab, setYearFilter, setMonthFilter, handleFileUpload, loadFromFirestore, hasData }}>
      {children}
    </AppContext.Provider>
  );
}
