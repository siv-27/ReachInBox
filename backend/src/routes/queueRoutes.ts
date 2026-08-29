import { Router } from 'express';
import { QueueController } from '../controllers/queueController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Enforce authentication for all queue endpoints
router.use(authMiddleware as any);

router.get('/stats', QueueController.getStats);
router.get('/jobs', QueueController.getJobs);
router.get('/events', QueueController.eventStream);

export default router;
