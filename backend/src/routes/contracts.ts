import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { Permission } from '../models/User.js';
import { ContractController } from '../controllers/ContractController.js';

const router = Router();
const controller = new ContractController();

router.use(authenticate);
router.get('/',       requirePermission(Permission.CONTRACTS_READ),   controller.list.bind(controller));
router.get('/:id',    requirePermission(Permission.CONTRACTS_READ),   controller.getOne.bind(controller));
router.post('/',      requirePermission(Permission.CONTRACTS_CREATE),  controller.create.bind(controller));
router.patch('/:id',  requirePermission(Permission.CONTRACTS_UPDATE),  controller.update.bind(controller));
router.delete('/:id', requirePermission(Permission.CONTRACTS_DELETE),  controller.remove.bind(controller));

export default router;
