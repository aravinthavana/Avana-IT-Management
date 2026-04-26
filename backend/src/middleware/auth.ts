import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: { id: number; role: string };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.cookies?.authToken || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    // Anti-CSRF Double-Submit check for browser mutating requests
    if (['POST', 'PUT', 'DELETE'].includes(req.method) && req.cookies?.authToken) {
        const csrfCookie = req.cookies?.['XSRF-TOKEN'];
        const csrfHeader = req.headers['x-xsrf-token'];
        if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
            return res.status(403).json({ error: 'CSRF security token mismatch.' });
        }
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error('JWT_SECRET is missing in middleware!');
        return res.status(500).json({ error: 'Internal server configuration error.' });
    }

    try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded as { id: number; role: string };
        next();
    } catch (error) {
        console.error('JWT Verification Failed:', (error as Error).message);
        res.status(403).json({ error: 'Invalid or expired token.' });
    }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'Admin') {
        return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }
    next();
};
