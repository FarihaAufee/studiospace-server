import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getMyBookings,
  getBookingById,
  createBooking,
  updateBooking,
  cancelBooking,
} from '../controllers/bookingController.js';

/**
 * BOOKING ROUTES — AUTH-DEPENDENT.
 *
 * Every route is wrapped with `requireAuth`. The placeholder middleware
 * currently responds 501; when Better Auth is integrated it will validate
 * the session and set `req.user`, and these routes become live with zero
 * controller changes.
 *
 * NOTE: /my is a fixed segment declared before /:id so "my" is never
 * captured as an id parameter.
 */
const router = Router();

router.post('/', requireAuth, createBooking); // POST /api/bookings
router.get('/my', requireAuth, getMyBookings); // GET /api/bookings/my
router.get('/:id', requireAuth, getBookingById); // GET /api/bookings/:id
router.put('/:id', requireAuth, updateBooking); // PUT /api/bookings/:id
router.patch('/:id/cancel', requireAuth, cancelBooking); // PATCH /api/bookings/:id/cancel

export default router;
