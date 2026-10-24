import ExcelJS from 'exceljs';
import { reportStatus } from '../utils/supportWork';

type ReportActivity = { workDate: Date; contactName: string; subject: string; workDone: string; statusAfter: string; waitingReason?: string | null };

export async function buildWorkReport(rows: ReportActivity[]) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Avana IT Management';
    const sheet = workbook.addWorksheet('Work Report', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
        { header: 'Sl. No', key: 'serial', width: 9 }, { header: 'Date', key: 'date', width: 15 },
        { header: 'User/Department', key: 'contact', width: 32 }, { header: 'Issue', key: 'subject', width: 40 },
        { header: 'Description', key: 'description', width: 90 }, { header: 'Status', key: 'status', width: 28 }
    ];
    rows.forEach((row, index) => {
        const added = sheet.addRow({ serial: index + 1, date: row.workDate, contact: row.contactName, subject: row.subject, description: row.workDone, status: reportStatus(row) });
        added.getCell(2).numFmt = 'dd-mm-yyyy';
        added.alignment = { vertical: 'top', wrapText: true };
        added.height = Math.min(180, Math.max(32, Math.ceil(row.workDone.length / 85) * 16));
    });
    sheet.getRow(1).height = 28;
    sheet.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF936709' } };
        cell.alignment = { vertical: 'middle' };
    });
    sheet.autoFilter = { from: 'A1', to: `F${Math.max(1, rows.length + 1)}` };
    sheet.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' };
    // String values stay literal, including text beginning with '='. Never create formulas from work notes.
    return Buffer.from(await workbook.xlsx.writeBuffer());
}
