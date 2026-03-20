import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Truck,
  ArrowLeft,
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import { UserMenu } from '@/components';
import { useAuthStore } from '@/stores';
import { Permission } from '@/types';
import { clientsService } from '@/services/clients';
import type { ClientItem, CreateClientPayload, UpdateClientPayload } from '@/services/clients';

// ============================================
// Helpers
// ============================================

function formatDateFR(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ============================================
// Skeleton
// ============================================

function SkeletonRow() {
  return (
    <tr>
      <td className="px-4 py-4">
        <div className="space-y-1">
          <div className="w-40 h-4 animate-pulse bg-gray-100 rounded" />
          <div className="w-28 h-3 animate-pulse bg-gray-100 rounded" />
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="space-y-1">
          <div className="w-32 h-4 animate-pulse bg-gray-100 rounded" />
          <div className="w-40 h-3 animate-pulse bg-gray-100 rounded" />
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="w-28 h-4 animate-pulse bg-gray-100 rounded" />
      </td>
      <td className="px-4 py-4">
        <div className="w-20 h-4 animate-pulse bg-gray-100 rounded" />
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
// Formulaire partagé (création / édition)
// ============================================

interface ClientFormData {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  siret: string;
}

function emptyForm(): ClientFormData {
  return {
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    address: { street: '', city: '', postalCode: '', country: 'France' },
    siret: '',
  };
}

function fromClient(c: ClientItem): ClientFormData {
  return {
    companyName: c.companyName,
    contactName: c.contactName,
    email: c.email,
    phone: c.phone,
    address: { ...c.address },
    siret: c.siret ?? '',
  };
}

type ValidationErrors = Partial<Record<string, string>>;

function validateForm(form: ClientFormData): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!form.companyName.trim()) errors.companyName = 'Le nom de l\'entreprise est requis';
  if (!form.contactName.trim()) errors.contactName = 'Le nom du contact est requis';
  if (!form.email.trim()) {
    errors.email = 'L\'email est requis';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'L\'email n\'est pas valide';
  }
  if (!form.phone.trim()) errors.phone = 'Le téléphone est requis';
  if (!form.address.street.trim()) errors['address.street'] = 'L\'adresse est requise';
  if (!form.address.city.trim()) errors['address.city'] = 'La ville est requise';
  if (!form.address.postalCode.trim()) errors['address.postalCode'] = 'Le code postal est requis';
  if (!form.address.country.trim()) errors['address.country'] = 'Le pays est requis';
  return errors;
}

interface ClientFormFieldsProps {
  form: ClientFormData;
  errors: ValidationErrors;
  onChange: (form: ClientFormData) => void;
}

function ClientFormFields({ form, errors, onChange }: ClientFormFieldsProps) {
  function set(key: keyof Omit<ClientFormData, 'address'>, value: string) {
    onChange({ ...form, [key]: value });
  }
  function setAddr(key: keyof ClientFormData['address'], value: string) {
    onChange({ ...form, address: { ...form.address, [key]: value } });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Entreprise <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.companyName}
            onChange={(e) => set('companyName', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Acme Construction"
          />
          {errors.companyName && <p className="mt-1 text-xs text-red-600">{errors.companyName}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contact <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.contactName}
            onChange={(e) => set('contactName', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Jean Dupont"
          />
          {errors.contactName && <p className="mt-1 text-xs text-red-600">{errors.contactName}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="contact@acme.fr"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Téléphone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="06 12 34 56 78"
          />
          {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Rue <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.address.street}
          onChange={(e) => setAddr('street', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="12 rue des Lilas"
        />
        {errors['address.street'] && <p className="mt-1 text-xs text-red-600">{errors['address.street']}</p>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Code postal <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.address.postalCode}
            onChange={(e) => setAddr('postalCode', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="75000"
          />
          {errors['address.postalCode'] && <p className="mt-1 text-xs text-red-600">{errors['address.postalCode']}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ville <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.address.city}
            onChange={(e) => setAddr('city', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Paris"
          />
          {errors['address.city'] && <p className="mt-1 text-xs text-red-600">{errors['address.city']}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pays <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.address.country}
            onChange={(e) => setAddr('country', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {errors['address.country'] && <p className="mt-1 text-xs text-red-600">{errors['address.country']}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          SIRET / N° d'entreprise
        </label>
        <input
          type="text"
          value={form.siret}
          onChange={(e) => set('siret', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="123 456 789 00012"
        />
      </div>
    </div>
  );
}

// ============================================
// Modal Création
// ============================================

interface CreateModalProps {
  onClose: () => void;
  onCreated: (client: ClientItem) => void;
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [form, setForm] = useState<ClientFormData>(emptyForm());
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setIsSubmitting(true);
    setApiError(null);
    try {
      const payload: CreateClientPayload = {
        companyName: form.companyName,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        address: form.address,
        ...(form.siret.trim() ? { siret: form.siret.trim() } : {}),
      };
      const created = await clientsService.createClient(payload);
      onCreated(created);
      onClose();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Nouveau client</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        {apiError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {apiError}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <ClientFormFields form={form} errors={errors} onChange={setForm} />
          <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Créer le client
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
  client: ClientItem;
  onClose: () => void;
  onUpdated: (client: ClientItem) => void;
}

function EditModal({ client, onClose, onUpdated }: EditModalProps) {
  const [form, setForm] = useState<ClientFormData>(fromClient(client));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setIsSubmitting(true);
    setApiError(null);
    try {
      const payload: UpdateClientPayload = {
        companyName: form.companyName,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        address: form.address,
        ...(form.siret.trim() ? { siret: form.siret.trim() } : {}),
      };
      const updated = await clientsService.updateClient(client._id, payload);
      onUpdated(updated);
      onClose();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Modifier le client</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        {apiError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {apiError}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <ClientFormFields form={form} errors={errors} onChange={setForm} />
          <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
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
// Dialog Suppression
// ============================================

interface DeleteDialogProps {
  client: ClientItem;
  onClose: () => void;
  onDeleted: (clientId: string) => void;
}

function DeleteDialog({ client, onClose, onDeleted }: DeleteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleDelete() {
    setIsSubmitting(true);
    setApiError(null);
    try {
      await clientsService.deleteClient(client._id);
      onDeleted(client._id);
      onClose();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Supprimer {client.companyName} ?
        </h2>
        <p className="text-sm text-gray-500 mb-1">
          Cette action est irréversible.
        </p>
        <p className="text-sm text-gray-500 mb-5">
          Si ce client possède des contrats actifs, la suppression sera refusée.
        </p>
        {apiError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {apiError}
          </div>
        )}
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button
            onClick={() => void handleDelete()}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ClientsPage
// ============================================

export function ClientsPage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientItem | null>(null);
  const [deletingClient, setDeletingClient] = useState<ClientItem | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void fetchClients(); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  async function fetchClients() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await clientsService.listClients({ search: search || undefined, page });
      setClients(result.clients);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  }

  const canCreate = user?.permissions.includes(Permission.CLIENTS_CREATE) ?? false;
  const canUpdate = user?.permissions.includes(Permission.CLIENTS_UPDATE) ?? false;
  const canDelete = user?.permissions.includes(Permission.CLIENTS_DELETE) ?? false;

  function handleClientCreated(client: ClientItem) {
    setClients((prev) => [client, ...prev]);
    setTotal((prev) => prev + 1);
  }

  function handleClientUpdated(updated: ClientItem) {
    setClients((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
  }

  function handleClientDeleted(clientId: string) {
    setClients((prev) => prev.filter((c) => c._id !== clientId));
    setTotal((prev) => prev - 1);
  }

  // Suppress unused variable warning — formatDateFR is available for future use
  void formatDateFR;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Truck className="w-8 h-8 text-primary-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">SaaS BTP</h1>
                <p className="text-sm text-gray-500">Gestion des clients</p>
              </div>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Tableau de bord
        </Link>

        {/* Barre d'actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Clients</h2>
            <p className="text-sm text-gray-500">{total} client{total > 1 ? 's' : ''}</p>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Nouveau client
            </button>
          )}
        </div>

        {/* Filtres */}
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Rechercher par entreprise ou contact..."
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {error ? (
            <div className="px-6 py-8 text-center">
              <p className="text-red-600 text-sm">{error}</p>
              <button onClick={() => void fetchClients()} className="mt-3 text-sm text-blue-600 hover:text-blue-700">
                Réessayer
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entreprise</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Téléphone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ville</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isLoading ? (
                    <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
                  ) : clients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                        Aucun client trouvé
                      </td>
                    </tr>
                  ) : (
                    clients.map((c) => (
                      <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-gray-900">{c.companyName}</p>
                          {c.siret && <p className="text-xs text-gray-500">{c.siret}</p>}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-gray-900">{c.contactName}</p>
                          <p className="text-xs text-gray-500">{c.email}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">{c.phone}</td>
                        <td className="px-4 py-4 text-sm text-gray-500">{c.address.city}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {canUpdate && (
                              <button
                                onClick={() => setEditingClient(c)}
                                title="Modifier"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => setDeletingClient(c)}
                                title="Supprimer"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            <span className="text-sm text-gray-500">Page {page} sur {totalPages}</span>
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

      {/* Modals */}
      {showCreateModal && (
        <CreateModal onClose={() => setShowCreateModal(false)} onCreated={handleClientCreated} />
      )}
      {editingClient !== null && (
        <EditModal client={editingClient} onClose={() => setEditingClient(null)} onUpdated={handleClientUpdated} />
      )}
      {deletingClient !== null && (
        <DeleteDialog client={deletingClient} onClose={() => setDeletingClient(null)} onDeleted={handleClientDeleted} />
      )}
    </div>
  );
}

export default ClientsPage;
