import { Router } from 'express';
import { SlackController } from '../controllers/slackController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Connect route initiates the redirect (needs user authentication cookie)
router.get('/connect', authMiddleware as any, SlackController.connect);

// Callback route handles redirect from Slack (does not require auth middleware on route as state parameter is decrypted to identify the user)
router.get('/callback', SlackController.callback as any);

// Status checks and Disconnect endpoints
router.get('/status', authMiddleware as any, SlackController.getStatus);
router.post('/disconnect', authMiddleware as any, SlackController.disconnect);

export default router;
