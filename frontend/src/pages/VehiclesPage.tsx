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
  RefreshCw,
} from 'lucide-react';
import { UserMenu } from '@/components';
import { useAuthStore } from '@/stores';
import { VehicleType, VehicleStatus, Permission } from '@/types';
import { vehiclesService } from '@/services/vehicles';
import type { VehicleItem, CreateVehiclePayload, VehicleStats } from '@/services/vehicles';

// ============================================
// Constantes
// ============================================

const TYPE_LABELS: Record<VehicleType, string> = {
  [VehicleType.MINI_PELLE]: 'Mini-pelle',
  [VehicleType.CHARGEUSE]: 'Chargeuse',
  [VehicleType.TRACTOPELLE]: 'Tractopelle',
  [VehicleType.NACELLE]: 'Nacelle',
  [VehicleType.COMPACTEUR]: 'Compacteur',
  [VehicleType.GROUPE_ELECTROGENE]: 'Groupe électrogène',
  [VehicleType.REMORQUE]: 'Remorque',
  [VehicleType.AUTRE]: 'Autre',
};

const STATUS_LABELS: Record<VehicleStatus, string> = {
  [VehicleStatus.DISPONIBLE]: 'Disponible',
  [VehicleStatus.EN_LOCATION]: 'En location',
  [VehicleStatus.EN_MAINTENANCE]: 'En maintenance',
  [VehicleStatus.HORS_SERVICE]: 'Hors service',
  [VehicleStatus.VOLE]: 'Volé',
};

// ============================================
// Badges
// ============================================

function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  const config: Record<VehicleStatus, string> = {
    [VehicleStatus.DISPONIBLE]: 'bg-green-100 text-green-700',
    [VehicleStatus.EN_LOCATION]: 'bg-blue-100 text-blue-700',
    [VehicleStatus.EN_MAINTENANCE]: 'bg-orange-100 text-orange-700',
    [VehicleStatus.HORS_SERVICE]: 'bg-red-100 text-red-700',
    [VehicleStatus.VOLE]: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ============================================
// Stats Cards
// ============================================

interface StatsCardsProps {
  stats: VehicleStats | null;
  isLoading: boolean;
}

function StatsCards({ stats, isLoading }: StatsCardsProps) {
  const cards = [
    { label: 'Total engins', value: stats?.total ?? 0, color: 'bg-gray-50 border-gray-200', textColor: 'text-gray-900' },
    { label: 'Disponibles', value: stats?.byStatus[VehicleStatus.DISPONIBLE] ?? 0, color: 'bg-green-50 border-green-200', textColor: 'text-green-700' },
    { label: 'En location', value: stats?.byStatus[VehicleStatus.EN_LOCATION] ?? 0, color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700' },
    { label: 'En maintenance', value: stats?.byStatus[VehicleStatus.EN_MAINTENANCE] ?? 0, color: 'bg-orange-50 border-orange-200', textColor: 'text-orange-700' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className={`${card.color} border rounded-xl p-4`}>
          {isLoading ? (
            <div className="w-12 h-8 animate-pulse bg-gray-200 rounded mb-1" />
          ) : (
            <p className={`text-2xl font-bold ${card.textColor}`}>{card.value}</p>
          )}
          <p className="text-sm text-gray-500">{card.label}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Skeleton
// ============================================

function SkeletonRow() {
  return (
    <tr>
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 animate-pulse bg-gray-100 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

// ============================================
// Formulaire partagé
// ============================================

interface VehicleFormData {
  name: string;
  internalCode: string;
  registrationNumber: string;
  type: VehicleType;
  brand: string;
  model: string;
  year: number;
  serialNumber: string;
  trackerId: string;
  notes: string;
}

function emptyForm(): VehicleFormData {
  return {
    name: '',
    internalCode: '',
    registrationNumber: '',
    type: VehicleType.AUTRE,
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    serialNumber: '',
    trackerId: '',
    notes: '',
  };
}

function fromVehicle(v: VehicleItem): VehicleFormData {
  return {
    name: v.name,
    internalCode: v.internalCode,
    registrationNumber: v.registrationNumber,
    type: v.type,
    brand: v.brand,
    model: v.model,
    year: v.year,
    serialNumber: v.serialNumber ?? '',
    trackerId: v.trackerId ?? '',
    notes: v.notes ?? '',
  };
}

type VehicleValidationErrors = Partial<Record<keyof VehicleFormData, string>>;

function validateVehicleForm(form: VehicleFormData): VehicleValidationErrors {
  const errors: VehicleValidationErrors = {};
  if (!form.name.trim()) errors.name = 'Le nom est requis';
  if (!form.internalCode.trim()) errors.internalCode = 'Le code interne est requis';
  if (!form.registrationNumber.trim()) errors.registrationNumber = "L'immatriculation est requise";
  if (!form.brand.trim()) errors.brand = 'La marque est requise';
  if (!form.model.trim()) errors.model = 'Le modèle est requis';
  if (!form.year || form.year < 1990 || form.year > 2030) errors.year = 'Année invalide (1990–2030)';
  return errors;
}

interface VehicleFormFieldsProps {
  form: VehicleFormData;
  errors: VehicleValidationErrors;
  onChange: (form: VehicleFormData) => void;
  readOnlyRegistration?: boolean;
}

function VehicleFormFields({ form, errors, onChange, readOnlyRegistration = false }: VehicleFormFieldsProps) {
  function set<K extends keyof VehicleFormData>(key: K, value: VehicleFormData[K]) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom <span className="text-red-500">*</span></label>
          <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Mini-pelle Chantier A" />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Code interne <span className="text-red-500">*</span></label>
          <input type="text" value={form.internalCode} onChange={(e) => set('internalCode', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="ENG-001" />
          {errors.internalCode && <p className="mt-1 text-xs text-red-600">{errors.internalCode}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Immatriculation <span className="text-red-500">*</span></label>
          <input type="text" value={form.registrationNumber}
            onChange={(e) => !readOnlyRegistration && set('registrationNumber', e.target.value)}
            readOnly={readOnlyRegistration}
            className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${readOnlyRegistration ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
            placeholder="AA-123-BB" />
          {errors.registrationNumber && <p className="mt-1 text-xs text-red-600">{errors.registrationNumber}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
          <select value={form.type} onChange={(e) => set('type', e.target.value as VehicleType)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            {Object.values(VehicleType).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Marque <span className="text-red-500">*</span></label>
          <input type="text" value={form.brand} onChange={(e) => set('brand', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Caterpillar" />
          {errors.brand && <p className="mt-1 text-xs text-red-600">{errors.brand}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Modèle <span className="text-red-500">*</span></label>
          <input type="text" value={form.model} onChange={(e) => set('model', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="308 CR" />
          {errors.model && <p className="mt-1 text-xs text-red-600">{errors.model}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Année <span className="text-red-500">*</span></label>
          <input type="number" value={form.year} onChange={(e) => set('year', parseInt(e.target.value, 10))}
            min={1990} max={2030}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          {errors.year && <p className="mt-1 text-xs text-red-600">{errors.year}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">N° de série</label>
          <input type="text" value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Optionnel" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ID Tracker GPS</label>
          <input type="text" value={form.trackerId} onChange={(e) => set('trackerId', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Optionnel" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="Informations complémentaires..." />
      </div>
    </div>
  );
}

// ============================================
// CreateModal
// ============================================

interface CreateModalProps {
  onClose: () => void;
  onCreated: (vehicle: VehicleItem) => void;
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [form, setForm] = useState<VehicleFormData>(emptyForm());
  const [errors, setErrors] = useState<VehicleValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateVehicleForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setIsSubmitting(true);
    setApiError(null);
    try {
      const payload: CreateVehiclePayload = {
        name: form.name,
        internalCode: form.internalCode,
        registrationNumber: form.registrationNumber,
        type: form.type,
        brand: form.brand,
        model: form.model,
        year: form.year,
        ...(form.serialNumber.trim() ? { serialNumber: form.serialNumber.trim() } : {}),
        ...(form.trackerId.trim() ? { trackerId: form.trackerId.trim() } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      };
      const created = await vehiclesService.createVehicle(payload);
      console.log('Created vehicle:', created);
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
          <h2 className="text-lg font-semibold text-gray-900">Ajouter un engin</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        {apiError && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{apiError}</div>}
        <form onSubmit={handleSubmit}>
          <VehicleFormFields form={form} errors={errors} onChange={setForm} />
          <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Ajouter l'engin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// EditModal
// ============================================

interface EditModalProps {
  vehicle: VehicleItem;
  onClose: () => void;
  onUpdated: (vehicle: VehicleItem) => void;
}

function EditModal({ vehicle, onClose, onUpdated }: EditModalProps) {
  const [form, setForm] = useState<VehicleFormData>(fromVehicle(vehicle));
  const [errors, setErrors] = useState<VehicleValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateVehicleForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setIsSubmitting(true);
    setApiError(null);
    try {
      const payload: CreateVehiclePayload = {
        name: form.name,
        internalCode: form.internalCode,
        registrationNumber: form.registrationNumber,
        type: form.type,
        brand: form.brand,
        model: form.model,
        year: form.year,
        ...(form.serialNumber.trim() ? { serialNumber: form.serialNumber.trim() } : {}),
        ...(form.trackerId.trim() ? { trackerId: form.trackerId.trim() } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      };
      const updated = await vehiclesService.updateVehicle(vehicle._id, payload);
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
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Modifier l'engin</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-5 font-mono">{vehicle.registrationNumber}</p>
        {apiError && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{apiError}</div>}
        <form onSubmit={handleSubmit}>
          <VehicleFormFields form={form} errors={errors} onChange={setForm} readOnlyRegistration />
          <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
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
// StatusModal
// ============================================

interface StatusModalProps {
  vehicle: VehicleItem;
  onClose: () => void;
  onUpdated: (vehicle: VehicleItem) => void;
}

function StatusModal({ vehicle, onClose, onUpdated }: StatusModalProps) {
  const [status, setStatus] = useState<VehicleStatus>(vehicle.status);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setApiError(null);
    try {
      const updated = await vehiclesService.updateStatus(vehicle._id, status);
      onUpdated(updated);
      onClose();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Erreur lors du changement de statut');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Changer le statut</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">{vehicle.name}</p>
        {apiError && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{apiError}</div>}
        <form onSubmit={handleSubmit}>
          <select value={status} onChange={(e) => setStatus(e.target.value as VehicleStatus)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4">
            {Object.values(VehicleStatus).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Mettre à jour
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// DeleteDialog
// ============================================

interface DeleteDialogProps {
  vehicle: VehicleItem;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DeleteDialog({ vehicle, onClose, onDeleted }: DeleteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleDelete() {
    setIsSubmitting(true);
    setApiError(null);
    try {
      await vehiclesService.deleteVehicle(vehicle._id);
      onDeleted(vehicle._id);
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
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Supprimer {vehicle.name} ?</h2>
        <p className="text-sm text-gray-500 mb-5">Cette action est irréversible. L'engin sera supprimé définitivement.</p>
        {apiError && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{apiError}</div>}
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={() => void handleDelete()} disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// FuelBar
// ============================================

function FuelBar({ level }: { level?: number }) {
  if (level === undefined) return <span className="text-xs text-gray-400">—</span>;
  const color = level >= 50 ? 'bg-green-500' : level >= 20 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-2 ${color} rounded-full`} style={{ width: `${level}%` }} />
      </div>
      <span className="text-xs text-gray-500">{level}%</span>
    </div>
  );
}

// ============================================
// VehiclesPage
// ============================================

export function VehiclesPage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [stats, setStats] = useState<VehicleStats | null>(null);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<VehicleStatus | ''>('');
  const [filterType, setFilterType] = useState<VehicleType | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleItem | null>(null);
  const [statusVehicle, setStatusVehicle] = useState<VehicleItem | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<VehicleItem | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    void fetchStats();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void fetchVehicles(); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterStatus, filterType, page]);

  async function fetchStats() {
    setIsStatsLoading(true);
    try {
      const s = await vehiclesService.getStats();
      setStats(s);
    } catch {
      // stats non bloquantes
    } finally {
      setIsStatsLoading(false);
    }
  }

  async function fetchVehicles() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await vehiclesService.listVehicles({
        search: search || undefined,
        status: filterStatus || undefined,
        type: filterType || undefined,
        page,
      });
      setVehicles(result.vehicles);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  }

  const canCreate = user?.permissions.includes(Permission.VEHICLES_CREATE) ?? false;
  const canUpdate = user?.permissions.includes(Permission.VEHICLES_UPDATE) ?? false;
  const canDelete = user?.permissions.includes(Permission.VEHICLES_DELETE) ?? false;

  function handleVehicleCreated(vehicle: VehicleItem) {
    setVehicles((prev) => [vehicle, ...prev]);
    setTotal((prev) => prev + 1);
    void fetchStats();
  }

  function handleVehicleUpdated(updated: VehicleItem) {
    setVehicles((prev) => prev.map((v) => (v._id === updated._id ? updated : v)));
    void fetchStats();
  }

  function handleVehicleDeleted(id: string) {
    setVehicles((prev) => prev.filter((v) => v._id !== id));
    setTotal((prev) => prev - 1);
    void fetchStats();
  }

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
                <p className="text-sm text-gray-500">Gestion du parc d'engins</p>
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

        {/* Stats */}
        <StatsCards stats={stats} isLoading={isStatsLoading} />

        {/* Barre d'actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Parc d'engins</h2>
            <p className="text-sm text-gray-500">{total} engin{total > 1 ? 's' : ''}</p>
          </div>
          {canCreate && (
            <button onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Ajouter un engin
            </button>
          )}
        </div>

        {/* Filtres */}
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Rechercher un engin..."
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <select value={filterType} onChange={(e) => { setFilterType(e.target.value as VehicleType | ''); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="">Tous les types</option>
            {Object.values(VehicleType).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value as VehicleStatus | ''); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="">Tous les statuts</option>
            {Object.values(VehicleStatus).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {error ? (
            <div className="px-6 py-8 text-center">
              <p className="text-red-600 text-sm">{error}</p>
              <button onClick={() => void fetchVehicles()} className="mt-3 text-sm text-blue-600 hover:text-blue-700">Réessayer</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engin</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Immatriculation</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marque / Modèle</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Carburant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isLoading ? (
                    <><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
                  ) : vehicles.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">Aucun engin trouvé</td></tr>
                  ) : (
                    vehicles.map((v) => (
                      <tr key={v._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-gray-900">{v.name}</p>
                          <p className="text-xs text-gray-500">{v.internalCode}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">{TYPE_LABELS[v.type] ?? v.type}</td>
                        <td className="px-4 py-4 text-sm font-mono text-gray-700">{v.registrationNumber}</td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-gray-900">{v.brand} {v.model}</p>
                          <p className="text-xs text-gray-500">{v.year}</p>
                        </td>
                        <td className="px-4 py-4"><VehicleStatusBadge status={v.status} /></td>
                        <td className="px-4 py-4"><FuelBar level={v.fuelLevel} /></td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {canUpdate && (
                              <>
                                <button onClick={() => setEditingVehicle(v)} title="Modifier"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button onClick={() => setStatusVehicle(v)} title="Changer le statut"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors">
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {canDelete && (
                              <button onClick={() => setDeletingVehicle(v)} title="Supprimer"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
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
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
              Précédent
            </button>
            <span className="text-sm text-gray-500">Page {page} sur {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
              Suivant
            </button>
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateModal && <CreateModal onClose={() => setShowCreateModal(false)} onCreated={handleVehicleCreated} />}
      {editingVehicle !== null && <EditModal vehicle={editingVehicle} onClose={() => setEditingVehicle(null)} onUpdated={handleVehicleUpdated} />}
      {statusVehicle !== null && <StatusModal vehicle={statusVehicle} onClose={() => setStatusVehicle(null)} onUpdated={handleVehicleUpdated} />}
      {deletingVehicle !== null && <DeleteDialog vehicle={deletingVehicle} onClose={() => setDeletingVehicle(null)} onDeleted={handleVehicleDeleted} />}
    </div>
  );
}

export default VehiclesPage;
