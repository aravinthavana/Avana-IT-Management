import React, { useCallback, useEffect, useRef, useState } from 'react';
import { License } from '../../types';
import { useAppContext } from '../../hooks/useAppContext';
import { apiClient } from '../../utils/apiClient';
import { licenseProvider, LicenseMember, LicenseMembers } from '../../utils/licenseUtils';
import Modal from '../ui/Modal';

interface AssignmentModalProps { isOpen: boolean; onClose: () => void; license: License; }
const inputClass = 'w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100';
const matches = (name: string, email: string | undefined, employeeId: string | undefined, search: string) =>
    `${name} ${email || ''}`.toLowerCase().includes(search.toLowerCase()) || Boolean(employeeId && employeeId.replace(/[-_\s]/g, '').toLowerCase().includes(search.replace(/[-_\s]/g, '').toLowerCase()));

const LicenseAssignmentModal: React.FC<AssignmentModalProps> = ({ isOpen, onClose, license }) => {
    const { users, assets, licenses, setLicenses, setNotification } = useAppContext();
    const active = licenses.find(l => l.id === license.id) || license;
    const provider = licenseProvider(active);
    const [data, setData] = useState<LicenseMembers | null>(null);
    const [view, setView] = useState<'members' | 'assign'>('members');
    const [search, setSearch] = useState('');
    const [candidateSearch, setCandidateSearch] = useState('');
    const [selectedId, setSelectedId] = useState<number | ''>('');
    const [assigneeType, setAssigneeType] = useState<'User' | 'Asset'>('User');
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState<{ action: 'assign' | 'remove'; name: string; member?: LicenseMember } | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const expected = useRef<{ action: 'assign' | 'remove'; userId?: number; azureId?: string } | null>(null);
    const request = useRef(0);
    const confirmation = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!pending) return;
        confirmation.current?.focus({ preventScroll: true });
        confirmation.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }, [pending]);

    const refresh = useCallback(async () => {
        const serial = ++request.current;
        setLoading(true);
        setError(null);
        try {
            const result = await apiClient<LicenseMembers>(`/api/licenses/${license.id}/assignments`);
            if (serial !== request.current) return;
            setData(result);
            const waiting = expected.current;
            if (waiting) {
                const observed = waiting.action === 'assign' ? result.members.some(m => m.userId === waiting.userId)
                    : !result.members.some(m => m.azureAdId === waiting.azureId || m.id === waiting.azureId);
                if (observed) { expected.current = null; setNotice(null); }
            }
            // The details endpoint reconciles the cached cloud roster before this read.
            setLicenses(await apiClient<License[]>('/api/licenses'));
        } catch (err: any) {
            if (serial === request.current) setError(err.message || 'Could not load assigned users.');
            throw err;
        } finally { if (serial === request.current) setLoading(false); }
    }, [license.id, setLicenses]);

    useEffect(() => {
        if (!isOpen) return;
        expected.current = null; setNotice(null);
        setView('members'); setSearch(''); setCandidateSearch(''); setSelectedId(''); setPending(null); setData(null);
        refresh().catch(() => {});
        return () => { request.current++; };
    }, [isOpen, refresh]);

    const currentMembers = [...(data?.members || [])].sort((a, b) => a.displayName.localeCompare(b.displayName));
    const assignedUsers = new Set(currentMembers.map(m => m.userId));
    const assignedAssets = new Set(active.assignments?.map(a => a.assetId));
    const candidates = provider === 'm365' ? (data?.eligibleUsers || [])
        : assigneeType === 'User' ? users.filter(u => u.status !== 'Inactive' && !assignedUsers.has(u.id)).map(u => ({ id: u.id, displayName: u.name, email: u.email, employeeId: u.employeeId, usageLocation: undefined }))
        : assets.filter(a => a.category !== 'Software' && !assignedAssets.has(a.id)).map(a => ({ id: a.id, displayName: a.name, email: a.assetId, employeeId: undefined, usageLocation: undefined }));
    const filteredCandidates = [...candidates].sort((a, b) => a.displayName.localeCompare(b.displayName)).filter(c => matches(c.displayName, c.email, c.employeeId, candidateSearch));
    const selected = candidates.find(c => c.id === selectedId);
    const available = data?.availableSeats ?? Math.max(0, active.seats - currentMembers.length);
    const blocked = busy || loading || Boolean(error);

    const perform = async () => {
        if (!pending || blocked) return;
        setBusy(true); setError(null);
        try {
            let result: { status?: string; message?: string };
            if (provider === 'm365') {
                result = pending.action === 'assign'
                    ? await apiClient(`/api/licenses/${active.id}/m365-members`, { method: 'POST', body: JSON.stringify({ userId: selectedId }) })
                    : await apiClient(`/api/licenses/${active.id}/m365-members/${encodeURIComponent(pending.member!.azureAdId || pending.member!.id)}`, { method: 'DELETE' });
            } else {
                result = pending.action === 'assign'
                    ? await apiClient('/api/license-assignments', { method: 'POST', body: JSON.stringify({ licenseId: active.id, userId: assigneeType === 'User' ? selectedId : null, assetId: assigneeType === 'Asset' ? selectedId : null }) })
                    : await apiClient(`/api/license-assignments/${pending.member!.assignmentId}`, { method: 'DELETE' });
            }
            if (result.status === 'pending') {
                setNotice(result.message || 'Waiting for Microsoft to confirm this change.');
                expected.current = pending.action === 'assign' ? { action: 'assign', userId: Number(selectedId) }
                    : { action: 'remove', azureId: pending.member!.azureAdId || pending.member!.id };
            } else { expected.current = null; setNotice(null); }
            setPending(null); setSelectedId(''); setView('members');
            setNotification({ type: result.status === 'pending' ? 'info' : 'success', message: result.message || (pending.action === 'assign' ? 'Portal assignment saved.' : 'Portal assignment removed.') });
            try { await refresh(); }
            catch { setError('The request was processed, but the user list could not refresh. Refresh users before making another change.'); }
        } catch (err: any) { setError(err.message || 'The assignment could not be changed.'); }
        finally { setBusy(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={() => { if (!busy) onClose(); }} closeDisabled={busy} title={provider === 'zoho' ? 'Zoho users' : provider === 'm365' ? 'Microsoft 365 license users' : 'Software assignments'} maxWidth="max-w-3xl">
            <div className="space-y-5" aria-busy={busy || loading}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0"><h3 className="font-semibold text-slate-900 dark:text-slate-100 break-words">{active.name}</h3>
                        <p className="text-sm text-slate-500 mt-1">{provider === 'zoho' ? 'View only · membership is managed in Zoho' : provider === 'm365' ? 'Changes are made in Microsoft 365 and checked before confirmation.' : 'These assignments are tracked in this portal.'}</p>
                        {data?.fetchedAt && <p className="text-xs text-slate-500 mt-1">Checked with {provider === 'm365' ? 'Microsoft 365' : 'Zoho'} at {new Date(data.fetchedAt).toLocaleString()}</p>}
                    </div>
                    <button type="button" disabled={loading || busy} onClick={() => refresh().catch(() => {})} className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl shrink-0 disabled:opacity-50">{loading ? 'Refreshing…' : 'Refresh users'}</button>
                </div>
                {notice && <p role="status" className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-sm">{notice}</p>}
                {data?.note && <p className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 text-sm">{data.note}</p>}
                {error && <div role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 text-sm">{error}</div>}
                {provider !== 'zoho' && data && <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    {[['Purchased', data.seats], ['Assigned', data.assignedSeats], ['Available', available]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><span className="block text-xs text-slate-500">{label}</span><strong className="block text-xl mt-1">{value ?? '—'}</strong></div>)}
                </div>}
                <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-3" aria-label="Assignment views">
                    <button type="button" disabled={busy} aria-pressed={view === 'members'} onClick={() => { setView('members'); setPending(null); }} className={`px-4 py-2 rounded-xl text-sm font-semibold ${view === 'members' ? 'bg-slate-900 text-white dark:bg-slate-700' : 'bg-slate-100 dark:bg-slate-800'}`}>{provider === 'zoho' ? 'Users' : 'Assigned users'} ({currentMembers.length})</button>
                    {provider !== 'zoho' && <button type="button" disabled={busy} aria-pressed={view === 'assign'} onClick={() => { setView('assign'); setPending(null); }} className={`px-4 py-2 rounded-xl text-sm font-semibold ${view === 'assign' ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>+ {provider === 'm365' ? 'Assign license' : 'Add assignment'}</button>}
                </div>
                {loading && !data && <p role="status" className="py-8 text-center text-slate-500">Loading users from {provider === 'm365' ? 'Microsoft 365' : provider === 'zoho' ? 'Zoho' : 'the portal'}…</p>}
                {view === 'members' && data && <>
                    <input type="search" aria-label="Search assigned users" placeholder="Search name, email or employee ID" value={search} onChange={e => setSearch(e.target.value)} className={inputClass} />
                    <div className="space-y-2 max-h-[45dvh] overflow-y-auto">
                        {currentMembers.filter(m => matches(m.displayName, m.email, m.employeeId, search)).map(member => <div key={member.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="min-w-0 flex-1"><p className="font-semibold text-sm break-words">{member.displayName}</p><p className="text-sm text-slate-500 break-all">{member.email}</p>
                                <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-slate-500">{member.employeeId && <span>{member.employeeId}</span>}{member.department && <span>{member.department}</span>}<span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">{member.assignmentSource}</span>{member.state && <span>{member.state}</span>}</div>
                                {member.note && <p className="text-xs text-slate-500 mt-2">{member.note}</p>}
                            </div>
                            {member.removable && provider !== 'zoho' && <button type="button" disabled={blocked} onClick={() => setPending({ action: 'remove', name: member.displayName, member })} className="px-3 py-2 rounded-lg text-sm border border-red-200 text-red-700 dark:text-red-300 disabled:opacity-50">{provider === 'm365' ? 'Remove license' : 'Remove assignment'}</button>}
                        </div>)}
                        {!currentMembers.some(m => matches(m.displayName, m.email, m.employeeId, search)) && <p className="py-8 text-center text-sm text-slate-500">{search ? 'No users match your search.' : 'No assigned users were reported.'}</p>}
                    </div>
                </>}
                {view === 'assign' && data && provider !== 'zoho' && <div className="space-y-3">
                    <p className="text-sm text-slate-500">{provider === 'm365' ? 'Choose an active employee with a synced Microsoft account. Employees already assigned this product are excluded.' : 'Choose an employee or a device. This records a portal assignment.'}</p>
                    {provider === 'manual' && <select aria-label="Assignment type" className={inputClass} value={assigneeType} onChange={e => { setAssigneeType(e.target.value as 'User' | 'Asset'); setSelectedId(''); }}><option value="User">Employee</option><option value="Asset">Device</option></select>}
                    <input type="search" aria-label="Search eligible employees or devices" placeholder="Search name, email or employee ID" value={candidateSearch} onChange={e => setCandidateSearch(e.target.value)} className={inputClass} />
                    {available <= 0 && <p className="text-sm text-amber-800 dark:text-amber-200">No seats are available. {provider === 'm365' ? 'Purchase seats in Microsoft 365, then refresh.' : 'Update the purchased seat count before assigning.'}</p>}
                    <fieldset className="space-y-2 max-h-[35dvh] overflow-y-auto"><legend className="sr-only">Choose an assignee</legend>
                        {filteredCandidates.map(candidate => {
                            const setupNeeded = provider === 'm365' && !candidate.usageLocation;
                            return <label key={candidate.id} className={`flex items-start gap-3 rounded-xl border p-3 ${selectedId === candidate.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                                <input type="radio" name="license-assignee" value={candidate.id} checked={selectedId === candidate.id} disabled={blocked || setupNeeded || available <= 0} onChange={() => setSelectedId(candidate.id)} className="mt-1" />
                                <span className="min-w-0"><span className="block font-semibold text-sm">{candidate.displayName}</span><span className="block text-sm text-slate-500 break-all">{candidate.email}</span>{candidate.employeeId && <span className="block text-xs text-slate-500">{candidate.employeeId}</span>}{setupNeeded && <span className="block text-xs text-amber-700 dark:text-amber-300">Set usage location in Microsoft 365, then refresh.</span>}</span>
                            </label>;
                        })}
                        {filteredCandidates.length === 0 && <p className="text-sm text-slate-500 py-4">No eligible assignees. {provider === 'm365' ? 'Sync Microsoft 365 if an employee is missing.' : 'All eligible assignees may already have this license.'}</p>}
                    </fieldset>
                    <button type="button" disabled={!selected || blocked || available <= 0} onClick={() => selected && setPending({ action: 'assign', name: selected.displayName })} className="w-full sm:w-auto rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-50">Review assignment</button>
                </div>}
                {pending && <div ref={confirmation} tabIndex={-1} role="region" aria-label="Confirm license change" className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 space-y-3">
                    <p className="font-semibold text-sm">{pending.action === 'assign' ? 'Assign' : 'Remove'} {active.name} {pending.action === 'assign' ? 'to' : 'from'} {pending.name}?</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{provider === 'm365' ? pending.action === 'remove' ? 'This removes access to the Microsoft services included in this license. Other product licenses are unchanged.' : 'This uses one seat in Microsoft 365.' : 'This changes the portal record only.'}</p>
                    <div className="flex flex-wrap gap-2"><button type="button" disabled={blocked} onClick={perform} className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${pending.action === 'remove' ? 'bg-red-600' : 'bg-brand-600'}`}>{busy ? provider === 'm365' ? 'Updating Microsoft 365…' : 'Saving…' : provider === 'm365' ? pending.action === 'assign' ? 'Assign in Microsoft 365' : 'Remove from Microsoft 365' : 'Confirm change'}</button><button type="button" disabled={busy} onClick={() => setPending(null)} className="px-4 py-2 text-sm border rounded-lg border-slate-300 dark:border-slate-600">Cancel</button></div>
                </div>}
                <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 dark:border-slate-700 pt-3 text-sm">
                    {provider === 'm365' ? <a href="https://admin.microsoft.com/" target="_blank" rel="noopener noreferrer" className="underline text-sky-700 dark:text-sky-300">Open Microsoft 365 admin center ↗</a> : <span />}
                    <button type="button" disabled={busy} onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700">Done</button>
                </div>
            </div>
        </Modal>
    );
};
export default LicenseAssignmentModal;
