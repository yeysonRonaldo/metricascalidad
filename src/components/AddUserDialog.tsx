import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus, CheckCircle } from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddUserDialog({ open, onOpenChange }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const secondaryAuth = getSecondaryAuth();
      await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await secondaryAuth.signOut();
      setSuccess(true);
      setEmail('');
      setPassword('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      const msg = err.code === 'auth/email-already-in-use' ? 'Este correo ya está registrado'
        : err.code === 'auth/weak-password' ? 'La contraseña debe tener al menos 6 caracteres'
        : err.code === 'auth/invalid-email' ? 'Correo electrónico inválido'
        : 'Error al crear usuario';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setEmail('');
      setPassword('');
      setError(null);
      setSuccess(false);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Agregar Usuario
          </DialogTitle>
          <DialogDescription>
            Crea una nueva cuenta de acceso al sistema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Correo electrónico</label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="nuevo@empresa.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Contraseña</label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 text-green-700 dark:text-green-400 text-sm p-3 rounded-lg border border-green-500/20 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Usuario creado exitosamente
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            {loading ? 'Creando...' : 'Crear Usuario'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
