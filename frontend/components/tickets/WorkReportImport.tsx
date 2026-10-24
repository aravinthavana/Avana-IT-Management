import React, { useState } from 'react';
import { API_URL } from '../../utils/apiClient';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';

interface ImportRow {
    importKey: string; row: number; workDate: string; subject: string; contactName: string; workDone: string;
    originalStatus: string; statusAfter: string; waitingReason: string | null; group: string; duplicate: boolean; selected: boolean;
}
interface Preview { rows: ImportRow[]; errors: string[]; start: string; end: string }
const inputClass = 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-sm';
const buttonClass = 'rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-semibold disabled:opacity-50';
const ongoing = (row: ImportRow) => !['Completed', 'Cancelled'].includes(row.statusAfter);

export default function WorkReportImport({ today, cases, onImported }: {
    today: string; cases: { id: number; subject: string }[]; onImported: (start: string, end: string, technician: string) => void;
}) {
    const { users, getHeaders, setNotification } = useAppContext();
    const { user } = useAuth();
    const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [preview, setPreview] = useState<Preview | null>(null);
    const [technician, setTechnician] = useState(String(user!.id));
    const [followUp, setFollowUp] = useState(today);
    const [nextAction, setNextAction] = useState('Review outstanding imported work');
    const [confirmed, setConfirmed] = useState(false);
    const ref = useDialogAccessibility(open, () => { if (!busy) setOpen(false); });
    const selected = preview?.rows.filter(row => row.selected && !row.duplicate) || [];
    const missingGroup = selected.some(row => ongoing(row) && !row.group.trim());
    const changeRow = (index: number, values: Partial<ImportRow>) => {
        setConfirmed(false); setPreview(current => current ? { ...current, rows: current.rows.map((row, i) => i === index ? { ...row, ...values } : row) } : current);
    };
    const read = async (file?: File) => {
        if (!file) return;
        setBusy(true); setError(''); setPreview(null); setConfirmed(false);
        try {
            if (file.size > 2 * 1024 * 1024) throw new Error('Choose a workbook of 2 MB or smaller.');
            const data = new FormData(); data.append('file', file);
            const headers = { ...getHeaders() }; delete headers['Content-Type'];
            const response = await fetch(`${API_URL}/api/support-work/import/preview`, { method: 'POST', headers, credentials: 'include', body: data });
            const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Preview failed');
            setPreview({ ...result, rows: result.rows.map((row: ImportRow) => ({ ...row, selected: !row.duplicate })) });
        } catch (problem) { setError((problem as Error).message); }
        finally { setBusy(false); }
    };
    const commit = async () => {
        if (!preview || !selected.length || missingGroup || !confirmed) return;
        setBusy(true); setError('');
        try {
            const response = await fetch(`${API_URL}/api/support-work/import`, { method: 'POST', headers: getHeaders(), credentials: 'include',
                body: JSON.stringify({ rows: selected, performedById: Number(technician), followUpDate: followUp, nextAction }) });
            const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Import failed');
            setNotification({ message: `Imported ${result.imported} activities. Skipped ${result.skipped} previously imported entries. No emails sent.`, type: 'success' });
            onImported(preview.start, preview.end, technician); setOpen(false); setPreview(null);
        } catch (problem) { setError((problem as Error).message); }
        finally { setBusy(false); }
    };
    return <>
        <button className={buttonClass} onClick={() => { setOpen(true); setError(''); setPreview(null); setConfirmed(false); }}>Import Excel report</button>
        {open && <div className="fixed inset-0 z-50 bg-black/50 p-2 sm:p-6 flex justify-center items-center"><div ref={ref} role="dialog" aria-modal="true" aria-labelledby="import-work-title" tabIndex={-1} className="w-full max-w-6xl max-h-[94dvh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 p-4 sm:p-6 space-y-4">
            <div className="flex justify-between gap-3 items-start"><div><h3 id="import-work-title" className="text-xl font-bold">Import weekly work report</h3><p className="text-sm text-slate-500 mt-1">Review dates, outcomes, and related cases before saving. All imported records stay private. No emails are sent.</p></div><button className={buttonClass} disabled={busy} onClick={() => setOpen(false)}>Cancel</button></div>
            <label className="block text-sm space-y-2">Choose your six-column work report (.xlsx)<input disabled={busy} className="block w-full" type="file" accept=".xlsx" onChange={event => { read(event.target.files?.[0]); event.target.value = ''; }} /></label>
            {busy && <p role="status">Processing workbook…</p>}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            {preview && <>
                <p className="text-sm font-semibold">{preview.rows.length} entries. Actual work dates: {preview.start} to {preview.end}. {preview.rows.filter(row => row.duplicate).length} already imported.</p>
                <p className="text-sm text-slate-500">Related rows should share a case group, such as “Battery replacement”. Use # and a case number to link an existing case. Completed work can stay standalone. Original spreadsheet statuses are preserved in Excel exports.</p>
                {preview.errors.length > 0 && <div role="alert" className="text-sm text-red-600">Fix these source rows and upload again: {preview.errors.join('; ')}</div>}
                <fieldset disabled={busy} className="space-y-4">
                    <div className="grid sm:grid-cols-3 gap-3">
                        <label className="text-sm space-y-1 block">Work performed by<select className={inputClass} value={technician} onChange={event => { setTechnician(event.target.value); setConfirmed(false); }}>{users.filter(person => person.role === 'Admin' && person.status === 'Active').map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
                        <label className="text-sm space-y-1 block">Follow-up date for outstanding work<input className={inputClass} type="date" value={followUp} onChange={event => { setFollowUp(event.target.value); setConfirmed(false); }} /></label>
                        <label className="text-sm space-y-1 block">Next action for outstanding work<input className={inputClass} maxLength={1000} value={nextAction} onChange={event => { setNextAction(event.target.value); setConfirmed(false); }} /></label>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 max-h-[45dvh]"><table className="w-full text-sm text-left min-w-[950px]">
                        <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0"><tr>{['Include', 'Work date', 'User / department', 'Issue / work done', 'Outcome', 'Case group'].map(title => <th key={title} className="p-3">{title}</th>)}</tr></thead>
                        <tbody>{preview.rows.map((row, index) => <tr key={row.importKey} className="border-t border-slate-200 dark:border-slate-700 align-top">
                            <td className="p-3"><input aria-label={`Include source row ${row.row}`} type="checkbox" disabled={row.duplicate} checked={row.selected && !row.duplicate} onChange={event => changeRow(index, { selected: event.target.checked })} />{row.duplicate && <span className="block text-xs">Imported</span>}</td>
                            <td className="p-3 whitespace-nowrap">{row.workDate}</td><td className="p-3 max-w-48 break-words">{row.contactName}</td>
                            <td className="p-3 max-w-80"><p className="font-semibold">{row.subject}</p><details className="mt-1 text-xs"><summary className="cursor-pointer">Work description</summary><p className="whitespace-pre-wrap break-words">{row.workDone}</p></details></td>
                            <td className="p-3 space-y-2"><span className="block text-xs text-slate-500">Original: {row.originalStatus}</span><select aria-label={`Outcome for source row ${row.row}`} className={inputClass} value={row.statusAfter} onChange={event => changeRow(index, { statusAfter: event.target.value, waitingReason: event.target.value === 'Waiting' ? row.waitingReason || 'Other' : null })}>{['Open', 'In progress', 'Waiting', 'Completed', 'Cancelled'].map(value => <option key={value}>{value}</option>)}</select>{row.statusAfter === 'Waiting' && <select className={inputClass} aria-label={`Waiting reason for source row ${row.row}`} value={row.waitingReason || 'Other'} onChange={event => changeRow(index, { waitingReason: event.target.value })}>{['Approval', 'Payment', 'Vendor', 'User', 'Verification', 'Other'].map(value => <option key={value}>{value}</option>)}</select>}</td>
                            <td className="p-3"><input aria-label={`Case group for source row ${row.row}`} list="import-case-groups" className={inputClass} value={row.group} placeholder={ongoing(row) ? 'Required for ongoing work' : 'Standalone, or enter a group'} maxLength={80} onChange={event => changeRow(index, { group: event.target.value })} /></td>
                        </tr>)}</tbody>
                    </table></div>
                    <datalist id="import-case-groups">{Array.from(new Set(preview.rows.map(row => row.group).filter(Boolean))).map(group => <option key={group} value={group} />)}{cases.map(item => <option key={item.id} value={`#${item.id}`}>{item.subject}</option>)}</datalist>
                    {missingGroup && <p className="text-sm text-amber-700 dark:text-amber-300">Give every selected ongoing entry a case group. Use the same group for its later completed entries to close that case correctly.</p>}
                    <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I reviewed the selected rows, date range, outcomes, and case groups.</span></label>
                    <button className="rounded-xl bg-brand-600 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50" disabled={!confirmed || missingGroup || !selected.length || preview.errors.length > 0 || !followUp || !nextAction.trim()} onClick={commit}>Import {selected.length} selected activities</button>
                </fieldset>
            </>}
        </div></div>}
    </>;
}
