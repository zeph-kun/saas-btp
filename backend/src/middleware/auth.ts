import { Request, Response, NextFunction } from 'express';
import { authService, JWTPayload } from '../services/AuthService.js';
import { User, IUserDocument, UserRole, Permission } from '../models/User.js';

/**
 * Extension de l'interface Request pour inclure l'utilisateur authentifié
 */
declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
      jwtPayload?: JWTPayload;
    }
  }
}

/**
 * Middleware d'authentification JWT
 * Vérifie le token dans le header Authorization
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Récupérer le token du header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token d\'authentification requis',
        },
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Vérifier le token
    const payload = authService.verifyAccessToken(token);
    
    // Récupérer l'utilisateur complet
    const user = await User.findById(payload.userId);
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Utilisateur non trouvé',
        },
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        success: false,
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Ce compte a été désactivé',
        },
      });
      return;
    }

    // Attacher l'utilisateur et le payload à la requête
    req.user = user;
    req.jwtPayload = payload;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token invalide ou expiré',
      },
    });
  }
};

/**
 * Middleware optionnel d'authentification
 * Attache l'utilisateur s'il est authentifié, sinon continue sans erreur
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = authService.verifyAccessToken(token);
      const user = await User.findById(payload.userId);
      
      if (user && user.isActive) {
        req.user = user;
        req.jwtPayload = payload;
      }
    }
  } catch {
    // Ignorer les erreurs, continuer sans authentification
  }
  
  next();
};

/**
 * Factory pour créer un middleware de vérification de rôle
 * @param allowedRoles - Rôles autorisés
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentification requise',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Vous n\'avez pas les droits nécessaires pour cette action',
        },
      });
      return;
    }

    next();
  };
};

/**
 * Factory pour créer un middleware de vérification de permission
 * @param requiredPermissions - Permissions requises (au moins une)
 */
export const requirePermission = (...requiredPermissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentification requise',
        },
      });
      return;
    }

    // Super admin a toujours accès
    if (req.user.role === UserRole.SUPER_ADMIN) {
      return next();
    }

    // Vérifier si l'utilisateur a au moins une des permissions
    const hasPermission = req.user.hasAnyPermission(requiredPermissions);

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Permission insuffisante pour cette action',
          requiredPermissions,
        },
      });
      return;
    }

    next();
  };
};

/**
 * Factory pour vérifier que toutes les permissions sont présentes
 */
export const requireAllPermissions = (...requiredPermissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentification requise',
        },
      });
      return;
    }

    // Super admin a toujours accès
    if (req.user.role === UserRole.SUPER_ADMIN) {
      return next();
    }

    const hasAllPermissions = req.user.hasAllPermissions(requiredPermissions);

    if (!hasAllPermissions) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Permissions insuffisantes pour cette action',
          requiredPermissions,
        },
      });
      return;
    }

    next();
  };
};

/**
 * Middleware pour vérifier que l'utilisateur appartient à la bonne organisation
 * Utilise x-organization-id du header ou l'organization de l'utilisateur
 */
export const requireOrganization = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentification requise',
      },
    });
    return;
  }

  // Super admin peut accéder à toutes les organisations
  if (req.user.role === UserRole.SUPER_ADMIN) {
    return next();
  }

  const requestedOrgId = req.headers['x-organization-id'] as string;
  
  // Si un ID d'organisation est spécifié, vérifier qu'il correspond
  if (requestedOrgId && requestedOrgId !== req.user.organizationId.toString()) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Accès non autorisé à cette organisation',
      },
    });
    return;
  }

  // Définir automatiquement l'ID d'organisation depuis l'utilisateur
  req.headers['x-organization-id'] = req.user.organizationId.toString();

  next();
};

export default {
  authenticate,
  optionalAuth,
  requireRole,
  requirePermission,
  requireAllPermissions,
  requireOrganization,
};
