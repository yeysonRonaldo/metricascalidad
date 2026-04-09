import { useState, useMemo, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { filterByYearMonth } from '@/lib/dataProcessing';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Save, Database, X, Check, Pencil } from 'lucide-react';

type DataType = 'sup' | 'ejec';

const STATUS_OPTIONS = ['REALIZADO', 'PROGRAMADO', 'CANCELADO', 'REPROGRAMADO', 'NO REALIZADO', 'PENDIENTE'];

export default function DataTableSection() {
  const { supData, ejecData, yearFilter, monthFilter, updateRow } = useAppContext();
  const [dataType, setDataType] = useState<DataType>('sup');
  const [search, setSearch] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState<number | null>(null);

  const rawData = dataType === 'sup' ? supData : ejecData;
  const filtered = useMemo(() => {
    const byDate = filterByYearMonth(rawData, yearFilter, monthFilter);
    if (!search.trim()) return byDate;
    const q = search.toUpperCase();
    return byDate.filter(r =>
      (r.CLIENTE || '').toString().toUpperCase().includes(q) ||
      (r.SUPERVISOR || '').toString().toUpperCase().includes(q) ||
      (r.EJECUTIVO || '').toString().toUpperCase().includes(q) ||
      (r.SUCURSAL || '').toString().toUpperCase().includes(q) ||
      (r.STATUS || '').toString().toUpperCase().includes(q)
    );
  }, [rawData, yearFilter, monthFilter, search]);

  const personField = dataType === 'sup' ? 'SUPERVISOR' : 'EJECUTIVO';

  const columns = [
    { key: 'FECHA', label: 'Fecha', editable: false },
    { key: personField, label: dataType === 'sup' ? 'Supervisor' : 'Ejecutivo', editable: true },
    { key: 'CLIENTE', label: 'Cliente', editable: true },
    { key: 'SUCURSAL', label: 'Sucursal', editable: true },
    { key: 'STATUS', label: 'Status', editable: true, type: 'select' },
    { key: 'TIPO DE VISITA', label: 'Tipo de Visita', editable: true },
    { key: 'OBSERVACIONES', label: 'Observaciones', editable: true },
  ];

  const startEdit = (rowIdx: number, field: string, currentValue: string) => {
    setEditingCell({ rowIdx, field });
    setEditValue(currentValue || '');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = useCallback(async () => {
    if (!editingCell) return;
    const row = filtered[editingCell.rowIdx];
    if (!row) return;
    
    const originalIdx = rawData.indexOf(row);
    if (originalIdx === -1) return;

    setSaving(editingCell.rowIdx);
    try {
      await updateRow(dataType, originalIdx, editingCell.field, editValue);
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
          <button
            onClick={() => { setDataType('sup'); setSearch(''); setEditingCell(null); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${dataType === 'sup' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Supervisores ({supData.length})
          </button>
          <button
            onClick={() => { setDataType('ejec'); setSearch(''); setEditingCell(null); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${dataType === 'ejec' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Ejecutivos ({ejecData.length})
          </button>
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, persona, sucursal..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <span className="text-sm text-muted-foreground">
          {filtered.length} registros
        </span>
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
                          <div className="flex items-center gap-1">
                            <Select value={editValue} onValueChange={v => setEditValue(v)}>
                              <SelectTrigger className="h-8 text-xs w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map(s => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <button onClick={saveEdit} disabled={saving === i} className="p-1 rounded hover:bg-green-100 text-green-600">
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
                            />
                            <button onClick={saveEdit} disabled={saving === i} className="p-1 rounded hover:bg-green-100 text-green-600">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={cancelEdit} className="p-1 rounded hover:bg-red-100 text-red-600">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
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
                        ) : (
                          val
                        )}
                      </td>
                    );
                  })}
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
    </div>
  );
}
