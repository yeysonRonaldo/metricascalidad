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

  let raw: string;
  if (type === 'ejec_pend') {
    // Para pendientes muchos registros no tienen FECHA ni MES, así que
    // ampliamos la clave con más campos para evitar colisiones.
    const mes = (row.MES || '').toString().trim().toUpperCase();
    const tipo = (row['TIPO DE VISITA'] || '').toString().trim().toUpperCase();
    const obs = (row.OBSERVACIONES || '').toString().trim().toUpperCase();
    const ano = (row.AÑO || '').toString().trim();
    raw = `${fecha}|${ano}|${mes}|${person}|${cliente}|${sucursal}|${status}|${tipo}|${obs}`;
  } else {
    raw = `${fecha}|${person}|${cliente}|${sucursal}|${status}`;
  }

  // Simple hash
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

async function saveToCollection(collectionName: string, data: DataRow[], type: DataType, replace = false): Promise<void> {
  if (replace) {
    await clearCollection(collectionName);
  }

  const existingIds = new Set<string>();
  if (!replace) {
    const existing = await getDocs(collection(db, collectionName));
    existing.forEach((d) => existingIds.add(d.id));
  }

  // Track IDs used within this batch run (incluye los existentes)
  const usedIds = new Set<string>(existingIds);

  let batch = writeBatch(db);
  let writeCount = 0;

  for (const row of data) {
    let docId = generateRowId(row, type);

    // Para ejec_pend: si la clave ya existe (en BD o en este lote),
    // generar variantes únicas con sufijo numérico para no perder registros.
    if (type === 'ejec_pend' && usedIds.has(docId)) {
      let suffix = 1;
      let candidate = `${docId}_${suffix}`;
      while (usedIds.has(candidate)) {
        suffix++;
        candidate = `${docId}_${suffix}`;
      }
      docId = candidate;
    } else if (type !== 'ejec_pend' && existingIds.has(docId)) {
      // Comportamiento original: dedup por clave para sup/ejec
      continue;
    }

    usedIds.add(docId);

    const rowCopy = { ...row };
    delete rowCopy._ROLE;
    // Guardamos el docId en el propio documento para que update/delete usen exactamente este ID.
    if (type === 'ejec_pend') {
      (rowCopy as Record<string, unknown>)._docId = docId;
    }
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

export async function saveEjecPendientesData(data: DataRow[], replace = false): Promise<void> {
  await saveToCollection(COLLECTION_EJEC_PENDIENTES, data, 'ejec_pend', replace);
}

function resolveDocId(row: DataRow, type: DataType): string {
  // Si el row trae un _docId persistido (caso ejec_pend con sufijo), úsalo.
  const stored = (row as Record<string, unknown>)._docId;
  if (typeof stored === 'string' && stored.length > 0) return stored;
  return generateRowId(row, type);
}

export async function updateRowInFirestore(
  type: DataType,
  oldRow: DataRow,
  field: string,
  newValue: string
): Promise<void> {
  const collectionName = collectionFor(type);
  const oldDocId = resolveDocId(oldRow, type);

  const updatedRow = { ...oldRow, [field]: newValue };
  delete updatedRow._ROLE;

  // Para ejec_pend: el _docId se mantiene estable aunque cambie STATUS,
  // así que NO regeneramos el ID — solo actualizamos in place.
  if (type === 'ejec_pend') {
    (updatedRow as Record<string, unknown>)._docId = oldDocId;
    try {
      await updateDoc(doc(db, collectionName, oldDocId), { [field]: newValue });
    } catch {
      await setDoc(doc(db, collectionName, oldDocId), updatedRow);
    }
    return;
  }

  const keyFields = ['FECHA', 'SUPERVISOR', 'EJECUTIVO', 'CLIENTE', 'SUCURSAL', 'STATUS'];
  if (keyFields.includes(field)) {
    const newDocId = generateRowId(updatedRow, type);
    try { await deleteDoc(doc(db, collectionName, oldDocId)); } catch { /* ignore */ }
    await setDoc(doc(db, collectionName, newDocId), updatedRow);
  } else {
    try {
      await updateDoc(doc(db, collectionName, oldDocId), { [field]: newValue });
    } catch {
      await setDoc(doc(db, collectionName, oldDocId), updatedRow);
    }
  }
}

export async function deleteRowFromFirestore(type: DataType, row: DataRow): Promise<void> {
  const collectionName = collectionFor(type);
  const docId = resolveDocId(row, type);
  await deleteDoc(doc(db, collectionName, docId));
}

export async function deleteRowsBatchFromFirestore(type: DataType, rows: DataRow[]): Promise<void> {
  if (rows.length === 0) return;
  const collectionName = collectionFor(type);
  let batch = writeBatch(db);
  let count = 0;
  for (const row of rows) {
    const docId = resolveDocId(row, type);
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
