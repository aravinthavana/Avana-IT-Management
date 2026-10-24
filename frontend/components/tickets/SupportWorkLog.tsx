import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../hooks/useAppContext';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';
import { API_URL } from '../../utils/apiClient';
import { TicketAttachment } from '../../types';
import WorkReportImport from './WorkReportImport';

type WorkStatus = 'Open' | 'In progress' | 'Waiting' | 'Completed' | 'Cancelled';
type Person = { id: number; name: string };
interface WorkActivity {
    id: number; caseId?: number; workDate: string; subject: string; contactName: string; contactUserId?: number;
    channel: string; category: string; priority: string; workDone: string; statusAfter: WorkStatus;
    waitingReason?: string; nextAction?: string; followUpDate?: string; performedById: number; performedBy?: Person;
    recordedBy?: Person; createdAt: string; effortMinutes?: number; assetId?: number; attachments?: string;
    notificationStatus: string; originalStatus?: string; affectedUserId?: number;
}
interface WorkCase {
    id: number; subject: string; contactName: string; contactUserId?: number; status: WorkStatus; revision: number;
    assignedToId: number; assignedTo?: Person; waitingReason?: string; nextAction?: string; followUpDate?: string;
    activities?: WorkActivity[]; _count?: { activities: number }; affectedUserId?: number;
}
interface Entry {
    clientRequestId: string; caseId?: number; caseRevision?: number; createCase: boolean; workDate: string;
    subject: string; contactName: string; contactUserId?: number; channel: string; category: string; priority: string;
    workDone: string; statusAfter: WorkStatus; waitingReason: string; nextAction: string; followUpDate: string; affectedUserId?: number;
    performedById: number; assignedToId: number; effortMinutes: string; assetId: string; attachments: TicketAttachment[]; notifyEmployee: boolean;
}
const channels = ['Phone', 'WhatsApp / message', 'Email', 'Walk-in', 'Internal work', 'Portal', 'Unspecified'];
const categories = ['Hardware', 'Software', 'Email', 'Network', 'Account', 'Onboarding / offboarding', 'Purchase / vendor', 'Project / website', 'Documentation', 'Other'];
const reasons = ['Approval', 'Payment', 'Vendor', 'User', 'Verification', 'Other'];
const statuses: WorkStatus[] = ['Open', 'In progress', 'Waiting', 'Completed', 'Cancelled'];
export function indiaDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const part = (type: string) => parts.find(value => value.type === type)!.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}
function weekStart(today: string) {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
}
const day = (value?: string) => value?.slice(0, 10) || '';
const displayDate = (value: string) => day(value).split('-').reverse().join('-');
const label = (value: { status?: string; statusAfter?: string; waitingReason?: string }) => (value.status || value.statusAfter) === 'Waiting' ? `Waiting on ${value.waitingReason || 'Other'}` : value.status || value.statusAfter;
const fieldClass = 'w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';
const secondary = 'rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50';
const primary = 'rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50';
function Field({ title, children }: { title: string; children: React.ReactNode }) {
    const id = React.useId();
    return <div className="block space-y-1.5 text-sm font-medium"><label className="block" htmlFor={id}>{title}</label>{React.Children.map(children, child =>
        React.isValidElement<{ id?: string }>(child) && typeof child.type === 'string' && ['input', 'select', 'textarea'].includes(child.type)
            ? React.cloneElement(child, { id }) : child)}</div>;
}
function attachmentsOf(value?: string): TicketAttachment[] { try { return JSON.parse(value || '[]'); } catch { return []; } }

const SupportWorkLog: React.FC = () => {
    const { user } = useAuth();
    const { users, assets, getHeaders, setNotification } = useAppContext();
    const today = indiaDate();
    const [start, setStart] = useState(() => weekStart(today));
    const [end, setEnd] = useState(today);
    const [technician, setTechnician] = useState(String(user?.id || ''));
    const [cases, setCases] = useState<WorkCase[]>([]);
    const [activities, setActivities] = useState<WorkActivity[]>([]);
    const [view, setView] = useState('Work log');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refresh, setRefresh] = useState(0);
    const [entry, setEntry] = useState<Entry | null>(null);
    const [entryError, setEntryError] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [detail, setDetail] = useState<WorkCase | null>(null);
    const [single, setSingle] = useState<WorkActivity | null>(null);
    const [detailBusy, setDetailBusy] = useState(false);
    const formRef = useDialogAccessibility(Boolean(entry), () => { if (!saving && !uploading) setEntry(null); });
    const detailRef = useDialogAccessibility(Boolean(detail || single), () => { setDetail(null); setSingle(null); });
    const admins = users.filter(person => person.role === 'Admin' && person.status === 'Active');
    const periodValid = Boolean(start && end && start <= end);

    useEffect(() => {
        if (!periodValid) { setLoading(false); setError('Choose a valid report date range.'); return; }
        const controller = new AbortController();
        setLoading(true); setError('');
        const options = { headers: getHeaders(), credentials: 'include' as const, signal: controller.signal };
        const query = new URLSearchParams({ start, end, ...(technician ? { technicianId: technician } : {}) });
        Promise.all([fetch(`${API_URL}/api/support-work`, options), fetch(`${API_URL}/api/support-work/activities?${query}`, options)])
            .then(async responses => {
                const values = await Promise.all(responses.map(response => response.json()));
                if (controller.signal.aborted) return;
                const failed = responses.findIndex(response => !response.ok);
                if (failed >= 0) throw new Error(values[failed].error || 'Unable to load the work log');
                setCases(values[0].cases); setActivities(values[1].activities);
            }).catch(problem => { if (!controller.signal.aborted) setError(problem.message); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [start, end, technician, refresh, getHeaders, periodValid]);

    const fresh = (completed: boolean): Entry => ({ clientRequestId: crypto.randomUUID(), createCase: !completed,
        workDate: today, subject: '', contactName: '', channel: 'Phone', category: 'Other', priority: 'Medium', workDone: '',
        statusAfter: completed ? 'Completed' : 'Open', waitingReason: 'User', nextAction: '', followUpDate: today,
        performedById: user!.id, assignedToId: user!.id, effortMinutes: '', assetId: '', attachments: [], notifyEmployee: false });
    const openEntry = (completed: boolean, linked?: WorkCase) => {
        setEntryError('');
        const base = fresh(completed);
        if (linked) {
            const last = linked.activities?.at(-1);
            Object.assign(base, { caseId: linked.id, caseRevision: linked.revision, createCase: false, subject: linked.subject,
                contactName: linked.contactName, contactUserId: linked.contactUserId, affectedUserId: linked.affectedUserId, assignedToId: linked.assignedToId,
                statusAfter: ['Completed', 'Cancelled'].includes(linked.status) ? 'In progress' : linked.status,
                waitingReason: linked.waitingReason || 'User', nextAction: linked.nextAction || '', followUpDate: day(linked.followUpDate) || today,
                category: last?.category || 'Other', assetId: last?.assetId ? String(last.assetId) : '' });
        }
        setEntry(base); setDetail(null); setSingle(null);
    };
    const change = <K extends keyof Entry>(key: K, value: Entry[K]) => setEntry(current => current ? { ...current, [key]: value } : current);
    const showCase = async (id: number) => {
        setDetailBusy(true);
        try {
            const response = await fetch(`${API_URL}/api/support-work/cases/${id}`, { headers: getHeaders(), credentials: 'include' });
            const value = await response.json(); if (!response.ok) throw new Error(value.error);
            setSingle(null); setDetail(value);
        } catch (problem) { setNotification({ message: (problem as Error).message, type: 'error' }); }
        finally { setDetailBusy(false); }
    };
    const save = async (another: boolean) => {
        if (!entry || saving || uploading) return;
        setSaving(true); setEntryError('');
        try {
            const response = await fetch(`${API_URL}/api/support-work/activities`, { method: 'POST', headers: getHeaders(), credentials: 'include',
                body: JSON.stringify({ ...entry, effortMinutes: entry.effortMinutes ? Number(entry.effortMinutes) : null,
                    assetId: entry.assetId ? Number(entry.assetId) : null, followUpDate: entry.followUpDate || null }) });
            const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Unable to save');
            const mail = value.activity.notificationStatus;
            setNotification({ message: mail === 'Failed' ? 'Work saved. The email could not be sent.' : value.duplicate ? 'This entry was already saved.' : 'Work saved.', type: mail === 'Failed' ? 'error' : 'success' });
            setRefresh(value => value + 1);
            setEntry(another ? fresh(entry.statusAfter === 'Completed') : null);
        } catch (problem) { setEntryError((problem as Error).message); }
        finally { setSaving(false); }
    };
    const upload = async (file?: File) => {
        if (!file || !entry) return;
        if (file.size > 5 * 1024 * 1024) { setEntryError('Attachments must be 5 MB or smaller.'); return; }
        setUploading(true); setEntryError('');
        try {
            const data = new FormData(); data.append('file', file);
            const headers = { ...getHeaders() }; delete headers['Content-Type'];
            const response = await fetch(`${API_URL}/api/support-work/attachments`, { method: 'POST', headers, credentials: 'include', body: data });
            const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Upload failed');
            const url = new URL(result.url, API_URL || window.location.origin).href;
            change('attachments', [...entry.attachments, { url, name: result.name || file.name, size: file.size, type: file.type }]);
        } catch (problem) { setEntryError((problem as Error).message); }
        finally { setUploading(false); }
    };
    const exportReport = async () => {
        setExporting(true);
        try {
            const query = new URLSearchParams({ start, end, ...(technician ? { technicianId: technician } : {}) });
            const response = await fetch(`${API_URL}/api/support-work/report.xlsx?${query}`, { headers: getHeaders(), credentials: 'include' });
            if (!response.ok) throw new Error((await response.json()).error || 'Export failed');
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement('a'); link.href = url; link.download = `IT-Work-Report-${start}-to-${end}.xlsx`; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (problem) { setNotification({ message: (problem as Error).message, type: 'error' }); }
        finally { setExporting(false); }
    };
    const ownCases = cases.filter(item => !technician || String(item.assignedToId) === technician);
    const due = ownCases.filter(item => !['Completed', 'Cancelled'].includes(item.status) && day(item.followUpDate) && day(item.followUpDate) <= today);
    const visibleCases = (view === 'Follow-ups due' ? due : view === 'Waiting' ? ownCases.filter(item => item.status === 'Waiting') : ownCases)
        .filter(item => `${item.id} ${item.subject} ${item.contactName} ${item.nextAction || ''}`.toLowerCase().includes(search.toLowerCase()));
    const visibleActivities = useMemo(() => activities.filter(item => (view !== 'Completed' || item.statusAfter === 'Completed') &&
        `${item.subject} ${item.contactName} ${item.workDone} ${item.caseId || ''}`.toLowerCase().includes(search.toLowerCase())), [activities, search, view]);
    const activityView = view === 'Work log' || view === 'Completed';
    const renderActivity = (item: WorkActivity) => <article key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
        <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>{displayDate(item.workDate)} · {item.channel} · {item.performedBy?.name}</span><span>{label(item)}</span></div>
        <h4 className="font-semibold break-words">{item.subject}</h4><p className="text-sm text-slate-500 break-words">{item.contactName}</p>
        <p className="text-sm whitespace-pre-wrap break-words">{item.workDone}</p>
        {item.affectedUserId && <p className="text-xs text-slate-500">Affected employee: {users.find(person => person.id === item.affectedUserId)?.name || `Employee #${item.affectedUserId}`}</p>}
        {item.nextAction && <p className="text-sm"><strong>Next:</strong> {item.nextAction}{item.followUpDate && ` · ${displayDate(item.followUpDate)}`}</p>}
        <p className="text-xs text-slate-500">Recorded by {item.recordedBy?.name || 'IT'} on {displayDate(indiaDate(new Date(item.createdAt)))}. Email: {item.notificationStatus}.{item.effortMinutes ? ` Time: ${item.effortMinutes} min.` : ''}{item.originalStatus ? ` Original report status: ${item.originalStatus}.` : ''}</p>
        {attachmentsOf(item.attachments).map((attachment, index) => /^https?:\/\//.test(attachment.url) && <a key={index} className="block text-sm underline text-brand-700 dark:text-brand-300" href={attachment.url} target="_blank" rel="noreferrer">{attachment.name}</a>)}
    </article>;

    return <section className="space-y-5 text-slate-800 dark:text-slate-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
            <div><h2 className="text-2xl font-bold">IT Support & Work Log</h2><p className="text-sm text-slate-500 mt-1">Log calls, messages, emails, and IT work. Records are private to IT.</p></div>
            <div className="flex flex-wrap gap-2"><button className={primary} onClick={() => openEntry(true)}>Log completed work</button><button className={secondary} onClick={() => openEntry(false)}>Log request / follow-up</button><WorkReportImport today={today} cases={cases} onImported={(from, to, owner) => { setStart(from); setEnd(to); setTechnician(owner); setView('Work log'); setRefresh(value => value + 1); }} /></div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[['Activities in report period', activities.length], ['Cases touched in period', new Set(activities.map(item => item.caseId).filter(Boolean)).size], ['Follow-ups due', due.length], ['Open cases', ownCases.filter(item => !['Completed', 'Cancelled'].includes(item.status)).length]].map(([title, value]) =>
                <div key={title} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"><p className="text-xs text-slate-500">{title}</p><p className="text-2xl font-bold mt-2">{value}</p></div>)}
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-4">
            <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3 items-end">
                <Field title="Report from"><input className={fieldClass} type="date" value={start} max={end} onChange={event => setStart(event.target.value)} /></Field>
                <Field title="Report to"><input className={fieldClass} type="date" value={end} min={start} onChange={event => setEnd(event.target.value)} /></Field>
                <Field title="Technician"><select className={fieldClass} value={technician} onChange={event => setTechnician(event.target.value)}><option value="">All IT technicians</option>{admins.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field>
                <button className={secondary} onClick={() => { setStart(today); setEnd(today); setView('Work log'); }}>Today’s work</button>
                <button className={primary} disabled={!periodValid || exporting} onClick={exportReport}>{exporting ? 'Exporting…' : 'Export weekly Excel'}</button>
            </div>
            <p className="text-xs text-slate-500">Excel includes every activity in the chosen date range and technician filter. Search and queue tabs do not change the report.</p>
            <div className="flex flex-wrap gap-2" aria-label="Work log views">{['Work log', 'Follow-ups due', 'Waiting', 'All cases', 'Completed'].map(name => <button key={name} aria-pressed={view === name} className={view === name ? primary : secondary} onClick={() => setView(name)}>{name}</button>)}</div>
            <input aria-label="Search work records" className={fieldClass} placeholder="Search by person, issue, work done, or case number" value={search} onChange={event => setSearch(event.target.value)} />
            {!activityView && <p className="text-xs text-slate-500">Case queues show current status across all dates, filtered by assigned technician.</p>}
            {error ? <div role="alert" className="text-red-600 space-y-2"><p>{error}</p><button className={secondary} onClick={() => setRefresh(value => value + 1)}>Retry</button></div> : loading ? <p role="status" className="py-8 text-center text-slate-500">Loading work records…</p> : activityView ?
                <div className="space-y-3">{visibleActivities.length === 0 && <p className="py-8 text-center text-slate-500">No work entries match this view.</p>}{visibleActivities.map(item => <div key={item.id} className="space-y-2">{renderActivity(item)}<button className="text-sm font-semibold text-brand-700 dark:text-brand-300 underline" disabled={detailBusy} onClick={() => item.caseId ? showCase(item.caseId) : setSingle(item)}>{item.caseId ? `View case #${item.caseId}` : 'View standalone entry'}</button></div>)}</div> :
                <div className="space-y-3">{visibleCases.length === 0 && <p className="py-8 text-center text-slate-500">No cases match this view.</p>}{visibleCases.map(item => <button key={item.id} disabled={detailBusy} onClick={() => showCase(item.id)} className="block w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:bg-slate-50 dark:hover:bg-slate-900 space-y-2">
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>Case #{item.id} · {item.assignedTo?.name}</span><span>{label(item)}</span></div><p className="font-semibold break-words">{item.subject}</p><p className="text-sm text-slate-500 break-words">{item.contactName}</p><p className="text-sm break-words">{item.nextAction || 'No further action'}{item.followUpDate && ` · Follow up ${displayDate(item.followUpDate)}`}</p><p className="text-xs text-slate-500">{item._count?.activities || 0} activities</p>
                </button>)}</div>}
        </div>
        {(detail || single) && <div className="fixed inset-0 z-50 bg-black/50 p-3 sm:p-6 flex items-center justify-center"><div ref={detailRef} role="dialog" aria-modal="true" aria-labelledby="work-detail-title" tabIndex={-1} className="w-full max-w-3xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 p-5 space-y-4">
            <div className="flex justify-between gap-3"><h3 id="work-detail-title" className="text-xl font-bold break-words">{detail ? `Case #${detail.id}: ${detail.subject}` : single?.subject}</h3><button aria-label="Close work details" className={secondary} onClick={() => { setDetail(null); setSingle(null); }}>Close</button></div>
            {detail && <><p>{detail.contactName} · {label(detail)}</p><p className="text-sm text-slate-500">Assigned to {detail.assignedTo?.name}. {detail.nextAction}{detail.followUpDate && ` · Follow up ${displayDate(detail.followUpDate)}`}</p><button className={primary} onClick={() => openEntry(false, detail)}>Add work / follow-up update</button></>}
            {(detail?.activities || (single ? [single] : [])).map(renderActivity)}
        </div></div>}
        {entry && <div className="fixed inset-0 z-[60] bg-black/50 p-2 sm:p-6 flex items-center justify-center"><div ref={formRef} role="dialog" aria-modal="true" aria-labelledby="work-entry-title" tabIndex={-1} className="w-full max-w-2xl max-h-[94dvh] flex flex-col rounded-2xl bg-white dark:bg-slate-800 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center gap-3"><div><h3 id="work-entry-title" className="text-xl font-bold">{entry.caseId ? `Update case #${entry.caseId}` : entry.createCase ? 'Log request / follow-up' : 'Log completed work'}</h3><p className="text-xs text-slate-500 mt-1">Private IT record. Email is optional.</p></div><button className={secondary} disabled={saving || uploading} onClick={() => setEntry(null)}>Cancel</button></div>
            <form id="support-work-entry-form" className="overflow-y-auto p-4 sm:p-6 space-y-4" onSubmit={event => { event.preventDefault(); save(false); }}>
                <fieldset disabled={saving || uploading} className="space-y-4">
                    {!entry.caseId && <Field title="Record type"><select className={fieldClass} value={entry.createCase ? 'case' : 'standalone'} onChange={event => { const createCase = event.target.value === 'case'; setEntry({ ...entry, createCase, statusAfter: createCase ? 'Open' : 'Completed' }); }}><option value="standalone">Standalone completed work</option><option value="case">New case with follow-ups</option></select></Field>}
                    {!entry.caseId && entry.createCase && <Field title="Or link an existing case"><select className={fieldClass} value="" onChange={event => { const linked = cases.find(item => item.id === Number(event.target.value)); if (linked) { setEntry({ ...entry, caseId: linked.id, caseRevision: linked.revision, createCase: false, subject: linked.subject, contactName: linked.contactName, contactUserId: linked.contactUserId, affectedUserId: linked.affectedUserId, assignedToId: linked.assignedToId }); } }}><option value="">Create a new case</option>{cases.map(item => <option key={item.id} value={item.id}>#{item.id} · {item.subject} · {item.contactName}</option>)}</select></Field>}
                    <div className="grid sm:grid-cols-2 gap-4"><Field title="Work date"><input required className={fieldClass} type="date" max={today} value={entry.workDate} onChange={event => change('workDate', event.target.value)} /></Field><Field title="Received through"><select className={fieldClass} value={entry.channel} onChange={event => change('channel', event.target.value)}>{channels.map(item => <option key={item}>{item}</option>)}</select></Field></div>
                    {entry.caseId && <p className="text-xs text-slate-500">Earlier-dated updates are added to the history without changing the case’s latest status.</p>}
                    <Field title="User / department / contact"><input required list="work-contacts" className={fieldClass} maxLength={250} value={entry.contactName} placeholder="Search an employee or enter a department / vendor" onChange={event => { const value = event.target.value; const selected = users.find(person => `${person.name} (${person.email})` === value); setEntry({ ...entry, contactName: selected ? selected.name : value, contactUserId: selected?.id, notifyEmployee: false }); }} /><datalist id="work-contacts">{users.map(person => <option key={person.id} value={`${person.name} (${person.email})`} />)}</datalist></Field>
                    {entry.contactUserId && <p className="text-xs text-slate-500">Linked employee: {users.find(person => person.id === entry.contactUserId)?.email}</p>}
                    <Field title="Issue / task"><input required maxLength={200} className={fieldClass} value={entry.subject} onChange={event => change('subject', event.target.value)} placeholder="For example: Laptop battery replacement" /></Field>
                    <Field title="Work done / update"><textarea required maxLength={10000} rows={4} className={fieldClass} value={entry.workDone} onChange={event => change('workDone', event.target.value)} placeholder="What was requested, what you did, and the result" /></Field>
                    <Field title="Outcome"><select className={fieldClass} value={entry.statusAfter} onChange={event => change('statusAfter', event.target.value as WorkStatus)}>{(entry.caseId || entry.createCase ? statuses : ['Completed', 'Cancelled']).map(item => <option key={item}>{item}</option>)}</select></Field>
                    {entry.statusAfter === 'Waiting' && <Field title="Waiting for"><select className={fieldClass} value={entry.waitingReason} onChange={event => change('waitingReason', event.target.value)}>{reasons.map(item => <option key={item}>{item}</option>)}</select></Field>}
                    {!['Completed', 'Cancelled'].includes(entry.statusAfter) && <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 space-y-3"><Field title="Next action"><input required maxLength={1000} className={fieldClass} value={entry.nextAction} onChange={event => change('nextAction', event.target.value)} /></Field><Field title="Follow-up date"><input required min={entry.workDate} type="date" className={fieldClass} value={entry.followUpDate} onChange={event => change('followUpDate', event.target.value)} /></Field></div>}
                    <details className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"><summary className="cursor-pointer text-sm font-semibold">More details</summary><div className="grid sm:grid-cols-2 gap-4 mt-4">
                        <Field title="Category"><select className={fieldClass} value={entry.category} onChange={event => change('category', event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></Field>
                        <Field title="Priority"><select className={fieldClass} value={entry.priority} onChange={event => change('priority', event.target.value)}>{['Low', 'Medium', 'High', 'Urgent'].map(item => <option key={item}>{item}</option>)}</select></Field>
                        <Field title="Affected employee (optional)"><select className={fieldClass} value={entry.affectedUserId || ''} onChange={event => change('affectedUserId', event.target.value ? Number(event.target.value) : undefined)}><option value="">No separate affected employee</option>{users.map(person => <option key={person.id} value={person.id}>{person.name} ({person.email})</option>)}</select></Field>
                        <Field title="Work performed by"><select className={fieldClass} value={entry.performedById} onChange={event => change('performedById', Number(event.target.value))}>{admins.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field>
                        {(entry.caseId || entry.createCase) && <Field title="Case assigned to"><select className={fieldClass} value={entry.assignedToId} onChange={event => change('assignedToId', Number(event.target.value))}>{admins.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field>}
                        <Field title="Time spent (minutes, optional)"><input type="number" min={1} max={1440} className={fieldClass} value={entry.effortMinutes} onChange={event => change('effortMinutes', event.target.value)} /></Field>
                        <Field title="Related asset (optional)"><select className={fieldClass} value={entry.assetId} onChange={event => change('assetId', event.target.value)}><option value="">No specific asset</option>{assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name} ({asset.assetId})</option>)}</select></Field>
                        <Field title="Attachment (optional)"><input type="file" disabled={entry.attachments.length >= 10} className="w-full text-sm" onChange={event => { upload(event.target.files?.[0]); event.target.value = ''; }} /></Field>
                    </div>{entry.attachments.map((attachment, index) => <div key={index} className="flex gap-3 text-sm mt-3"><span className="min-w-0 break-all">{attachment.name}</span><button type="button" className="underline" onClick={() => change('attachments', entry.attachments.filter((_, i) => i !== index))}>Remove</button></div>)}</details>
                    <label className="flex gap-2 items-start text-sm"><input type="checkbox" className="mt-1" disabled={!entry.contactUserId} checked={entry.notifyEmployee} onChange={event => change('notifyEmployee', event.target.checked)} /><span>Email this update to the selected employee<span className="block text-xs text-slate-500 mt-1">Off by default. Work notes remain private in the portal. The email includes your work update and outcome.</span></span></label>
                    {entryError && <p role="alert" className="text-sm text-red-600">{entryError}</p>}
                </fieldset>
                {uploading && <p role="status" className="text-sm">Uploading attachment…</p>}
            </form>
            <div className="flex flex-wrap gap-2 p-4 border-t border-slate-200 dark:border-slate-700 shrink-0"><button className={primary} disabled={saving || uploading} type="submit" form="support-work-entry-form">{saving ? 'Saving…' : 'Save'}</button><button className={secondary} disabled={saving || uploading} type="button" onClick={() => { if (formRef.current?.querySelector<HTMLFormElement>('form')?.reportValidity()) save(true); }}>Save & add another</button></div>
        </div></div>}
    </section>;
};
export default SupportWorkLog;
