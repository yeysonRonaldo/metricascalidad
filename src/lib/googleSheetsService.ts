import Papa from 'papaparse';
import { convertDatesAndFill } from '@/lib/dataProcessing';
import type { DataRow } from '@/types/metrics';

const BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6fGiU2UFXQ_5GapwAN9kDUJvDIGZwBI9GPIeuzrVMub7g8mX9-M5UwwgeuLC-9Q/pub?output=csv';
const GID_BD = '1436157166';
const GID_EJECUTIVOS = '118118633';

function fetchCSV(gid: string): Promise<DataRow[]> {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}&gid=${gid}&cachebust=${Date.now()}`;
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = convertDatesAndFill(results.data as Record<string, unknown>[]);
        resolve(data);
      },
      error: (err: Error) => reject(err),
    });
  });
}

export async function fetchFromGoogleSheets(): Promise<{ supData: DataRow[]; ejecData: DataRow[] }> {
  const [supData, ejecData] = await Promise.all([
    fetchCSV(GID_BD),
    fetchCSV(GID_EJECUTIVOS),
  ]);
  return { supData, ejecData };
}
