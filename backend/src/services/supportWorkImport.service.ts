import ExcelJS from 'exceljs';
import { createHash } from 'crypto';
import { inflateRawSync } from 'zlib';
import { dateOnly, utcDate, workStatuses, waitingReasons } from '../utils/supportWork';
import { z } from 'zod';

export const importRow = z.object({
    importKey: z.string().regex(/^[a-f0-9]{64}$/), row: z.number().int().positive(), workDate: dateOnly,
    contactName: z.string().trim().min(1).max(250), subject: z.string().trim().min(1).max(200),
    workDone: z.string().trim().min(1).max(10000), originalStatus: z.string().trim().min(1).max(100),
    statusAfter: z.enum(workStatuses), waitingReason: z.enum(waitingReasons).nullable(), group: z.string().trim().max(80).default('')
});
export const importRequest = z.object({ rows: z.array(importRow).min(1).max(500), followUpDate: dateOnly,
    nextAction: z.string().trim().min(1).max(1000), performedById: z.number().int().positive() });

function checkedZip(buffer: Buffer) {
    // Check actual inflated lengths before asking the spreadsheet parser to load the package.
    if (buffer.length > 2 * 1024 * 1024) throw new Error('Workbook must be 2 MB or smaller');
    let end = buffer.length - 22;
    while (end >= Math.max(0, buffer.length - 65557) && buffer.readUInt32LE(end) !== 0x06054b50) end--;
    if (end < 0 || end < buffer.length - 65557) throw new Error('Invalid XLSX package');
    const count = buffer.readUInt16LE(end + 10);
    let cursor = buffer.readUInt32LE(end + 16), remaining = 20 * 1024 * 1024;
    if (count > 200 || cursor >= end) throw new Error('Workbook package is too large');
    for (let i = 0; i < count; i++) {
        if (cursor + 46 > end || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid XLSX directory');
        const method = buffer.readUInt16LE(cursor + 10), size = buffer.readUInt32LE(cursor + 20), offset = buffer.readUInt32LE(cursor + 42);
        if (offset + 30 > cursor || buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error('Invalid XLSX entry');
        const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
        if (start + size > cursor || remaining < 1) throw new Error('Workbook package is too large');
        const data = buffer.subarray(start, start + size);
        const length = method === 8 ? inflateRawSync(data, { maxOutputLength: remaining }).length : method === 0 ? data.length : remaining + 1;
        remaining -= length;
        if (remaining < 0) throw new Error('Workbook package is too large');
        cursor += 46 + buffer.readUInt16LE(cursor + 28) + buffer.readUInt16LE(cursor + 30) + buffer.readUInt16LE(cursor + 32);
    }
}
const text = (value: ExcelJS.CellValue): string => {
    if (value == null) return '';
    if (typeof value === 'object' && 'richText' in value) return value.richText.map(part => part.text).join('');
    if (typeof value === 'object' && 'formula' in value) return text(value.result as ExcelJS.CellValue);
    if (typeof value === 'object' && 'text' in value) return value.text;
    return String(value).trim();
};
function workDate(value: ExcelJS.CellValue) {
    if (value instanceof Date) return dateOnly.parse(value.toISOString().slice(0, 10));
    if (typeof value === 'number') return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString().slice(0, 10);
    const raw = text(value), match = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    return dateOnly.parse(match ? `${match[3]}-${match[2]}-${match[1]}` : raw);
}
function normalizeStatus(raw: string): { statusAfter: typeof workStatuses[number]; waitingReason: typeof waitingReasons[number] | null } {
    const value = raw.toLowerCase();
    if (/cancel|not joining/.test(value)) return { statusAfter: 'Cancelled', waitingReason: null };
    if (/^(completed|resolved|closed)$/.test(value)) return { statusAfter: 'Completed', waitingReason: null };
    if (/verif|confirmation/.test(value)) return { statusAfter: 'Waiting', waitingReason: 'Verification' };
    if (/payment/.test(value)) return { statusAfter: 'Waiting', waitingReason: 'Payment' };
    if (/approval/.test(value)) return { statusAfter: 'Waiting', waitingReason: 'Approval' };
    if (/vendor/.test(value)) return { statusAfter: 'Waiting', waitingReason: 'Vendor' };
    if (/user/.test(value)) return { statusAfter: 'Waiting', waitingReason: 'User' };
    return { statusAfter: 'In progress', waitingReason: null };
}

export async function previewWorkImport(buffer: Buffer) {
    checkedZip(buffer);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet('Work Report') || workbook.worksheets[0];
    if (!sheet || sheet.rowCount > 501) throw new Error('Choose a Work Report with up to 500 entries');
    const expected = ['sl. no', 'date', 'user/department', 'issue', 'description', 'status'];
    if (expected.some((value, index) => text(sheet.getRow(1).getCell(index + 1).value).toLowerCase() !== value)) throw new Error('Expected columns: Sl. No, Date, User/Department, Issue, Description, Status');
    const hash = createHash('sha256').update(buffer).digest('hex');
    const rows: z.infer<typeof importRow>[] = [], errors: string[] = [];
    sheet.eachRow((row, number) => {
        if (number === 1 || [2, 3, 4, 5, 6].every(column => !text(row.getCell(column).value))) return;
        try {
            const originalStatus = text(row.getCell(6).value);
            rows.push(importRow.parse({ importKey: createHash('sha256').update(`${hash}:${sheet.id}:${number}`).digest('hex'), row: number,
                workDate: workDate(row.getCell(2).value), contactName: text(row.getCell(3).value), subject: text(row.getCell(4).value),
                workDone: text(row.getCell(5).value), originalStatus, ...normalizeStatus(originalStatus), group: '' }));
        } catch { errors.push(`Row ${number}: check date, contact, issue, description, and status`); }
    });
    const dates = rows.map(row => row.workDate).sort();
    return { rows, errors, start: dates[0], end: dates.at(-1), sheet: sheet.name };
}
export { utcDate };
