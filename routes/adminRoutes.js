import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';
import {
  getAdminStudios,
  getAdminStudioById,
  updateAdminStudio,
  deleteAdminStudio,
  getAdminStats,
} from '../controllers/adminController.js';

/**
 * ADMIN ROUTES �?" requireAuth (verified Better Auth session, 401) followed
 * by requireAdmin (session email inside the server-side ADMIN_EMAILS env
 * list, 403 for any other user). No request body or query can grant admin
 * access. Reads/edits/deletes cover every studio, including legacy/demo
 * documents with no hostId and string _id values.
 */
const router = Router();

// NOTE: fixed segments are declared before /:id paths.
router.get('/stats', requireAuth, requireAdmin, getAdminStats);          // GET /api/admin/stats
router.get('/studios', requireAuth, requireAdmin, getAdminStudios);     // GET /api/admin/studios (+ filters)
router.get('/studios/:id', requireAuth, requireAdmin, getAdminStudioById); // GET /api/admin/studios/:id
router.put('/studios/:id', requireAuth, requireAdmin, updateAdminStudio);  // PUT /api/admin/studios/:id
router.delete('/studios/:id', requireAuth, requireAdmin, deleteAdminStudio); // DELETE /api/admin/studios/:id

export default router;
