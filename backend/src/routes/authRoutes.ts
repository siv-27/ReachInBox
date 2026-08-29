import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/google', AuthController.googleLogin);
router.get('/google/callback', AuthController.googleCallback);
router.get('/me', authMiddleware as any, AuthController.me);
router.post('/logout', AuthController.logout);

export default router;
