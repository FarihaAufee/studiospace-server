import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getProfile,
  updateProfile,
} from '../controllers/profileController.js';

/**
 * USER PROFILE ROUTES — AUTH-DEPENDENT.
 *
 * Wrapped with `requireAuth` (501 until Better Auth is integrated).
 * The profile reads/writes Better Auth's own `user` collection document.
 */
const router = Router();

router.get('/', requireAuth, getProfile); // GET /api/profile
router.put('/', requireAuth, updateProfile); // PUT /api/profile

export default router;
