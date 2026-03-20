import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { contractService } from '../services/ContractService.js';
import { ContractStatus } from '../types/index.js';
import { ApiResponse } from '../types/index.js';
import { IContractDocument } from '../models/Contract.js';
import {
  ContractNotFoundError,
  ContractConflictError,
  ContractValidationError,
} from '../services/ContractService.js';

// ============================================
// Schémas Zod
// ============================================

const GeoPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90),   // latitude
  ]),
});

const CreateContractSchema = z.object({
  clientId: z.string().regex(/^[a-f\d]{24}$/i, 'clientId invalide'),
  vehicleId: z.string().regex(/^[a-f\d]{24}$/i, 'vehicleId invalide'),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  dailyRate: z.number().min(0),
  deposit: z.number().min(0).optional(),
  deliveryLocation: GeoPointSchema,
  deliveryAddress: z.string().min(1),
  geofenceId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateContractSchema = z.object({
  startDate: z.string().or(z.date()).optional(),
  endDate: z.string().or(z.date()).optional(),
  dailyRate: z.number().min(0).optional(),
  deposit: z.number().min(0).optional(),
  deliveryLocation: GeoPointSchema.optional(),
  deliveryAddress: z.string().min(1).optional(),
  geofenceId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  status: z.nativeEnum(ContractStatus).optional(),
  notes: z.string().max(2000).optional(),
});

const ListContractsQuerySchema = z.object({
  status: z.nativeEnum(ContractStatus).optional(),
  clientId: z.string().optional(),
  vehicleId: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// ============================================
// Helpers
// ============================================

function handleServiceError(
  error: unknown,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof ContractNotFoundError) {
    const response: ApiResponse<null> = {
      success: false,
      error: { code: error.code, message: error.message },
    };
    res.status(404).json(response);
    return;
  }

  if (error instanceof ContractConflictError) {
    const response: ApiResponse<null> = {
      success: false,
      error: { code: error.code, message: error.message },
    };
    res.status(409).json(response);
    return;
  }

  if (error instanceof ContractValidationError) {
    const response: ApiResponse<null> = {
      success: false,
      error: { code: error.code, message: error.message },
    };
    res.status(400).json(response);
    return;
  }

  next(error);
}

// ============================================
// Contrôleur
// ============================================

/**
 * Contrôleur de gestion des contrats de location
 * Architecture : Controller → Service → Model
 */
export class ContractController {
  /**
   * GET /api/contracts
   * Liste les contrats de l'organisation avec pagination et filtres
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentification requise' },
        });
        return;
      }

      const parseResult = ListContractsQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Paramètres de requête invalides',
            details: parseResult.error.flatten().fieldErrors as Record<
              string,
              string[]
            >,
          },
        };
        res.status(400).json(response);
        return;
      }

      const filters = parseResult.data;
      const organizationId = req.user.organizationId.toString();

      const { contracts, total } = await contractService.listContracts(
        organizationId,
        filters
      );

      const page = filters.page;
      const limit = filters.limit;

      const response: ApiResponse<IContractDocument[]> = {
        success: true,
        data: contracts,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/contracts/:id
   * Récupère un contrat par son ID (scoped à l'organisation)
   */
  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentification requise' },
        });
        return;
      }

      const { id } = req.params;
      const organizationId = req.user.organizationId.toString();

      const contract = await contractService.getContractById(
        organizationId,
        id
      );

      const response: ApiResponse<IContractDocument> = {
        success: true,
        data: contract,
      };

      res.json(response);
    } catch (error) {
      handleServiceError(error, res, next);
    }
  }

  /**
   * POST /api/contracts
   * Crée un contrat dans l'organisation du demandeur
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentification requise' },
        });
        return;
      }

      const parseResult = CreateContractSchema.safeParse(req.body);
      if (!parseResult.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Données de création invalides',
            details: parseResult.error.flatten().fieldErrors as Record<
              string,
              string[]
            >,
          },
        };
        res.status(400).json(response);
        return;
      }

      // organizationId est toujours pris du token, jamais du body
      const organizationId = req.user.organizationId.toString();

      const contract = await contractService.createContract(
        organizationId,
        parseResult.data
      );

      const response: ApiResponse<IContractDocument> = {
        success: true,
        data: contract,
      };

      res.status(201).json(response);
    } catch (error) {
      handleServiceError(error, res, next);
    }
  }

  /**
   * PATCH /api/contracts/:id
   * Met à jour un contrat
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentification requise' },
        });
        return;
      }

      const parseResult = UpdateContractSchema.safeParse(req.body);
      if (!parseResult.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Données de mise à jour invalides',
            details: parseResult.error.flatten().fieldErrors as Record<
              string,
              string[]
            >,
          },
        };
        res.status(400).json(response);
        return;
      }

      const { id } = req.params;
      const organizationId = req.user.organizationId.toString();

      const contract = await contractService.updateContract(
        organizationId,
        id,
        parseResult.data
      );

      const response: ApiResponse<IContractDocument> = {
        success: true,
        data: contract,
      };

      res.json(response);
    } catch (error) {
      handleServiceError(error, res, next);
    }
  }

  /**
   * DELETE /api/contracts/:id
   * Supprime un contrat (uniquement si brouillon ou annulé)
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentification requise' },
        });
        return;
      }

      const { id } = req.params;
      const organizationId = req.user.organizationId.toString();

      await contractService.deleteContract(organizationId, id);

      const response: ApiResponse<null> = {
        success: true,
      };

      res.json(response);
    } catch (error) {
      handleServiceError(error, res, next);
    }
  }
}

export const contractController = new ContractController();

export default contractController;
