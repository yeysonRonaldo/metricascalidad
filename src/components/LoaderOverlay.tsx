import { Loader2 } from 'lucide-react';

export default function LoaderOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-card/90 backdrop-blur-sm">
      <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
      <h2 className="text-xl font-bold text-primary animate-pulse">Procesando datos...</h2>
    </div>
  );
}
