import mongoose from 'mongoose';
import { User, IUserDocument, UserRole, Permission, DEFAULT_PERMISSIONS } from '../models/User.js';

// ============================================
// Interfaces
// ============================================

export interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  permissions?: Permission[];
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

// ============================================
// Erreurs métier
// ============================================

export class UserNotFoundError extends Error {
  readonly code = 'USER_NOT_FOUND';
  constructor(userId: string) {
    super(`Utilisateur non trouvé : ${userId}`);
    this.name = 'UserNotFoundError';
  }
}

export class UserForbiddenError extends Error {
  readonly code = 'FORBIDDEN';
  constructor(message = 'Action non autorisée') {
    super(message);
    this.name = 'UserForbiddenError';
  }
}

export class UserConflictError extends Error {
  readonly code = 'CONFLICT';
  constructor(message: string) {
    super(message);
    this.name = 'UserConflictError';
  }
}

// ============================================
// Service
// ============================================

/**
 * Service de gestion des utilisateurs
 * Couche métier entre les contrôleurs et le modèle User
 */
export class UserService {
  /**
   * Liste les utilisateurs d'une organisation avec pagination et filtres
   */
  async listUsers(
    organizationId: string,
    filters: UserFilters
  ): Promise<{ users: IUserDocument[]; total: number }> {
    const {
      role,
      isActive = true,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const query: Record<string, unknown> = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      isActive,
    };

    if (role) {
      query.role = role;
    }

    if (search && search.trim().length > 0) {
      const regex = { $regex: search.trim(), $options: 'i' };
      query.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .exec(),
      User.countDocuments(query),
    ]);

    return { users, total };
  }

  /**
   * Récupère un utilisateur par son ID, scoped à l'organisation
   */
  async getUserById(
    organizationId: string,
    userId: string
  ): Promise<IUserDocument> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new UserNotFoundError(userId);
    }

    const user = await User.findOne({
      _id: new mongoose.Types.ObjectId(userId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
    }).exec();

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    return user;
  }

  /**
   * Crée un utilisateur dans l'organisation
   */
  async createUser(
    organizationId: string,
    data: CreateUserData
  ): Promise<IUserDocument> {
    // Vérifier si l'email est déjà utilisé
    const existing = await User.findOne({
      email: data.email.toLowerCase(),
    }).exec();

    if (existing) {
      throw new UserConflictError(
        `Un utilisateur avec l'email "${data.email}" existe déjà`
      );
    }

    const role = data.role ?? UserRole.OPERATOR;
    const permissions =
      data.permissions && data.permissions.length > 0
        ? data.permissions
        : DEFAULT_PERMISSIONS[role];

    const user = await User.create({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      role,
      permissions,
      organizationId: new mongoose.Types.ObjectId(organizationId),
      isActive: true,
    });

    return user;
  }

  /**
   * Met à jour un utilisateur (scoped à l'organisation)
   * Règle : un utilisateur ne peut pas modifier son propre rôle
   */
  async updateUser(
    organizationId: string,
    userId: string,
    data: UpdateUserData,
    requestingUserId: string
  ): Promise<IUserDocument> {
    const user = await this.getUserById(organizationId, userId);

    // Interdire l'auto-modification du rôle
    if (
      data.role !== undefined &&
      user._id.toString() === requestingUserId
    ) {
      throw new UserForbiddenError(
        'Vous ne pouvez pas modifier votre propre rôle'
      );
    }

    // Si le rôle est modifié, recalculer les permissions par défaut
    if (data.role !== undefined && data.role !== user.role) {
      user.role = data.role;
      // Réinitialiser les permissions selon le nouveau rôle
      user.permissions = DEFAULT_PERMISSIONS[data.role] ?? [];
    }

    if (data.firstName !== undefined) user.firstName = data.firstName;
    if (data.lastName !== undefined) user.lastName = data.lastName;
    if (data.email !== undefined) {
      // Vérifier unicité de l'email si changé
      if (data.email.toLowerCase() !== user.email) {
        const conflict = await User.findOne({
          email: data.email.toLowerCase(),
          _id: { $ne: user._id },
        }).exec();
        if (conflict) {
          throw new UserConflictError(
            `Un utilisateur avec l'email "${data.email}" existe déjà`
          );
        }
      }
      user.email = data.email;
    }
    if (data.isActive !== undefined) user.isActive = data.isActive;

    await user.save();

    return user;
  }

  /**
   * Désactive un utilisateur (soft delete : isActive = false)
   * Un utilisateur ne peut pas se désactiver lui-même
   */
  async deactivateUser(
    organizationId: string,
    userId: string,
    requestingUserId: string
  ): Promise<void> {
    const user = await this.getUserById(organizationId, userId);

    if (user._id.toString() === requestingUserId) {
      throw new UserForbiddenError(
        'Vous ne pouvez pas désactiver votre propre compte'
      );
    }

    user.isActive = false;
    await user.save();
  }

  /**
   * Met à jour les permissions d'un utilisateur
   */
  async updatePermissions(
    organizationId: string,
    userId: string,
    permissions: Permission[]
  ): Promise<IUserDocument> {
    const user = await this.getUserById(organizationId, userId);

    user.permissions = permissions;
    await user.save();

    return user;
  }
}

export const userService = new UserService();

export default userService;
