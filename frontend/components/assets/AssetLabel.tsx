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
                    size: 52,
                    level: 'H'
                });
            }
        }
    }, [asset.assetId]);

    return (
        <div className="bg-white overflow-hidden flex flex-col p-1 border border-dashed border-gray-400" style={{ width: '189px', height: '113px' }}>
            {/* Header: Logo - Increased height significantly */}
            <div className="w-full flex justify-center items-center shrink-0 mb-1" style={{ height: '38px' }}>
                <img src="/logo.png" alt="Avana Logo" className="w-full h-full object-contain" />
            </div>
            
            <div className="w-full h-px bg-gray-300 shrink-0 mb-1"></div>

            {/* Body: QR & Details */}
            <div className="flex gap-1.5 items-center flex-grow overflow-hidden">
                <canvas ref={qrCodeRef} className="shrink-0" style={{ width: '52px', height: '52px' }}></canvas>
                
                <div className="flex flex-col justify-center overflow-hidden w-full h-full text-[7.5px] leading-tight text-gray-800">
                    <p className="font-bold truncate text-[8.5px]">{asset.name}</p>
                    <p className="text-gray-600 truncate text-[7px] uppercase tracking-wide">{asset.category}</p>
                    <div className="mt-0.5 pt-0.5 border-t border-gray-200">
                         <p className="font-semibold truncate">SN: {asset.serialNumber}</p>
                         <p className="font-black text-[9.5px] truncate tracking-tight">{asset.assetId}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetLabel;