import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { Permission } from '../models/User.js';
import { UserController } from '../controllers/UserController.js';

const router = Router();
const controller = new UserController();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

router.get(
  '/',
  requirePermission(Permission.USERS_READ),
  (req, res, next) => controller.list(req, res, next)
);

router.get(
  '/:id',
  requirePermission(Permission.USERS_READ),
  (req, res, next) => controller.getOne(req, res, next)
);

router.post(
  '/',
  requirePermission(Permission.USERS_CREATE),
  (req, res, next) => controller.create(req, res, next)
);

router.patch(
  '/:id',
  requirePermission(Permission.USERS_UPDATE),
  (req, res, next) => controller.update(req, res, next)
);

router.delete(
  '/:id',
  requirePermission(Permission.USERS_DELETE),
  (req, res, next) => controller.remove(req, res, next)
);

router.patch(
  '/:id/permissions',
  requirePermission(Permission.USERS_UPDATE),
  (req, res, next) => controller.updatePermissions(req, res, next)
);

export default router;
