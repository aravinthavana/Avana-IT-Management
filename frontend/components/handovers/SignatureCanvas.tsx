import React, { useRef, useState } from 'react';

interface SignatureCanvasProps {
    onSave: (signatureBase64: string) => void;
    onCancel: () => void;
}

export function getCanvasPoint(canvas: Pick<HTMLCanvasElement, 'width' | 'height' | 'getBoundingClientRect'>, clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
        x: Math.max(0, Math.min(canvas.width, (clientX - rect.left) * canvas.width / rect.width)),
        y: Math.max(0, Math.min(canvas.height, (clientY - rect.top) * canvas.height / rect.height))
    };
}

export default function SignatureCanvas({ onSave, onCancel }: SignatureCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [hasInk, setHasInk] = useState(false);

    const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        const canvas = event.currentTarget;
        const point = getCanvasPoint(canvas, event.clientX, event.clientY);
        const ctx = canvas.getContext('2d');
        if (!point || !ctx) return;
        event.preventDefault();
        canvas.setPointerCapture(event.pointerId);
        drawing.current = true;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(point.x + 0.01, point.y + 0.01);
        ctx.stroke();
        setHasInk(true);
    };
    const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return;
        const point = getCanvasPoint(event.currentTarget, event.clientX, event.clientY);
        const ctx = event.currentTarget.getContext('2d');
        if (!point || !ctx) return;
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
    };
    const stopDrawing = () => { drawing.current = false; };
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        drawing.current = false;
        setHasInk(false);
    };
    return (
        <div className="bg-surface p-4 sm:p-6 rounded-lg shadow-lg max-w-md w-full mx-auto">
            <h3 className="text-lg font-semibold text-ink mb-2">Draw your signature</h3>
            <p className="text-sm text-quiet mb-4">Use your finger, pen or mouse in the area below.</p>
            <div className="border-2 border-line rounded-lg overflow-hidden">
                <canvas ref={canvasRef} width={400} height={200} aria-label="Signature drawing area"
                    className="cursor-crosshair touch-none w-full bg-white"
                    onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing}
                    onPointerCancel={stopDrawing} onLostPointerCapture={stopDrawing} />
            </div>
            <div className="flex flex-wrap justify-between gap-3 mt-4">
                <button type="button" onClick={clearCanvas} className="px-4 py-2 text-sm font-medium text-ink bg-muted rounded-lg">Clear</button>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-quiet hover:underline">Cancel</button>
                    <button type="button" disabled={!hasInk} onClick={() => { if (hasInk && canvasRef.current) onSave(canvasRef.current.toDataURL('image/png')); }}
                        className="px-4 py-2 text-sm font-semibold text-on-accent bg-accent rounded-lg disabled:opacity-50">Confirm &amp; Sign</button>
                </div>
            </div>
        </div>
    );
}
