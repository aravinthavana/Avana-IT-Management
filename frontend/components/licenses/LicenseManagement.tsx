import { API_URL } from '../../utils/apiClient';
import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { ICONS } from '../../constants';
import ConfirmationModal from '../ui/ConfirmationModal';
import LicenseForm from './LicenseForm';
import LicenseAssignmentModal from './LicenseAssignmentModal';
import LicenseProRataModal from './LicenseProRataModal';
import { License } from '../../types';


export const ZohoLogo: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="9" height="9" rx="2" fill="#b27f0d" />
        <rect x="13" y="2" width="9" height="9" rx="2" fill="#404131" />
        <rect x="2" y="13" width="9" height="9" rx="2" fill="#404131" />
        <rect x="13" y="13" width="9" height="9" rx="2" fill="#b27f0d" />
    </svg>
);

export const M365Logo: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.5 2H2v9.5h9.5V2zm10.5 0H12.5v9.5H22V2zM11.5 12.5H2V22h9.5V12.5zm10.5 0H12.5V22H22V12.5z"/>
    </svg>
);

const isCloudLicense = (license: License) => {
    return Boolean(
        license.isM365 ||
        license.key === 'ZOHO-PEOPLE-PLUS' ||
        (license.name && license.name.toLowerCase().includes('zoho')) ||
        (license.name && license.name.toLowerCase().includes('microsoft')) ||
        (license.name && license.name.toLowerCase().includes('office 365'))
    );
};

const isZohoLicense = (license: License) => {
    return license.key === 'ZOHO-PEOPLE-PLUS' || (license.name && license.name.toLowerCase().includes('zoho'));
};

const LicenseManagement: React.FC = () => {
    const { licenses, setLicenses, setNotification, getHeaders } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'cloud' | 'manual'>('all');

    // Modal controls
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isProRataOpen, setIsProRataOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isZohoSyncing, setIsZohoSyncing] = useState(false);
    const [licenseToDelete, setLicenseToDelete] = useState<number | null>(null);
    const [selectedLicense, setSelectedLicense] = useState<License | null>(null);

    // Summary calculations
    const totalLicenses = licenses.length;
    const totalSeats = licenses.reduce((sum, l) => sum + (l.seats || 0), 0);
    const totalAssignedSeats = licenses.reduce((sum, l) => sum + (l.assignedSeats || l.assignments?.length || 0), 0);
    const totalAvailableSeats = Math.max(0, totalSeats - totalAssignedSeats);
    const overallUtilization = totalSeats > 0 ? Math.round((totalAssignedSeats / totalSeats) * 100) : 0;

    const cloudLicensesCount = licenses.filter(isCloudLicense).length;
    const manualLicensesCount = licenses.filter(l => !isCloudLicense(l)).length;

    const handleSyncM365Licenses = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch(`${API_URL}/api/m365/sync`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include'
            });
            if (res.status === 404) {
                throw new Error('M365 sync endpoint not found (404). Please ensure the latest backend commit is deployed on Render.');
            }
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error(`Unexpected server response (${res.status} ${res.statusText}). The backend may be deploying or restarting.`);
            }
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to sync M365 licenses');
            setNotification({
                message: `Synced ${data.data?.licensesSynced || 0} Microsoft 365 license pools successfully!`,
                type: 'success'
            });
            const licRes = await fetch(`${API_URL}/api/licenses`, { headers: getHeaders(), credentials: 'include' });
            if (licRes.ok) setLicenses(await licRes.json());
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSyncZohoLicenses = async () => {
        setIsZohoSyncing(true);
        try {
            const res = await fetch(`${API_URL}/api/zoho/sync-licenses`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include'
            });
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error(`Unexpected server response (${res.status} ${res.statusText}).`);
            }
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to sync Zoho People Plus');
            setNotification({
                message: `Zoho People Plus synced! ${data.activeZohoEmployees || 0} active employees mapped. ${data.assignedToPortalUsers || 0} assigned to portal users.`,
                type: 'success'
            });
            const licRes = await fetch(`${API_URL}/api/licenses`, { headers: getHeaders(), credentials: 'include' });
            if (licRes.ok) setLicenses(await licRes.json());
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setIsZohoSyncing(false);
        }
    };

    const openProRataForm = (license: License) => {
        setSelectedLicense(license);
        setIsProRataOpen(true);
    };

    const filteredLicenses = licenses.filter(l => {
        const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (l.category && l.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (l.remarks && l.remarks.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;
        if (activeTab === 'cloud') return isCloudLicense(l);
        if (activeTab === 'manual') return !isCloudLicense(l);
        return true;
    });

    const getStatusStyle = (status: string) => {
        if (status === 'Active') return 'bg-surface text-ink   border border-line ';
        if (status === 'Expiring Soon') return 'bg-surface text-ink   border border-line ';
        return 'bg-surface text-ink   border border-line ';
    };

    const handleSave = async (licenseData: License) => {
        try {
            if (selectedLicense) {
                const res = await fetch(`${API_URL}/api/licenses/${licenseData.id}`, {
                    method: 'PUT', headers: getHeaders(),
                    credentials: 'include', body: JSON.stringify(licenseData),
                });
                if (!res.ok) throw new Error((await res.json()).error);
                const updated = await res.json();
                setLicenses(licenses.map(l => l.id === updated.id ? { ...updated, assignedSeats: l.assignedSeats, assignments: l.assignments } : l));
                setNotification({ message: 'License updated successfully.', type: 'success' });
            } else {
                const res = await fetch(`${API_URL}/api/licenses`, {
                    method: 'POST', headers: getHeaders(),
                    credentials: 'include', body: JSON.stringify(licenseData),
                });
                if (!res.ok) throw new Error((await res.json()).error);
                const created = await res.json();
                setLicenses([...licenses, { ...created, assignedSeats: 0, assignments: [] }]);
                setNotification({ message: 'License added successfully.', type: 'success' });
            }
            setIsFormOpen(false);
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to save', type: 'error' });
        }
    };

    const handleDelete = async () => {
        if (!licenseToDelete) return;
        try {
            const res = await fetch(`${API_URL}/api/licenses/${licenseToDelete}`, {
                method: 'DELETE', headers: getHeaders(),
                credentials: 'include',
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setLicenses(licenses.filter(l => l.id !== licenseToDelete));
            setNotification({ message: 'License deleted.', type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to delete', type: 'error' });
        }
        setLicenseToDelete(null);
    };

    const handleOpenAssign = (license: License) => {
        setSelectedLicense(license);
        setIsAssignModalOpen(true);
    };

    const openEditForm = (license: License) => {
        setSelectedLicense(license);
        setIsFormOpen(true);
    };

    const openAddForm = () => {
        setSelectedLicense(null);
        setIsFormOpen(true);
    };

    return (
        <div className="bg-transparent pb-20 space-y-6">
            {/* ── Summary Metrics Bar ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-surface border border-line rounded-2xl p-4 shadow-xs">
                    <p className="text-xs font-semibold text-quiet uppercase tracking-wider">Total Subscriptions</p>
                    <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-bold text-ink">{totalLicenses}</span>
                        <span className="text-xs font-medium text-quiet">{cloudLicensesCount} cloud · {manualLicensesCount} manual</span>
                    </div>
                </div>

                <div className="bg-surface border border-line rounded-2xl p-4 shadow-xs">
                    <p className="text-xs font-semibold text-quiet uppercase tracking-wider">Total Licensed Seats</p>
                    <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-bold text-ink">{totalSeats}</span>
                        <span className="text-xs font-medium text-quiet">capacity</span>
                    </div>
                </div>

                <div className="bg-surface border border-line rounded-2xl p-4 shadow-xs">
                    <p className="text-xs font-semibold text-quiet uppercase tracking-wider">Assigned Seats</p>
                    <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-bold text-ink">{totalAssignedSeats}</span>
                        <span className="text-xs font-semibold text-ink">{overallUtilization}% utilized</span>
                    </div>
                </div>

                <div className="bg-surface border border-line rounded-2xl p-4 shadow-xs">
                    <p className="text-xs font-semibold text-quiet uppercase tracking-wider">Available Free Seats</p>
                    <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-bold text-ink">{totalAvailableSeats}</span>
                        <span className="text-xs font-medium text-quiet">ready to assign</span>
                    </div>
                </div>
            </div>

            {/* ── Toolbar: Search, Filters & Sync Actions ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-4 rounded-2xl border border-line shadow-xs">
                {/* Search & Tabs */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-quiet">{ICONS.search}</span>
                        <input
                            type="text"
                            placeholder="Search licenses, suites, keys..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-canvas border border-line rounded-xl text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                activeTab === 'all'
                                    ? 'bg-surface  text-ink  shadow-xs'
                                    : 'text-quiet  hover:text-ink'
                            }`}
                        >
                            All ({totalLicenses})
                        </button>
                        <button
                            onClick={() => setActiveTab('cloud')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                activeTab === 'cloud'
                                    ? 'bg-surface  text-ink  shadow-xs'
                                    : 'text-quiet  hover:text-ink'
                            }`}
                        >
                            <span>Cloud Synced</span>
                            <span className="text-[10px] bg-surface text-ink px-1.5 py-0.2 rounded-full font-bold">
                                {cloudLicensesCount}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('manual')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                activeTab === 'manual'
                                    ? 'bg-surface  text-ink  shadow-xs'
                                    : 'text-quiet  hover:text-ink'
                            }`}
                        >
                            <span>Manual Software</span>
                            <span className="text-[10px] bg-muted text-ink px-1.5 py-0.2 rounded-full font-bold">
                                {manualLicensesCount}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                    <button
                        onClick={handleSyncM365Licenses}
                        disabled={isSyncing}
                        className="bg-surface hover:bg-surface text-ink border border-line px-3.5 py-2 rounded-xl font-semibold transition-all duration-200 active:scale-95 flex items-center gap-2 disabled:opacity-50 text-xs shadow-xs"
                        title="Sync Microsoft 365 license pools and user assignments"
                    >
                        <M365Logo className={`w-3.5 h-3.5 text-ink  ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>{isSyncing ? 'Syncing M365...' : 'Sync M365'}</span>
                    </button>

                    <button
                        onClick={handleSyncZohoLicenses}
                        disabled={isZohoSyncing}
                        className="bg-surface hover:bg-surface text-ink border border-line/80 px-3.5 py-2 rounded-xl font-semibold transition-all duration-200 active:scale-95 flex items-center gap-2 disabled:opacity-50 text-xs shadow-xs"
                        title="Sync Zoho People Plus (AMD & Tech) active employees and seat pool"
                    >
                        <ZohoLogo className={`w-3.5 h-3.5 ${isZohoSyncing ? 'animate-spin' : ''}`} />
                        <span>{isZohoSyncing ? 'Syncing Zoho...' : 'Sync Zoho People Plus'}</span>
                    </button>

                    <button
                        onClick={openAddForm}
                        className="bg-accent text-on-strong px-4 py-2 rounded-xl hover:bg-accent font-semibold transition-all duration-200 active:scale-95 text-xs shadow-xs flex items-center gap-1.5"
                    >
                        {ICONS.add} <span>Add License</span>
                    </button>
                </div>
            </div>

            {/* ── Licenses Grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredLicenses.map(license => {
                    const isM365 = license.isM365 || (license.name && license.name.toLowerCase().includes('microsoft'));
                    const isZoho = isZohoLicense(license);
                    const isCloud = isM365 || isZoho;

                    const assigned = license.assignedSeats || (license.assignments?.length || 0);
                    const total = license.seats || 0;
                    const available = Math.max(0, total - assigned);
                    const utilization = total > 0 ? Math.min(100, Math.round((assigned / total) * 100)) : 0;

                    // Progress bar coloring
                    let progressColor = 'bg-olive';
                    if (utilization >= 95) progressColor = 'bg-olive';
                    else if (utilization >= 80) progressColor = 'bg-olive';

                    return (
                        <div
                            key={license.id}
                            className={`bg-surface  rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between p-5 ${
                                isZoho
                                    ? 'border-line/80  hover:border-line'
                                    : isM365
                                    ? 'border-line/80  hover:border-line'
                                    : 'border-line  hover:border-line'
                            }`}
                        >
                            <div>
                                {/* Header badge + title */}
                                <div className="flex justify-between items-start mb-3 gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                            {isM365 && (
                                                <span className="inline-flex items-center gap-1 text-[10px] bg-surface text-ink border border-line px-2 py-0.5 rounded-full font-semibold">
                                                    <M365Logo className="w-2.5 h-2.5 text-ink" />
                                                    Microsoft 365
                                                </span>
                                            )}
                                            {isZoho && (
                                                <span className="inline-flex items-center gap-1.5 text-[10px] bg-surface text-ink border border-line px-2 py-0.5 rounded-full font-semibold">
                                                    <ZohoLogo className="w-3 h-3 flex-shrink-0" />
                                                    Zoho People Plus (AMD & Tech)
                                                </span>
                                            )}
                                            {!isCloud && (
                                                <span className="inline-flex items-center gap-1 text-[10px] bg-muted text-ink border border-line px-2 py-0.5 rounded-full font-medium">
                                                    💾 Manual Software
                                                </span>
                                            )}
                                            {isCloud && (
                                                <span className="text-[10px] text-ink font-semibold flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-olive animate-pulse"></span>
                                                    Auto-Synced
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-base text-ink leading-snug line-clamp-2" title={license.name}>
                                            {license.name}
                                        </h3>
                                        <p className="text-xs text-quiet mt-0.5">{license.category || 'General Software'}</p>
                                    </div>
                                    <span className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full flex-shrink-0 ${getStatusStyle(license.status)}`}>
                                        {license.status}
                                    </span>
                                </div>

                                {/* Seat Utilization Progress Bar */}
                                <div className="mt-4 p-3 bg-canvas rounded-xl border border-line">
                                    <div className="flex justify-between items-baseline mb-1.5 text-xs">
                                        <span className="font-semibold text-ink">
                                            {assigned} <span className="text-quiet font-normal">/ {total} seats assigned</span>
                                        </span>
                                        <span className={`font-bold ${utilization >= 95 ? 'text-ink ' : 'text-quiet '}`}>
                                            {utilization}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                        <div
                                            className={`h-2 rounded-full transition-all duration-300 ${progressColor}`}
                                            style={{ width: `${utilization}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center mt-2 text-[11px]">
                                        <span className="text-quiet">Available remaining:</span>
                                        <span className={`font-semibold ${available === 0 ? 'text-ink ' : 'text-ink '}`}>
                                            {available} {available === 1 ? 'seat' : 'seats'} free
                                        </span>
                                    </div>
                                </div>

                                {/* Metadata Details */}
                                <div className="space-y-1.5 my-3 text-xs text-quiet px-1">
                                    {license.startDate && (
                                        <div className="flex justify-between">
                                            <span className="text-quiet">Start Date:</span>
                                            <span className="font-medium">{new Date(license.startDate).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-quiet">Renewal / Expires:</span>
                                        <span className="font-medium">{license.expirationDate ? new Date(license.expirationDate).toLocaleDateString() : 'Continuous Cloud Subscription'}</span>
                                    </div>
                                    {license.cost != null && (
                                        <div className="flex justify-between">
                                            <span className="text-quiet">Annual Cost:</span>
                                            <span className="font-bold text-ink">₹{license.cost.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {license.key && !isCloud && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-quiet">License Key:</span>
                                            <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-ink max-w-[150px] truncate" title={license.key}>
                                                {license.key}
                                            </span>
                                        </div>
                                    )}
                                    {license.remarks && (
                                        <p className="text-[11px] text-quiet italic border-t border-line pt-2 line-clamp-2" title={license.remarks}>
                                            "{license.remarks}"
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Action Footer */}
                            <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                                <button
                                    onClick={() => handleOpenAssign(license)}
                                    className="flex-1 bg-strong hover:bg-strong text-on-strong px-3 py-1.5 rounded-xl transition-all text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 shadow-xs"
                                >
                                    <span>Manage Users ({assigned})</span>
                                </button>

                                <button
                                    onClick={() => openProRataForm(license)}
                                    className="p-1.5 text-ink hover:text-ink hover:bg-surface rounded-lg transition-colors"
                                    title="Add Seats (Pro-Rata)"
                                >
                                    {ICONS.add}
                                </button>
                                <button
                                    onClick={() => openEditForm(license)}
                                    className="p-1.5 text-quiet hover:text-ink hover:bg-muted rounded-lg transition-colors"
                                    title="Edit Details"
                                >
                                    {ICONS.edit}
                                </button>
                                <button
                                    onClick={() => setLicenseToDelete(license.id)}
                                    className="p-1.5 text-ink hover:text-ink hover:bg-surface rounded-lg transition-colors"
                                    title="Delete License"
                                >
                                    {ICONS.delete}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Empty state */}
            {filteredLicenses.length === 0 && (
                <div className="text-center py-16 bg-surface rounded-2xl border border-line">
                    <p className="text-base font-semibold text-ink">No licenses found</p>
                    <p className="text-xs text-quiet mt-1">Try adjusting your search terms or filter selection.</p>
                </div>
            )}

            {/* Modals */}
            <ConfirmationModal isOpen={!!licenseToDelete} onClose={() => setLicenseToDelete(null)} onConfirm={handleDelete} title="Delete License">
                Are you sure you want to delete this license?
            </ConfirmationModal>

            {isProRataOpen && selectedLicense && (
                <LicenseProRataModal
                    isOpen={isProRataOpen}
                    onClose={() => setIsProRataOpen(false)}
                    onSave={handleSave}
                    license={selectedLicense}
                />
            )}

            {isFormOpen && (
                <LicenseForm
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    onSave={handleSave}
                    license={selectedLicense}
                />
            )}

            {isAssignModalOpen && selectedLicense && (
                <LicenseAssignmentModal
                    isOpen={isAssignModalOpen}
                    onClose={() => setIsAssignModalOpen(false)}
                    license={selectedLicense}
                />
            )}
        </div>
    );
};

export default LicenseManagement;
