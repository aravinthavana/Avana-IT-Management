import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: { id: number; role: string };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-plz-change');
        req.user = decoded as { id: number; role: string };
        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid or expired token.' });
    }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'Admin') {
        return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }
    next();
};
