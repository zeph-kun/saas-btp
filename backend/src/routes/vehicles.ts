import { Router } from 'express';
import { vehicleController } from '../controllers/index.js';
import { validate, validateMongoId } from '../validators/index.js';
import {
  createVehicleSchema,
  updateVehicleSchema,
  updateVehicleLocationSchema,
  updateVehicleStatusSchema,
  vehicleQuerySchema,
  nearQuerySchema,
} from '../validators/schemas.js';

const router = Router();

/**
 * Routes pour la gestion des véhicules
 * 
 * GET    /api/vehicles          - Liste avec pagination/filtres
 * GET    /api/vehicles/stats    - Statistiques pour dashboard
 * GET    /api/vehicles/near     - Recherche géographique
 * GET    /api/vehicles/:id      - Détail d'un véhicule
 * GET    /api/vehicles/:id/details - Véhicule + contrat + client
 * POST   /api/vehicles          - Créer un véhicule
 * PUT    /api/vehicles/:id      - Modifier un véhicule
 * PATCH  /api/vehicles/:id/location - Mettre à jour la position
 * PATCH  /api/vehicles/:id/status   - Modifier le statut
 * POST   /api/vehicles/:id/geofences/:geofenceId - Assigner geofence
 * DELETE /api/vehicles/:id/geofences/:geofenceId - Retirer geofence
 * DELETE /api/vehicles/:id      - Supprimer (soft)
 */

// Routes sans paramètre d'ID (AVANT les routes avec :id)
router.get('/stats', vehicleController.getStats.bind(vehicleController));

router.get(
  '/near',
  validate(nearQuerySchema, 'query'),
  vehicleController.findNear.bind(vehicleController)
);

router.get(
  '/',
  validate(vehicleQuerySchema, 'query'),
  vehicleController.getAll.bind(vehicleController)
);

router.post(
  '/',
  validate(createVehicleSchema),
  vehicleController.create.bind(vehicleController)
);

// Routes avec paramètre :id
router.get(
  '/:id',
  validateMongoId('id'),
  vehicleController.getById.bind(vehicleController)
);

router.get(
  '/:id/details',
  validateMongoId('id'),
  vehicleController.getDetails.bind(vehicleController)
);

router.put(
  '/:id',
  validateMongoId('id'),
  validate(updateVehicleSchema),
  vehicleController.update.bind(vehicleController)
);

router.patch(
  '/:id/location',
  validateMongoId('id'),
  validate(updateVehicleLocationSchema),
  vehicleController.updateLocation.bind(vehicleController)
);

router.patch(
  '/:id/status',
  validateMongoId('id'),
  validate(updateVehicleStatusSchema),
  vehicleController.updateStatus.bind(vehicleController)
);

router.post(
  '/:id/geofences/:geofenceId',
  validateMongoId('id'),
  validateMongoId('geofenceId'),
  vehicleController.assignGeofence.bind(vehicleController)
);

router.delete(
  '/:id/geofences/:geofenceId',
  validateMongoId('id'),
  validateMongoId('geofenceId'),
  vehicleController.removeGeofence.bind(vehicleController)
);

router.delete(
  '/:id',
  validateMongoId('id'),
  vehicleController.delete.bind(vehicleController)
);

export default router;
