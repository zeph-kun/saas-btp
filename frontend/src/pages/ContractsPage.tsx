import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Truck,
  ArrowLeft,
  Plus,
  X,
  Loader2,
  FileText,
} from 'lucide-react';
import { UserMenu } from '@/components';
import { useAuthStore } from '@/stores';
import { contractsService } from '@/services/contracts';
import type { ContractItem, CreateContractPayload } from '@/services/contracts';
import { ContractStatus, Permission } from '@/types';
import type { ApiResponse } from '@/types';
import { api } from '@/services/api';

// ============================================
// Helpers
// ============================================

function formatDateFR(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getClientLabel(clientId: ContractItem['clientId']): string {
  if (typeof clientId === 'object' && clientId !== null) {
    return clientId.companyName;
  }
  return clientId;
}

function getVehicleLabel(vehicleId: ContractItem['vehicleId']): string {
  if (typeof vehicleId === 'object' && vehicleId !== null) {
    return vehicleId.name;
  }
  return vehicleId;
}

function getVehicleSubLabel(vehicleId: ContractItem['vehicleId']): string {
  if (typeof vehicleId === 'object' && vehicleId !== null) {
    return vehicleId.registrationNumber;
  }
  return '';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function calculateDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ============================================
// Interfaces locales
// ============================================

interface ClientOption {
  _id: string;
  companyName: string;
}

interface VehicleOption {
  _id: string;
  name: string;
  registrationNumber: string;
}

// ============================================
// Badge Statut
// ============================================

interface StatusBadgeProps {
  status: ContractStatus;
}

const STATUS_CONFIG: Record<ContractStatus, { label: string; className: string }> = {
  [ContractStatus.BROUILLON]: {
    label: 'Brouillon',
    className: 'bg-gray-100 text-gray-700',
  },
  [ContractStatus.ACTIF]: {
    label: 'Actif',
    className: 'bg-green-100 text-green-700',
  },
  [ContractStatus.TERMINE]: {
    label: 'Terminé',
    className: 'bg-blue-100 text-blue-700',
  },
  [ContractStatus.ANNULE]: {
    label: 'Annulé',
    className: 'bg-red-100 text-red-700',
  },
};

function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = STATUS_CONFIG[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-700',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${className}`}
    >
      {label}
    </span>
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
// Formulaire partagé (Create / Edit)
// ============================================

interface ContractFormData {
  clientId: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  dailyRate: string; // string pour l'input, converti en number à la soumission
  deposit: string;
  deliveryAddress: string;
  notes: string;
}

const EMPTY_FORM: ContractFormData = {
  clientId: '',
  vehicleId: '',
  startDate: '',
  endDate: '',
  dailyRate: '',
  deposit: '',
  deliveryAddress: '',
  notes: '',
};

interface ContractFormProps {
  formData: ContractFormData;
  onChange: (data: ContractFormData) => void;
  clients: ClientOption[];
  vehicles: VehicleOption[];
  loadingOptions: boolean;
  contractNumber?: string;
}

function ContractForm({
  formData,
  onChange,
  clients,
  vehicles,
  loadingOptions,
  contractNumber,
}: ContractFormProps) {
  function set(field: keyof ContractFormData, value: string) {
    onChange({ ...formData, [field]: value });
  }

  const days = calculateDays(formData.startDate, formData.endDate);
  const dailyRateNum = parseFloat(formData.dailyRate) || 0;
  const estimatedTotal = days * dailyRateNum;

  return (
    <div className="space-y-4">
      {/* N° contrat en lecture seule (mode édition) */}
      {contractNumber && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            N° de contrat
          </label>
          <input
            type="text"
            value={contractNumber}
            readOnly
            className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
          />
        </div>
      )}

      {/* Client */}
      <div>
        <label htmlFor="form-clientId" className="block text-sm font-medium text-gray-700 mb-1">
          Client <span className="text-red-500">*</span>
        </label>
        <select
          id="form-clientId"
          value={formData.clientId}
          onChange={(e) => set('clientId', e.target.value)}
          disabled={loadingOptions}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        >
          <option value="">
            {loadingOptions ? 'Chargement...' : '— Sélectionner un client —'}
          </option>
          {clients.map((c) => (
            <option key={c._id} value={c._id}>
              {c.companyName}
            </option>
          ))}
        </select>
      </div>

      {/* Véhicule */}
      <div>
        <label htmlFor="form-vehicleId" className="block text-sm font-medium text-gray-700 mb-1">
          Véhicule <span className="text-red-500">*</span>
        </label>
        <select
          id="form-vehicleId"
          value={formData.vehicleId}
          onChange={(e) => set('vehicleId', e.target.value)}
          disabled={loadingOptions}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        >
          <option value="">
            {loadingOptions ? 'Chargement...' : '— Sélectionner un véhicule disponible —'}
          </option>
          {vehicles.map((v) => (
            <option key={v._id} value={v._id}>
              {v.name} — {v.registrationNumber}
            </option>
          ))}
        </select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="form-startDate" className="block text-sm font-medium text-gray-700 mb-1">
            Date de début <span className="text-red-500">*</span>
          </label>
          <input
            id="form-startDate"
            type="date"
            value={formData.startDate}
            onChange={(e) => set('startDate', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label htmlFor="form-endDate" className="block text-sm font-medium text-gray-700 mb-1">
            Date de fin <span className="text-red-500">*</span>
          </label>
          <input
            id="form-endDate"
            type="date"
            value={formData.endDate}
            onChange={(e) => set('endDate', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tarifs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="form-dailyRate" className="block text-sm font-medium text-gray-700 mb-1">
            Tarif journalier (€) <span className="text-red-500">*</span>
          </label>
          <input
            id="form-dailyRate"
            type="number"
            min="0"
            step="0.01"
            value={formData.dailyRate}
            onChange={(e) => set('dailyRate', e.target.value)}
            placeholder="0.00"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label htmlFor="form-deposit" className="block text-sm font-medium text-gray-700 mb-1">
            Caution (€)
          </label>
          <input
            id="form-deposit"
            type="number"
            min="0"
            step="0.01"
            value={formData.deposit}
            onChange={(e) => set('deposit', e.target.value)}
            placeholder="Optionnel"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Estimation du montant total (création uniquement — temps réel) */}
      {days > 0 && dailyRateNum > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
          <p className="text-sm text-blue-700">
            <span className="font-medium">Estimation :</span>{' '}
            {days} jour{days > 1 ? 's' : ''} × {formatCurrency(dailyRateNum)} ={' '}
            <span className="font-semibold">{formatCurrency(estimatedTotal)}</span>
          </p>
        </div>
      )}

      {/* Adresse de livraison */}
      <div>
        <label htmlFor="form-deliveryAddress" className="block text-sm font-medium text-gray-700 mb-1">
          Adresse de livraison <span className="text-red-500">*</span>
        </label>
        <input
          id="form-deliveryAddress"
          type="text"
          value={formData.deliveryAddress}
          onChange={(e) => set('deliveryAddress', e.target.value)}
          placeholder="Ex: 12 rue du Chantier, 75001 Paris"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="form-notes" className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          id="form-notes"
          value={formData.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          placeholder="Informations complémentaires (optionnel)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>
    </div>
  );
}

// ============================================
// Hook : charger les options clients / véhicules
// ============================================

function useContractOptions(open: boolean) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingOptions(true);

    async function fetchOptions() {
      try {
        const [clientsRes, vehiclesRes] = await Promise.all([
          api.get<ApiResponse<ClientOption[]>>('/clients', {
            params: { limit: 100 },
          }),
          api.get<ApiResponse<VehicleOption[]>>('/vehicles', {
            params: { status: 'disponible', limit: 100 },
          }),
        ]);

        if (cancelled) return;

        if (clientsRes.data.success && clientsRes.data.data) {
          setClients(clientsRes.data.data);
        }
        if (vehiclesRes.data.success && vehiclesRes.data.data) {
          setVehicles(vehiclesRes.data.data);
        }
      } catch {
        // silently fail — le select restera vide
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    }

    void fetchOptions();
    return () => {
      cancelled = true;
    };
  }, [open]);

  return { clients, vehicles, loadingOptions };
}

// ============================================
// Modal Création
// ============================================

interface CreateModalProps {
  onClose: () => void;
  onCreated: (contract: ContractItem) => void;
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [formData, setFormData] = useState<ContractFormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { clients, vehicles, loadingOptions } = useContractOptions(true);

  function validate(): string | null {
    if (!formData.clientId) return 'Veuillez sélectionner un client';
    if (!formData.vehicleId) return 'Veuillez sélectionner un véhicule';
    if (!formData.startDate) return 'La date de début est requise';
    if (!formData.endDate) return 'La date de fin est requise';
    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      return 'La date de fin doit être postérieure à la date de début';
    }
    const rate = parseFloat(formData.dailyRate);
    if (!formData.dailyRate || isNaN(rate) || rate < 0) {
      return 'Le tarif journalier est requis et doit être positif';
    }
    if (!formData.deliveryAddress.trim()) return "L'adresse de livraison est requise";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload: CreateContractPayload = {
      clientId: formData.clientId,
      vehicleId: formData.vehicleId,
      startDate: formData.startDate,
      endDate: formData.endDate,
      dailyRate: parseFloat(formData.dailyRate),
      deposit: formData.deposit ? parseFloat(formData.deposit) : undefined,
      deliveryAddress: formData.deliveryAddress,
      deliveryLocation: { type: 'Point', coordinates: [0, 0] },
      notes: formData.notes || undefined,
    };

    try {
      const created = await contractsService.createContract(payload);
      onCreated(created);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center overflow-y-auto py-6">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
        {/* Titre */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Nouveau contrat</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <ContractForm
            formData={formData}
            onChange={setFormData}
            clients={clients}
            vehicles={vehicles}
            loadingOptions={loadingOptions}
          />

          <div className="flex items-center justify-end gap-3 pt-5">
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
              Créer le contrat
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
  contract: ContractItem;
  onClose: () => void;
  onUpdated: (contract: ContractItem) => void;
}

function EditModal({ contract, onClose, onUpdated }: EditModalProps) {
  const getClientId = (): string => {
    if (typeof contract.clientId === 'object' && contract.clientId !== null) {
      return contract.clientId._id;
    }
    return contract.clientId;
  };
  const getVehicleId = (): string => {
    if (typeof contract.vehicleId === 'object' && contract.vehicleId !== null) {
      return contract.vehicleId._id;
    }
    return contract.vehicleId;
  };

  const [formData, setFormData] = useState<ContractFormData>({
    clientId: getClientId(),
    vehicleId: getVehicleId(),
    startDate: contract.startDate.slice(0, 10),
    endDate: contract.endDate.slice(0, 10),
    dailyRate: String(contract.dailyRate),
    deposit: contract.deposit !== undefined ? String(contract.deposit) : '',
    deliveryAddress: contract.deliveryAddress,
    notes: contract.notes ?? '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { clients, vehicles, loadingOptions } = useContractOptions(true);

  function validate(): string | null {
    if (!formData.clientId) return 'Veuillez sélectionner un client';
    if (!formData.vehicleId) return 'Veuillez sélectionner un véhicule';
    if (!formData.startDate) return 'La date de début est requise';
    if (!formData.endDate) return 'La date de fin est requise';
    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      return 'La date de fin doit être postérieure à la date de début';
    }
    const rate = parseFloat(formData.dailyRate);
    if (!formData.dailyRate || isNaN(rate) || rate < 0) {
      return 'Le tarif journalier est requis et doit être positif';
    }
    if (!formData.deliveryAddress.trim()) return "L'adresse de livraison est requise";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      clientId: formData.clientId,
      vehicleId: formData.vehicleId,
      startDate: formData.startDate,
      endDate: formData.endDate,
      dailyRate: parseFloat(formData.dailyRate),
      deposit: formData.deposit ? parseFloat(formData.deposit) : undefined,
      deliveryAddress: formData.deliveryAddress,
      deliveryLocation: contract.deliveryLocation,
      notes: formData.notes || undefined,
    };

    try {
      const updated = await contractsService.updateContract(contract._id, payload);
      onUpdated(updated);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center overflow-y-auto py-6">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
        {/* Titre */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Modifier le contrat</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <ContractForm
            formData={formData}
            onChange={setFormData}
            clients={clients}
            vehicles={vehicles}
            loadingOptions={loadingOptions}
            contractNumber={contract.contractNumber}
          />

          <div className="flex items-center justify-end gap-3 pt-5">
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
// Dialog Suppression
// ============================================

interface DeleteDialogProps {
  contract: ContractItem;
  onClose: () => void;
  onDeleted: (contractId: string) => void;
}

function DeleteDialog({ contract, onClose, onDeleted }: DeleteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setIsSubmitting(true);
    setDeleteError(null);
    try {
      await contractsService.deleteContract(contract._id);
      onDeleted(contract._id);
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Supprimer le contrat ?
        </h2>
        <p className="text-sm text-gray-500 mb-1">
          Contrat{' '}
          <span className="font-medium text-gray-700">{contract.contractNumber}</span>
        </p>
        <p className="text-sm text-gray-500 mb-5">Cette action est irréversible.</p>

        {deleteError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {deleteError}
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
            onClick={handleDelete}
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
// Boutons changement de statut inline
// ============================================

interface StatusActionsProps {
  contract: ContractItem;
  canUpdate: boolean;
  onStatusChange: (contract: ContractItem, newStatus: ContractStatus) => void;
  isChanging: boolean;
}

function StatusActions({
  contract,
  canUpdate,
  onStatusChange,
  isChanging,
}: StatusActionsProps) {
  if (!canUpdate) return null;

  if (contract.status === ContractStatus.BROUILLON) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => onStatusChange(contract, ContractStatus.ACTIF)}
          disabled={isChanging}
          title="Activer"
          className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Activer
        </button>
        <button
          onClick={() => onStatusChange(contract, ContractStatus.ANNULE)}
          disabled={isChanging}
          title="Annuler le contrat"
          className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Annuler
        </button>
      </div>
    );
  }

  if (contract.status === ContractStatus.ACTIF) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => onStatusChange(contract, ContractStatus.TERMINE)}
          disabled={isChanging}
          title="Terminer"
          className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Terminer
        </button>
        <button
          onClick={() => onStatusChange(contract, ContractStatus.ANNULE)}
          disabled={isChanging}
          title="Annuler le contrat"
          className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Annuler
        </button>
      </div>
    );
  }

  return null;
}

// ============================================
// ContractsPage
// ============================================

export function ContractsPage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  // Permissions
  const canRead = user?.permissions.includes(Permission.CONTRACTS_READ) ?? false;
  const canCreate = user?.permissions.includes(Permission.CONTRACTS_CREATE) ?? false;
  const canUpdate = user?.permissions.includes(Permission.CONTRACTS_UPDATE) ?? false;
  const canDelete = user?.permissions.includes(Permission.CONTRACTS_DELETE) ?? false;

  // États liste
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ContractStatus | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Changement de statut inline
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractItem | null>(null);
  const [deletingContract, setDeletingContract] = useState<ContractItem | null>(null);

  // Protection d'accès
  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  const fetchContracts = useCallback(async () => {
    if (!canRead) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await contractsService.listContracts({
        status: filterStatus || undefined,
        page,
      });
      setContracts(result.contracts);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des contrats');
    } finally {
      setIsLoading(false);
    }
  }, [canRead, filterStatus, page]);

  // Stocker la ref pour l'appel depuis le useEffect
  const fetchRef = useRef(fetchContracts);
  fetchRef.current = fetchContracts;

  useEffect(() => {
    void fetchRef.current();
  }, [filterStatus, page]);

  // ── Changement de statut inline ──
  async function handleStatusChange(contract: ContractItem, newStatus: ContractStatus) {
    setChangingStatusId(contract._id);
    try {
      const updated = await contractsService.updateContract(contract._id, { status: newStatus });
      setContracts((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du changement de statut');
    } finally {
      setChangingStatusId(null);
    }
  }

  // ── Callbacks modals ──
  function handleContractCreated(newContract: ContractItem) {
    setContracts((prev) => [newContract, ...prev]);
    setTotal((prev) => prev + 1);
  }

  function handleContractUpdated(updatedContract: ContractItem) {
    setContracts((prev) =>
      prev.map((c) => (c._id === updatedContract._id ? updatedContract : c)),
    );
  }

  function handleContractDeleted(contractId: string) {
    setContracts((prev) => prev.filter((c) => c._id !== contractId));
    setTotal((prev) => prev - 1);
  }

  // Accès refusé si pas de permission de lecture
  if (isAuthenticated && !canRead) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-900 mb-2">Accès refusé</p>
          <p className="text-sm text-gray-500">
            Vous n'avez pas la permission de consulter les contrats.
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
              <div className="bg-primary-100 p-2 rounded-lg">
                <Truck className="w-8 h-8 text-primary-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">SaaS BTP</h1>
                <p className="text-sm text-gray-500">Gestion des contrats</p>
              </div>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Retour */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Tableau de bord
        </Link>

        {/* ── Barre d'actions ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Contrats de location</h2>
            <p className="text-sm text-gray-500">
              {total} contrat{total > 1 ? 's' : ''}
            </p>
          </div>

          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Nouveau contrat
            </button>
          )}
        </div>

        {/* ── Filtre statut ── */}
        <div className="flex gap-4 mb-4">
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as ContractStatus | '');
              setPage(1);
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Tous les statuts</option>
            <option value={ContractStatus.BROUILLON}>Brouillon</option>
            <option value={ContractStatus.ACTIF}>Actif</option>
            <option value={ContractStatus.TERMINE}>Terminé</option>
            <option value={ContractStatus.ANNULE}>Annulé</option>
          </select>
        </div>

        {/* ── Tableau ── */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {error ? (
            <div className="px-6 py-8 text-center">
              <p className="text-red-600 text-sm">{error}</p>
              <button
                onClick={() => void fetchContracts()}
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
                      N° Contrat
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Véhicule
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Période
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Montant total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
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
                  ) : contracts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-gray-500"
                      >
                        Aucun contrat trouvé
                      </td>
                    </tr>
                  ) : (
                    contracts.map((contract) => {
                      const isChanging = changingStatusId === contract._id;
                      const canBeDeleted =
                        canDelete &&
                        (contract.status === ContractStatus.BROUILLON ||
                          contract.status === ContractStatus.ANNULE);

                      return (
                        <tr
                          key={contract._id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          {/* N° Contrat */}
                          <td className="px-4 py-4">
                            <span className="text-sm font-medium text-gray-900">
                              {contract.contractNumber}
                            </span>
                          </td>

                          {/* Client */}
                          <td className="px-4 py-4">
                            <span className="text-sm text-gray-900">
                              {getClientLabel(contract.clientId)}
                            </span>
                          </td>

                          {/* Véhicule */}
                          <td className="px-4 py-4">
                            <div>
                              <p className="text-sm text-gray-900">
                                {getVehicleLabel(contract.vehicleId)}
                              </p>
                              {getVehicleSubLabel(contract.vehicleId) && (
                                <p className="text-xs text-gray-500">
                                  {getVehicleSubLabel(contract.vehicleId)}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Période */}
                          <td className="px-4 py-4">
                            <span className="text-sm text-gray-700 whitespace-nowrap">
                              {formatDateFR(contract.startDate)} →{' '}
                              {formatDateFR(contract.endDate)}
                            </span>
                          </td>

                          {/* Montant total */}
                          <td className="px-4 py-4">
                            <span className="text-sm font-medium text-gray-900">
                              {contract.totalAmount !== undefined
                                ? formatCurrency(contract.totalAmount)
                                : '—'}
                            </span>
                          </td>

                          {/* Statut */}
                          <td className="px-4 py-4">
                            <StatusBadge status={contract.status} />
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Changement de statut inline */}
                              <StatusActions
                                contract={contract}
                                canUpdate={canUpdate}
                                onStatusChange={handleStatusChange}
                                isChanging={isChanging}
                              />

                              {/* Édition */}
                              {canUpdate && (
                                <button
                                  onClick={() => setEditingContract(contract)}
                                  title="Modifier"
                                  className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                                >
                                  Modifier
                                </button>
                              )}

                              {/* Suppression */}
                              {canBeDeleted && (
                                <button
                                  onClick={() => setDeletingContract(contract)}
                                  title="Supprimer"
                                  className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
                                >
                                  Supprimer
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
          onCreated={handleContractCreated}
        />
      )}

      {editingContract !== null && (
        <EditModal
          contract={editingContract}
          onClose={() => setEditingContract(null)}
          onUpdated={handleContractUpdated}
        />
      )}

      {deletingContract !== null && (
        <DeleteDialog
          contract={deletingContract}
          onClose={() => setDeletingContract(null)}
          onDeleted={handleContractDeleted}
        />
      )}
    </div>
  );
}

export default ContractsPage;
