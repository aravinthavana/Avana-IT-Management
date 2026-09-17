import React, { useEffect, useRef } from 'react';
import { User, Asset } from '../../types';

// Global QRious variable
declare var QRious: any;

interface DeclarationFormProps {
    user: User;
    laptop: Asset;
}

const DeclarationForm: React.FC<DeclarationFormProps> = ({ user, laptop }) => {
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
    const qrCodeRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (qrCodeRef.current && laptop.assetId) {
            const canvas = qrCodeRef.current;
            const iframeWindow = canvas.ownerDocument.defaultView as any;
            const QRLib = (iframeWindow && iframeWindow.QRious) || (window as any).QRious;

            if (QRLib) {
                new QRLib({
                    element: canvas,
                    value: laptop.assetId,
                    size: 72,
                    level: 'H'
                });
            }
        }
    }, [laptop.assetId]);
    
    const companyDetails = {
        AMD: { 
            name: 'Avana Medical Devices Pvt. Ltd.', 
            address: ['No. 91, Sundar Nagar 4th Avenue,', 'Nandambakkam, Chennai - 600 032, Tamil Nadu, India.'], 
            phone: '+91 44 4233 1061 / 62 / 63', 
            cin: 'U74999TN2009PTC071443' 
        },
        ASSP: { 
            name: 'Avana Surgical Systems Pvt. Ltd.', 
            address: ['No. 91, 2nd Floor, Sundar Nagar 4th Avenue,', 'Nandambakkam, Chennai – 600 032, Tamil Nadu, India.'], 
            phone: '+91 44 2233 1061 / 62 / 63', 
            cin: 'U74999TN2009PTC071443' 
        },
        ATS: { 
            name: 'Avana Technology Services Pvt. Ltd.', 
            address: ['No. 91, Ground Floor, Sundar Nagar 4th Avenue,', 'Nandambakkam, Chennai - 600 032, Tamil Nadu, India.'], 
            phone: '+91 44 2233 1061 / 62 / 63', 
            cin: '' 
        }
    };

    const companyCode = (laptop.company || laptop.assetId?.split('-')[0] || 'AMD').toUpperCase();
    const currentCompany = companyDetails[companyCode as keyof typeof companyDetails] || companyDetails.AMD;

    // specs parsing
    const specs: Record<string, any> = (() => {
        if (!laptop.specs) return {};
        if (typeof laptop.specs === 'string') {
            try { return JSON.parse(laptop.specs); } catch { return {}; }
        }
        return laptop.specs as Record<string, any>;
    })();

    const isDesktop = laptop.category?.toLowerCase() === 'desktop' || laptop.assetId?.includes('-DES-');
    const deviceType = isDesktop ? 'Desktop' : 'Laptop';

    // Technical specifications list
    const rawTechnicalDetails = [
        { label: `${deviceType} Brand`, value: laptop.brand },
        { label: 'Model Number', value: laptop.model },
        { label: 'Serial Number', value: laptop.serialNumber },
        { label: `${deviceType} Color`, value: specs.color },
        { label: 'Processor', value: specs.processor },
        { label: 'Memory (RAM)', value: specs.memoryTechnology || specs.ram },
        { label: 'Storage', value: specs.storage },
        { label: 'Graphics', value: specs.graphics },
        { label: isDesktop ? 'Monitor / Display' : 'Display Size', value: specs.displaySize },
        { label: 'Operating System', value: specs.os },
        { label: isDesktop ? 'Power Supply' : 'Power Adapter', value: specs.chargerAdapter || specs.powerSupply || (isDesktop ? 'Included' : undefined) },
        ...(!isDesktop && specs.battery ? [{ label: 'Battery Status', value: specs.battery }] : []),
        { label: 'Installed Software', value: specs.software },
        { label: 'Physical Condition', value: laptop.condition || 'Good' },
    ].filter(item => item.value);

    // Pair specs into 2 columns for a compact, balanced layout
    const pairedSpecs: Array<[{ label: string; value: any }, { label: string; value: any } | null]> = [];
    for (let i = 0; i < rawTechnicalDetails.length; i += 2) {
        pairedSpecs.push([rawTechnicalDetails[i], rawTechnicalDetails[i + 1] || null]);
    }

    const deptName = typeof user.department === 'object' ? user.department?.name : (user.department || 'N/A');
    const branchLocation = user.location || (typeof user.branch === 'object' ? user.branch?.name : user.branch) || 'N/A';

    return (
        <div className="bg-white p-7 font-sans text-slate-800 flex flex-col justify-between" style={{ minHeight: '100%', fontSize: '9pt', lineHeight: '1.4' }}>
            {/* ── 1. Compact Executive Header ── */}
            <header className="flex justify-between items-center pb-2.5 border-b-2 border-slate-900 mb-2.5">
                <div className="text-[8.5pt] leading-tight">
                    <h1 className="font-bold text-sm text-slate-900 tracking-tight">{currentCompany.name}</h1>
                    {currentCompany.address.map((line, i) => (
                        <p key={i} className="text-slate-600">{line}</p>
                    ))}
                    <p className="text-slate-600">
                        Phone: {currentCompany.phone}
                        {currentCompany.cin && <span className="ml-2 font-mono">CIN: {currentCompany.cin}</span>}
                    </p>
                </div>
                <div className="flex-shrink-0 ml-4">
                    <img 
                        src="/logo.png" 
                        alt="Avana Logo" 
                        className="h-10 w-auto max-w-[125px] object-contain" 
                    />
                </div>
            </header>

            {/* ── 2. Document Title ── */}
            <div className="text-center my-1.5">
                <h2 className="font-bold uppercase tracking-wider text-[11pt] text-slate-900 inline-block border-b-2 border-slate-900 pb-0.5">
                    Declaration Cum Undertaking
                </h2>
                <p className="text-[8pt] text-slate-500 uppercase tracking-widest mt-0.5">
                    IT Asset Handover & Acceptable Usage Policy
                </p>
            </div>

            {/* ── 3. Employee & Allocation Details Table ── */}
            <div className="mb-2.5">
                <table className="w-full border-collapse border border-slate-300 text-[8.5pt]">
                    <tbody>
                        <tr className="border-b border-slate-200 bg-slate-50">
                            <td className="py-1 px-2.5 font-semibold text-slate-600 w-[18%]">Employee Name:</td>
                            <td className="py-1 px-2.5 font-bold text-slate-900 w-[32%]">{user.name}</td>
                            <td className="py-1 px-2.5 font-semibold text-slate-600 w-[18%]">Date of Handover:</td>
                            <td className="py-1 px-2.5 font-semibold text-slate-900 w-[32%]">{today}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                            <td className="py-1 px-2.5 font-semibold text-slate-600">Employee ID / Dept:</td>
                            <td className="py-1 px-2.5 text-slate-800">
                                {user.employeeId && <span className="font-mono font-semibold mr-1">[{user.employeeId}]</span>}
                                {deptName}
                            </td>
                            <td className="py-1 px-2.5 font-semibold text-slate-600">Contact Number:</td>
                            <td className="py-1 px-2.5 text-slate-800">{user.mobile || 'N/A'}</td>
                        </tr>
                        <tr className="border-b border-slate-200 bg-slate-50">
                            <td className="py-1 px-2.5 font-semibold text-slate-600">{deviceType} Asset ID:</td>
                            <td className="py-1 px-2.5 font-mono font-bold text-slate-900">{laptop.assetId}</td>
                            <td className="py-1 px-2.5 font-semibold text-slate-600">Work Location:</td>
                            <td className="py-1 px-2.5 text-slate-800">{branchLocation}</td>
                        </tr>
                        <tr>
                            <td className="py-1 px-2.5 font-semibold text-slate-600">Issuing Entity:</td>
                            <td className="py-1 px-2.5 text-slate-800">{companyCode} — {currentCompany.name.replace(' Pvt. Ltd.', '')}</td>
                            <td className="py-1 px-2.5 font-semibold text-slate-600">Issued Condition:</td>
                            <td className="py-1 px-2.5 font-bold text-slate-900">{laptop.condition || 'Good'} (1 Unit)</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ── 4. Technical Specifications Table (Balanced 2-Column Paired Layout) ── */}
            <div className="mb-2.5">
                <div className="flex justify-between items-center bg-slate-800 text-white px-2.5 py-1 rounded-t">
                    <span className="font-bold text-[8.5pt] uppercase tracking-wider">Technical Specifications & Hardware Details</span>
                    <span className="text-[7.5pt] opacity-80">Serial No: <strong className="font-mono">{laptop.serialNumber || 'N/A'}</strong></span>
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[8pt]">
                    <tbody>
                        {pairedSpecs.map(([col1, col2], index) => (
                            <tr key={index} className={`border-b border-slate-200 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                                <td className="py-1 px-2 font-semibold text-slate-600 w-[18%]">{col1.label}:</td>
                                <td className="py-1 px-2 text-slate-900 font-medium w-[32%] border-r border-slate-200">{col1.value || '—'}</td>
                                {col2 ? (
                                    <>
                                        <td className="py-1 px-2 font-semibold text-slate-600 w-[18%]">{col2.label}:</td>
                                        <td className="py-1 px-2 text-slate-900 font-medium w-[32%]">{col2.value || '—'}</td>
                                    </>
                                ) : (
                                    <td colSpan={2} className="py-1 px-2 text-slate-400 italic">—</td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── 5. Terms and Conditions ── */}
            <div className="mb-2.5 p-2 bg-slate-50 rounded border border-slate-200 text-[7.8pt] leading-tight">
                <p className="font-bold text-slate-900 mb-1 uppercase tracking-wide text-[8pt]">
                    Terms & Conditions of Asset Allocation:
                </p>
                <ol className="list-decimal list-inside space-y-0.5 text-slate-700 pl-0.5">
                    <li>The {deviceType.toLowerCase()} issued is solely for official and authorized company business purposes.</li>
                    <li>The employee shall be fully accountable for the safe custody, theft, loss, or accidental damage of the property.</li>
                    <li>Any additional software or hardware required must be communicated via email and approved by the IT Department.</li>
                    <li>In case of any hardware or software malfunction, the employee is required to immediately report it to the IT team.</li>
                    <li>Employees may not hand over or take the {deviceType.toLowerCase()} for repair to any external vendor or unauthorized agency.</li>
                    <li>The {deviceType.toLowerCase()} must be promptly returned to the Company in good working condition upon exit or transfer.</li>
                    <li>The employee shall be liable to replace or reimburse the company in the event of theft, loss, or willful damage.</li>
                </ol>
            </div>

            {/* ── 6. Acknowledgment & Dual Signature Block ── */}
            <footer className="pt-2 border-t-2 border-slate-900 text-[8.5pt]">
                <p className="text-[8pt] text-slate-700 mb-2 italic">
                    "I, the undersigned, hereby acknowledge receipt of the {deviceType.toLowerCase()} detailed above in {laptop.condition ? `${laptop.condition} working condition` : 'complete and satisfactory working condition'}, and agree to abide by all the terms, security guidelines, and policies specified herein."
                </p>
                <div className="flex justify-between items-end gap-6">
                    {/* Left: Employee Signature */}
                    <div className="flex-1">
                        <p className="font-bold text-[8.5pt] text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-0.5 mb-1.5">
                            Employee Acknowledgment
                        </p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[8pt]">
                            <div>
                                <span className="text-slate-500 block text-[7.5pt]">Signature:</span>
                                <div className="h-5 border-b border-slate-400 w-full"></div>
                            </div>
                            <div>
                                <span className="text-slate-500 block text-[7.5pt]">Employee Name:</span>
                                <p className="font-bold text-slate-900 pt-0.5 truncate">{user.name}</p>
                            </div>
                            <div>
                                <span className="text-slate-500 block text-[7.5pt]">Date:</span>
                                <p className="font-medium text-slate-800 pt-0.5">{today}</p>
                            </div>
                            <div>
                                <span className="text-slate-500 block text-[7.5pt]">Place / Branch:</span>
                                <p className="font-medium text-slate-800 pt-0.5">{branchLocation}</p>
                            </div>
                        </div>
                    </div>

                    {/* Right: IT Authorization & QR Code */}
                    <div className="flex items-end gap-3 flex-shrink-0 pl-4 border-l border-slate-200">
                        <div className="text-right text-[8pt]">
                            <p className="font-bold text-[8.5pt] text-slate-900 uppercase tracking-wider mb-1">
                                Authorized Signatory
                            </p>
                            <div className="h-5 border-b border-slate-400 w-32 ml-auto mb-1"></div>
                            <p className="text-[7.5pt] text-slate-500">IT Department / Avana</p>
                        </div>
                        <div className="text-center flex-shrink-0 bg-white p-1 rounded border border-slate-200 shadow-sm">
                            <canvas ref={qrCodeRef} style={{ width: '64px', height: '64px', display: 'block' }}></canvas>
                            <p className="text-[7pt] font-mono text-slate-700 font-bold mt-0.5">{laptop.assetId}</p>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default DeclarationForm;