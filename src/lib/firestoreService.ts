import { collection, getDocs, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { convertDatesAndFill } from "@/lib/dataProcessing";
import type { DataRow } from "@/types/metrics";

const COLLECTION_SUP = "visitas_supervisores";
const COLLECTION_EJEC = "visitas_ejecutivos";

export async function fetchVisitasData(): Promise<{ supData: DataRow[]; ejecData: DataRow[] }> {
  const [supSnap, ejecSnap] = await Promise.all([
    getDocs(collection(db, COLLECTION_SUP)),
    getDocs(collection(db, COLLECTION_EJEC)),
  ]);

  const rawSup: Record<string, unknown>[] = [];
  supSnap.forEach((d) => rawSup.push({ id: d.id, ...d.data() }));

  const rawEjec: Record<string, unknown>[] = [];
  ejecSnap.forEach((d) => rawEjec.push({ id: d.id, ...d.data() }));

  const supData = convertDatesAndFill(rawSup);
  const ejecData = convertDatesAndFill(rawEjec);

  return { supData, ejecData };
}

async function saveToCollection(collectionName: string, data: DataRow[]): Promise<void> {
  // Delete existing docs first, then write new ones in batches of 500
  const existing = await getDocs(collection(db, collectionName));
  
  // Delete in batches
  let deleteBatch = writeBatch(db);
  let count = 0;
  for (const docSnap of existing.docs) {
    deleteBatch.delete(docSnap.ref);
    count++;
    if (count % 500 === 0) {
      await deleteBatch.commit();
      deleteBatch = writeBatch(db);
    }
  }
  if (count % 500 !== 0) await deleteBatch.commit();

  // Write new data in batches
  let batch = writeBatch(db);
  let writeCount = 0;
  for (let i = 0; i < data.length; i++) {
    const row = { ...data[i] };
    // Remove internal fields
    delete row._ROLE;
    const ref = doc(collection(db, collectionName));
    batch.set(ref, row);
    writeCount++;
    if (writeCount % 500 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  if (writeCount % 500 !== 0) await batch.commit();
}

export async function saveSupData(data: DataRow[]): Promise<void> {
  await saveToCollection(COLLECTION_SUP, data);
}

export async function saveEjecData(data: DataRow[]): Promise<void> {
  await saveToCollection(COLLECTION_EJEC, data);
}
