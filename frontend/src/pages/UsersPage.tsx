import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Truck,
  ArrowLeft,
  UserPlus,
  Search,
  Edit3,
  UserX,
  Eye,
  EyeOff,
  X,
  Loader2,
} from 'lucide-react';
import { UserMenu } from '@/components';
import { useAuthStore } from '@/stores';
import { usersService } from '@/services/users';
import type { UserItem, CreateUserPayload, UpdateUserPayload } from '@/services/users';

// ============================================
// Helpers
// ============================================

function formatDateFR(dateStr?: string): string {
  if (!dateStr) return 'Jamais';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ============================================
// Badges
// ============================================

interface RoleBadgeProps {
  role: string;
}

function RoleBadge({ role }: RoleBadgeProps) {
  const config: Record<string, { label: string; className: string }> = {
    super_admin: {
      label: 'Super Admin',
      className: 'bg-purple-100 text-purple-700',
    },
    admin: {
      label: 'Administrateur',
      className: 'bg-blue-100 text-blue-700',
    },
    manager: {
      label: 'Manager',
      className: 'bg-green-100 text-green-700',
    },
    operator: {
      label: 'Opérateur',
      className: 'bg-gray-100 text-gray-700',
    },
  };

  const { label, className } = config[role] ?? {
    label: role,
    className: 'bg-gray-100 text-gray-700',
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

interface StatusBadgeProps {
  isActive: boolean;
}

function StatusBadge({ isActive }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {isActive ? 'Actif' : 'Inactif'}
    </span>
  );
}

// ============================================
// Skeleton row
// ============================================

function SkeletonRow() {
  return (
    <tr>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full animate-pulse bg-gray-100" />
          <div className="space-y-1">
            <div className="w-32 h-4 animate-pulse bg-gray-100 rounded" />
            <div className="w-44 h-3 animate-pulse bg-gray-100 rounded" />
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="w-20 h-5 animate-pulse bg-gray-100 rounded" />
      </td>
      <td className="px-4 py-4">
        <div className="w-14 h-5 animate-pulse bg-gray-100 rounded" />
      </td>
      <td className="px-4 py-4">
        <div className="w-28 h-4 animate-pulse bg-gray-100 rounded" />
      </td>
      <td className="px-4 py-4">
        <div className="flex gap-2">
          <div className="w-7 h-7 animate-pulse bg-gray-100 rounded" />
          <div className="w-7 h-7 animate-pulse bg-gray-100 rounded" />
        </div>
      </td>
    </tr>
  );
}

// ============================================
// Modal Création
// ============================================

interface CreateModalProps {
  onClose: () => void;
  onCreated: (user: UserItem) => void;
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [formData, setFormData] = useState<CreateUserPayload>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'operator',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof CreateUserPayload, string>>>({});

  function validate(): boolean {
    const errors: Partial<Record<keyof CreateUserPayload, string>> = {};
    if (!formData.firstName.trim()) errors.firstName = 'Le prénom est requis';
    if (!formData.lastName.trim()) errors.lastName = 'Le nom est requis';
    if (!formData.email.trim()) {
      errors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "L'email n'est pas valide";
    }
    if (!formData.password) {
      errors.password = 'Le mot de passe est requis';
    } else if (formData.password.length < 8) {
      errors.password = 'Le mot de passe doit contenir au moins 8 caractères';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setCreateError(null);
    try {
      const newUser = await usersService.createUser(formData);
      onCreated(newUser);
      onClose();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        {/* Titre */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Inviter un utilisateur</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {createError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {createError}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Prénom */}
          <div>
            <label htmlFor="create-firstName" className="block text-sm font-medium text-gray-700 mb-1">
              Prénom <span className="text-red-500">*</span>
            </label>
            <input
              id="create-firstName"
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Jean"
            />
            {validationErrors.firstName && (
              <p className="mt-1 text-xs text-red-600">{validationErrors.firstName}</p>
            )}
          </div>

          {/* Nom */}
          <div>
            <label htmlFor="create-lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              id="create-lastName"
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Dupont"
            />
            {validationErrors.lastName && (
              <p className="mt-1 text-xs text-red-600">{validationErrors.lastName}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="create-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="create-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="jean.dupont@entreprise.fr"
            />
            {validationErrors.email && (
              <p className="mt-1 text-xs text-red-600">{validationErrors.email}</p>
            )}
          </div>

          {/* Mot de passe */}
          <div>
            <label htmlFor="create-password" className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="create-password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Minimum 8 caractères"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {validationErrors.password && (
              <p className="mt-1 text-xs text-red-600">{validationErrors.password}</p>
            )}
          </div>

          {/* Rôle */}
          <div>
            <label htmlFor="create-role" className="block text-sm font-medium text-gray-700 mb-1">
              Rôle
            </label>
            <select
              id="create-role"
              value={formData.role}
              onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="operator">Opérateur</option>
              <option value="manager">Manager</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Créer l'utilisateur
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// Modal Édition
// ============================================

interface EditModalProps {
  user: UserItem;
  onClose: () => void;
  onUpdated: (user: UserItem) => void;
}

function EditModal({ user, onClose, onUpdated }: EditModalProps) {
  const [editForm, setEditForm] = useState<UpdateUserPayload>({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setEditError(null);
    try {
      const updated = await usersService.updateUser(user._id, editForm);
      onUpdated(updated);
      onClose();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        {/* Titre */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Modifier l'utilisateur</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {editError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {editError}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-4">
          {/* Prénom */}
          <div>
            <label htmlFor="edit-firstName" className="block text-sm font-medium text-gray-700 mb-1">
              Prénom
            </label>
            <input
              id="edit-firstName"
              type="text"
              value={editForm.firstName ?? ''}
              onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Nom */}
          <div>
            <label htmlFor="edit-lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Nom
            </label>
            <input
              id="edit-lastName"
              type="text"
              value={editForm.lastName ?? ''}
              onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="edit-email"
              type="email"
              value={editForm.email ?? ''}
              onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Rôle */}
          <div>
            <label htmlFor="edit-role" className="block text-sm font-medium text-gray-700 mb-1">
              Rôle
            </label>
            <select
              id="edit-role"
              value={editForm.role ?? 'operator'}
              onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="operator">Opérateur</option>
              <option value="manager">Manager</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>

          {/* Compte actif */}
          <div className="flex items-center gap-3">
            <input
              id="edit-isActive"
              type="checkbox"
              checked={editForm.isActive ?? true}
              onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="edit-isActive" className="text-sm font-medium text-gray-700">
              Compte actif
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// Dialog Confirmation désactivation
// ============================================

interface DeactivateDialogProps {
  user: UserItem;
  onClose: () => void;
  onDeactivated: (userId: string) => void;
}

function DeactivateDialog({ user, onClose, onDeactivated }: DeactivateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  async function handleDeactivate() {
    setIsSubmitting(true);
    setDeactivateError(null);
    try {
      await usersService.deactivateUser(user._id);
      onDeactivated(user._id);
      onClose();
    } catch (err) {
      setDeactivateError(err instanceof Error ? err.message : 'Erreur lors de la désactivation');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Désactiver {user.firstName} {user.lastName} ?
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          Cet utilisateur ne pourra plus se connecter. Cette action est réversible.
        </p>

        {deactivateError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {deactivateError}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleDeactivate}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Désactiver
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// UsersPage
// ============================================

export function UsersPage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  // États de liste
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<UserItem | null>(null);

  // Protection d'accès
  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  // Chargement des utilisateurs
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      void fetchUsers();
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterRole, page]);

  async function fetchUsers() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await usersService.listUsers({
        search: search || undefined,
        role: filterRole || undefined,
        page,
      });
      setUsers(result.users);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des utilisateurs');
    } finally {
      setIsLoading(false);
    }
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Callbacks modals
  function handleUserCreated(newUser: UserItem) {
    setUsers((prev) => [newUser, ...prev]);
    setTotal((prev) => prev + 1);
  }

  function handleUserUpdated(updatedUser: UserItem) {
    setUsers((prev) => prev.map((u) => (u._id === updatedUser._id ? updatedUser : u)));
  }

  function handleUserDeactivated(userId: string) {
    setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, isActive: false } : u)));
  }

  // Accès refusé si pas admin
  if (isAuthenticated && !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <p className="text-lg font-semibold text-gray-900 mb-2">Accès refusé</p>
          <p className="text-sm text-gray-500">
            Cette page est réservée aux administrateurs.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 mt-4 text-sm text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Header ── */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Truck className="w-8 h-8 text-primary-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">SaaS BTP</h1>
                <p className="text-sm text-gray-500">Gestion des utilisateurs</p>
              </div>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Bouton retour */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Tableau de bord
        </Link>

        {/* ── Barre d'actions ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Membres de l'organisation</h2>
            <p className="text-sm text-gray-500">
              {total} utilisateur{total > 1 ? 's' : ''}
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <UserPlus className="w-4 h-4" />
              Inviter un utilisateur
            </button>
          )}
        </div>

        {/* ── Filtres ── */}
        <div className="flex gap-4 mb-4">
          {/* Recherche */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher par nom ou email..."
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filtre rôle */}
          <select
            value={filterRole}
            onChange={(e) => {
              setFilterRole(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Tous les rôles</option>
            <option value="admin">Administrateur (admin)</option>
            <option value="manager">Manager (manager)</option>
            <option value="operator">Opérateur (operator)</option>
          </select>
        </div>

        {/* ── Tableau ── */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {error ? (
            <div className="px-6 py-8 text-center">
              <p className="text-red-600 text-sm">{error}</p>
              <button
                onClick={() => void fetchUsers()}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700"
              >
                Réessayer
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Utilisateur
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rôle
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dernière connexion
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isLoading ? (
                    <>
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                        Aucun utilisateur trouvé
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isSelf = u._id === user?._id || u.id === user?.id;
                      const canEdit = isAdmin && !isSelf;
                      const canDeactivate = isAdmin && !isSelf && u.isActive;

                      return (
                        <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                          {/* Utilisateur */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                {getInitials(u.firstName, u.lastName)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {u.firstName} {u.lastName}
                                  {isSelf && (
                                    <span className="ml-2 text-xs text-gray-400">(vous)</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500">{u.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Rôle */}
                          <td className="px-4 py-4">
                            <RoleBadge role={u.role} />
                          </td>

                          {/* Statut */}
                          <td className="px-4 py-4">
                            <StatusBadge isActive={u.isActive} />
                          </td>

                          {/* Dernière connexion */}
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {formatDateFR(u.lastLoginAt)}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              {canEdit && (
                                <button
                                  onClick={() => setEditingUser(u)}
                                  title="Modifier"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              )}
                              {canDeactivate && (
                                <button
                                  onClick={() => setDeactivatingUser(u)}
                                  title="Désactiver"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <UserX className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            <span className="text-sm text-gray-500">
              Page {page} sur {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </div>
        )}
      </main>

      {/* ── Modals ── */}
      {showCreateModal && (
        <CreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleUserCreated}
        />
      )}

      {editingUser !== null && (
        <EditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdated={handleUserUpdated}
        />
      )}

      {deactivatingUser !== null && (
        <DeactivateDialog
          user={deactivatingUser}
          onClose={() => setDeactivatingUser(null)}
          onDeactivated={handleUserDeactivated}
        />
      )}
    </div>
  );
}

export default UsersPage;
