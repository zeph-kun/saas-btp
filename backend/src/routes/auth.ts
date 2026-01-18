import { Router } from 'express';
import { authController } from '../controllers/AuthController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../validators/middleware.js';
import { z } from 'zod';

const router = Router();

/**
 * Schémas de validation pour l'authentification
 */
const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Email invalide'),
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'
      ),
    firstName: z.string().min(1, 'Le prénom est requis').max(50),
    lastName: z.string().min(1, 'Le nom est requis').max(50),
    organizationId: z.string().optional(),
    role: z.enum(['admin', 'manager', 'operator']).optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email invalide'),
    password: z.string().min(1, 'Le mot de passe est requis'),
  }),
});

const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token requis'),
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Email invalide'),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token requis'),
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'
      ),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
    newPassword: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'
      ),
  }),
});

const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    email: z.string().email('Email invalide').optional(),
  }),
});

/**
 * Routes publiques (sans authentification)
 */

// POST /api/auth/login - Connexion
router.post('/login', validate(loginSchema), authController.login);

// POST /api/auth/refresh - Rafraîchir les tokens
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);

// POST /api/auth/forgot-password - Demander un reset de mot de passe
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);

// POST /api/auth/reset-password - Réinitialiser le mot de passe
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

/**
 * Routes protégées (authentification requise)
 */

// POST /api/auth/register - Inscription (admin peut créer des utilisateurs)
router.post(
  '/register',
  optionalAuth,
  validate(registerSchema),
  authController.register
);

// POST /api/auth/logout - Déconnexion
router.post('/logout', authController.logout);

// POST /api/auth/logout-all - Déconnexion de toutes les sessions
router.post('/logout-all', authenticate, authController.logoutAll);

// POST /api/auth/change-password - Changer le mot de passe
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);

// GET /api/auth/me - Informations de l'utilisateur connecté
router.get('/me', authenticate, authController.me);

// PATCH /api/auth/me - Mettre à jour le profil
router.patch(
  '/me',
  authenticate,
  validate(updateProfileSchema),
  authController.updateProfile
);

export default router;
