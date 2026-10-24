import { Asset } from '../types';

export const getWarrantyStatus = (asset: Asset): { label: string, text: string, color: string } => {
    if (!asset.warrantyType) return { label: 'None', text: 'No Warranty', color: 'text-quiet' };

    let endDate: Date;
    if (asset.warrantyType === 'Years' && asset.warrantyStartDate && asset.warrantyYears) {
        const start = new Date(asset.warrantyStartDate);
        endDate = new Date(start.setFullYear(start.getFullYear() + parseInt(asset.warrantyYears as string)));
    } else if (asset.warrantyEndDate) {
        endDate = new Date(asset.warrantyEndDate);
    } else {
        return { label: 'Unknown', text: 'Unknown', color: 'text-quiet' };
    }

    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { label: 'Expired', text: `Expired on ${endDate.toLocaleDateString()}`, color: 'text-ink ' };
    } else if (diffDays <= 30) {
        return { label: 'Expiring Soon', text: `Expiring Soon: ${endDate.toLocaleDateString()}`, color: 'text-ink ' };
    } else {
        return { label: 'Valid', text: `Valid until ${endDate.toLocaleDateString()}`, color: 'text-ink ' };
    }
};

export const generateAssetId = (company: string, assetCode: string, year: string, sequence: number): string => {
    const formattedSequence = sequence.toString().padStart(4, '0');
    if (year) {
        return `${company}-${assetCode}-${year}-${formattedSequence}`;
    }
    return `${company}-${assetCode}-${formattedSequence}`;
};
