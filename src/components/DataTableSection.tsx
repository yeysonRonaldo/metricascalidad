import { useState, useMemo, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { filterByYearMonth, MONTH_NAMES, normalizeText, cleanString, normalizeMonth, parseDateValue, isRealized } from '@/lib/dataProcessing';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Database, X, Check, Pencil, CalendarIcon, Filter, Trash2, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { DataRow } from '@/types/metrics';

type DataType = 'sup' | 'ejec' | 'ejec_pend';

const STATUS_OPTIONS = ['REALIZADO', 'PROGRAMADO', 'CANCELADO', 'REPROGRAMADO', 'NO REALIZADO', 'PENDIENTE'];
const EJEC_STATUS_OPTIONS = ['PROGRAMADO', 'ENVIADO'];

type DeleteScope = 'single' | 'forward' | 'range' | 'year';

export default function DataTableSection() {
  const { supData, ejecData, ejecPendientesData, yearFilter, monthFilter, updateRow, deleteRow, deleteRowsBulk, usersData } = useAppContext();
  const { profile, user } = useAuth();
  const isSuperAdminEarly = user?.email?.toLowerCase() === 'yeyickvelas@gmail.com';
  const isEjecutivoOnly = !isSuperAdminEarly && profile?.rol === 'EJECUTIVO';
  const [dataType, setDataType] = useState<DataType>(isEjecutivoOnly ? 'ejec_pend' : 'sup');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [nameFilter, setNameFilter] = useState('all');
  const [mesFilter, setMesFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [dateField, setDateField] = useState<'FECHA' | 'FECHA ENVIADO'>('FECHA');
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ rowIdx: number; row: DataRow } | null>(null);
  const [deleteScope, setDeleteScope] = useState<DeleteScope>('single');
  const [rangeFrom, setRangeFrom] = useState<string>(MONTH_NAMES[0]);
  const [rangeTo, setRangeTo] = useState<string>(MONTH_NAMES[MONTH_NAMES.length - 1]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const rawData = dataType === 'sup' ? supData : dataType === 'ejec' ? ejecData : ejecPendientesData;
  const personField = dataType === 'sup' ? 'SUPERVISOR' : 'EJECUTIVO';
  const isEjec = dataType === 'ejec' || dataType === 'ejec_pend';
  const isSuperAdmin = user?.email?.toLowerCase() === 'yeyickvelas@gmail.com';
  const isAdmin = isSuperAdmin || profile?.rol === 'ADMIN' || profile?.rol === 'SUPERVISOR';

  // Unique names for dropdown
  const uniqueNames = useMemo(() => {
    const names = new Set<string>();
    rawData.forEach(r => {
      const n = (r[personField] || '').toString().trim();
      if (n) names.add(n);
    });
    return Array.from(names).sort();
  }, [rawData, personField]);

  // Unique statuses in data
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    rawData.forEach(r => {
      const s = (r.STATUS || '').toString().trim();
      if (s) statuses.add(s);
    });
    return Array.from(statuses).sort();
  }, [rawData]);

  // Unique months in data
  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    rawData.forEach(r => {
      const m = (r.MES || '').toString().trim();
      if (m) months.add(m);
    });
    return Array.from(months);
  }, [rawData]);

  const filtered = useMemo(() => {
    let data = filterByYearMonth(rawData, yearFilter, monthFilter);

    // Status filter (partial match for typed input)
    if (statusFilter !== 'all') {
      const q = statusFilter.toUpperCase();
      data = data.filter(r => (r.STATUS || '').toString().toUpperCase().includes(q));
    }

    // Name filter (partial match for typed input)
    if (nameFilter !== 'all') {
      const q = nameFilter.toUpperCase();
      data = data.filter(r => (r[personField] || '').toString().toUpperCase().includes(q));
    }

    // Month filter (partial match)
    if (mesFilter !== 'all') {
      const q = mesFilter.toUpperCase();
      data = data.filter(r => (r.MES || '').toString().toUpperCase().includes(q));
    }

    // Date range filter (FECHA o FECHA ENVIADO)
    if (dateFrom || dateTo) {
      const field = dataType === 'ejec_pend' ? dateField : 'FECHA';
      const fromTs = dateFrom ? new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate()).getTime() : null;
      const toTs = dateTo ? new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59, 999).getTime() : null;
      data = data.filter(r => {
        const d = parseDateValue(r[field]);
        if (!d) return false;
        const ts = d.getTime();
        if (fromTs !== null && ts < fromTs) return false;
        if (toTs !== null && ts > toTs) return false;
        return true;
      });
    }

    // Text search
    if (search.trim()) {
      const q = search.toUpperCase();
      data = data.filter(r =>
        (r.CLIENTE || '').toString().toUpperCase().includes(q) ||
        (r.SUPERVISOR || '').toString().toUpperCase().includes(q) ||
        (r.EJECUTIVO || '').toString().toUpperCase().includes(q) ||
        (r.SUCURSAL || '').toString().toUpperCase().includes(q) ||
        (r.STATUS || '').toString().toUpperCase().includes(q)
      );
    }

    return data;
  }, [rawData, yearFilter, monthFilter, search, statusFilter, nameFilter, mesFilter, dateFrom, dateTo, dateField, dataType, personField]);

  const columns = isEjec
    ? [
        { key: 'FECHA', label: 'Fecha', editable: true, type: 'date' as const },
        { key: 'MES', label: 'Mes', editable: false },
        { key: personField, label: 'Ejecutivo', editable: isAdmin },
        { key: 'CLIENTE', label: 'Cliente', editable: isAdmin },
        { key: 'SUCURSAL', label: 'Sucursal', editable: isAdmin },
        { key: 'STATUS', label: 'Status', editable: true, type: 'select' as const },
        ...(dataType === 'ejec_pend'
          ? [{ key: 'FECHA ENVIADO', label: 'Fecha Enviado', editable: true, type: 'date' as const }]
          : []),
        { key: 'TIPO DE VISITA', label: 'Tipo de Visita', editable: false },
        { key: 'OBSERVACIONES', label: 'Observaciones', editable: false },
      ]
    : [
        { key: 'FECHA', label: 'Fecha', editable: true, type: 'date' as const },
        { key: 'MES', label: 'Mes', editable: true },
        { key: personField, label: 'Supervisor', editable: true },
        { key: 'CLIENTE', label: 'Cliente', editable: true },
        { key: 'SUCURSAL', label: 'Sucursal', editable: true },
        { key: 'STATUS', label: 'Status', editable: true, type: 'select' as const },
        { key: 'TIPO DE VISITA', label: 'Tipo de Visita', editable: true },
        { key: 'OBSERVACIONES', label: 'Observaciones', editable: true },
      ];

  const statusOptionsForType = isEjec ? EJEC_STATUS_OPTIONS : STATUS_OPTIONS;

  const startEdit = (rowIdx: number, field: string, currentValue: string) => {
    setEditingCell({ rowIdx, field });
    setEditValue(currentValue || '');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = useCallback(async (overrideValue?: string, rowIdxOverride?: number) => {
    const cell = editingCell ?? (rowIdxOverride !== undefined ? { rowIdx: rowIdxOverride, field: 'STATUS' } : null);
    if (!cell) return;
    const row = filtered[cell.rowIdx];
    if (!row) return;

    const originalIdx = rawData.indexOf(row);
    if (originalIdx === -1) return;

    const valueToSave = overrideValue !== undefined ? overrideValue : editValue;

    setSaving(cell.rowIdx);
    try {
      await updateRow(dataType, originalIdx, cell.field, valueToSave);
      toast.success('Registro actualizado ✅');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar');
    } finally {
      setSaving(null);
      setEditingCell(null);
      setEditValue('');
    }
  }, [editingCell, editValue, filtered, rawData, dataType, updateRow]);

  // Cambio directo de STATUS sin necesidad de confirmar (clic en celda → Select → guarda)
  const handleStatusChange = useCallback(async (rowIdx: number, newValue: string) => {
    const row = filtered[rowIdx];
    if (!row) return;
    const originalIdx = rawData.indexOf(row);
    if (originalIdx === -1) return;
    setSaving(rowIdx);
    try {
      await updateRow(dataType, originalIdx, 'STATUS', newValue);
      toast.success('Status actualizado ✅');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar');
    } finally {
      setSaving(null);
      setEditingCell(null);
      setEditValue('');
    }
  }, [filtered, rawData, dataType, updateRow]);

  // Funciones obsoletas eliminadas


  const handleDelete = useCallback(async (rowIdx: number) => {
    const row = filtered[rowIdx];
    if (!row) return;

    if (isEjec) {
      const rowMonth = normalizeMonth(row.MES) || MONTH_NAMES[0];
      setDeleteScope('single');
      setRangeFrom(rowMonth);
      setRangeTo(MONTH_NAMES[MONTH_NAMES.length - 1]);
      setDeleteDialog({ rowIdx, row });
      return;
    }

    const originalIdx = rawData.indexOf(row);
    if (originalIdx === -1) return;
    if (!window.confirm('¿Estás seguro de eliminar este registro?')) return;

    setDeleting(rowIdx);
    try {
      await deleteRow(dataType, originalIdx);
      toast.success('Registro eliminado 🗑️');
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar');
    } finally {
      setDeleting(null);
    }
  }, [filtered, rawData, dataType, deleteRow, isEjec]);

  const confirmBulkDelete = useCallback(async () => {
    if (!deleteDialog) return;
    const { row } = deleteDialog;
    const targetEjec = normalizeText(row[personField]);
    const targetCliente = cleanString(row.CLIENTE as string);
    const targetSucursal = cleanString(row.SUCURSAL as string);
    const rowMonth = normalizeMonth(row.MES) || MONTH_NAMES[0];

    let targetMonths: Set<string>;
    if (deleteScope === 'single') {
      targetMonths = new Set([rowMonth]);
    } else if (deleteScope === 'forward') {
      const startIdx = MONTH_NAMES.indexOf(rowMonth);
      targetMonths = new Set(MONTH_NAMES.slice(startIdx >= 0 ? startIdx : 0));
    } else if (deleteScope === 'year') {
      targetMonths = new Set(MONTH_NAMES);
    } else {
      const fromIdx = MONTH_NAMES.indexOf(rangeFrom);
      const toIdx = MONTH_NAMES.indexOf(rangeTo);
      const [a, b] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
      targetMonths = new Set(MONTH_NAMES.slice(a, b + 1));
    }

    const targetYear = yearFilter;
    const indices: number[] = [];
    rawData.forEach((r, i) => {
      const rEjec = normalizeText(r[personField]);
      const rCliente = cleanString(r.CLIENTE as string);
      const rSucursal = cleanString(r.SUCURSAL as string);
      const rMonth = normalizeMonth(r.MES);
      const rYear = (r.AÑO || '').toString().trim();
      if (rEjec !== targetEjec) return;
      if (rCliente !== targetCliente) return;
      if (rSucursal !== targetSucursal) return;
      if (!targetMonths.has(rMonth)) return;
      if (targetYear !== 'all' && rYear && rYear !== targetYear) return;
      indices.push(i);
    });

    if (indices.length === 0) {
      toast.error('No se encontraron registros para eliminar');
      return;
    }

    setBulkDeleting(true);
    try {
      await deleteRowsBulk(dataType, indices);
      const monthList = Array.from(targetMonths);
      const summary = monthList.length === 1
        ? monthList[0]
        : `${monthList[0]} a ${monthList[monthList.length - 1]}`;
      toast.success(`${indices.length} registro(s) eliminado(s) (${summary}) 🗑️`);
      setDeleteDialog(null);
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar registros');
    } finally {
      setBulkDeleting(false);
    }
  }, [deleteDialog, deleteScope, rangeFrom, rangeTo, rawData, personField, yearFilter, dataType, deleteRowsBulk]);

  const getStatusColor = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s.includes('REALIZADO') && !s.includes('NO ')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (s.includes('PROGRAMADO')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    if (s.includes('CANCELADO')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    if (s.includes('REPROGRAMADO')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-4 pb-10">
      <div className="border-b-2 border-primary/10 pb-2 mb-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Database className="w-6 h-6" /> Base de Datos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Edita directamente los registros de supervisores y ejecutivos</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-muted rounded-lg p-0.5">
          {!isEjecutivoOnly && (
            <>
              <button
                onClick={() => { setDataType('sup'); setSearch(''); setEditingCell(null); setStatusFilter('all'); setNameFilter('all'); setMesFilter('all'); setDateFrom(undefined); setDateTo(undefined); }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${dataType === 'sup' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Supervisores ({supData.length})
              </button>
              <button
                onClick={() => { setDataType('ejec'); setSearch(''); setEditingCell(null); setStatusFilter('all'); setNameFilter('all'); setMesFilter('all'); setDateFrom(undefined); setDateTo(undefined); }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${dataType === 'ejec' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Ejecutivos ({ejecData.length})
              </button>
            </>
          )}
          <button
            onClick={() => { setDataType('ejec_pend'); setSearch(''); setEditingCell(null); setStatusFilter('all'); setNameFilter('all'); setMesFilter('all'); setDateFrom(undefined); setDateTo(undefined); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${dataType === 'ejec_pend' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Ejecutivos 2 ({ejecPendientesData.length})
          </button>
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <span className="text-sm text-muted-foreground">
          {filtered.length} registros
        </span>
      </div>

      {isEjec && (
        <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-lg p-2.5 text-xs text-foreground/80">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Ejecutivos: edición restringida</p>
            <p className="text-muted-foreground">
              Solo se puede cambiar el <strong>STATUS</strong> de un registro (ej. <em>Programado → Enviado</em>).
              Para quitar un registro (ej. cliente dado de baja), usa el ícono de papelera y elige el rango de meses.
              Esta data no se sobrescribe desde Google Sheets.
            </p>
          </div>
        </div>
      )}

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2 bg-muted/40 rounded-lg p-2.5">
        <Filter className="w-4 h-4 text-muted-foreground" />

        {/* Status filter - searchable */}
        <div className="relative">
          <Input
            placeholder="Filtrar status..."
            value={statusFilter === 'all' ? '' : statusFilter}
            onChange={e => setStatusFilter(e.target.value || 'all')}
            list={`status-list-${dataType}`}
            className="h-8 text-xs w-[160px] bg-background"
          />
          <datalist id={`status-list-${dataType}`}>
            {uniqueStatuses.map(s => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        {/* Name filter - searchable */}
        <div className="relative">
          <Input
            placeholder="Filtrar nombre..."
            value={nameFilter === 'all' ? '' : nameFilter}
            onChange={e => setNameFilter(e.target.value || 'all')}
            list={`name-list-${dataType}`}
            className="h-8 text-xs w-[180px] bg-background"
          />
          <datalist id={`name-list-${dataType}`}>
            {uniqueNames.map(n => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>

        {/* Month filter - searchable */}
        <div className="relative">
          <Input
            placeholder="Filtrar mes..."
            value={mesFilter === 'all' ? '' : mesFilter}
            onChange={e => setMesFilter(e.target.value || 'all')}
            list={`mes-list-${dataType}`}
            className="h-8 text-xs w-[140px] bg-background"
          />
          <datalist id={`mes-list-${dataType}`}>
            {uniqueMonths.map(m => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        {/* Date field selector (solo Ejecutivos 2) */}
        {dataType === 'ejec_pend' && (
          <Select
            value={dateField}
            onValueChange={(v) => {
              setDateField(v as 'FECHA' | 'FECHA ENVIADO');
              // Limpiamos el rango al cambiar de campo para evitar resultados confusos
              setDateFrom(undefined);
              setDateTo(undefined);
            }}
          >
            <SelectTrigger className="h-8 text-xs w-[160px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FECHA">Filtrar por Fecha</SelectItem>
              <SelectItem value="FECHA ENVIADO">Filtrar por Fecha Enviado</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Quick filters para STATUS */}
        <div className="flex bg-background border rounded-md overflow-hidden text-xs h-8">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 font-medium transition ${statusFilter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Todos
          </button>
          <button
            onClick={() => setStatusFilter('PROGRAMADO')}
            className={`px-3 font-medium transition ${statusFilter === 'PROGRAMADO' ? 'bg-blue-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Programados
          </button>
          <button
            onClick={() => setStatusFilter('ENVIADO')}
            className={`px-3 font-medium transition ${statusFilter === 'ENVIADO' ? 'bg-green-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Enviados
          </button>
        </div>

        {/* Date from */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("h-8 text-xs w-[140px] justify-start", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="w-3 h-3 mr-1" />
              {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Desde'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={es} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>

        {/* Date to */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("h-8 text-xs w-[140px] justify-start", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="w-3 h-3 mr-1" />
              {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Hasta'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={es} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>

        {/* Clear filters */}
        {(statusFilter !== 'all' || nameFilter !== 'all' || mesFilter !== 'all' || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setStatusFilter('all'); setNameFilter('all'); setMesFilter('all'); setDateFrom(undefined); setDateTo(undefined); }}>
            <X className="w-3 h-3 mr-1" /> Limpiar
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
          <table className="w-full text-sm">
            <thead className="bg-muted/80 sticky top-0 z-10">
               <tr>
                 <th className="px-3 py-2.5 text-left font-semibold text-xs text-muted-foreground w-8">#</th>
                 {columns.map(c => (
                   <th key={c.key} className="px-3 py-2.5 text-left font-semibold text-xs text-muted-foreground whitespace-nowrap">
                     {c.label}
                     {c.editable && <Pencil className="w-3 h-3 inline ml-1 opacity-40" />}
                   </th>
                 ))}
                 <th className="px-3 py-2.5 text-center font-semibold text-xs text-muted-foreground w-10"></th>
               </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.slice(0, 500).map((row, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-muted-foreground text-xs">{i + 1}</td>
                  {columns.map(col => {
                    const isEditing = editingCell?.rowIdx === i && editingCell?.field === col.key;
                    const val = (row[col.key] || '').toString();

                    if (isEditing && col.type === 'select') {
                      return (
                        <td key={col.key} className="px-2 py-1">
                          <Select
                            value={editValue}
                            onValueChange={v => { setEditValue(v); handleStatusChange(i, v); }}
                            open
                            onOpenChange={(open) => { if (!open) cancelEdit(); }}
                          >
                            <SelectTrigger className="h-8 text-xs w-[150px]" disabled={saving === i}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptionsForType.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      );
                    }

                    if (isEditing && col.type === 'date') {
                      const parsed = editValue ? new Date(editValue) : undefined;
                      const valid = parsed && !isNaN(parsed.getTime()) ? parsed : undefined;
                      return (
                        <td key={col.key} className="px-2 py-1">
                          <div className="flex items-center gap-1">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="h-8 text-xs w-[150px] justify-start">
                                  <CalendarIcon className="w-3 h-3 mr-1" />
                                  {valid ? format(valid, 'dd/MM/yyyy') : 'Elegir fecha'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={valid}
                                  onSelect={(d) => setEditValue(d ? format(d, 'yyyy-MM-dd') : '')}
                                  locale={es}
                                  initialFocus
                                  className={cn("p-3 pointer-events-auto")}
                                />
                              </PopoverContent>
                            </Popover>
                            <button onClick={() => saveEdit()} disabled={saving === i} className="p-1 rounded hover:bg-green-100 text-green-600">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={cancelEdit} className="p-1 rounded hover:bg-red-100 text-red-600">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      );
                    }

                    if (isEditing) {
                      return (
                        <td key={col.key} className="px-2 py-1">
                          <div className="flex items-center gap-1">
                            <Input
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                              className="h-8 text-xs"
                              autoFocus
                              list={col.key === personField ? 'users-datalist' : undefined}
                            />
                            <button onClick={() => saveEdit()} disabled={saving === i} className="p-1 rounded hover:bg-green-100 text-green-600">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={cancelEdit} className="p-1 rounded hover:bg-red-100 text-red-600">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          {col.key === personField && (
                            <datalist id="users-datalist">
                              {usersData.filter(u => dataType === 'sup' ? u.rol === 'SUPERVISOR' || u.rol === 'ADMIN' : u.rol === 'EJECUTIVO').map(u => (
                                <option key={u.id} value={u.nombre} />
                              ))}
                            </datalist>
                          )}
                        </td>
                      );
                    }

                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-2 whitespace-nowrap max-w-[200px] truncate ${col.editable ? 'cursor-pointer hover:bg-primary/5' : ''}`}
                        onClick={() => col.editable && startEdit(i, col.key, val)}
                        title={col.editable ? 'Clic para editar' : val}
                      >
                        {col.key === 'STATUS' ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(val)}`}>{val}</span>
                        ) : col.type === 'date' ? (
                          (() => {
                            if (!val) return <span className="text-muted-foreground italic text-xs">—</span>;
                            const d = new Date(val);
                            return !isNaN(d.getTime()) ? format(d, 'dd/MM/yyyy') : val;
                          })()
                        ) : (
                          val
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-center">
                    <button
                      onClick={() => handleDelete(i)}
                      disabled={deleting === i}
                      className="p-1 rounded hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors"
                      title="Eliminar registro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">No se encontraron registros</div>
          )}
          {filtered.length > 500 && (
            <div className="text-center py-3 text-xs text-muted-foreground bg-muted/50">
              Mostrando 500 de {filtered.length} registros. Usa los filtros para reducir.
            </div>
          )}
        </div>
      </div>

      {/* Dialog de borrado por rango (solo Ejecutivos) */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar registro de meta</DialogTitle>
            <DialogDescription>
              {deleteDialog && (
                <span className="block mt-1 text-foreground">
                  <strong>{(deleteDialog.row[personField] || '').toString()}</strong> –{' '}
                  {(deleteDialog.row.CLIENTE || '').toString()} ({(deleteDialog.row.SUCURSAL || '').toString()})
                  <br />
                  <span className="text-xs text-muted-foreground">
                    Mes del registro: {normalizeMonth(deleteDialog.row.MES) || '—'} · Año filtro: {yearFilter}
                  </span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-sm font-medium text-foreground">¿De qué meses deseas eliminarlo?</p>
            <RadioGroup value={deleteScope} onValueChange={(v) => setDeleteScope(v as DeleteScope)} className="space-y-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="single" id="scope-single" />
                <Label htmlFor="scope-single" className="cursor-pointer text-sm">
                  Solo este mes ({deleteDialog ? (normalizeMonth(deleteDialog.row.MES) || '—') : ''})
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="forward" id="scope-forward" />
                <Label htmlFor="scope-forward" className="cursor-pointer text-sm">
                  Desde este mes en adelante (resto del año)
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="range" id="scope-range" className="mt-2" />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="scope-range" className="cursor-pointer text-sm">Rango personalizado</Label>
                  {deleteScope === 'range' && (
                    <div className="flex items-center gap-2">
                      <Select value={rangeFrom} onValueChange={setRangeFrom}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MONTH_NAMES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">a</span>
                      <Select value={rangeTo} onValueChange={setRangeTo}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MONTH_NAMES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="year" id="scope-year" />
                <Label htmlFor="scope-year" className="cursor-pointer text-sm">
                  Todo el año ({yearFilter === 'all' ? 'todos los años' : yearFilter})
                </Label>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog(null)} disabled={bulkDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete} disabled={bulkDeleting}>
              <Trash2 className="w-4 h-4 mr-1" />
              {bulkDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
