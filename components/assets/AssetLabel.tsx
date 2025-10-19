import React, { useEffect, useRef } from 'react';
import { Asset } from '../../types';

// This is a global variable from the script loaded in index.html
declare var QRious: any;

interface AssetLabelProps {
    asset: Asset;
}

const CompanyLogo: React.FC<{ company: string }> = ({ company }) => {
    return (
        <div className="text-center flex flex-col items-center">
            <img src="https://avanamedical.com/wp-content/themes/avana/assets/images/logo.png" alt="Avana Logo" className="h-6" />
            <p className="text-[7px] font-light tracking-widest text-gray-600 -mt-1">IT ASSET</p>
        </div>
    );
};

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
                    size: 64,
                    level: 'H'
                });
            }
        }
    }, [asset.assetId]);

    return (
        // The main container, sized to 50x30mm, with overflow hidden to prevent visual bugs.
        <div className="p-1 border border-dashed border-gray-400 bg-white overflow-hidden" style={{ width: '189px', height: '113px' }}>
            <div className="flex flex-col h-full">
                {/* Company Logo at the top */}
                <CompanyLogo company={asset.company} />
                
                {/* Content area below the logo */}
                <div className="flex-grow flex items-center gap-2 border-t border-gray-200 mt-1 pt-1">
                    <canvas ref={qrCodeRef} className="flex-shrink-0"></canvas>
                    
                    <div className="text-[9px] overflow-hidden leading-tight w-full">
                        <p className="font-bold truncate" title={asset.name}>{asset.name}</p>
                        <p className="text-gray-600 truncate" title={asset.category}>{asset.category}</p>
                        <div className="mt-1 pt-1 border-t border-gray-200">
                             {/* Using break-words to handle long strings without breaking layout */}
                             <p className="font-semibold text-gray-800 break-words leading-snug">S/N: {asset.serialNumber}</p>
                             <p className="font-semibold text-gray-800 break-words leading-snug">{asset.assetId}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetLabel;