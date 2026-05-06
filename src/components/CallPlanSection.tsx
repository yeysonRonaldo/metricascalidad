import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { MONTH_NAMES, MONTH_ORDER } from '@/lib/dataProcessing';
import { assignCallDates, getBusinessDays, formatYMD } from '@/lib/callPlanScheduler';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { CalendarDays, Phone, CalendarIcon, CheckCircle2, AlertCircle, Wand2, Bug, Wrench, Sparkles } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { DataRow } from '@/types/metrics';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

function parseYMD(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = parse(s, 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : undefined;
}

function asBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1' || v.toUpperCase() === 'SI';
  return false;
}

export default function CallPlanSection() {
  const { ejecPendientesData, yearFilter, monthFilter, updateRow } = useAppContext();
  const { profile, user } = useAuth();

  const isSuperAdmin = user?.email?.toLowerCase() === 'yeyickvelas@gmail.com';
  const isEjecutivo = !isSuperAdmin && profile?.rol === 'EJECUTIVO';

  // Determine target year/month
  const now = new Date();
  const targetYear = yearFilter !== 'all' ? parseInt(yearFilter, 10) : now.getFullYear();
  const targetMonthName = monthFilter !== 'all' ? monthFilter : MONTH_NAMES[now.getMonth()];
  const targetMonthIdx = (MONTH_ORDER[targetMonthName] || (now.getMonth() + 1)) - 1;

  // Filter clients for this user (already restricted in context for EJECUTIVO)
  const myClients = useMemo(() => {
    if (isEjecutivo && profile?.nombre) {
      const me = profile.nombre.toUpperCase();
      return ejecPendientesData.filter(r => (r.EJECUTIVO || '').toString().toUpperCase() === me);
    }
    return ejecPendientesData;
  }, [ejecPendientesData, isEjecutivo, profile?.nombre]);

  const [reasonDialog, setReasonDialog] = useState<{ globalIdx: number; newDate: string } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [generating, setGenerating] = useState(false);

  // Group clients by FECHA_LLAMADA
  const businessDays = useMemo(() => getBusinessDays(targetYear, targetMonthIdx), [targetYear, targetMonthIdx]);

  const grouped = useMemo(() => {
    const map = new Map<string, { row: DataRow; globalIdx: number }[]>();
    myClients.forEach((row) => {
      const fecha = String(row.FECHA_LLAMADA || '').trim();
      if (!fecha) return;
      const arr = map.get(fecha) || [];
      const globalIdx = ejecPendientesData.indexOf(row);
      arr.push({ row, globalIdx });
      map.set(fecha, arr);
    });
    return map;
  }, [myClients, ejecPendientesData]);

  const unassigned = useMemo(
    () => myClients.filter(r => !String(r.FECHA_LLAMADA || '').trim()),
    [myClients]
  );

  const totals = useMemo(() => {
    const total = myClients.length;
    const realized = myClients.filter(r => asBool(r.LLAMADA_REALIZADA)).length;
    const todayStr = formatYMD(new Date());
    const today = (grouped.get(todayStr) || []).filter(({ row }) => !asBool(row.LLAMADA_REALIZADA)).length;
    return { total, realized, today, pct: total > 0 ? Math.round((realized / total) * 100) : 0 };
  }, [myClients, grouped]);

  const handleGenerate = async () => {
    if (myClients.length === 0) {
      toast.info('No hay clientes para planificar.');
      return;
    }
    const ok = window.confirm(
      'Esto redistribuirá uniformemente las fechas de llamada de TODOS los clientes pendientes (no realizados) del mes. ¿Continuar?'
    );
    if (!ok) return;
    setGenerating(true);
    try {
      const changes = assignCallDates(myClients, targetYear, targetMonthIdx);
      for (const c of changes) {
        const globalIdx = ejecPendientesData.indexOf(c.row);
        if (globalIdx === -1) continue;
        await updateRow('ejec_pend', globalIdx, 'FECHA_LLAMADA', c.newDate);
        if (!String(c.row.FECHA_LLAMADA_ORIGINAL || '').trim()) {
          await updateRow('ejec_pend', globalIdx, 'FECHA_LLAMADA_ORIGINAL', c.newDate);
        }
      }
      toast.success(`Plan regenerado: ${changes.length} clientes actualizados.`);
    } catch (e) {
      console.error(e);
      toast.error('Error al generar el plan.');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleField = async (globalIdx: number, field: string, value: boolean) => {
    try {
      await updateRow('ejec_pend', globalIdx, field, value ? 'true' : 'false');
    } catch {
      toast.error('Error al guardar');
    }
  };

  const handleObsChange = async (globalIdx: number, value: string) => {
    try {
      await updateRow('ejec_pend', globalIdx, 'OBSERVACIONES_LLAMADA', value);
    } catch {
      toast.error('Error al guardar observación');
    }
  };

  const handleMarkDone = async (globalIdx: number, currentlyDone: boolean) => {
    try {
      await updateRow('ejec_pend', globalIdx, 'LLAMADA_REALIZADA', currentlyDone ? 'false' : 'true');
      if (!currentlyDone) {
        await updateRow('ejec_pend', globalIdx, 'FECHA_LLAMADA_REALIZADA', formatYMD(new Date()));
      }
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const requestDateChange = (globalIdx: number, newDate: Date | undefined) => {
    if (!newDate) return;
    setReasonDialog({ globalIdx, newDate: formatYMD(newDate) });
    setReasonText('');
  };

  const confirmDateChange = async () => {
    if (!reasonDialog) return;
    if (reasonText.trim().length < 5) {
      toast.error('El motivo debe tener al menos 5 caracteres.');
      return;
    }
    const { globalIdx, newDate } = reasonDialog;
    const row = ejecPendientesData[globalIdx];
    try {
      if (!String(row?.FECHA_LLAMADA_ORIGINAL || '').trim() && row?.FECHA_LLAMADA) {
        await updateRow('ejec_pend', globalIdx, 'FECHA_LLAMADA_ORIGINAL', String(row.FECHA_LLAMADA));
      }
      await updateRow('ejec_pend', globalIdx, 'FECHA_LLAMADA', newDate);
      await updateRow('ejec_pend', globalIdx, 'MOTIVO_CAMBIO_FECHA', reasonText.trim());
      toast.success('Fecha actualizada ✅');
      setReasonDialog(null);
      setReasonText('');
    } catch {
      toast.error('Error al actualizar la fecha');
    }
  };

  // Group business days by week (each Monday starts a new week block)
  const weeks: Date[][] = useMemo(() => {
    const result: Date[][] = [];
    let current: Date[] = [];
    businessDays.forEach((d) => {
      if (d.getDay() === 1 && current.length > 0) {
        result.push(current);
        current = [];
      }
      current.push(d);
    });
    if (current.length > 0) result.push(current);
    return result;
  }, [businessDays]);

  return (
    <div className="space-y-4 pb-10">
      <div className="border-b-2 border-primary/10 pb-2 mb-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Phone className="w-6 h-6" /> Plan de Llamadas — {targetMonthName} {targetYear}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Organiza tus llamadas del mes (Lun-Vie). Puedes cambiar la fecha registrando el motivo.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Clientes del mes</div>
          <div className="text-2xl font-bold">{totals.total}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Llamadas hoy</div>
          <div className="text-2xl font-bold">{totals.today}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Realizadas</div>
          <div className="text-2xl font-bold text-green-600">{totals.realized}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Avance</div>
          <div className="text-2xl font-bold text-primary">{totals.pct}%</div>
        </Card>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 rounded-lg p-3">
        <div className="text-sm text-muted-foreground">
          {unassigned.length > 0
            ? <span className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-amber-500" /> {unassigned.length} clientes sin fecha asignada</span>
            : <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-600" /> Todos los clientes están agendados</span>}
        </div>
        <Button onClick={handleGenerate} disabled={generating || unassigned.length === 0}>
          <Wand2 className="w-4 h-4 mr-1.5" />
          {generating ? 'Generando…' : 'Generar plan del mes'}
        </Button>
      </div>

      {myClients.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No hay clientes pendientes para mostrar.
        </div>
      )}

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Semana {wi + 1}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {week.map((day) => {
              const ymd = formatYMD(day);
              const items = grouped.get(ymd) || [];
              const dayName = DAY_NAMES[day.getDay() - 1] || '';
              return (
                <Card key={ymd} className="p-3 flex flex-col gap-2 min-h-[120px]">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">{dayName}</div>
                      <div className="text-lg font-bold">{format(day, 'd MMM', { locale: es })}</div>
                    </div>
                    <div className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {items.length}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {items.map(({ row, globalIdx }) => {
                      const done = asBool(row.LLAMADA_REALIZADA);
                      const plaga = asBool(row.PLAGA);
                      const mant = asBool(row.MEJORA_MANTENIMIENTO);
                      const limp = asBool(row.MEJORA_LIMPIEZA);
                      return (
                        <div key={`${ymd}-${globalIdx}`} className={cn(
                          "border rounded-md p-2 text-xs space-y-1.5",
                          done && "bg-green-50 dark:bg-green-950/20 border-green-300"
                        )}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate">{String(row.CLIENTE || '')}</div>
                              {row.SUCURSAL && <div className="text-muted-foreground truncate">{String(row.SUCURSAL)}</div>}
                            </div>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  <CalendarIcon className="w-3.5 h-3.5" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                  mode="single"
                                  selected={parseYMD(String(row.FECHA_LLAMADA || ''))}
                                  onSelect={(d) => requestDateChange(globalIdx, d)}
                                  disabled={(d) => d.getDay() === 0 || d.getDay() === 6}
                                  className={cn("p-3 pointer-events-auto")}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <Checkbox checked={plaga} onCheckedChange={(v) => handleToggleField(globalIdx, 'PLAGA', !!v)} />
                              <Bug className="w-3 h-3" /> Plaga
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <Checkbox checked={mant} onCheckedChange={(v) => handleToggleField(globalIdx, 'MEJORA_MANTENIMIENTO', !!v)} />
                              <Wrench className="w-3 h-3" /> Mant.
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <Checkbox checked={limp} onCheckedChange={(v) => handleToggleField(globalIdx, 'MEJORA_LIMPIEZA', !!v)} />
                              <Sparkles className="w-3 h-3" /> Limpieza
                            </label>
                          </div>
                          <Textarea
                            placeholder="Observaciones…"
                            defaultValue={String(row.OBSERVACIONES_LLAMADA || '')}
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (v !== String(row.OBSERVACIONES_LLAMADA || '')) {
                                handleObsChange(globalIdx, v);
                              }
                            }}
                            className="text-xs min-h-[50px]"
                          />
                          {row.MOTIVO_CAMBIO_FECHA && (
                            <div className="text-[10px] text-muted-foreground italic">
                              Cambio: {String(row.MOTIVO_CAMBIO_FECHA)}
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant={done ? "outline" : "default"}
                            className="w-full h-7 text-xs"
                            onClick={() => handleMarkDone(globalIdx, done)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            {done ? 'Llamada realizada' : 'Marcar realizada'}
                          </Button>
                        </div>
                      );
                    })}
                    {items.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-2">Sin llamadas</div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Unassigned */}
      {unassigned.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4" /> Sin fecha asignada ({unassigned.length})
          </h2>
          <div className="space-y-1 max-h-60 overflow-y-auto text-xs">
            {unassigned.slice(0, 50).map((row, i) => (
              <div key={i} className="flex justify-between border-b py-1">
                <span>{String(row.CLIENTE || '')} {row.SUCURSAL ? `— ${row.SUCURSAL}` : ''}</span>
                <span className="text-muted-foreground">{String(row.STATUS || '')}</span>
              </div>
            ))}
            {unassigned.length > 50 && (
              <div className="text-center text-muted-foreground pt-2">
                + {unassigned.length - 50} más…
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Reason dialog */}
      <Dialog open={!!reasonDialog} onOpenChange={(o) => !o && setReasonDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo del cambio de fecha</DialogTitle>
            <DialogDescription>
              Indica brevemente por qué reagendaste esta llamada. Mínimo 5 caracteres.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Ej. El cliente pidió ser contactado el viernes…"
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonDialog(null)}>Cancelar</Button>
            <Button onClick={confirmDateChange}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
