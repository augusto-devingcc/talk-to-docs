import * as XLSX from 'xlsx';

export async function parse(buffer: Buffer): Promise<{ text: string; pages?: number }> {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    const rows = csv.split('\n').filter((line) => line.trim().length > 0);
    const reformatted = rows
      .map((line) =>
        line
          .split(',')
          .map((cell) => cell.trim())
          .join(' | '),
      )
      .join('\n');
    parts.push(`# Sheet: ${sheetName}\n${reformatted}`);
  }
  return { text: parts.join('\n\n'), pages: wb.SheetNames.length };
}
