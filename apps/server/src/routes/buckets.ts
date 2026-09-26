import { type Request, type Response, Router } from 'express';
import { connections } from '../services/db.js';
import * as s3 from '../services/s3.js';
import { isValidBucketName } from '../utils/validation.js';

const router = Router();

// Helper to extract S3 error details
function getS3ErrorDetails(error: any): { message: string; s3Code?: string; status: number } {
  const s3Code = error.name || error.Code || error.$metadata?.httpStatusCode;
  const message = error.message || 'Operation failed';
  const status = error.status || error.$metadata?.httpStatusCode || 500;
  return { message, s3Code, status };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const active = connections.getActive();
    if (active?.bucket) {
      // Single-bucket connection (e.g., GCS): don't call ListBuckets (provider may reject it).
      return res.json({ buckets: [{ name: active.bucket, creationDate: null }] });
    }
    const buckets = await s3.listBuckets();
    res.json({ buckets });
  } catch (error: any) {
    console.warn('Error listing buckets:', error.message);
    // If no connection, return empty bucket list with special status
    if (error.message && error.message.includes('No active S3 connection')) {
      return res.json({ buckets: [] });
    }
    const { message, s3Code, status } = getS3ErrorDetails(error);
    res.status(status).json({ error: message, s3Code });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    if (connections.getActive()?.bucket) {
      return res.status(403).json({ error: 'Creating buckets is disabled for single-bucket connections. Unpin the connection to manage buckets.' });
    }

    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Bucket name required' });
    }
    if (!isValidBucketName(name)) {
      return res.status(400).json({ error: 'Invalid bucket name. Use lowercase letters, numbers, and hyphens.' });
    }

    await s3.createBucket(name);
    res.json({ success: true, message: 'Bucket created' });
  } catch (error: any) {
    console.error('Error creating bucket:', error);
    const { message, s3Code, status } = getS3ErrorDetails(error);
    res.status(status).json({ error: message, s3Code });
  }
});

router.delete('/:name', async (req: Request, res: Response) => {
  try {
    if (connections.getActive()?.bucket) {
      return res.status(403).json({ error: 'Deleting buckets is disabled for single-bucket connections. Unpin the connection to manage buckets.' });
    }

    const { name } = req.params;
    if (!isValidBucketName(name)) {
      return res.status(400).json({ error: 'Invalid bucket name' });
    }

    await s3.deleteBucket(name);
    res.json({ success: true, message: 'Bucket deleted' });
  } catch (error: any) {
    console.error('Error deleting bucket:', error);
    const { message, s3Code, status } = getS3ErrorDetails(error);
    res.status(status).json({ error: message, s3Code });
  }
});

export default router;
