import { Request, Response, NextFunction } from 'express';
import { Geofence, IGeofenceDocument } from '../models/index.js';
import { locationService } from '../services/index.js';
import { ApiResponse } from '../types/index.js';
import { CreateGeofenceInput, UpdateGeofenceInput } from '../validators/schemas.js';
import { getOrganizationObjectId, DEMO_ORGANIZATION_ID } from '../config/index.js';

/**
 * Contrôleur pour la gestion des geofences (zones de sécurité)
 */
export class GeofenceController {
  /**
   * GET /api/geofences
   * Liste toutes les geofences de l'organisation
   */
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.headers['x-organization-id'] as string || DEMO_ORGANIZATION_ID;
      const { isActive } = req.query;

      const filter: Record<string, unknown> = {
        organizationId: getOrganizationObjectId(organizationId),
      };

      if (isActive !== undefined) {
        filter.isActive = isActive === 'true';
      }

      const geofences = await Geofence.find(filter)
        .populate('assignedVehicles', 'name registrationNumber status')
        .sort({ name: 1 })
        .exec();

      const response: ApiResponse<IGeofenceDocument[]> = {
        success: true,
        data: geofences,
        meta: {
          total: geofences.length,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/geofences/:id
   * Récupère une geofence par son ID
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const geofence = await Geofence.findById(id)
        .populate('assignedVehicles', 'name registrationNumber status location')
        .exec();

      if (!geofence) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Geofence non trouvée',
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<IGeofenceDocument> = {
        success: true,
        data: geofence,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/geofences
   * Crée une nouvelle geofence
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.headers['x-organization-id'] as string || DEMO_ORGANIZATION_ID;
      const geofenceData: CreateGeofenceInput = req.body;

      const geofence = new Geofence({
        ...geofenceData,
        organizationId: getOrganizationObjectId(organizationId),
      });

      await geofence.save();

      const response: ApiResponse<IGeofenceDocument> = {
        success: true,
        data: geofence,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/geofences/:id
   * Met à jour une geofence
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updates: UpdateGeofenceInput = req.body;

      const geofence = await Geofence.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      ).exec();

      if (!geofence) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Geofence non trouvée',
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<IGeofenceDocument> = {
        success: true,
        data: geofence,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/geofences/:id
   * Supprime une geofence
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const geofence = await Geofence.findByIdAndDelete(id).exec();

      if (!geofence) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Geofence non trouvée',
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
      next(error);
    }
  }

  /**
   * GET /api/geofences/:id/vehicles
   * Liste les véhicules actuellement dans une geofence
   */
  async getVehiclesInside(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const vehicles = await locationService.findVehiclesInGeofence(id);

      const response: ApiResponse<typeof vehicles> = {
        success: true,
        data: vehicles,
        meta: {
          total: vehicles.length,
        },
      };

      res.json(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('non trouvée')) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        };
        res.status(404).json(response);
        return;
      }
      next(error);
    }
  }

  /**
   * GET /api/geofences/containing-point
   * Trouve les geofences contenant un point donné
   */
  async findContainingPoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.headers['x-organization-id'] as string || DEMO_ORGANIZATION_ID;
      const { longitude, latitude } = req.query;

      const geofences = await locationService.findGeofencesContainingPoint(
        Number(longitude),
        Number(latitude),
        organizationId
      );

      const response: ApiResponse<typeof geofences> = {
        success: true,
        data: geofences,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const geofenceController = new GeofenceController();
export default geofenceController;
