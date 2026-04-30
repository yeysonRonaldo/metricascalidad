import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { DataRow, TabName, TimeUnit } from '@/types/metrics';
import { convertDatesAndFill, isRealized, isProgrammed } from '@/lib/dataProcessing';
import { fetchVisitasData, saveSupData, saveEjecData, saveEjecPendientesData, updateRowInFirestore, deleteRowFromFirestore, deleteRowsBatchFromFirestore } from '@/lib/firestoreService';
import { fetchFromGoogleSheets } from '@/lib/googleSheetsService';
import { toast } from 'sonner';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface AppState {
  supData: DataRow[];
  ejecData: DataRow[];
  ejecPendientesData: DataRow[];
  activeTab: TabName;
  yearFilter: string;
  monthFilter: string;
  isLoading: boolean;
  lastSync: Date | null;
}

interface AppContextType extends AppState {
  setActiveTab: (tab: TabName) => void;
  setYearFilter: (y: string) => void;
  setMonthFilter: (m: string) => void;
  handleFileUpload: (file: File) => void;
  loadFromFirestore: () => Promise<void>;
  syncFromGoogleSheets: () => Promise<void>;
  updateRow: (type: 'sup' | 'ejec' | 'ejec_pend', index: number, field: string, value: string) => Promise<void>;
  deleteRow: (type: 'sup' | 'ejec' | 'ejec_pend', index: number) => Promise<void>;
  deleteRowsBulk: (type: 'sup' | 'ejec' | 'ejec_pend', indices: number[]) => Promise<void>;
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
    ejecPendientesData: [],
    activeTab: 'dashboard',
    yearFilter: '2026',
    monthFilter: 'all',
    isLoading: false,
    lastSync: null,
  });

  const setActiveTab = useCallback((tab: TabName) => setState(s => ({ ...s, activeTab: tab })), []);
  const setYearFilter = useCallback((y: string) => setState(s => ({ ...s, yearFilter: y })), []);
  const setMonthFilter = useCallback((m: string) => setState(s => ({ ...s, monthFilter: m })), []);

  const processData = useCallback((supData: DataRow[], ejecData: DataRow[], ejecPendientesData: DataRow[] = []) => {
    const years = new Set<string>();
    supData.forEach(d => { if (d.AÑO) years.add(d.AÑO.toString()); });
    ejecData.forEach(d => { if (d.AÑO) years.add(d.AÑO.toString()); });
    const sortedYears = Array.from(years).sort();
    const latestYear = sortedYears.length
      ? sortedYears[sortedYears.length - 1]
      : (supData.length > 0 || ejecData.length > 0 ? 'all' : '2026');

    const defaultTab: TabName = supData.length > 0 ? 'dashboard' : 'ejecutivos';
    setState(s => ({
      ...s,
      supData,
      ejecData,
      ejecPendientesData,
      yearFilter: latestYear,
      activeTab: defaultTab,
      isLoading: false,
      lastSync: new Date(),
    }));
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    setState(s => ({ ...s, isLoading: true }));
    const name = file.name.toLowerCase();

    const processAndSave = (sup: DataRow[], ejec: DataRow[]) => {
      processData(sup, ejec, state.ejecPendientesData);
      // Save to Firestore in background
      const promises: Promise<void>[] = [];
      if (sup.length > 0) promises.push(saveSupData(sup));
      if (ejec.length > 0) promises.push(saveEjecData(ejec));
      Promise.all(promises)
        .then(() => console.log('Datos guardados en Firestore ✅'))
        .catch(err => console.error('Error guardando en Firestore:', err));
    };

    if (name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = convertDatesAndFill(results.data as Record<string, unknown>[]);
          if (data.length > 0 && data[0].EJECUTIVO !== undefined) {
            processAndSave(state.supData, data);
          } else {
            processAndSave(data, state.ejecData);
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
          processAndSave(newSup, newEjec);
        } catch {
          setState(s => ({ ...s, isLoading: false }));
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }, [state.supData, state.ejecData, state.ejecPendientesData, processData]);

  const loadFromFirestore = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true }));
    try {
      const { supData, ejecData, ejecPendientesData } = await fetchVisitasData();
      processData(supData, ejecData, ejecPendientesData);
    } catch (err) {
      console.error('Error loading from Firestore:', err);
      setState(s => ({ ...s, isLoading: false }));
    }
  }, [processData]);

  const syncFromGoogleSheets = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true }));
    try {
      // Traer SOLO Supervisores desde Google Sheets.
      // Ejecutivos: la fuente de verdad es Firestore (no se sobrescribe).
      const [{ supData }, firestoreData] = await Promise.all([
        fetchFromGoogleSheets(),
        fetchVisitasData(),
      ]);
      const ejecData = firestoreData.ejecData;
      let ejecPendientesData = firestoreData.ejecPendientesData;

      // Primera carga: si la colección de pendientes está vacía,
      // sembrarla con los registros PROGRAMADOS sin MES tomados de Ejecutivos.
      if (ejecPendientesData.length === 0 && ejecData.length > 0) {
        const seed = ejecData.filter(r => isProgrammed(r.STATUS) && !String(r.MES || '').trim());
        if (seed.length > 0) {
          ejecPendientesData = seed;
          saveEjecPendientesData(seed)
            .then(() => console.log(`Ejecutivos pendientes sembrados: ${seed.length} registros ✅`))
            .catch(err => console.error('Error sembrando pendientes:', err));
        }
      }

      const supRealized = supData.filter(r => isRealized(r.STATUS)).length;
      const ejecRealized = ejecData.filter(r => isRealized(r.STATUS)).length;
      processData(supData, ejecData, ejecPendientesData);
      toast.success(`Sincronizado: ${supData.length} sup (${supRealized} realiz), ${ejecData.length} ejec (${ejecRealized} realiz), ${ejecPendientesData.length} pendientes`);
      // Guardar SOLO Supervisores en Firestore.
      if (supData.length > 0) {
        saveSupData(supData, true)
          .then(() => console.log('Supervisores guardados en Firestore ✅'))
          .catch(err => console.error('Error guardando supervisores:', err));
      }
    } catch (err) {
      console.error('Error syncing from Google Sheets:', err);
      toast.error('Error al sincronizar. Cargando datos guardados...');
      try {
        const { supData, ejecData, ejecPendientesData } = await fetchVisitasData();
        processData(supData, ejecData, ejecPendientesData);
      } catch {
        setState(s => ({ ...s, isLoading: false }));
      }
    }
  }, [processData]);

  // Save to Firestore after file upload
  const saveAfterUpload = useCallback(async (sup: DataRow[], ejec: DataRow[]) => {
    try {
      const promises: Promise<void>[] = [];
      if (sup.length > 0) promises.push(saveSupData(sup));
      if (ejec.length > 0) promises.push(saveEjecData(ejec));
      await Promise.all(promises);
      console.log('Data saved to Firestore successfully');
    } catch (err) {
      console.error('Error saving to Firestore:', err);
    }
  }, []);

  const dataKeyFor = (type: 'sup' | 'ejec' | 'ejec_pend'): 'supData' | 'ejecData' | 'ejecPendientesData' => {
    if (type === 'sup') return 'supData';
    if (type === 'ejec') return 'ejecData';
    return 'ejecPendientesData';
  };

  const updateRow = useCallback(async (type: 'sup' | 'ejec' | 'ejec_pend', index: number, field: string, value: string) => {
    const dataKey = dataKeyFor(type);
    const oldRow = state[dataKey][index];
    if (!oldRow) throw new Error('Row not found');

    setState(s => {
      const newData = [...s[dataKey]];
      newData[index] = { ...newData[index], [field]: value };
      return { ...s, [dataKey]: newData };
    });

    await updateRowInFirestore(type, oldRow, field, value);
  }, [state.supData, state.ejecData, state.ejecPendientesData]);

  const deleteRow = useCallback(async (type: 'sup' | 'ejec' | 'ejec_pend', index: number) => {
    const dataKey = dataKeyFor(type);
    const row = state[dataKey][index];
    if (!row) throw new Error('Row not found');

    setState(s => {
      const newData = [...s[dataKey]];
      newData.splice(index, 1);
      return { ...s, [dataKey]: newData };
    });

    await deleteRowFromFirestore(type, row);
  }, [state.supData, state.ejecData, state.ejecPendientesData]);

  const deleteRowsBulk = useCallback(async (type: 'sup' | 'ejec' | 'ejec_pend', indices: number[]) => {
    if (indices.length === 0) return;
    const dataKey = dataKeyFor(type);
    const idxSet = new Set(indices);
    const rowsToDelete = indices
      .map(i => state[dataKey][i])
      .filter((r): r is DataRow => Boolean(r));
    if (rowsToDelete.length === 0) return;

    setState(s => {
      const newData = s[dataKey].filter((_, i) => !idxSet.has(i));
      return { ...s, [dataKey]: newData };
    });

    await deleteRowsBatchFromFirestore(type, rowsToDelete);
  }, [state.supData, state.ejecData, state.ejecPendientesData]);

  // Auto-sync from Google Sheets on mount
  useEffect(() => {
    syncFromGoogleSheets();
  }, [syncFromGoogleSheets]);

  const hasData = state.supData.length > 0 || state.ejecData.length > 0;

  return (
    <AppContext.Provider value={{ ...state, setActiveTab, setYearFilter, setMonthFilter, handleFileUpload, loadFromFirestore, syncFromGoogleSheets, updateRow, deleteRow, deleteRowsBulk, hasData }}>
      {children}
    </AppContext.Provider>
  );
}
