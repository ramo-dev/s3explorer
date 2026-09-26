import { Router } from 'express';
import { getAuthStatus, login, logout } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/status', getAuthStatus);

export default router;
