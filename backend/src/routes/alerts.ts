import { Router } from 'express';
import { alertController } from '../controllers/index.js';
import { validateMongoId } from '../validators/index.js';

const router = Router();

/**
 * Routes pour la gestion des alertes
 * 
 * GET   /api/alerts            - Alertes actives
 * GET   /api/alerts/stats      - Statistiques des alertes
 * GET   /api/alerts/vehicle/:vehicleId - Historique d'un véhicule
 * PATCH /api/alerts/:id/acknowledge - Acquitter une alerte
 * PATCH /api/alerts/:id/resolve     - Résoudre une alerte
 */

router.get('/stats', alertController.getStats.bind(alertController));

router.get('/', alertController.getActiveAlerts.bind(alertController));

router.get(
  '/vehicle/:vehicleId',
  validateMongoId('vehicleId'),
  alertController.getVehicleAlerts.bind(alertController)
);

router.patch(
  '/:id/acknowledge',
  validateMongoId('id'),
  alertController.acknowledge.bind(alertController)
);

router.patch(
  '/:id/resolve',
  validateMongoId('id'),
  alertController.resolve.bind(alertController)
);

export default router;
