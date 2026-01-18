import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { User, IUserDocument, UserRole, Permission } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import config from '../config/index.js';

/**
 * Payload du JWT
 */
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string;
  permissions: Permission[];
}

/**
 * Résultat de l'authentification
 */
export interface AuthResult {
  user: IUserDocument;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Données pour l'inscription
 */
export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  organizationId: string;
}

/**
 * Service d'authentification
 * Gère l'inscription, la connexion, les tokens JWT et la récupération de mot de passe
 */
export class AuthService {
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiryDays = 7;

  /**
   * Inscrit un nouvel utilisateur
   */
  async register(data: RegisterData): Promise<AuthResult> {
    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      throw new Error('Un utilisateur avec cet email existe déjà');
    }

    // Créer l'utilisateur
    const user = await User.create({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || UserRole.OPERATOR,
      organizationId: new Types.ObjectId(data.organizationId),
    });

    // Générer les tokens
    return this.generateAuthResult(user);
  }

  /**
   * Connecte un utilisateur
   */
  async login(
    email: string,
    password: string,
    metadata?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthResult> {
    // Trouver l'utilisateur avec le mot de passe
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password')
      .exec();

    if (!user) {
      throw new Error('Email ou mot de passe incorrect');
    }

    // Vérifier si le compte est actif
    if (!user.isActive) {
      throw new Error('Ce compte a été désactivé');
    }

    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('Email ou mot de passe incorrect');
    }

    // Mettre à jour la date de dernière connexion
    user.lastLoginAt = new Date();
    await user.save();

    // Générer les tokens
    return this.generateAuthResult(user, metadata);
  }

  /**
   * Rafraîchit les tokens avec un refresh token
   */
  async refreshTokens(
    refreshTokenStr: string,
    metadata?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthResult> {
    // Trouver le refresh token
    const refreshToken = await RefreshToken.findOne({ token: refreshTokenStr });

    if (!refreshToken) {
      throw new Error('Refresh token invalide');
    }

    if (!refreshToken.isValid()) {
      throw new Error('Refresh token expiré ou révoqué');
    }

    // Trouver l'utilisateur
    const user = await User.findById(refreshToken.userId);
    if (!user || !user.isActive) {
      await refreshToken.updateOne({ isRevoked: true });
      throw new Error('Utilisateur non trouvé ou désactivé');
    }

    // Révoquer l'ancien refresh token
    await refreshToken.updateOne({ isRevoked: true });

    // Générer de nouveaux tokens
    return this.generateAuthResult(user, metadata);
  }

  /**
   * Déconnecte un utilisateur (révoque le refresh token)
   */
  async logout(refreshTokenStr: string): Promise<void> {
    await RefreshToken.updateOne(
      { token: refreshTokenStr },
      { isRevoked: true }
    );
  }

  /**
   * Déconnecte toutes les sessions d'un utilisateur
   */
  async logoutAll(userId: string): Promise<void> {
    await RefreshToken.revokeAllForUser(new Types.ObjectId(userId));
  }

  /**
   * Génère un token de réinitialisation de mot de passe
   */
  async forgotPassword(email: string): Promise<string> {
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Ne pas révéler si l'email existe ou non (sécurité)
      throw new Error('Si cet email existe, un lien de réinitialisation a été envoyé');
    }

    // Générer le token de reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Sauvegarder le token hashé
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure
    await user.save({ validateBeforeSave: false });

    // Retourner le token non-hashé (à envoyer par email)
    return resetToken;
  }

  /**
   * Réinitialise le mot de passe avec un token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Hasher le token pour le comparer
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Trouver l'utilisateur avec ce token non expiré
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      throw new Error('Token invalide ou expiré');
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Révoquer tous les refresh tokens existants
    await RefreshToken.revokeAllForUser(user._id);
  }

  /**
   * Change le mot de passe d'un utilisateur connecté
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await User.findById(userId).select('+password');

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    // Vérifier le mot de passe actuel
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new Error('Mot de passe actuel incorrect');
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();

    // Révoquer tous les refresh tokens sauf celui actuel (optionnel)
    await RefreshToken.revokeAllForUser(user._id);
  }

  /**
   * Vérifie un access token et retourne le payload
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as JWTPayload;
    } catch {
      throw new Error('Token invalide ou expiré');
    }
  }

  /**
   * Récupère un utilisateur par son ID
   */
  async getUserById(userId: string): Promise<IUserDocument | null> {
    return User.findById(userId);
  }

  /**
   * Génère le résultat d'authentification (tokens + user)
   */
  private async generateAuthResult(
    user: IUserDocument,
    metadata?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthResult> {
    // Créer le payload JWT
    const payload: JWTPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      organizationId: user.organizationId.toString(),
      permissions: user.permissions,
    };

    // Générer l'access token
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: this.accessTokenExpiry,
    });

    // Créer le refresh token en base
    const refreshTokenDoc = await RefreshToken.createToken(
      user._id,
      this.refreshTokenExpiryDays,
      metadata
    );

    return {
      user,
      accessToken,
      refreshToken: refreshTokenDoc.token,
      expiresIn: 15 * 60, // 15 minutes en secondes
    };
  }
}

export const authService = new AuthService();

export default authService;
