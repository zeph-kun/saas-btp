import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { clientService } from '../services/ClientService.js';
import { ApiResponse } from '../types/index.js';
import { IClientDocument } from '../models/Client.js';
import {
  ClientNotFoundError,
  ClientConflictError,
} from '../services/ClientService.js';

// ============================================
// Schémas Zod
// ============================================

const CreateClientSchema = z.object({
  companyName: z.string().min(1, 'Le nom de l\'entreprise est requis').max(200, 'Le nom ne peut pas dépasser 200 caractères'),
  contactName: z.string().min(1, 'Le nom du contact est requis'),
  email: z.string().email('Email invalide'),
  phone: z.string().regex(
    /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/,
    'Téléphone FR invalide'
  ),
  address: z.object({
    street: z.string().min(1, 'La rue est requise'),
    city: z.string().min(1, 'La ville est requise'),
    postalCode: z.string().regex(/^\d{5}$/, 'Code postal invalide'),
    country: z.string().optional().default('France'),
  }),
  siret: z.string().regex(/^\d{14}$/, 'SIRET invalide (14 chiffres)').optional(),
});

const UpdateClientSchema = CreateClientSchema.partial();

const ListClientsQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// ============================================
// Helper
// ============================================

function handleServiceError(
  error: unknown,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof ClientNotFoundError) {
    const response: ApiResponse<null> = {
      success: false,
      error: { code: error.code, message: error.message },
    };
    res.status(404).json(response);
    return;
  }

  if (error instanceof ClientConflictError) {
    const response: ApiResponse<null> = {
      success: false,
      error: { code: error.code, message: error.message },
    };
    res.status(409).json(response);
    return;
  }

  next(error);
}

// ============================================
// Contrôleur
// ============================================

/**
 * Contrôleur de gestion des clients
 * Architecture : Controller → Service → Model
 */
export class ClientController {
  /**
   * GET /api/clients
   * Liste les clients de l'organisation avec pagination et recherche
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

      const parseResult = ListClientsQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Paramètres de requête invalides',
            details: parseResult.error.flatten().fieldErrors as Record<string, string[]>,
          },
        };
        res.status(400).json(response);
        return;
      }

      const filters = parseResult.data;
      const organizationId = req.user.organizationId.toString();

      const { clients, total } = await clientService.listClients(organizationId, filters);

      const page = filters.page;
      const limit = filters.limit;

      const response: ApiResponse<IClientDocument[]> = {
        success: true,
        data: clients,
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
   * GET /api/clients/:id
   * Récupère un client par son ID (scoped à l'organisation)
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

      const client = await clientService.getClientById(organizationId, id);

      const response: ApiResponse<IClientDocument> = {
        success: true,
        data: client,
      };

      res.json(response);
    } catch (error) {
      handleServiceError(error, res, next);
    }
  }

  /**
   * POST /api/clients
   * Crée un client dans l'organisation du demandeur
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

      const parseResult = CreateClientSchema.safeParse(req.body);
      if (!parseResult.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Données de création invalides',
            details: parseResult.error.flatten().fieldErrors as Record<string, string[]>,
          },
        };
        res.status(400).json(response);
        return;
      }

      // organizationId est toujours pris du token, jamais du body
      const organizationId = req.user.organizationId.toString();

      const client = await clientService.createClient(organizationId, parseResult.data);

      const response: ApiResponse<IClientDocument> = {
        success: true,
        data: client,
      };

      res.status(201).json(response);
    } catch (error) {
      handleServiceError(error, res, next);
    }
  }

  /**
   * PATCH /api/clients/:id
   * Met à jour un client (scoped à l'organisation)
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

      const parseResult = UpdateClientSchema.safeParse(req.body);
      if (!parseResult.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Données de mise à jour invalides',
            details: parseResult.error.flatten().fieldErrors as Record<string, string[]>,
          },
        };
        res.status(400).json(response);
        return;
      }

      const { id } = req.params;
      const organizationId = req.user.organizationId.toString();

      const client = await clientService.updateClient(organizationId, id, parseResult.data);

      const response: ApiResponse<IClientDocument> = {
        success: true,
        data: client,
      };

      res.json(response);
    } catch (error) {
      handleServiceError(error, res, next);
    }
  }

  /**
   * DELETE /api/clients/:id
   * Supprime physiquement un client (vérifie l'absence de contrats actifs)
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

      await clientService.deleteClient(organizationId, id);

      const response: ApiResponse<null> = {
        success: true,
      };

      res.json(response);
    } catch (error) {
      handleServiceError(error, res, next);
    }
  }
}

export const clientController = new ClientController();

export default clientController;
