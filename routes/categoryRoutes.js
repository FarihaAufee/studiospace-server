import { Router } from 'express';
import {
  getAllCategories,
  getStudiosByCategory,
} from '../controllers/categoryController.js';

const router = Router();

// READ-ONLY & PUBLIC — no authentication. Categories are not a separate
// CRUD API (per project rules): single Studio API + category filtering.

router.get('/', getAllCategories); // GET /api/categories (+ live counts)

// NOTE: the fixed segment /:category/studios; "category" may be a slug
// ("photo-studios"), a title ("Photo Studios") or any stored category value.
router.get('/:category/studios', getStudiosByCategory); // GET /api/categories/:category/studios

export default router;
