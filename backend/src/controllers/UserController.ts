import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { userService } from '../services/UserService.js';
import { Permission, UserRole } from '../models/User.js';
import { ApiResponse } from '../types/index.js';
import { IUserDocument } from '../models/User.js';
import {
  UserNotFoundError,
  UserForbiddenError,
  UserConflictError,
} from '../services/UserService.js';

// ============================================
// Schémas Zod
// ============================================

const CreateUserSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  firstName: z
    .string()
    .min(1, 'Le prénom est requis')
    .max(50, 'Le prénom ne peut pas dépasser 50 caractères'),
  lastName: z
    .string()
    .min(1, 'Le nom est requis')
    .max(50, 'Le nom ne peut pas dépasser 50 caractères'),
  role: z.nativeEnum(UserRole).optional(),
  permissions: z.array(z.nativeEnum(Permission)).optional(),
});

const UpdateUserSchema = z.object({
  firstName: z
    .string()
    .min(1, 'Le prénom est requis')
    .max(50)
    .optional(),
  lastName: z
    .string()
    .min(1, 'Le nom est requis')
    .max(50)
    .optional(),
  email: z.string().email('Email invalide').optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
});

const UpdatePermissionsSchema = z.object({
  permissions: z.array(z.nativeEnum(Permission)),
});

const ListUsersQuerySchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined) return true;
      return v !== 'false';
    }),
  search: z.string().optional(),
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
  if (error instanceof UserNotFoundError) {
    const response: ApiResponse<null> = {
      success: false,
      error: { code: error.code, message: error.message },
    };
    res.status(404).json(response);
    return;
  }

  if (error instanceof UserForbiddenError) {
    const response: ApiResponse<null> = {
      success: false,
      error: { code: error.code, message: error.message },
    };
    res.status(403).json(response);
    return;
  }

  if (error instanceof UserConflictError) {
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
 * Contrôleur de gestion des utilisateurs
 * Architecture : Controller → Service → Model
 */
export class UserController {
  /**
   * GET /api/users
   * Liste les utilisateurs de l'organisation avec pagination et filtres
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

      const parseResult = ListUsersQuerySchema.safeParse(req.query);
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

      const { users, total } = await userService.listUsers(organizationId, filters);

      const page = filters.page ?? 1;
      const limit = filters.limit ?? 20;

      const response: ApiResponse<IUserDocument[]> = {
        success: true,
        data: users,
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
   * GET /api/users/:id
   * Récupère un utilisateur par son ID (scoped à l'organisation)
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

      const user = await userService.getUserById(organizationId, id);

      const response: ApiResponse<IUserDocument> = {
        success: true,
        data: user,
      };

      res.json(response);
    } catch (error) {
      handleServiceError(error, res, next);
    }
  }

  /**
   * POST /api/users
   * Crée un utilisateur dans l'organisation du demandeur
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

      const parseResult = CreateUserSchema.safeParse(req.body);
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

      const user = await userService.createUser(
        organizationId,
        parseResult.data
      );

      const response: ApiResponse<IUserDocument> = {
        success: true,
        data: user,
      };

      res.status(201).json(response);
    } catch (error) {
      handleServiceError(error, res, next);
    }
  }

  /**
   * PATCH /api/users/:id
   * Met à jour un utilisateur
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

      const parseResult = UpdateUserSchema.safeParse(req.body);
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
      const requestingUserId = req.user._id.toString();

      const user = await userService.updateUser(
        organizationId,
        id,
        parseResult.data,
        requestingUserId
      );

      const response: ApiResponse<IUserDocument> = {
        success: true,
        data: user,
      };

      res.json(response);
    } catch (error) {
      handleServiceError(error, res, next);
    }
  }

  /**
   * DELETE /api/users/:id
   * Désactive un utilisateur (soft delete : isActive = false)
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
      const requestingUserId = req.user._id.toString();

      await userService.deactivateUser(organizationId, id, requestingUserId);

      const response: ApiResponse<null> = {
        success: true,
      };

      res.json(response);
    } catch (error) {
      handleServiceError(error, res, next);
    }
  }

  /**
   * PATCH /api/users/:id/permissions
   * Met à jour les permissions d'un utilisateur
   */
  async updatePermissions(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentification requise' },
        });
        return;
      }

      const parseResult = UpdatePermissionsSchema.safeParse(req.body);
      if (!parseResult.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Liste de permissions invalide',
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

      const user = await userService.updatePermissions(
        organizationId,
        id,
        parseResult.data.permissions
      );

      const response: ApiResponse<IUserDocument> = {
        success: true,
        data: user,
      };

      res.json(response);
    } catch (error) {
      handleServiceError(error, res, next);
    }
  }
}

export const userController = new UserController();

export default userController;
