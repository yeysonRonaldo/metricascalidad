import { convertDatesAndFill } from '@/lib/dataProcessing';
import type { DataRow } from '@/types/metrics';

const SHEET_ID = '2PACX-1vS6fGiU2UFXQ_5GapwAN9kDUJvDIGZwBI9GPIeuzrVMub7g8mX9-M5UwwgeuLC-9Q';
const GID_BD = '1436157166';
const GID_EJECUTIVOS = '118118633';

function buildCsvUrl(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?output=csv&gid=${gid}&cachebust=${Date.now()}`;
}

function parseCSV(text: string): Record<string, unknown>[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, unknown>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

async function fetchCSV(gid: string): Promise<DataRow[]> {
  const url = buildCsvUrl(gid);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  const raw = parseCSV(text);
  return convertDatesAndFill(raw);
}

export async function fetchFromGoogleSheets(): Promise<{ supData: DataRow[]; ejecData: DataRow[] }> {
  const [supData, ejecData] = await Promise.all([
    fetchCSV(GID_BD),
    fetchCSV(GID_EJECUTIVOS),
  ]);
  return { supData, ejecData };
}
