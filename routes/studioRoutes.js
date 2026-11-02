import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getAllStudios,
  getFeaturedStudios,
  getStudioById,
  createStudio,
  updateStudio,
  deleteStudio,
} from '../controllers/studioController.js';

const router = Router();

// NOTE: /featured is a fixed segment. It MUST be declared before /:id,
// otherwise "featured" would be captured as an id parameter.

// GET routes are PUBLIC — browsing/filtering stays open.
router.get('/', getAllStudios);              // GET /api/studios (+ filters)
router.get('/featured', getFeaturedStudios); // GET /api/studios/featured
router.get('/:id', getStudioById);           // GET /api/studios/:id

// Mutation routes are AUTH-DEPENDENT, wrapped with `requireAuth`.
// The placeholder middleware currently responds 501; when Better Auth is
// integrated it validates the session, sets req.user, and these routes
// become live — controllers then enforce owner-only update/delete and
// stamp hostId from the session (never from the request body).
router.post('/', requireAuth, createStudio);       // POST /api/studios
router.put('/:id', requireAuth, updateStudio);     // PUT /api/studios/:id
router.delete('/:id', requireAuth, deleteStudio);  // DELETE /api/studios/:id

export default router;
