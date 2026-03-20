import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Types } from 'mongoose';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { User, IUserDocument, UserRole, Permission } from '../models/User.js';
import { Organization } from '../models/Organization.js';
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
 * Résultat login quand MFA est requis
 */
export interface MfaPendingResult {
  mfaRequired: true;
  mfaToken: string;
}

/**
 * Résultat du setup MFA
 */
export interface MfaSetupResult {
  secret: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
}

const MFA_TOKEN_EXPIRY = '5m';
const MFA_ISSUER = 'BTP Location';
const BACKUP_CODES_COUNT = 8;

/**
 * Données pour l'inscription
 * `organizationId` est optionnel : s'il est absent, une nouvelle organisation
 * est créée automatiquement (flux d'auto-inscription publique).
 */
export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  organizationId?: string;
}

/**
 * Service d'authentification
 * Gère l'inscription, la connexion, les tokens JWT et la récupération de mot de passe
 */
export class AuthService {
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiryDays = 7;

  /**
   * Inscrit un nouvel utilisateur.
   *
   * Flux auto-inscription (sans `organizationId`) :
   *   1. Crée une Organisation avec le nom "{firstName} {lastName} - Organisation"
   *   2. Utilise l'`_id` de cette organisation pour l'utilisateur
   *
   * Flux invitation (avec `organizationId`) :
   *   Rattache directement l'utilisateur à l'organisation existante.
   */
  async register(data: RegisterData): Promise<AuthResult> {
    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      throw new Error('Un utilisateur avec cet email existe déjà');
    }

    // Résoudre l'organisationId : créer une nouvelle org si absent
    let resolvedOrganizationId: Types.ObjectId;

    if (data.organizationId) {
      resolvedOrganizationId = new Types.ObjectId(data.organizationId);
    } else {
      // Auto-inscription : créer une organisation dédiée
      const orgName = `${data.firstName} ${data.lastName} - Organisation`;
      const newOrg = await Organization.create({ name: orgName });
      resolvedOrganizationId = newOrg._id;
    }

    // Créer l'utilisateur
    const user = await User.create({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || UserRole.OPERATOR,
      organizationId: resolvedOrganizationId,
    });

    // Générer les tokens
    return this.generateAuthResult(user);
  }

  /**
   * Connecte un utilisateur.
   * Si MFA est activé, retourne un token temporaire au lieu des tokens d'accès.
   */
  async login(
    email: string,
    password: string,
    metadata?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthResult | MfaPendingResult> {
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

    // Si MFA activé, retourner un token temporaire pour la vérification TOTP
    if (user.mfaEnabled) {
      const mfaToken = jwt.sign(
        { userId: user._id.toString(), purpose: 'mfa' },
        config.jwt.secret,
        { expiresIn: MFA_TOKEN_EXPIRY }
      );
      return { mfaRequired: true, mfaToken };
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

  // ============================================
  // MFA / TOTP
  // ============================================

  /**
   * Génère un secret TOTP et retourne le QR code pour le setup
   */
  async setupMfa(userId: string): Promise<MfaSetupResult> {
    const user = await User.findById(userId);
    if (!user) throw new Error('Utilisateur non trouvé');
    if (user.mfaEnabled) throw new Error('Le MFA est déjà activé');

    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: MFA_ISSUER,
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    const otpauthUrl = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Stocker temporairement le secret (pas encore activé)
    user.mfaSecret = secret.base32;
    await user.save({ validateBeforeSave: false });

    return { secret: secret.base32, qrCodeDataUrl, otpauthUrl };
  }

  /**
   * Valide le code TOTP et active le MFA. Retourne les codes de secours.
   */
  async enableMfa(userId: string, token: string): Promise<string[]> {
    const user = await User.findById(userId).select('+mfaSecret');
    if (!user) throw new Error('Utilisateur non trouvé');
    if (user.mfaEnabled) throw new Error('Le MFA est déjà activé');
    if (!user.mfaSecret) throw new Error('Aucun setup MFA en cours. Appelez /mfa/setup d\'abord');

    const isValid = this.verifyTotpToken(user.mfaSecret, token);
    if (!isValid) throw new Error('Code TOTP invalide');

    // Générer les codes de secours
    const backupCodes = Array.from({ length: BACKUP_CODES_COUNT }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Hasher les codes avant stockage
    const hashedCodes = backupCodes.map((code) =>
      crypto.createHash('sha256').update(code).digest('hex')
    );

    user.mfaEnabled = true;
    user.mfaBackupCodes = hashedCodes;
    await user.save({ validateBeforeSave: false });

    return backupCodes;
  }

  /**
   * Désactive le MFA (requiert le mot de passe)
   */
  async disableMfa(userId: string, password: string): Promise<void> {
    const user = await User.findById(userId).select('+password');
    if (!user) throw new Error('Utilisateur non trouvé');
    if (!user.mfaEnabled) throw new Error('Le MFA n\'est pas activé');

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) throw new Error('Mot de passe incorrect');

    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.mfaBackupCodes = undefined;
    await user.save({ validateBeforeSave: false });
  }

  /**
   * Vérifie le code TOTP pendant le login et retourne les tokens d'accès.
   * Accepte un code TOTP ou un code de secours.
   */
  async verifyMfa(
    mfaToken: string,
    code: string,
    metadata?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthResult> {
    // Vérifier le token MFA temporaire
    let payload: { userId: string; purpose: string };
    try {
      payload = jwt.verify(mfaToken, config.jwt.secret) as typeof payload;
    } catch {
      throw new Error('Token MFA expiré ou invalide');
    }

    if (payload.purpose !== 'mfa') {
      throw new Error('Token invalide');
    }

    const user = await User.findById(payload.userId).select('+mfaSecret +mfaBackupCodes');
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new Error('Utilisateur non trouvé ou MFA non activé');
    }

    // Tenter la vérification TOTP
    const isTotpValid = this.verifyTotpToken(user.mfaSecret, code);

    if (!isTotpValid) {
      // Tenter un code de secours
      const codeHash = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
      const backupIndex = user.mfaBackupCodes?.indexOf(codeHash) ?? -1;

      if (backupIndex === -1) {
        throw new Error('Code MFA invalide');
      }

      // Consommer le code de secours
      user.mfaBackupCodes!.splice(backupIndex, 1);
      await user.save({ validateBeforeSave: false });
    }

    // Mettre à jour la date de dernière connexion
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    return this.generateAuthResult(user, metadata);
  }

  /**
   * Vérifie un token TOTP avec une fenêtre de tolérance de +/- 1 période
   */
  private verifyTotpToken(secret: string, token: string): boolean {
    const totp = new OTPAuth.TOTP({
      issuer: MFA_ISSUER,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
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
