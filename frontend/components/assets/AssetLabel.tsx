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
                    size: 56,
                    level: 'M'
                });
            }
        }
    }, [asset.assetId]);

    return (
        <div 
            className="bg-white overflow-hidden flex flex-col"
            style={{ 
                width: '189px', 
                height: '113px', 
                boxSizing: 'border-box', 
                padding: '4px',
                backgroundColor: '#ffffff'
            }}
        >
            {/* Header: Logo with Cropped Transparency */}
            <div 
                className="relative w-full flex justify-center items-center shrink-0 overflow-hidden" 
                style={{ height: '32px' }}
            >
                <img 
                    alt="Avana Logo" 
                    className="absolute" 
                    src="/logo.png" 
                    style={{ width: '69px', height: '78px', objectFit: 'contain' }} 
                />
            </div>
            
            {/* Divider */}
            <div 
                className="w-full shrink-0" 
                style={{ 
                    height: '1px', 
                    backgroundColor: '#d1d5db', 
                    marginTop: '1px', 
                    marginBottom: '3px' 
                }}
            />

            {/* Body: QR & Details */}
            <div 
                className="flex items-center overflow-hidden"
                style={{ gap: '6px', flex: 1, minHeight: 0, width: '100%' }}
            >
                <canvas 
                    ref={qrCodeRef} 
                    className="shrink-0" 
                    style={{ width: '56px', height: '56px', display: 'block' }}
                />
                
                <div 
                    className="flex flex-col justify-center overflow-hidden"
                    style={{ 
                        flex: 1, 
                        minWidth: 0, 
                        height: '100%', 
                        color: '#1e293b' 
                    }}
                >
                    <p 
                        className="font-bold truncate" 
                        style={{ 
                            fontSize: '9px', 
                            lineHeight: 1.15, 
                            color: '#0f172a', 
                            margin: 0 
                        }}
                        title={asset.name}
                    >
                        {asset.name}
                    </p>
                    <p 
                        className="font-semibold truncate uppercase" 
                        style={{ 
                            fontSize: '7px', 
                            color: '#64748b', 
                            letterSpacing: '0.04em', 
                            lineHeight: 1.15, 
                            margin: '1px 0 0 0' 
                        }}
                    >
                        {asset.category}
                    </p>
                    <div 
                        style={{ 
                            marginTop: '2px', 
                            paddingTop: '2px', 
                            borderTop: '1px solid #e2e8f0' 
                        }}
                    >
                        <p 
                            className="truncate" 
                            style={{ 
                                fontSize: '7.5px', 
                                color: '#334155', 
                                lineHeight: 1.15, 
                                margin: 0 
                            }}
                        >
                            SN: {asset.serialNumber || 'N/A'}
                        </p>
                        <p 
                            className="font-bold truncate" 
                            style={{ 
                                fontSize: '10px', 
                                fontWeight: 800, 
                                color: '#0f172a', 
                                letterSpacing: '-0.02em', 
                                lineHeight: 1.15, 
                                margin: '1px 0 0 0' 
                            }}
                        >
                            {asset.assetId}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetLabel;