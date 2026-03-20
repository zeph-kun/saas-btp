import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { Permission } from '../models/User.js';
import { ClientController } from '../controllers/ClientController.js';

const router = Router();
const controller = new ClientController();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

router.get(
  '/',
  requirePermission(Permission.CLIENTS_READ),
  controller.list.bind(controller)
);

router.get(
  '/:id',
  requirePermission(Permission.CLIENTS_READ),
  controller.getOne.bind(controller)
);

router.post(
  '/',
  requirePermission(Permission.CLIENTS_CREATE),
  controller.create.bind(controller)
);

router.patch(
  '/:id',
  requirePermission(Permission.CLIENTS_UPDATE),
  controller.update.bind(controller)
);

router.delete(
  '/:id',
  requirePermission(Permission.CLIENTS_DELETE),
  controller.remove.bind(controller)
);

export default router;
