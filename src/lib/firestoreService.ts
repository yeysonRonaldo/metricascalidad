import { collection, getDocs, doc, writeBatch, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { convertDatesAndFill } from "@/lib/dataProcessing";
import type { DataRow } from "@/types/metrics";

const COLLECTION_SUP = "visitas_supervisores";
const COLLECTION_EJEC = "visitas_ejecutivos";

function generateRowId(row: DataRow, type: 'sup' | 'ejec'): string {
  const fecha = (row.FECHA || '').toString().trim();
  const person = type === 'sup'
    ? (row.SUPERVISOR || '').toString().trim().toUpperCase()
    : (row.EJECUTIVO || '').toString().trim().toUpperCase();
  const cliente = (row.CLIENTE || '').toString().trim().toUpperCase();
  const sucursal = (row.SUCURSAL || '').toString().trim().toUpperCase();
  const status = (row.STATUS || '').toString().trim().toUpperCase();
  // Create a deterministic key
  const raw = `${fecha}|${person}|${cliente}|${sucursal}|${status}`;
  // Simple hash to create a valid Firestore doc ID
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `${Math.abs(hash).toString(36)}_${raw.replace(/[^a-zA-Z0-9|]/g, '').slice(0, 60)}`;
}

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

async function saveToCollection(collectionName: string, data: DataRow[], type: 'sup' | 'ejec'): Promise<void> {
  // Fetch existing doc IDs to skip duplicates
  const existing = await getDocs(collection(db, collectionName));
  const existingIds = new Set<string>();
  existing.forEach((d) => existingIds.add(d.id));

  // Only write rows whose deterministic ID doesn't already exist
  let batch = writeBatch(db);
  let writeCount = 0;
  let skipped = 0;

  for (const row of data) {
    const docId = generateRowId(row, type);
    if (existingIds.has(docId)) {
      skipped++;
      continue;
    }
    const rowCopy = { ...row };
    delete rowCopy._ROLE;
    const ref = doc(collection(db, collectionName), docId);
    batch.set(ref, rowCopy);
    writeCount++;
    if (writeCount % 500 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  if (writeCount % 500 !== 0 && writeCount > 0) await batch.commit();
  console.log(`Firestore [${collectionName}]: ${writeCount} nuevos, ${skipped} duplicados omitidos`);
}

export async function saveSupData(data: DataRow[]): Promise<void> {
  await saveToCollection(COLLECTION_SUP, data, 'sup');
}

export async function saveEjecData(data: DataRow[]): Promise<void> {
  await saveToCollection(COLLECTION_EJEC, data, 'ejec');
}

export async function updateRowInFirestore(
  type: 'sup' | 'ejec',
  oldRow: DataRow,
  field: string,
  newValue: string
): Promise<void> {
  const collectionName = type === 'sup' ? COLLECTION_SUP : COLLECTION_EJEC;
  const oldDocId = generateRowId(oldRow, type);
  
  // Create updated row
  const updatedRow = { ...oldRow, [field]: newValue };
  delete updatedRow._ROLE;
  
  // If key fields changed, we need to delete old doc and create new one
  const keyFields = ['FECHA', 'SUPERVISOR', 'EJECUTIVO', 'CLIENTE', 'SUCURSAL', 'STATUS'];
  if (keyFields.includes(field)) {
    const newDocId = generateRowId(updatedRow, type);
    // Delete old, create new
    try { await deleteDoc(doc(db, collectionName, oldDocId)); } catch { /* ignore */ }
    await setDoc(doc(db, collectionName, newDocId), updatedRow);
  } else {
    // Just update in place
    try {
      await updateDoc(doc(db, collectionName, oldDocId), { [field]: newValue });
    } catch {
      // Doc might not exist, create it
      await setDoc(doc(db, collectionName, oldDocId), updatedRow);
    }
  }
}
