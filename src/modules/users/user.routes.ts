import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../auth/auth.middleware';
import {
  getMyProfileHandler,
  updateMyProfileHandler,
  uploadPhotoHandler,
  createUserHandler,
  getUserByIdHandler,
  listUsersHandler,
  adminUpdateUserHandler,
  deactivateUserHandler,
} from './user.controller';
import { ValidationError } from '../../shared/errors/AppError';

const router = Router();

// Multer: memory storage, 2 MB limit, images only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

// ─── Own profile routes (any authenticated role) ──────────────────────────────
router.get('/me', authenticate(), getMyProfileHandler);
router.put('/me', authenticate(), updateMyProfileHandler);
router.post('/me/photo', authenticate(), upload.single('photo'), uploadPhotoHandler);

// ─── Admin-only routes ────────────────────────────────────────────────────────
router.post('/', authenticate(), authorize(['admin']), createUserHandler);
router.get('/', authenticate(), authorize(['admin']), listUsersHandler);
router.get('/:id', authenticate(), authorize(['admin']), getUserByIdHandler);
router.put('/:id', authenticate(), authorize(['admin']), adminUpdateUserHandler);
router.delete('/:id', authenticate(), authorize(['admin']), deactivateUserHandler);

export default router;
