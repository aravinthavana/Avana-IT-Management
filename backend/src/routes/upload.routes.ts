import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';

const router = Router();

const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'text/plain', 'text/csv', 'application/zip',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (_req: any, file: any, cb: any) => {
        if (file.mimetype.startsWith('image/') || allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('File type not supported. Allowed: Images, PDF, TXT, CSV, DOC, DOCX, XLS, XLSX, ZIP.'));
        }
    }
});

router.post('/api/upload', authenticateToken, (req, res) => {
    upload.single('file')(req, res, (err: any) => {
        if (err) {
            console.error('Upload error:', err.message);
            return res.status(400).json({ error: err.message || 'File upload failed' });
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Store as base64 data URL — survives server restarts, no disk required
        const base64 = file.buffer.toString('base64');
        const dataUrl = `data:${file.mimetype};base64,${base64}`;

        res.json({
            url: dataUrl,
            name: file.originalname,
            size: file.size,
            type: file.mimetype
        });
    });
});

export default router;
