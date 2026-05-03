import React, { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, UserPlus, Database, CalendarIcon, Loader2, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { DataRow } from '@/types/metrics';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { addRecordsBulkToFirestore } from '@/lib/firestoreService';
import { useAuth } from '@/context/AuthContext';

const firebaseConfig = {
  apiKey: "AIzaSyA7kM8-CH8KkjWDCi4ShI8Jltc3fVTjdmg",
  authDomain: "metricas-123.firebaseapp.com",
  projectId: "metricas-123",
  storageBucket: "metricas-123.firebasestorage.app",
  messagingSenderId: "900899195040",
  appId: "1:900899195040:web:8303cb1e9eb7f3a57ae1c5"
};

function getSecondaryAuth() {
  const existing = getApps().find(a => a.name === 'secondary');
  const app = existing || initializeApp(firebaseConfig, 'secondary');
  return getAuth(app);
}

export default function AdminSection() {
  const { addRecord, addUser, removeUser, usersData, loadFromFirestore } = useAppContext();
  const { profile, user } = useAuth();

  // Estado para Nuevo Usuario
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'SUPERVISOR' | 'EJECUTIVO' | 'ADMIN'>('EJECUTIVO');
  const [savingUser, setSavingUser] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Estado para Nuevo Registro
  const [recordType, setRecordType] = useState<'sup' | 'ejec' | 'ejec_pend'>('ejec_pend');
  const [date, setDate] = useState<Date | undefined>();
  const [frecuencia, setFrecuencia] = useState<'once' | 'monthly' | 'bimonthly' | 'quarterly'>('once');
  const [person, setPerson] = useState('');
  const [client, setClient] = useState('');
  const [branch, setBranch] = useState('');
  const [status, setStatus] = useState('PROGRAMADO');
  const [visitType, setVisitType] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);

  const isSuperAdmin = user?.email?.toLowerCase() === 'yeyickvelas@gmail.com';
  const isAdmin = isSuperAdmin || profile?.rol === 'ADMIN' || profile?.rol === 'SUPERVISOR';

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldAlert className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Acceso Denegado</h2>
        <p className="text-muted-foreground mt-2">No tienes permisos para ver esta sección.</p>
      </div>
    );
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      toast.error('Completa todos los campos');
      return;
    }
    if (newUserPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setSavingUser(true);
    try {
      const secondaryAuth = getSecondaryAuth();
      await createUserWithEmailAndPassword(secondaryAuth, newUserEmail.trim(), newUserPassword.trim());
      await secondaryAuth.signOut();

      await addUser(newUserName.trim().toUpperCase(), newUserRole, newUserEmail.trim(), newUserPassword.trim());
      toast.success('Empleado y cuenta creados correctamente');
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        toast.error('Este correo ya está registrado en el sistema');
      } else {
        toast.error('Error al guardar empleado');
      }
    } finally {
      setSavingUser(false);
    }
  };

  const handleRemoveUser = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas remover este empleado del catálogo? NOTA: La cuenta de inicio de sesión de Firebase permanecerá activa, pero no tendrá acceso.')) return;
    try {
      await removeUser(id);
      toast.success('Empleado removido');
    } catch (err) {
      console.error(err);
      toast.error('Error al remover empleado');
    }
  };

  const togglePassword = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
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
      const rowsToCreate: DataRow[] = [];
      const currentYear = date.getFullYear();
      let currentDate = new Date(date);
      
      const stepMonths = frecuencia === 'monthly' ? 1 : frecuencia === 'bimonthly' ? 2 : frecuencia === 'quarterly' ? 3 : 0;

      while (currentDate.getFullYear() === currentYear) {
        const row: DataRow = {
          FECHA: format(currentDate, 'yyyy-MM-dd'),
          AÑO: currentDate.getFullYear().toString(),
          MES: currentDate.toLocaleDateString('es-ES', { month: 'long' }).toUpperCase(),
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

        rowsToCreate.push(row);

        if (stepMonths === 0) break; // Solo una vez

        currentDate.setMonth(currentDate.getMonth() + stepMonths);
      }

      if (rowsToCreate.length === 1) {
        await addRecord(recordType, rowsToCreate[0]);
      } else {
        await addRecordsBulkToFirestore(recordType, rowsToCreate);
        await loadFromFirestore(); // Reload to see bulk changes
      }

      toast.success(`${rowsToCreate.length} registro(s) añadido(s) a la base de datos ✅`);
      setClient('');
      setBranch('');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar registro(s)');
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
        <p className="text-sm text-muted-foreground mt-1">Gestiona el catálogo de empleados, contraseñas y creación masiva de registros.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* COLUMNA 1: Catálogo de Empleados */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5" /> Agregar Empleado (Usuario)
              </CardTitle>
              <CardDescription>
                Crea una cuenta para que puedan iniciar sesión y asocia su nombre a los registros.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Nombre Completo <span className="text-red-500">*</span></label>
                  <Input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Ej. Juan Pérez" required />
                  <p className="text-[10px] text-muted-foreground">Este nombre debe coincidir EXACTAMENTE con el nombre en la base de datos.</p>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-medium">Correo Electrónico <span className="text-red-500">*</span></label>
                  <Input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="juan@empresa.com" required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Contraseña <span className="text-red-500">*</span></label>
                    <Input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="Mínimo 6 chars" required minLength={6} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Rol <span className="text-red-500">*</span></label>
                    <Select value={newUserRole} onValueChange={(v: 'SUPERVISOR' | 'EJECUTIVO' | 'ADMIN') => setNewUserRole(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EJECUTIVO">Ejecutivo (Limitado)</SelectItem>
                        <SelectItem value="SUPERVISOR">Supervisor (Total)</SelectItem>
                        <SelectItem value="ADMIN">Admin (Total)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" disabled={savingUser} className="w-full h-9">
                  {savingUser ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Crear Usuario
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Catálogo y Contraseñas ({usersData.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scroll">
                {usersData.length === 0 && <p className="text-xs text-muted-foreground italic">No hay empleados registrados en el catálogo. Se extraen de los registros.</p>}
                {usersData.map(u => (
                  <div key={u.id} className="flex flex-col bg-muted/50 p-3 rounded-md border text-sm gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{u.nombre}</span>
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm font-medium">{u.rol}</span>
                      </div>
                      <button onClick={() => u.id && handleRemoveUser(u.id)} className="text-destructive/60 hover:text-destructive p-1 rounded-sm hover:bg-destructive/10 transition-colors" title="Eliminar del catálogo">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {u.email && (
                      <div className="text-xs flex flex-col gap-1 mt-1 border-t pt-2 border-border/50">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email:</span>
                          <span className="font-medium">{u.email}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Pass:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono bg-background px-1.5 py-0.5 rounded border">{showPasswords[u.id!] ? u.password : '••••••••'}</span>
                            <button onClick={() => togglePassword(u.id!)} className="text-muted-foreground hover:text-foreground">
                              {showPasswords[u.id!] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
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
                Crea una o varias metas directamente en Firebase.
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
                    <label className="text-xs font-medium">Fecha de Inicio <span className="text-red-500">*</span></label>
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
                    <label className="text-xs font-medium">Frecuencia <span className="text-red-500">*</span></label>
                    <Select value={frecuencia} onValueChange={(v: 'once' | 'monthly' | 'bimonthly' | 'quarterly') => setFrecuencia(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">Solo una vez</SelectItem>
                        <SelectItem value="monthly">Mensual (Resto del año)</SelectItem>
                        <SelectItem value="bimonthly">Bimensual (Cada 2 meses)</SelectItem>
                        <SelectItem value="quarterly">Trimestral (Cada 3 meses)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">{recordType === 'sup' ? 'Supervisor' : 'Ejecutivo'} <span className="text-red-500">*</span></label>
                  <Input value={person} onChange={e => setPerson(e.target.value)} placeholder="Nombre del responsable" required list="admin-users-list" />
                  <datalist id="admin-users-list">
                    {usersData.filter(u => recordType === 'sup' ? u.rol === 'SUPERVISOR' || u.rol === 'ADMIN' : u.rol === 'EJECUTIVO').map(u => (
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
                  Guardar {frecuencia === 'once' ? 'Registro' : 'Registros Múltiples'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
