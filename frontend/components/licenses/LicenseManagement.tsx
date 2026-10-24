import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { apiClient } from '../../utils/apiClient';
import { licenseProvider } from '../../utils/licenseUtils';
import { License } from '../../types';
import ConfirmationModal from '../ui/ConfirmationModal';
import LicenseForm from './LicenseForm';
import LicenseAssignmentModal from './LicenseAssignmentModal';
import LicenseProRataModal from './LicenseProRataModal';

export const ZohoLogo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="2" width="9" height="9" rx="2" fill="#E42528" /><rect x="13" y="2" width="9" height="9" rx="2" fill="#22A048" /><rect x="2" y="13" width="9" height="9" rx="2" fill="#0078BD" /><rect x="13" y="13" width="9" height="9" rx="2" fill="#F4AC1C" /></svg>;
export const M365Logo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.5 2H2v9.5h9.5V2zm10.5 0H12.5v9.5H22V2zM11.5 12.5H2V22h9.5V12.5zm10.5 0H12.5V22H22V12.5z" /></svg>;
const providers = [{ id: 'm365', label: 'Microsoft 365' }, { id: 'zoho', label: 'Zoho · view only' }, { id: 'manual', label: 'Other software' }] as const;

const LicenseManagement: React.FC = () => {
    const { licenses, setLicenses, setNotification } = useAppContext();
    const [provider, setProvider] = useState<'m365' | 'zoho' | 'manual'>('m365');
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [panel, setPanel] = useState<'users' | 'edit' | 'seats' | null>(null);
    const [adding, setAdding] = useState(false);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshed, setRefreshed] = useState<Partial<Record<'m365' | 'zoho' | 'manual', string>>>({});
    const selected = licenses.find(l => l.id === selectedId);
    const group = licenses.filter(l => licenseProvider(l) === provider);
    const filtered = group.filter(l => `${l.name} ${l.category || ''}`.toLowerCase().includes(search.toLowerCase()));
    const assigned = group.reduce((sum, l) => sum + (l.assignments?.length ?? l.assignedSeats ?? 0), 0);
    const capacity = group.reduce((sum, l) => sum + l.seats, 0);
    const reload = async () => setLicenses(await apiClient<License[]>('/api/licenses'));

    const refresh = async () => {
        setBusy(true); setError(null);
        try {
            if (provider !== 'manual') await apiClient(provider === 'm365' ? '/api/m365/sync' : '/api/zoho/sync-licenses', { method: 'POST', body: '{}' });
            await reload();
            setRefreshed(old => ({ ...old, [provider]: new Date().toLocaleString() }));
            setNotification({ type: 'success', message: provider === 'zoho' ? 'Zoho user references refreshed. Membership remains managed in Zoho.' : provider === 'm365' ? 'Microsoft 365 subscriptions and assignments refreshed.' : 'Software records refreshed.' });
        } catch (err: any) { setError(err.message || 'Refresh failed. Try again.'); }
        finally { setBusy(false); }
    };
    const save = async (data: License) => {
        try {
            await apiClient(adding ? '/api/licenses' : `/api/licenses/${data.id}`, { method: adding ? 'POST' : 'PUT', body: JSON.stringify({ ...data, startDate: data.startDate || null, expirationDate: data.expirationDate || null }) });
            await reload(); setPanel(null); setAdding(false);
            setNotification({ type: 'success', message: 'Software record saved.' });
        } catch (err: any) { setNotification({ type: 'error', message: err.message || 'Could not save the software record.' }); }
    };
    const remove = async () => {
        if (!deleting) return;
        try { await apiClient(`/api/licenses/${deleting}`, { method: 'DELETE' }); await reload(); setDeleting(null); setNotification({ type: 'success', message: 'Software record deleted.' }); }
        catch (err: any) { setNotification({ type: 'error', message: err.message || 'Could not delete the record.' }); }
    };
    const open = (license: License, next: 'users' | 'edit' | 'seats') => { setSelectedId(license.id); setPanel(next); };
    const metrics = provider === 'zoho'
        ? [['Tracked subscriptions', group.length], ['Matched portal users', assigned], ['Assignment management', 'In Zoho']]
        : [['Subscriptions', group.length], [provider === 'm365' ? 'Synced assignments' : 'Assigned seats', assigned], [provider === 'm365' ? 'Purchased seats · last sync' : 'Available seats', provider === 'm365' ? capacity : Math.max(0, capacity - assigned)]];

    return (
        <div className="space-y-5 pb-12">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div><h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Licenses &amp; subscriptions</h2><p className="text-sm text-slate-500 mt-1">Manage Microsoft 365 access, view Zoho users, and track other software.</p></div>
                {provider === 'manual' && <button type="button" onClick={() => { setAdding(true); setSelectedId(null); }} className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold">+ Add software</button>}
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Subscription provider">
                {providers.map(item => <button key={item.id} type="button" aria-pressed={provider === item.id} onClick={() => { setProvider(item.id); setSearch(''); setError(null); }} className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold ${provider === item.id ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-700 dark:border-slate-700' : 'bg-white text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700'}`}>
                    {item.id === 'm365' ? <M365Logo /> : item.id === 'zoho' ? <ZohoLogo /> : null}{item.label}<span className="opacity-70">({licenses.filter(l => licenseProvider(l) === item.id).length})</span>
                </button>)}
            </div>
            <div className={`rounded-2xl border p-4 text-sm ${provider === 'zoho' ? 'bg-amber-50 border-amber-200 text-amber-950 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-100' : 'bg-sky-50 border-sky-200 text-sky-950 dark:bg-sky-950/30 dark:border-sky-900 dark:text-sky-100'}`}>
                {provider === 'm365' ? <><strong>Microsoft 365 controls access.</strong> Open a subscription to view live assignments, assign an employee, or remove a direct license. Purchased seat counts come from Microsoft; group-managed access stays in Entra.</>
                    : provider === 'zoho' ? <><strong>Zoho is view only.</strong> See active users from Zoho People Plus. Assignments, removals and subscription changes are managed in Zoho. Zoho One organizations need their own connection.</>
                    : <><strong>Portal records.</strong> Assign seats to employees or devices for software you track manually. These actions do not provision access in an external service.</>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {metrics.map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{value}</p></div>)}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="w-full sm:max-w-md"><label htmlFor="subscription-search" className="sr-only">Search subscriptions</label><input id="subscription-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subscriptions" className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl px-4 py-2.5 text-sm" /></div>
                <div className="flex flex-col sm:items-end gap-1"><button type="button" disabled={busy} onClick={refresh} className="rounded-xl px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-sm font-semibold disabled:opacity-50">{busy ? 'Refreshing…' : provider === 'm365' ? 'Refresh Microsoft 365' : provider === 'zoho' ? 'Refresh Zoho People Plus' : 'Refresh records'}</button>{refreshed[provider] && <span className="text-xs text-slate-500">Refreshed {refreshed[provider]}</span>}</div>
            </div>
            {error && <div role="alert" className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 text-sm">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(license => {
                    const count = license.assignments?.length ?? license.assignedSeats ?? 0;
                    const linked = license.isM365 && license.skuId;
                    return <section key={license.id} aria-label={license.name} className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                        <div className="p-5 flex-1 space-y-4">
                            <div className="flex items-start justify-between gap-3"><h3 className="font-bold text-base text-slate-900 dark:text-slate-100 break-words min-w-0 flex-1">{license.name}</h3><span className={`shrink-0 text-xs px-2 py-1 rounded-full ${provider === 'zoho' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : license.status === 'Active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{provider === 'zoho' ? 'View only' : license.status}</span></div>
                            <p className="text-sm text-slate-500">{license.category}</p>
                            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{count} {provider === 'zoho' ? 'matched users' : provider === 'm365' ? 'synced user assignments' : 'assigned seats'}</p>
                                {provider !== 'zoho' && <p className="text-xs text-slate-500 mt-1">{license.seats} purchased seats{provider === 'm365' ? ' · last sync' : ` · ${Math.max(0, license.seats - count)} available`}</p>}
                                {provider === 'zoho' && <p className="text-xs text-slate-500 mt-1">Open the user list for the source roster, including employees not yet matched to the portal.</p>}
                            </div>
                            {provider === 'm365' && !linked && <p className="text-xs text-amber-800 dark:text-amber-200">Refresh Microsoft 365 to import the connected subscription. This older record is not linked to a Microsoft product.</p>}
                            {provider === 'manual' && <dl className="text-sm space-y-1 text-slate-500">{license.expirationDate && <div className="flex justify-between gap-2"><dt>Renewal</dt><dd>{new Date(license.expirationDate).toLocaleDateString()}</dd></div>}{license.cost != null && <div className="flex justify-between gap-2"><dt>Recorded cost</dt><dd>₹{license.cost.toLocaleString()}</dd></div>}</dl>}
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                            <button type="button" disabled={provider === 'm365' && !linked} onClick={() => open(license, 'users')} className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{provider === 'zoho' ? 'View users' : provider === 'm365' ? 'Manage Microsoft 365 users' : 'Manage assignments'}</button>
                            {provider === 'manual' && <div className="flex flex-wrap justify-between gap-2 text-xs"><button type="button" onClick={() => open(license, 'seats')} className="px-2 py-2 text-brand-700 dark:text-brand-400">Add purchased seats</button><button type="button" onClick={() => open(license, 'edit')} className="px-2 py-2 text-slate-600 dark:text-slate-300">Edit details</button><button type="button" onClick={() => setDeleting(license.id)} className="px-2 py-2 text-red-600 dark:text-red-300">Delete</button></div>}
                        </div>
                    </section>;
                })}
            </div>
            {!filtered.length && <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center"><h3 className="font-semibold text-slate-800 dark:text-slate-100">{search ? 'No subscriptions match your search' : provider === 'm365' ? 'No Microsoft 365 subscriptions yet' : provider === 'zoho' ? 'No Zoho subscription references yet' : 'No manual software records yet'}</h3><p className="text-sm text-slate-500 mt-2">{search ? 'Try a different product name.' : provider === 'manual' ? 'Add software to start tracking purchased seats.' : 'Use the refresh button to import the connected provider.'}</p></div>}
            {selected && panel === 'users' && <LicenseAssignmentModal key={selected.id} isOpen onClose={() => setPanel(null)} license={selected} />}
            {(adding || (selected && panel === 'edit')) && <LicenseForm isOpen onClose={() => { setAdding(false); setPanel(null); }} onSave={save} license={adding ? null : selected!} />}
            {selected && panel === 'seats' && <LicenseProRataModal isOpen onClose={() => setPanel(null)} onSave={save} license={selected} />}
            <ConfirmationModal isOpen={deleting !== null} onClose={() => setDeleting(null)} onConfirm={remove} title="Delete software record">Delete this manual software record and its portal assignments?</ConfirmationModal>
        </div>
    );
};
export default LicenseManagement;
