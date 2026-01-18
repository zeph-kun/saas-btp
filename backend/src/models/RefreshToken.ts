import mongoose, { Schema, Document, Types } from 'mongoose';
import crypto from 'crypto';

/**
 * Interface pour le document Mongoose RefreshToken
 */
export interface IRefreshTokenDocument extends Document {
  _id: Types.ObjectId;
  token: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  isRevoked: boolean;
  userAgent?: string;
  ipAddress?: string;
  
  // Méthodes d'instance
  isExpired(): boolean;
  isValid(): boolean;
}

/**
 * Schéma Mongoose pour les refresh tokens
 */
const refreshTokenSchema = new Schema<IRefreshTokenDocument>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
    userAgent: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index pour le nettoyage automatique des tokens expirés
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index composite pour les recherches
refreshTokenSchema.index({ userId: 1, isRevoked: 1 });

/**
 * Vérifie si le token est expiré
 */
refreshTokenSchema.methods.isExpired = function(): boolean {
  return new Date() > this.expiresAt;
};

/**
 * Vérifie si le token est valide (non expiré et non révoqué)
 */
refreshTokenSchema.methods.isValid = function(): boolean {
  return !this.isRevoked && !this.isExpired();
};

/**
 * Méthode statique pour générer un nouveau token
 */
refreshTokenSchema.statics.generateToken = function(): string {
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Méthode statique pour créer un nouveau refresh token
 */
refreshTokenSchema.statics.createToken = async function(
  userId: Types.ObjectId,
  expiresInDays: number = 7,
  metadata?: { userAgent?: string; ipAddress?: string }
): Promise<IRefreshTokenDocument> {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  return this.create({
    token,
    userId,
    expiresAt,
    ...metadata,
  });
};

/**
 * Méthode statique pour révoquer tous les tokens d'un utilisateur
 */
refreshTokenSchema.statics.revokeAllForUser = async function(
  userId: Types.ObjectId
): Promise<void> {
  await this.updateMany(
    { userId, isRevoked: false },
    { isRevoked: true }
  );
};

// Interface pour les méthodes statiques
export interface IRefreshTokenModel extends mongoose.Model<IRefreshTokenDocument> {
  generateToken(): string;
  createToken(
    userId: Types.ObjectId,
    expiresInDays?: number,
    metadata?: { userAgent?: string; ipAddress?: string }
  ): Promise<IRefreshTokenDocument>;
  revokeAllForUser(userId: Types.ObjectId): Promise<void>;
}

export const RefreshToken = mongoose.model<IRefreshTokenDocument, IRefreshTokenModel>(
  'RefreshToken',
  refreshTokenSchema
);

export default RefreshToken;
