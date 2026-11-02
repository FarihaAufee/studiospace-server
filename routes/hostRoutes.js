import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getMyListings,
  getListingById,
  updateListing,
  deleteListing,
} from '../controllers/hostController.js';

/**
 * HOST LISTING ROUTES — AUTH-DEPENDENT.
 *
 * Everything is wrapped with `requireAuth` (501 until Better Auth is
 * integrated). Ownership checks live in the controller: hosts may
 * update/delete ONLY their own listings.
 *
 * These are intentionally separate from the public /api/studios routes so
 * the existing public Studio APIs keep working unchanged.
 */
const router = Router();

router.get('/', requireAuth, getMyListings); // GET /api/hosts/listings
router.get('/:id', requireAuth, getListingById); // GET /api/hosts/listings/:id
router.put('/:id', requireAuth, updateListing); // PUT /api/hosts/listings/:id
router.delete('/:id', requireAuth, deleteListing); // DELETE /api/hosts/listings/:id

export default router;
