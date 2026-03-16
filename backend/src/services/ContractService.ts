import mongoose from 'mongoose';
import { Contract, IContractDocument } from '../models/Contract.js';
import { Client } from '../models/Client.js';
import { Vehicle } from '../models/Vehicle.js';
import { ContractStatus, VehicleStatus } from '../types/index.js';

// ============================================
// Interfaces
// ============================================

export interface ContractFilters {
  status?: ContractStatus;
  clientId?: string;
  vehicleId?: string;
  page?: number;   // default 1
  limit?: number;  // default 20, max 100
}

export interface CreateContractData {
  clientId: string;
  vehicleId: string;
  startDate: Date | string;
  endDate: Date | string;
  dailyRate: number;
  deposit?: number;
  deliveryLocation: { type: 'Point'; coordinates: [number, number] };
  deliveryAddress: string;
  geofenceId?: string;
  notes?: string;
}

export type UpdateContractData = Partial<
  Omit<CreateContractData, 'clientId' | 'vehicleId'>
> & {
  status?: ContractStatus;
};

// ============================================
// Erreurs métier
// ============================================

export class ContractNotFoundError extends Error {
  readonly code = 'CONTRACT_NOT_FOUND';
  constructor(contractId: string) {
    super(`Contrat non trouvé : ${contractId}`);
    this.name = 'ContractNotFoundError';
  }
}

export class ContractConflictError extends Error {
  readonly code = 'CONFLICT';
  constructor(message: string) {
    super(message);
    this.name = 'ContractConflictError';
  }
}

export class ContractValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ContractValidationError';
  }
}

// ============================================
// Service
// ============================================

/**
 * Service de gestion des contrats de location
 * Couche métier entre les contrôleurs et le modèle Contract
 */
export class ContractService {
  /**
   * Liste les contrats d'une organisation avec pagination et filtres
   * Popule clientId (companyName, contactName) et vehicleId (name, registrationNumber, type)
   */
  async listContracts(
    organizationId: string,
    filters: ContractFilters
  ): Promise<{ contracts: IContractDocument[]; total: number }> {
    const { status, clientId, vehicleId, page = 1, limit = 20 } = filters;

    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const query: Record<string, unknown> = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
    };

    if (status) {
      query.status = status;
    }

    if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
      query.clientId = new mongoose.Types.ObjectId(clientId);
    }

    if (vehicleId && mongoose.Types.ObjectId.isValid(vehicleId)) {
      query.vehicleId = new mongoose.Types.ObjectId(vehicleId);
    }

    const [contracts, total] = await Promise.all([
      Contract.find(query)
        .populate('clientId', 'companyName contactName')
        .populate('vehicleId', 'name registrationNumber type')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .exec(),
      Contract.countDocuments(query),
    ]);

    return { contracts, total };
  }

  /**
   * Récupère un contrat par son ID, scoped à l'organisation
   * Popule clientId et vehicleId
   */
  async getContractById(
    organizationId: string,
    contractId: string
  ): Promise<IContractDocument> {
    if (!mongoose.Types.ObjectId.isValid(contractId)) {
      throw new ContractNotFoundError(contractId);
    }

    const contract = await Contract.findOne({
      _id: new mongoose.Types.ObjectId(contractId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
    })
      .populate('clientId', 'companyName contactName')
      .populate('vehicleId', 'name registrationNumber type')
      .exec();

    if (!contract) {
      throw new ContractNotFoundError(contractId);
    }

    return contract;
  }

  /**
   * Crée un contrat dans l'organisation
   *
   * Vérifications :
   * 1. clientId appartient à la même organisation
   * 2. vehicleId appartient à la même organisation
   * 3. Pas de contrat ACTIF pour ce véhicule sur la même période
   */
  async createContract(
    organizationId: string,
    data: CreateContractData
  ): Promise<IContractDocument> {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    // Validation des dates
    if (endDate <= startDate) {
      throw new ContractValidationError(
        'La date de fin doit être postérieure à la date de début'
      );
    }

    // 1. Vérifier que le client appartient à l'organisation
    if (!mongoose.Types.ObjectId.isValid(data.clientId)) {
      throw new ContractValidationError('clientId invalide');
    }
    const client = await Client.findOne({
      _id: new mongoose.Types.ObjectId(data.clientId),
      organizationId: orgObjectId,
    }).exec();

    if (!client) {
      throw new ContractConflictError(
        `Le client "${data.clientId}" n'appartient pas à cette organisation`
      );
    }

    // 2. Vérifier que le véhicule appartient à l'organisation
    if (!mongoose.Types.ObjectId.isValid(data.vehicleId)) {
      throw new ContractValidationError('vehicleId invalide');
    }
    const vehicle = await Vehicle.findOne({
      _id: new mongoose.Types.ObjectId(data.vehicleId),
      organizationId: orgObjectId,
    }).exec();

    if (!vehicle) {
      throw new ContractConflictError(
        `Le véhicule "${data.vehicleId}" n'appartient pas à cette organisation`
      );
    }

    // 3. Vérifier l'absence de chevauchement avec des contrats ACTIFS
    await this._checkVehicleOverlap(data.vehicleId, startDate, endDate, null);

    // Création du contrat
    const contractData: Record<string, unknown> = {
      clientId: new mongoose.Types.ObjectId(data.clientId),
      vehicleId: new mongoose.Types.ObjectId(data.vehicleId),
      organizationId: orgObjectId,
      startDate,
      endDate,
      dailyRate: data.dailyRate,
      deposit: data.deposit ?? 0,
      deliveryLocation: data.deliveryLocation,
      deliveryAddress: data.deliveryAddress,
      status: ContractStatus.BROUILLON,
    };

    if (data.geofenceId && mongoose.Types.ObjectId.isValid(data.geofenceId)) {
      contractData.geofenceId = new mongoose.Types.ObjectId(data.geofenceId);
    }

    if (data.notes !== undefined) {
      contractData.notes = data.notes;
    }

    const contract = await Contract.create(contractData);

    return contract;
  }

  /**
   * Met à jour un contrat (scoped à l'organisation)
   *
   * - Si passage à ACTIF : re-vérifier l'absence de chevauchement
   * - Si ANNULE ou TERMINE : mettre le véhicule à DISPONIBLE si aucun autre contrat actif
   */
  async updateContract(
    organizationId: string,
    contractId: string,
    data: UpdateContractData
  ): Promise<IContractDocument> {
    const contract = await this.getContractById(organizationId, contractId);

    const previousStatus = contract.status;

    // Appliquer les modifications de dates/taux si fournis
    if (data.startDate !== undefined) {
      contract.startDate = new Date(data.startDate);
    }
    if (data.endDate !== undefined) {
      contract.endDate = new Date(data.endDate);
    }
    if (data.dailyRate !== undefined) {
      contract.dailyRate = data.dailyRate;
    }
    if (data.deposit !== undefined) {
      contract.deposit = data.deposit;
    }
    if (data.deliveryLocation !== undefined) {
      contract.deliveryLocation = data.deliveryLocation;
    }
    if (data.deliveryAddress !== undefined) {
      contract.deliveryAddress = data.deliveryAddress;
    }
    if (data.notes !== undefined) {
      contract.notes = data.notes;
    }
    if (data.geofenceId !== undefined) {
      if (
        data.geofenceId &&
        mongoose.Types.ObjectId.isValid(data.geofenceId)
      ) {
        contract.geofenceId = new mongoose.Types.ObjectId(data.geofenceId);
      } else {
        contract.geofenceId = undefined;
      }
    }

    // Gestion du changement de statut
    if (data.status !== undefined && data.status !== previousStatus) {
      // Passage à ACTIF → re-vérifier le chevauchement
      if (data.status === ContractStatus.ACTIF) {
        await this._checkVehicleOverlap(
          contract.vehicleId.toString(),
          contract.startDate,
          contract.endDate,
          contractId
        );
      }

      contract.status = data.status;

      // Si le contrat est terminé ou annulé, libérer le véhicule si nécessaire
      if (
        data.status === ContractStatus.ANNULE ||
        data.status === ContractStatus.TERMINE
      ) {
        await this._releaseVehicleIfFree(contract.vehicleId.toString(), contractId);
      }
    }

    // Validation dates (endDate > startDate)
    if (contract.endDate <= contract.startDate) {
      throw new ContractValidationError(
        'La date de fin doit être postérieure à la date de début'
      );
    }

    await contract.save();

    return contract;
  }

  /**
   * Supprime un contrat
   * Seulement si status = BROUILLON ou ANNULE
   */
  async deleteContract(
    organizationId: string,
    contractId: string
  ): Promise<void> {
    const contract = await this.getContractById(organizationId, contractId);

    if (
      contract.status !== ContractStatus.BROUILLON &&
      contract.status !== ContractStatus.ANNULE
    ) {
      throw new ContractConflictError(
        'Seuls les contrats brouillon ou annulés peuvent être supprimés'
      );
    }

    await Contract.deleteOne({ _id: contract._id }).exec();
  }

  // ============================================
  // Méthodes privées
  // ============================================

  /**
   * Vérifie s'il existe un contrat ACTIF sur la même période pour un véhicule donné
   * @param vehicleId - ID du véhicule
   * @param startDate - Date de début du nouveau contrat
   * @param endDate - Date de fin du nouveau contrat
   * @param excludeContractId - ID du contrat à exclure (pour les mises à jour)
   */
  private async _checkVehicleOverlap(
    vehicleId: string,
    startDate: Date,
    endDate: Date,
    excludeContractId: string | null
  ): Promise<void> {
    const query: Record<string, unknown> = {
      vehicleId: new mongoose.Types.ObjectId(vehicleId),
      status: ContractStatus.ACTIF,
      // Chevauchement : startDate < endDate_existant ET startDate_existant < endDate
      startDate: { $lt: endDate },
      endDate: { $gt: startDate },
    };

    if (excludeContractId && mongoose.Types.ObjectId.isValid(excludeContractId)) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeContractId) };
    }

    const conflicting = await Contract.findOne(query).exec();

    if (conflicting) {
      throw new ContractConflictError(
        `Le véhicule est déjà sous contrat actif du ${conflicting.startDate.toLocaleDateString(
          'fr-FR'
        )} au ${conflicting.endDate.toLocaleDateString(
          'fr-FR'
        )} (contrat ${conflicting.contractNumber})`
      );
    }
  }

  /**
   * Libère le véhicule (status → DISPONIBLE) s'il n'a plus aucun contrat ACTIF
   * @param vehicleId - ID du véhicule
   * @param excludeContractId - ID du contrat qui vient d'être terminé/annulé (à exclure)
   */
  private async _releaseVehicleIfFree(
    vehicleId: string,
    excludeContractId: string
  ): Promise<void> {
    const activeContractCount = await Contract.countDocuments({
      vehicleId: new mongoose.Types.ObjectId(vehicleId),
      status: ContractStatus.ACTIF,
      _id: { $ne: new mongoose.Types.ObjectId(excludeContractId) },
    });

    if (activeContractCount === 0) {
      await Vehicle.findByIdAndUpdate(vehicleId, {
        status: VehicleStatus.DISPONIBLE,
      }).exec();
    }
  }
}

export const contractService = new ContractService();

export default contractService;
