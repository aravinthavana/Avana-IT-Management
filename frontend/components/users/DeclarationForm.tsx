import React, { useEffect, useRef } from 'react';
import { User, Asset } from '../../types';

// This is a global variable from the script loaded in index.html
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

            // Check if QRious is available on the iframe's window
            if (iframeWindow && iframeWindow.QRious) {
                new iframeWindow.QRious({
                    element: canvas,
                    value: laptop.assetId,
                    size: 100, // Reduced size for better visibility
                    level: 'H'
                });
            }
        }
    }, [laptop.assetId]);
    
    const companyDetails = {
        AMD: { name: 'Avana Medical Devices Pvt. Ltd.', address: ['No. 91, Sundar Nagar 4th Avenue,', 'Nandambakkam, Chennai - 600 032,', 'Tamil Nadu, India.'], phone: '+91 44 4233 1061 / 62 / 63', cin: 'U74999TN2009PTC071443' },
        ASSP: { name: 'Avana Surgical Systems Pvt. Ltd.', address: ['No.91, 2nd Floor, Sundar Nagar 4th Avenue,', 'Nandambakkam, Chennai – 600 032,', 'Tamil Nadu, India.'], phone: '+91 44 2233 1061 / 62 / 63', cin: 'U74999TN2009PTC071443' },
        ATS: { name: 'Avana Technology Services Pvt. Ltd.', address: ['No.91, Ground Floor, Sundar Nagar 4th Avenue,', 'Nandambakkam, Chennai 600032,', 'Tamil Nadu, India'], phone: '+91 44 2233 1061/62/63', cin: '' }
    };

    const currentCompany = companyDetails[laptop.company as keyof typeof companyDetails] || companyDetails.AMD;

    // specs may be stored as a JSON string in SQLite — safely parse it
    const specs: Record<string, any> = (() => {
        if (!laptop.specs) return {};
        if (typeof laptop.specs === 'string') {
            try { return JSON.parse(laptop.specs); } catch { return {}; }
        }
        return laptop.specs as Record<string, any>;
    })();

    const technicalDetails = [
        { label: 'Laptop Brand', value: laptop.brand }, { label: 'Model Number', value: laptop.model },
        { label: 'Laptop Color', value: specs.color }, { label: 'Laptop Service Tag', value: specs.serviceTag },
        { label: 'Charger Adapter', value: specs.chargerAdapter }, { label: 'Processor', value: specs.processor },
        { label: 'Graphics', value: specs.graphics }, { label: 'Storage', value: specs.storage },
        { label: 'Memory Technology', value: specs.memoryTechnology }, { label: 'Battery', value: specs.battery },
        { label: 'Dimensions', value: specs.dimensions }, { label: 'Audio', value: specs.audio },
        { label: 'Display Size', value: specs.displaySize }, { label: 'Operating System', value: specs.os },
        { label: 'Item Weight', value: specs.itemWeight }, { label: 'Software', value: specs.software },
    ].filter(item => item.value);
    
    return (
        <div className="bg-white p-8 font-sans leading-normal text-gray-800 flex flex-col h-full" style={{ fontSize: '10pt' }}>
            <header className="flex justify-between items-start pb-4 border-b-2 border-black">
                <div className="text-xs">
                    <h1 className="font-bold text-base">{currentCompany.name}</h1>
                    {currentCompany.address.map((line, i) => <p key={i}>{line}</p>)}
                    <p>Phone: {currentCompany.phone}</p>
                    {currentCompany.cin && <p>CIN No. : {currentCompany.cin}</p>}
                </div>
                <div className="text-right flex flex-col items-end">
                     <img src="https://avanamedical.com/wp-content/themes/avana/assets/images/logo.png" alt="Avana Logo" className="h-12" />
                </div>
            </header>
            
            <main className="flex-grow">
                <h2 className="text-center font-bold uppercase tracking-wider underline text-base my-4">Declaration Cum Undertaking</h2>

                <div className="mb-4 text-sm">
                    <p className="font-bold">To: {user.name}</p>
                    <p>Dept: {user.department}</p>
                    <p>Mob No: {user.mobile}</p> 
                </div>

                <table className="w-full mb-4 text-sm">
                    <tbody>
                        <tr className="border-t border-b border-gray-400">
                            <td className="py-1 pr-4 whitespace-nowrap"><strong className="font-semibold">Date:</strong> {today}</td>
                            <td className="py-1 px-4 whitespace-nowrap"><strong className="font-semibold">Laptop Asset ID:</strong> {laptop.assetId}</td>
                            <td className="py-1 px-4 whitespace-nowrap"><strong className="font-semibold">Company:</strong> {laptop.company}</td>
                            <td className="py-1 pl-4 whitespace-nowrap"><strong className="font-semibold">Working Location:</strong> {user.location}</td>
                        </tr>
                    </tbody>
                </table>

                <table className="w-full border-collapse text-left mb-4 text-sm">
                    <thead className="border-b-2 border-black">
                        <tr>
                            <th className="p-1 font-bold w-12 text-center">S.No</th>
                            <th className="p-1 font-bold">Specification</th>
                            <th className="p-1 font-bold">Details</th>
                            <th className="p-1 font-bold w-12 text-center">Qty</th>
                        </tr>
                    </thead>
                    <tbody className="align-top">
                        {technicalDetails.map((item, index) => (
                            <tr key={index} className="border-b border-gray-300">
                                <td className="p-1 text-center">{index + 1}</td>
                                <td className="p-1 font-semibold">{item.label}</td>
                                <td className="p-1">{item.value}</td>
                                {index === 0 && <td className="p-1 text-center" rowSpan={technicalDetails.length}>1</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="text-xs space-y-2">
                    <p className="font-bold underline">The laptop has been issued with the below terms and conditions:</p>
                    <ul className="list-decimal list-inside space-y-1 pl-2">
                        <li>The laptop issued is for solely official purpose.</li>
                        <li>The employee shall be fully accountable for theft, loss or damage of the property.</li>
                        <li>Any additional software / hardware required by employee (before or after taking handover) should be clearly communicated through mail to the Company and get the approval.</li>
                        <li>Management is at the sole discretion on approving such requests.</li>
                        <li>In case of any malfunction, employees are required to report the same to the Company.</li>
                        <li>Employees may not take the laptop for repair to any external agency or vendor at any point of time.</li>
                        <li>The laptop should be returned to the Company in case of leaving the organization.</li>
                        <li>The employee shall be liable to replace or pay an equivalent amount to the organization, in case of theft, loss or damage to the property.</li>
                        <li>The organization retains the right to deduct the same from the salary in case of such an event.</li>
                    </ul>
                </div>
            </main>
            
            <footer className="pt-4 text-sm border-t-2 border-black">
                <p className="mb-8">
                    I, the undersigned, acknowledge receipt of the asset detailed above and agree to the terms and conditions.
                </p>
                <div className="flex justify-between items-end">
                    <div className="space-y-4">
                        <p>Signature: <span className="inline-block w-56 border-b border-black align-bottom"></span></p>
                        <p>Name: <span className="inline-block w-56 border-b border-black align-bottom pl-2">{user.name}</span></p>
                        <p>Date: <span className="inline-block w-56 border-b border-black align-bottom"></span></p>
                        <p>Location: <span className="inline-block w-56 border-b border-black align-bottom"></span></p>
                    </div>
                    <div className="text-center flex-shrink-0">
                        <canvas ref={qrCodeRef}></canvas>
                        <p className="text-xs font-mono mt-1">{laptop.assetId}</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default DeclarationForm;