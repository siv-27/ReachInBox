import { Router } from 'express';
import { emailQueue } from '../queue/emailQueue';

const router = Router();

router.post('/queue', async (req, res, next): Promise<void> => {
  try {
    const { emailId, delay } = req.body;

    if (!emailId) {
      res.status(400).json({ error: 'emailId is required' });
      return;
    }

    // Deterministic but unique job ID to support testing retries/delay checks
    const jobId = `test-${emailId}-${Date.now()}`;

    const job = await emailQueue.add(
      'test-email',
      { emailId },
      {
        jobId,
        delay: delay ? parseInt(String(delay), 10) : undefined,
      }
    );

    res.json({
      message: 'Job added',
      jobId: job.id,
      emailId,
      delay: delay || 0,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
