import { CloudUpload } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="text-center py-20 flex flex-col items-center justify-center absolute inset-0">
      <div className="inline-block p-6 rounded-full bg-primary/10 mb-4">
        <CloudUpload className="w-12 h-12 text-primary" />
      </div>
      <h2 className="text-3xl font-bold text-foreground mb-2">¡Bienvenido!</h2>
      <p className="text-muted-foreground text-lg mb-6 max-w-md mx-auto">
        Para comenzar, carga tu archivo <b>BD.csv</b> o tu <b>Excel (.xlsx)</b>.
      </p>
    </div>
  );
}
