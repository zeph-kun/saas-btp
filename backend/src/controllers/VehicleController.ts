import { Request, Response, NextFunction } from 'express';
import { vehicleService, locationService, alertService } from '../services/index.js';
import { ApiResponse, VehicleStatus } from '../types/index.js';
import { IVehicleDocument } from '../models/index.js';
import {
  CreateVehicleInput,
  UpdateVehicleInput,
  UpdateVehicleLocationInput,
  VehicleQueryInput,
} from '../validators/schemas.js';
import { DEMO_ORGANIZATION_ID } from '../config/index.js';

/**
 * Contrôleur pour la gestion des véhicules/engins
 * Architecture: Controller -> Service -> Model
 */
export class VehicleController {
  /**
   * GET /api/vehicles
   * Liste les véhicules avec pagination et filtres
   */
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // L'organizationId viendrait normalement du JWT/session
      const organizationId = req.headers['x-organization-id'] as string || DEMO_ORGANIZATION_ID;
      const query = (req as Request & { validatedQuery: VehicleQueryInput }).validatedQuery || req.query;

      const result = await vehicleService.getVehiclesByOrganization(organizationId, {
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
        status: query.status as VehicleStatus | undefined,
        type: query.type as string | undefined,
        search: query.search as string | undefined,
      });

      const response: ApiResponse<IVehicleDocument[]> = {
        success: true,
        data: result.vehicles,
        meta: {
          page: result.page,
          limit: Number(query.limit) || 20,
          total: result.total,
          totalPages: result.totalPages,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/vehicles/:id
   * Récupère un véhicule par son ID
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const vehicle = await vehicleService.getVehicleById(id);

      if (!vehicle) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Véhicule non trouvé',
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<IVehicleDocument> = {
        success: true,
        data: vehicle,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/vehicles/:id/details
   * Récupère un véhicule avec son contrat actif et client
   */
  async getDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const details = await vehicleService.getVehicleWithActiveContract(id);

      if (!details.vehicle) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Véhicule non trouvé',
          },
        };
        res.status(404).json(response);
        return;
      }

      // Récupérer aussi l'historique des alertes récentes
      const alerts = await alertService.getVehicleAlertHistory(id, 10);

      const response: ApiResponse<{
        vehicle: IVehicleDocument;
        contract: unknown;
        client: unknown;
        recentAlerts: unknown[];
      }> = {
        success: true,
        data: {
          vehicle: details.vehicle,
          contract: details.contract,
          client: details.client,
          recentAlerts: alerts,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/vehicles
   * Crée un nouveau véhicule
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.headers['x-organization-id'] as string || DEMO_ORGANIZATION_ID;
      const vehicleData: CreateVehicleInput = req.body;

      const vehicle = await vehicleService.createVehicle({
        ...vehicleData,
        organizationId,
        status: VehicleStatus.DISPONIBLE,
        lastLocationUpdate: new Date(),
        assignedGeofences: [],
      });

      const response: ApiResponse<IVehicleDocument> = {
        success: true,
        data: vehicle,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/vehicles/:id
   * Met à jour un véhicule
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updates: UpdateVehicleInput = req.body;

      const vehicle = await vehicleService.updateVehicle(id, updates);

      if (!vehicle) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Véhicule non trouvé',
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<IVehicleDocument> = {
        success: true,
        data: vehicle,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/vehicles/:id/location
   * Met à jour la position d'un véhicule (appelé par le tracker GPS)
   * Vérifie automatiquement les violations de geofence
   */
  async updateLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const locationData: UpdateVehicleLocationInput = req.body;

      // Utiliser le LocationService pour la mise à jour + détection d'alertes
      const result = await locationService.updateVehicleLocation(id, locationData.location);

      // Si des alertes ont été détectées, les créer
      for (const alertData of result.alerts) {
        await alertService.createAlert(
          id,
          alertData.type,
          alertData.severity,
          alertData.message,
          locationData.location
        );
      }

      const response: ApiResponse<{
        vehicle: IVehicleDocument;
        alertsTriggered: number;
      }> = {
        success: true,
        data: {
          vehicle: result.vehicle,
          alertsTriggered: result.alerts.length,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/vehicles/:id/status
   * Met à jour le statut d'un véhicule
   */
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const vehicle = await vehicleService.updateVehicleStatus(id, status);

      if (!vehicle) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Véhicule non trouvé',
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<IVehicleDocument> = {
        success: true,
        data: vehicle,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/vehicles/:id/geofences/:geofenceId
   * Assigne une geofence à un véhicule
   */
  async assignGeofence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, geofenceId } = req.params;

      const vehicle = await vehicleService.assignGeofence(id, geofenceId);

      if (!vehicle) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Véhicule non trouvé',
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<IVehicleDocument> = {
        success: true,
        data: vehicle,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/vehicles/:id/geofences/:geofenceId
   * Retire une geofence d'un véhicule
   */
  async removeGeofence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, geofenceId } = req.params;

      const vehicle = await vehicleService.removeGeofence(id, geofenceId);

      if (!vehicle) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Véhicule non trouvé',
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<IVehicleDocument> = {
        success: true,
        data: vehicle,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/vehicles/:id
   * Supprime (soft delete) un véhicule
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const success = await vehicleService.deleteVehicle(id);

      if (!success) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Véhicule non trouvé',
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<null> = {
        success: true,
      };

      res.json(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('contrat actif')) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'CONFLICT',
            message: error.message,
          },
        };
        res.status(409).json(response);
        return;
      }
      next(error);
    }
  }

  /**
   * GET /api/vehicles/stats
   * Statistiques des véhicules pour le dashboard
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.headers['x-organization-id'] as string || DEMO_ORGANIZATION_ID;

      const stats = await vehicleService.getVehicleStats(organizationId);

      const response: ApiResponse<typeof stats> = {
        success: true,
        data: stats,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/vehicles/near
   * Trouve les véhicules proches d'un point
   */
  async findNear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.headers['x-organization-id'] as string || DEMO_ORGANIZATION_ID;
      const { longitude, latitude, radiusMeters } = req.query;

      const vehicles = await locationService.findVehiclesNearPoint(
        Number(longitude),
        Number(latitude),
        Number(radiusMeters) || 1000,
        organizationId
      );

      const response: ApiResponse<IVehicleDocument[]> = {
        success: true,
        data: vehicles,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

// Export d'une instance singleton
export const vehicleController = new VehicleController();
export default vehicleController;
