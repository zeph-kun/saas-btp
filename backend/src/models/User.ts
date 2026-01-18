import mongoose, { Schema, Document, Types } from 'mongoose';
import bcrypt from 'bcrypt';

/**
 * Rôles disponibles dans le système
 * - super_admin: Accès total à la plateforme (multi-organisations)
 * - admin: Administrateur d'une organisation
 * - manager: Gestionnaire de flotte
 * - operator: Opérateur terrain (lecture seule + mises à jour position)
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  OPERATOR = 'operator',
}

/**
 * Permissions granulaires
 */
export enum Permission {
  // Véhicules
  VEHICLES_READ = 'vehicles:read',
  VEHICLES_CREATE = 'vehicles:create',
  VEHICLES_UPDATE = 'vehicles:update',
  VEHICLES_DELETE = 'vehicles:delete',
  VEHICLES_LOCATION = 'vehicles:location',
  
  // Geofences
  GEOFENCES_READ = 'geofences:read',
  GEOFENCES_CREATE = 'geofences:create',
  GEOFENCES_UPDATE = 'geofences:update',
  GEOFENCES_DELETE = 'geofences:delete',
  
  // Alertes
  ALERTS_READ = 'alerts:read',
  ALERTS_ACKNOWLEDGE = 'alerts:acknowledge',
  ALERTS_RESOLVE = 'alerts:resolve',
  
  // Clients
  CLIENTS_READ = 'clients:read',
  CLIENTS_CREATE = 'clients:create',
  CLIENTS_UPDATE = 'clients:update',
  CLIENTS_DELETE = 'clients:delete',
  
  // Contrats
  CONTRACTS_READ = 'contracts:read',
  CONTRACTS_CREATE = 'contracts:create',
  CONTRACTS_UPDATE = 'contracts:update',
  CONTRACTS_DELETE = 'contracts:delete',
  
  // Utilisateurs
  USERS_READ = 'users:read',
  USERS_CREATE = 'users:create',
  USERS_UPDATE = 'users:update',
  USERS_DELETE = 'users:delete',
  
  // Organisation
  ORGANIZATION_SETTINGS = 'organization:settings',
}

/**
 * Permissions par défaut selon le rôle
 */
export const DEFAULT_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  [UserRole.ADMIN]: Object.values(Permission),
  [UserRole.MANAGER]: [
    Permission.VEHICLES_READ,
    Permission.VEHICLES_CREATE,
    Permission.VEHICLES_UPDATE,
    Permission.VEHICLES_LOCATION,
    Permission.GEOFENCES_READ,
    Permission.GEOFENCES_CREATE,
    Permission.GEOFENCES_UPDATE,
    Permission.ALERTS_READ,
    Permission.ALERTS_ACKNOWLEDGE,
    Permission.ALERTS_RESOLVE,
    Permission.CLIENTS_READ,
    Permission.CLIENTS_CREATE,
    Permission.CLIENTS_UPDATE,
    Permission.CONTRACTS_READ,
    Permission.CONTRACTS_CREATE,
    Permission.CONTRACTS_UPDATE,
    Permission.USERS_READ,
  ],
  [UserRole.OPERATOR]: [
    Permission.VEHICLES_READ,
    Permission.VEHICLES_LOCATION,
    Permission.GEOFENCES_READ,
    Permission.ALERTS_READ,
    Permission.ALERTS_ACKNOWLEDGE,
    Permission.CLIENTS_READ,
    Permission.CONTRACTS_READ,
  ],
};

/**
 * Interface pour le document Mongoose User
 */
export interface IUserDocument extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: Permission[];
  organizationId: Types.ObjectId;
  isActive: boolean;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Méthodes d'instance
  comparePassword(candidatePassword: string): Promise<boolean>;
  hasPermission(permission: Permission): boolean;
  hasAnyPermission(permissions: Permission[]): boolean;
  hasAllPermissions(permissions: Permission[]): boolean;
  fullName: string;
}

/**
 * Schéma Mongoose pour les utilisateurs
 */
const userSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: [true, 'L\'email est requis'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Email invalide'],
    },
    password: {
      type: String,
      required: [true, 'Le mot de passe est requis'],
      minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères'],
      select: false, // Ne pas inclure par défaut dans les requêtes
    },
    firstName: {
      type: String,
      required: [true, 'Le prénom est requis'],
      trim: true,
      maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères'],
    },
    lastName: {
      type: String,
      required: [true, 'Le nom est requis'],
      trim: true,
      maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères'],
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.OPERATOR,
    },
    permissions: {
      type: [String],
      enum: Object.values(Permission),
      default: function(this: IUserDocument) {
        return DEFAULT_PERMISSIONS[this.role] || DEFAULT_PERMISSIONS[UserRole.OPERATOR];
      },
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'L\'organisation est requise'],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
    passwordChangedAt: {
      type: Date,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret.password;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index composites
userSchema.index({ organizationId: 1, email: 1 });
userSchema.index({ organizationId: 1, role: 1 });

// Virtual pour le nom complet
userSchema.virtual('fullName').get(function(this: IUserDocument) {
  return `${this.firstName} ${this.lastName}`;
});

/**
 * Middleware pre-save pour hasher le mot de passe
 */
userSchema.pre('save', async function(next) {
  // Ne hasher que si le mot de passe a été modifié
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Générer le salt et hasher le mot de passe
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    
    // Mettre à jour la date de changement de mot de passe
    if (!this.isNew) {
      this.passwordChangedAt = new Date();
    }
    
    next();
  } catch (error) {
    next(error as Error);
  }
});

/**
 * Middleware pre-save pour définir les permissions par défaut selon le rôle
 */
userSchema.pre('save', function(next) {
  if (this.isModified('role') && !this.isModified('permissions')) {
    this.permissions = DEFAULT_PERMISSIONS[this.role] || [];
  }
  next();
});

/**
 * Méthode pour comparer les mots de passe
 */
userSchema.methods.comparePassword = async function(
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Vérifie si l'utilisateur a une permission spécifique
 */
userSchema.methods.hasPermission = function(permission: Permission): boolean {
  return this.permissions.includes(permission);
};

/**
 * Vérifie si l'utilisateur a au moins une des permissions
 */
userSchema.methods.hasAnyPermission = function(permissions: Permission[]): boolean {
  return permissions.some(p => this.permissions.includes(p));
};

/**
 * Vérifie si l'utilisateur a toutes les permissions
 */
userSchema.methods.hasAllPermissions = function(permissions: Permission[]): boolean {
  return permissions.every(p => this.permissions.includes(p));
};

export const User = mongoose.model<IUserDocument>('User', userSchema);

export default User;
