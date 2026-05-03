import React, { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, UserPlus, Database, CalendarIcon, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { DataRow } from '@/types/metrics';

export default function AdminSection() {
  const { addRecord, addUser, removeUser, usersData, yearFilter } = useAppContext();

  // Estado para Nuevo Usuario
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'SUPERVISOR' | 'EJECUTIVO'>('EJECUTIVO');
  const [savingUser, setSavingUser] = useState(false);

  // Estado para Nuevo Registro
  const [recordType, setRecordType] = useState<'sup' | 'ejec' | 'ejec_pend'>('ejec_pend');
  const [date, setDate] = useState<Date | undefined>();
  const [month, setMonth] = useState('');
  const [person, setPerson] = useState('');
  const [client, setClient] = useState('');
  const [branch, setBranch] = useState('');
  const [status, setStatus] = useState('PROGRAMADO');
  const [visitType, setVisitType] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;
    setSavingUser(true);
    try {
      await addUser(newUserName.trim().toUpperCase(), newUserRole);
      toast.success('Empleado agregado al catálogo');
      setNewUserName('');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar empleado');
    } finally {
      setSavingUser(false);
    }
  };

  const handleRemoveUser = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas remover este empleado del catálogo?')) return;
    try {
      await removeUser(id);
      toast.success('Empleado removido');
    } catch (err) {
      console.error(err);
      toast.error('Error al remover empleado');
    }
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      toast.error('La fecha es obligatoria');
      return;
    }
    if (!person.trim() || !client.trim() || !status.trim()) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    setSavingRecord(true);
    try {
      const row: DataRow = {
        FECHA: format(date, 'yyyy-MM-dd'),
        AÑO: date.getFullYear().toString(),
        MES: month.trim() ? month.trim().toUpperCase() : '',
        CLIENTE: client.trim(),
        SUCURSAL: branch.trim(),
        STATUS: status.trim().toUpperCase(),
        'TIPO DE VISITA': visitType.trim()
      };

      if (recordType === 'sup') {
        row.SUPERVISOR = person.trim();
      } else {
        row.EJECUTIVO = person.trim();
      }

      await addRecord(recordType, row);
      toast.success('Registro añadido a la base de datos ✅');
      
      // Reset form but keep type
      setClient('');
      setBranch('');
      // setDate(undefined); // usually date, person, month stay the same for bulk entry
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar registro');
    } finally {
      setSavingRecord(false);
    }
  };

  return (
    <div className="space-y-6 pb-10 max-w-5xl mx-auto">
      <div className="border-b-2 border-primary/10 pb-2 mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-primary" /> Panel de Administración
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Gestiona el catálogo de empleados y agrega registros manualmente a la base de datos sin usar Excel.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* COLUMNA 1: Catálogo de Empleados */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5" /> Agregar Empleado
              </CardTitle>
              <CardDescription>
                Agrega nombres para que aparezcan en los selectores.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Nombre Completo</label>
                    <Input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Ej. Juan Pérez" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Rol</label>
                    <Select value={newUserRole} onValueChange={(v: 'SUPERVISOR' | 'EJECUTIVO') => setNewUserRole(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                        <SelectItem value="EJECUTIVO">Ejecutivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" disabled={savingUser} className="w-full h-9">
                  {savingUser ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Guardar Empleado
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Catálogo Actual ({usersData.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scroll">
                {usersData.length === 0 && <p className="text-xs text-muted-foreground italic">No hay empleados registrados en el catálogo. Se extraen de los registros.</p>}
                {usersData.map(u => (
                  <div key={u.id} className="flex items-center justify-between bg-muted/50 p-2 rounded-md border text-sm">
                    <div>
                      <span className="font-medium">{u.nombre}</span>
                      <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm">{u.rol}</span>
                    </div>
                    <button onClick={() => u.id && handleRemoveUser(u.id)} className="text-destructive/60 hover:text-destructive p-1 rounded-sm hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA 2: Agregar Registros Manuales */}
        <div>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="w-5 h-5" /> Agregar Registro Manual
              </CardTitle>
              <CardDescription>
                Crea una nueva meta o gestión directamente en Firebase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddRecord} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Base de Datos Destino</label>
                  <Select value={recordType} onValueChange={(v: 'sup' | 'ejec' | 'ejec_pend') => setRecordType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sup">Supervisores</SelectItem>
                      <SelectItem value="ejec">Ejecutivos 1 (Normal)</SelectItem>
                      <SelectItem value="ejec_pend">Ejecutivos 2 (Pendientes)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Fecha <span className="text-red-500">*</span></label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date ? format(date, "dd/MM/yyyy") : <span>Elegir fecha</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={date} onSelect={setDate} locale={es} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Mes (Opcional)</label>
                    <Input value={month} onChange={e => setMonth(e.target.value)} placeholder="Ej. ENERO" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">{recordType === 'sup' ? 'Supervisor' : 'Ejecutivo'} <span className="text-red-500">*</span></label>
                  <Input value={person} onChange={e => setPerson(e.target.value)} placeholder="Nombre del responsable" required list="admin-users-list" />
                  <datalist id="admin-users-list">
                    {usersData.filter(u => recordType === 'sup' ? u.rol === 'SUPERVISOR' : u.rol === 'EJECUTIVO').map(u => (
                      <option key={u.id} value={u.nombre} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Cliente <span className="text-red-500">*</span></label>
                  <Input value={client} onChange={e => setClient(e.target.value)} placeholder="Nombre del cliente" required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Sucursal</label>
                    <Input value={branch} onChange={e => setBranch(e.target.value)} placeholder="Sucursal" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Status <span className="text-red-500">*</span></label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PROGRAMADO">PROGRAMADO</SelectItem>
                        <SelectItem value="ENVIADO">ENVIADO</SelectItem>
                        <SelectItem value="REALIZADO">REALIZADO</SelectItem>
                        <SelectItem value="PENDIENTE">PENDIENTE</SelectItem>
                        <SelectItem value="CANCELADO">CANCELADO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Tipo de Visita</label>
                  <Input value={visitType} onChange={e => setVisitType(e.target.value)} placeholder="Ej. SEGUIMIENTO" />
                </div>

                <Button type="submit" disabled={savingRecord} className="w-full">
                  {savingRecord ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                  Guardar Registro
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
