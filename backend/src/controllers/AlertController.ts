import { Request, Response, NextFunction } from 'express';
import { alertService } from '../services/index.js';
import { ApiResponse } from '../types/index.js';
import { IAlertDocument } from '../models/index.js';
import { DEMO_ORGANIZATION_ID } from '../config/index.js';

/**
 * Contrôleur pour la gestion des alertes
 */
export class AlertController {
  /**
   * GET /api/alerts
   * Liste les alertes actives de l'organisation
   */
  async getActiveAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.headers['x-organization-id'] as string || DEMO_ORGANIZATION_ID;

      const alerts = await alertService.getActiveAlerts(organizationId);

      const response: ApiResponse<IAlertDocument[]> = {
        success: true,
        data: alerts,
        meta: {
          total: alerts.length,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/alerts/stats
   * Statistiques des alertes pour le dashboard
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.headers['x-organization-id'] as string || DEMO_ORGANIZATION_ID;

      const stats = await alertService.getAlertStats(organizationId);

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
   * GET /api/alerts/vehicle/:vehicleId
   * Historique des alertes d'un véhicule
   */
  async getVehicleAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vehicleId } = req.params;
      const limit = Number(req.query.limit) || 50;

      const alerts = await alertService.getVehicleAlertHistory(vehicleId, limit);

      const response: ApiResponse<IAlertDocument[]> = {
        success: true,
        data: alerts,
        meta: {
          total: alerts.length,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/alerts/:id/acknowledge
   * Acquitte une alerte (prise en compte)
   */
  async acknowledge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      // Utiliser l'utilisateur authentifié ou un ID de démo valide
      const userId = req.user?._id?.toString() || '000000000000000000000001';

      const alert = await alertService.acknowledgeAlert(id, userId);

      if (!alert) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Alerte non trouvée',
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<IAlertDocument> = {
        success: true,
        data: alert,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/alerts/:id/resolve
   * Résout une alerte
   */
  async resolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { resolutionNotes } = req.body;
      // Utiliser l'utilisateur authentifié ou un ID de démo valide
      const userId = req.user?._id?.toString() || '000000000000000000000001';

      const alert = await alertService.resolveAlert(id, userId, resolutionNotes);

      if (!alert) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Alerte non trouvée',
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<IAlertDocument> = {
        success: true,
        data: alert,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const alertController = new AlertController();
export default alertController;
