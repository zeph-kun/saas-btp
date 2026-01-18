import { Router } from 'express';
import { geofenceController } from '../controllers/index.js';
import { validate, validateMongoId } from '../validators/index.js';
import { createGeofenceSchema, updateGeofenceSchema, nearQuerySchema } from '../validators/schemas.js';

const router = Router();

/**
 * Routes pour la gestion des geofences
 * 
 * GET    /api/geofences                    - Liste des geofences
 * GET    /api/geofences/containing-point   - Trouver par point
 * GET    /api/geofences/:id                - Détail d'une geofence
 * GET    /api/geofences/:id/vehicles       - Véhicules dans la zone
 * POST   /api/geofences                    - Créer une geofence
 * PUT    /api/geofences/:id                - Modifier une geofence
 * DELETE /api/geofences/:id                - Supprimer une geofence
 */

router.get(
  '/containing-point',
  validate(nearQuerySchema),
  geofenceController.findContainingPoint.bind(geofenceController)
);

router.get('/', geofenceController.getAll.bind(geofenceController));

router.post(
  '/',
  validate(createGeofenceSchema),
  geofenceController.create.bind(geofenceController)
);

router.get(
  '/:id',
  validateMongoId('id'),
  geofenceController.getById.bind(geofenceController)
);

router.get(
  '/:id/vehicles',
  validateMongoId('id'),
  geofenceController.getVehiclesInside.bind(geofenceController)
);

router.put(
  '/:id',
  validateMongoId('id'),
  validate(updateGeofenceSchema),
  geofenceController.update.bind(geofenceController)
);

router.delete(
  '/:id',
  validateMongoId('id'),
  geofenceController.delete.bind(geofenceController)
);

export default router;
