import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { convertDatesAndFill } from "@/lib/dataProcessing";
import type { DataRow } from "@/types/metrics";

export async function fetchCatalogoMetricas(): Promise<{ supData: DataRow[]; ejecData: DataRow[] }> {
  const snapshot = await getDocs(collection(db, "catalogo_metricas"));
  const rawData: Record<string, unknown>[] = [];
  
  snapshot.forEach((doc) => {
    rawData.push({ id: doc.id, ...doc.data() });
  });

  const data = convertDatesAndFill(rawData);

  // Separate supervisores vs ejecutivos based on EJECUTIVO field
  const supData: DataRow[] = [];
  const ejecData: DataRow[] = [];

  data.forEach((row) => {
    if (row.EJECUTIVO !== undefined && row.EJECUTIVO !== '') {
      ejecData.push(row);
    } else {
      supData.push(row);
    }
  });

  return { supData, ejecData };
}
