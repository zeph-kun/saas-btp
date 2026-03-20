import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/AuthService.js';
import { User, UserRole } from '../models/User.js';
import { ApiResponse } from '../types/index.js';
import config from '../config/index.js';

const REFRESH_TOKEN_COOKIE = 'btp_refresh_token';
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 jours en ms

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: (config.nodeEnv === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
  path: '/api/auth',
};

function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, COOKIE_OPTIONS);
}

/**
 * Contrôleur d'authentification
 * Gère l'inscription, la connexion, les tokens et la récupération de mot de passe
 */
export class AuthController {
  /**
   * POST /api/auth/register
   * Inscription d'un nouvel utilisateur.
   *
   * Deux cas :
   * - Inscription publique (req.user absent) : l'utilisateur devient ADMIN de sa
   *   propre organisation créée automatiquement par AuthService.
   * - Inscription par invitation (req.user présent, ADMIN ou SUPER_ADMIN) :
   *   le rôle fourni dans le body est utilisé ; l'organisation est celle du
   *   demandeur sauf si `organizationId` est explicitement précisé.
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, firstName, lastName, organizationId, role } = req.body;

      let userRole: UserRole;
      if (!req.user) {
        userRole = UserRole.ADMIN;
      } else if (
        req.user.role === UserRole.ADMIN ||
        req.user.role === UserRole.SUPER_ADMIN
      ) {
        userRole = role ?? UserRole.OPERATOR;
      } else {
        userRole = UserRole.OPERATOR;
      }

      const resolvedOrganizationId: string | undefined =
        organizationId ??
        (req.user ? req.user.organizationId.toString() : undefined);

      const result = await authService.register({
        email,
        password,
        firstName,
        lastName,
        organizationId: resolvedOrganizationId,
        role: userRole,
      });

      setRefreshTokenCookie(res, result.refreshToken);

      const response: ApiResponse<{ user: typeof result.user; accessToken: string; expiresIn: number }> = {
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   * Connexion d'un utilisateur
   */
  async login(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      const metadata = {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.connection.remoteAddress,
      };

      const result = await authService.login(email, password, metadata);

      setRefreshTokenCookie(res, result.refreshToken);

      const response: ApiResponse<{ user: typeof result.user; accessToken: string; expiresIn: number }> = {
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        },
      };

      res.json(response);
    } catch (error) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email ou mot de passe incorrect',
        },
      });
    }
  }

  /**
   * POST /api/auth/refresh
   * Rafraîchissement des tokens (refresh token lu depuis le cookie httpOnly)
   */
  async refreshToken(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REFRESH_TOKEN',
            message: 'Refresh token requis',
          },
        });
        return;
      }

      const metadata = {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.connection.remoteAddress,
      };

      const result = await authService.refreshTokens(refreshToken, metadata);

      setRefreshTokenCookie(res, result.refreshToken);

      const response: ApiResponse<{ user: typeof result.user; accessToken: string; expiresIn: number }> = {
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        },
      };

      res.json(response);
    } catch (error) {
      clearRefreshTokenCookie(res);
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token invalide ou expiré',
        },
      });
    }
  }

  /**
   * POST /api/auth/logout
   * Déconnexion (révoque le refresh token depuis le cookie)
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      clearRefreshTokenCookie(res);

      res.json({
        success: true,
        data: { message: 'Déconnexion réussie' },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout-all
   * Déconnexion de toutes les sessions
   */
  async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
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

      await authService.logoutAll(req.user._id.toString());

      clearRefreshTokenCookie(res);

      res.json({
        success: true,
        data: { message: 'Toutes les sessions ont été fermées' },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/forgot-password
   * Demande de réinitialisation de mot de passe
   */
  async forgotPassword(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      const resetToken = await authService.forgotPassword(email);

      console.log(`[Auth] Token de reset pour ${email}: ${resetToken}`);

      res.json({
        success: true,
        data: {
          message: 'Si cet email existe, un lien de réinitialisation a été envoyé',
          ...(process.env.NODE_ENV === 'development' && { resetToken }),
        },
      });
    } catch {
      res.json({
        success: true,
        data: {
          message: 'Si cet email existe, un lien de réinitialisation a été envoyé',
        },
      });
    }
  }

  /**
   * POST /api/auth/reset-password
   * Réinitialisation du mot de passe
   */
  async resetPassword(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Token et nouveau mot de passe requis',
          },
        });
        return;
      }

      await authService.resetPassword(token, password);

      res.json({
        success: true,
        data: { message: 'Mot de passe réinitialisé avec succès' },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RESET_TOKEN',
          message: 'Token invalide ou expiré',
        },
      });
    }
  }

  /**
   * POST /api/auth/change-password
   * Changement de mot de passe (utilisateur connecté)
   */
  async changePassword(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
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

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Mot de passe actuel et nouveau mot de passe requis',
          },
        });
        return;
      }

      await authService.changePassword(
        req.user._id.toString(),
        currentPassword,
        newPassword
      );

      res.json({
        success: true,
        data: { message: 'Mot de passe changé avec succès' },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: error instanceof Error ? error.message : 'Erreur lors du changement de mot de passe',
        },
      });
    }
  }

  /**
   * GET /api/auth/me
   * Récupère les informations de l'utilisateur connecté
   */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
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

      const response: ApiResponse<typeof req.user> = {
        success: true,
        data: req.user,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/auth/me
   * Met à jour le profil de l'utilisateur connecté
   */
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
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

      const { firstName, lastName, email } = req.body;

      const updates: Record<string, string> = {};
      if (firstName) updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;
      if (email) updates.email = email;

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        updates,
        { new: true, runValidators: true }
      );

      const response: ApiResponse<typeof updatedUser> = {
        success: true,
        data: updatedUser,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();

export default authController;
