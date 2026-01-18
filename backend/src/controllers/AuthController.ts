import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/AuthService.js';
import { User, UserRole } from '../models/User.js';
import { ApiResponse } from '../types/index.js';

/**
 * Contrôleur d'authentification
 * Gère l'inscription, la connexion, les tokens et la récupération de mot de passe
 */
export class AuthController {
  /**
   * POST /api/auth/register
   * Inscription d'un nouvel utilisateur
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, firstName, lastName, organizationId, role } = req.body;

      // Seuls les admins peuvent créer des utilisateurs avec un rôle spécifique
      const userRole = req.user?.role === UserRole.ADMIN || req.user?.role === UserRole.SUPER_ADMIN
        ? role
        : UserRole.OPERATOR;

      const result = await authService.register({
        email,
        password,
        firstName,
        lastName,
        organizationId: organizationId || req.user?.organizationId.toString(),
        role: userRole,
      });

      const response: ApiResponse<typeof result> = {
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
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

      const response: ApiResponse<typeof result> = {
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        },
      };

      res.json(response);
    } catch (error) {
      // Ne pas révéler de détails sur l'erreur (sécurité)
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
   * Rafraîchissement des tokens
   */
  async refreshToken(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

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

      const response: ApiResponse<typeof result> = {
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        },
      };

      res.json(response);
    } catch (error) {
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
   * Déconnexion (révoque le refresh token)
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await authService.logout(refreshToken);
      }

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

      // Toujours retourner le même message (sécurité)
      const resetToken = await authService.forgotPassword(email);

      // En production, envoyer le token par email
      // Pour le dev, on le retourne dans la réponse
      console.log(`🔑 Token de reset pour ${email}: ${resetToken}`);

      res.json({
        success: true,
        data: {
          message: 'Si cet email existe, un lien de réinitialisation a été envoyé',
          // En dev uniquement :
          ...(process.env.NODE_ENV === 'development' && { resetToken }),
        },
      });
    } catch {
      // Toujours retourner succès pour ne pas révéler si l'email existe
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
      
      // Mettre à jour uniquement les champs autorisés
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
