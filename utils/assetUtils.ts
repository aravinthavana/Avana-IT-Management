import { Asset } from '../types';

export const getWarrantyStatus = (asset: Asset): { label: string, text: string, color: string } => {
    if (!asset.warrantyType) return { label: 'None', text: 'No Warranty', color: 'text-gray-500' };

    let endDate: Date;
    if (asset.warrantyType === 'Years' && asset.warrantyStartDate && asset.warrantyYears) {
        const start = new Date(asset.warrantyStartDate);
        endDate = new Date(start.setFullYear(start.getFullYear() + parseInt(asset.warrantyYears as string)));
    } else if (asset.warrantyEndDate) {
        endDate = new Date(asset.warrantyEndDate);
    } else {
        return { label: 'Unknown', text: 'Unknown', color: 'text-gray-500' };
    }

    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { label: 'Expired', text: `Expired on ${endDate.toLocaleDateString()}`, color: 'text-red-600 dark:text-red-400' };
    } else if (diffDays <= 30) {
        return { label: 'Expiring Soon', text: `Expiring Soon: ${endDate.toLocaleDateString()}`, color: 'text-yellow-600 dark:text-yellow-400' };
    } else {
        return { label: 'Valid', text: `Valid until ${endDate.toLocaleDateString()}`, color: 'text-green-600 dark:text-green-400' };
    }
};

export const generateAssetId = (company: string, assetCode: string, year: string, sequence: number): string => {
    const formattedSequence = sequence.toString().padStart(4, '0');
    if (year) {
        return `${company}-${assetCode}-${year}-${formattedSequence}`;
    }
    return `${company}-${assetCode}-${formattedSequence}`;
};
