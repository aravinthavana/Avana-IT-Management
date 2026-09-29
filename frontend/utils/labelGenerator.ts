import { jsPDF } from 'jspdf';
import { Asset } from '../types';

declare var QRious: any;

/**
 * Generates a pixel-perfect 300 DPI canvas for a 50mm x 30mm thermal label.
 * Postek C168/300 resolution: 300 DPI (approx 11.81 dots/mm)
 * Width: 50mm * (300 / 25.4) ≈ 591 px
 * Height: 30mm * (300 / 25.4) ≈ 354 px
 */
export async function generateLabelCanvas(asset: Asset): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    const width = 591;
    const height = 354;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas 2D context');

    // 1. Solid pure white thermal paper background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. Load and draw Avana logo
    try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = '/logo.png';
        await new Promise<boolean>((resolve) => {
            if (logoImg.complete && logoImg.naturalWidth > 0) {
                resolve(true);
            } else {
                logoImg.onload = () => resolve(true);
                logoImg.onerror = () => resolve(false);
            }
        });

        // Logo container height 82px, max width 230px, centered horizontally
        const maxLogoW = 230;
        const maxLogoH = 82;
        const natW = logoImg.naturalWidth || 200;
        const natH = logoImg.naturalHeight || 70;
        const ratio = Math.min(maxLogoW / natW, maxLogoH / natH);
        const drawW = natW * ratio;
        const drawH = natH * ratio;
        const logoX = (width - drawW) / 2;
        const logoY = 8 + (maxLogoH - drawH) / 2;
        ctx.drawImage(logoImg, logoX, logoY, drawW, drawH);
    } catch {
        // Fallback text if logo fails to render
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('AVANA', width / 2, 58);
        ctx.textAlign = 'left';
    }

    // 3. Top divider line
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(14, 98);
    ctx.lineTo(width - 14, 98);
    ctx.stroke();

    // 4. Generate QR Code at high resolution (175x175 px)
    const qrSize = 175;
    const qrX = 18;
    const qrY = 120;
    try {
        const qrCanvas = document.createElement('canvas');
        const QRiousConstructor = (window as any).QRious || (globalThis as any).QRious;
        if (QRiousConstructor) {
            new QRiousConstructor({
                element: qrCanvas,
                value: asset.assetId || 'AVANA',
                size: qrSize,
                level: 'M'
            });
            ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
        }
    } catch (err) {
        console.warn('QR code generation failed in label generator:', err);
    }

    // 5. Right Details Column
    const textStartX = 212;
    const maxTextWidth = width - textStartX - 18; // approx 361px

    const fitText = (text: string, maxWidth: number) => {
        if (ctx.measureText(text).width <= maxWidth) return text;
        let truncated = text;
        while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
            truncated = truncated.slice(0, -1);
        }
        return truncated + '...';
    };

    // Asset Name (Bold, 26px)
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(fitText(asset.name || 'Unnamed Asset', maxTextWidth), textStartX, 150);

    // Category (Uppercase, Slate-500, 20px)
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(fitText((asset.category || '').toUpperCase(), maxTextWidth), textStartX, 184);

    // Inner subtle divider line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(textStartX, 200);
    ctx.lineTo(width - 18, 200);
    ctx.stroke();

    // Serial Number (Monospace, Slate-700, 22px)
    ctx.fillStyle = '#334155';
    ctx.font = '22px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.fillText(fitText(`SN: ${asset.serialNumber || 'N/A'}`, maxTextWidth), textStartX, 238);

    // Asset ID (Primary bold identifier, 34px)
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 34px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.fillText(fitText(asset.assetId, maxTextWidth), textStartX, 286);

    return canvas;
}

/**
 * Creates a physical 50mm x 30mm PDF with zero margins.
 */
export async function generateLabelPDF(asset: Asset): Promise<jsPDF> {
    const canvas = await generateLabelCanvas(asset);
    // In jsPDF, [height, width] when orientation is 'landscape'
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [30, 50]
    });
    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 0, 0, 50, 30, undefined, 'FAST');
    return doc;
}

/**
 * Opens a clean, dedicated popup print window containing ONLY the 50mm x 30mm label image
 * with empty title and zero margins to eliminate browser headers/footers and centering issues.
 */
export async function printLabelDirect(asset: Asset): Promise<void> {
    const canvas = await generateLabelCanvas(asset);
    const imgData = canvas.toDataURL('image/png');

    const printWin = window.open('', '_blank', 'width=650,height=450');
    if (!printWin) {
        // Fallback to standard window.print if popup blocked
        window.print();
        return;
    }

    printWin.document.open();
    printWin.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>&lrm;</title>
    <style>
      @page {
        size: 50mm 30mm;
        margin: 0mm;
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        padding: 0;
        width: 50mm;
        height: 30mm;
        overflow: hidden;
        background-color: #ffffff;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      img {
        width: 50mm;
        height: 30mm;
        display: block;
        margin: 0;
        padding: 0;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
      }
    </style>
  </head>
  <body>
    <img src="${imgData}" alt="Asset Label ${asset.assetId}" />
    <script>
      window.onload = function() {
        setTimeout(function() {
          window.focus();
          window.print();
        }, 150);
      };
    </script>
  </body>
</html>`);
    printWin.document.close();
}

/**
 * Generates and downloads the exact 50mm x 30mm PDF file.
 */
export async function downloadLabelPDF(asset: Asset): Promise<void> {
    const doc = await generateLabelPDF(asset);
    doc.save(`Asset-Label-${asset.assetId}-50x30mm.pdf`);
}

/**
 * Opens the exact 50mm x 30mm PDF in a new tab where Chrome's built-in PDF viewer
 * will display it with zero browser headers/footers and native 50x30mm dimensions.
 */
export async function openLabelPDF(asset: Asset): Promise<void> {
    const doc = await generateLabelPDF(asset);
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
}
