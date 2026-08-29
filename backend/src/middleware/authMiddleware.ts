import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { config } from '../config/env';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    googleId: string;
    name: string;
    email: string;
    avatar: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.token;

    if (!token) {
      res.status(401).json({ status: 'error', message: 'Unauthorized: No token provided' });
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid token' });
      return;
    }

    if (!decoded || typeof decoded !== 'object' || !decoded.userId) {
      res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid token payload' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      res.status(401).json({ status: 'error', message: 'Unauthorized: User not found' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
