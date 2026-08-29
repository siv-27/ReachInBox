import { Router } from 'express';
import { EmailController } from '../controllers/emailController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Protect all email endpoints with authMiddleware
router.use(authMiddleware as any);

router.post('/schedule', EmailController.schedule);
router.get('/scheduled', EmailController.getScheduled);
router.get('/sent', EmailController.getSent);
router.get('/search', EmailController.search);

export default router;
