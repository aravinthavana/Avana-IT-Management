import React, { useEffect, useRef } from 'react';
import { Asset } from '../../types';

// This is a global variable from the script loaded in index.html
declare var QRious: any;

interface AssetLabelProps {
    asset: Asset;
}

const AssetLabel: React.FC<AssetLabelProps> = ({ asset }) => {
    const qrCodeRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (qrCodeRef.current && asset.assetId) {
            const canvas = qrCodeRef.current;
            const iframeWindow = canvas.ownerDocument.defaultView as any;

            if (iframeWindow && iframeWindow.QRious) {
                new iframeWindow.QRious({
                    element: canvas,
                    value: asset.assetId,
                    size: 60,
                    level: 'M'
                });
            }
        }
    }, [asset.assetId]);

    return (
        <div className="bg-white overflow-hidden flex flex-col p-1" style={{ width: '189px', height: '113px' }}>
            {/* Header: Logo with Cropped Transparency */}
            <div className="relative w-full flex justify-center items-center shrink-0 overflow-hidden" style={{ height: '36px' }}>
                <img src="/logo.png" alt="Avana Logo" className="absolute" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
            </div>
            
            <div className="w-full h-px bg-gray-300 shrink-0 mb-1 mt-0.5"></div>

            {/* Body: QR & Details */}
            <div className="flex gap-2 items-center flex-grow overflow-hidden">
                <canvas ref={qrCodeRef} className="shrink-0" style={{ width: '60px', height: '60px' }}></canvas>
                
                <div className="flex flex-col justify-center overflow-hidden w-full h-full text-[8px] leading-[1.25] text-gray-800 font-semibold">
                    <p className="font-bold truncate text-[9.5px] leading-tight">{asset.name}</p>
                    <p className="text-gray-600 truncate text-[7px] uppercase tracking-wide font-medium">{asset.category}</p>
                    <div className="mt-1 pt-0.5 border-t border-gray-200">
                         <p className="truncate">SN: {asset.serialNumber}</p>
                         <p className="font-black text-[10.5px] truncate tracking-tight">{asset.assetId}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetLabel;