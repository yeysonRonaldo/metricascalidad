import { collection, getDocs, doc, writeBatch, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { convertDatesAndFill } from "@/lib/dataProcessing";
import type { DataRow } from "@/types/metrics";

const COLLECTION_SUP = "visitas_supervisores";
const COLLECTION_EJEC = "visitas_ejecutivos";
const COLLECTION_EJEC_PENDIENTES = "visitas_ejecutivos_pendientes";

type DataType = 'sup' | 'ejec' | 'ejec_pend';

function collectionFor(type: DataType): string {
  if (type === 'sup') return COLLECTION_SUP;
  if (type === 'ejec') return COLLECTION_EJEC;
  return COLLECTION_EJEC_PENDIENTES;
}

function generateRowId(row: DataRow, type: DataType): string {
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

export async function fetchVisitasData(): Promise<{ supData: DataRow[]; ejecData: DataRow[]; ejecPendientesData: DataRow[] }> {
  const [supSnap, ejecSnap, ejecPendSnap] = await Promise.all([
    getDocs(collection(db, COLLECTION_SUP)),
    getDocs(collection(db, COLLECTION_EJEC)),
    getDocs(collection(db, COLLECTION_EJEC_PENDIENTES)),
  ]);

  const rawSup: Record<string, unknown>[] = [];
  supSnap.forEach((d) => rawSup.push({ id: d.id, ...d.data() }));

  const rawEjec: Record<string, unknown>[] = [];
  ejecSnap.forEach((d) => rawEjec.push({ id: d.id, ...d.data() }));

  const rawEjecPend: Record<string, unknown>[] = [];
  ejecPendSnap.forEach((d) => rawEjecPend.push({ id: d.id, ...d.data() }));

  const supData = convertDatesAndFill(rawSup);
  const ejecData = convertDatesAndFill(rawEjec);
  const ejecPendientesData = convertDatesAndFill(rawEjecPend);

  return { supData, ejecData, ejecPendientesData };
}

async function clearCollection(collectionName: string): Promise<void> {
  const snapshot = await getDocs(collection(db, collectionName));
  if (snapshot.empty) return;
  let batch = writeBatch(db);
  let count = 0;
  snapshot.forEach((d) => {
    batch.delete(d.ref);
    count++;
    if (count % 500 === 0) {
      batch.commit();
      batch = writeBatch(db);
    }
  });
  if (count % 500 !== 0) await batch.commit();
  console.log(`Firestore [${collectionName}]: ${count} documentos eliminados`);
}

async function saveToCollection(collectionName: string, data: DataRow[], type: 'sup' | 'ejec', replace = false): Promise<void> {
  if (replace) {
    await clearCollection(collectionName);
  }

  const existingIds = new Set<string>();
  if (!replace) {
    const existing = await getDocs(collection(db, collectionName));
    existing.forEach((d) => existingIds.add(d.id));
  }

  let batch = writeBatch(db);
  let writeCount = 0;

  for (const row of data) {
    const docId = generateRowId(row, type);
    if (existingIds.has(docId)) continue;
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
  console.log(`Firestore [${collectionName}]: ${writeCount} escritos${replace ? ' (reemplazo completo)' : ''}`);
}

export async function saveSupData(data: DataRow[], replace = false): Promise<void> {
  await saveToCollection(COLLECTION_SUP, data, 'sup', replace);
}

export async function saveEjecData(data: DataRow[], replace = false): Promise<void> {
  await saveToCollection(COLLECTION_EJEC, data, 'ejec', replace);
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

export async function deleteRowFromFirestore(type: 'sup' | 'ejec', row: DataRow): Promise<void> {
  const collectionName = type === 'sup' ? COLLECTION_SUP : COLLECTION_EJEC;
  const docId = generateRowId(row, type);
  await deleteDoc(doc(db, collectionName, docId));
}

export async function deleteRowsBatchFromFirestore(type: 'sup' | 'ejec', rows: DataRow[]): Promise<void> {
  if (rows.length === 0) return;
  const collectionName = type === 'sup' ? COLLECTION_SUP : COLLECTION_EJEC;
  let batch = writeBatch(db);
  let count = 0;
  for (const row of rows) {
    const docId = generateRowId(row, type);
    batch.delete(doc(db, collectionName, docId));
    count++;
    if (count % 500 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  if (count % 500 !== 0) await batch.commit();
  console.log(`Firestore [${collectionName}]: ${count} documentos eliminados (batch)`);
}
