import mongoose from 'mongoose';
import { Vehicle, IVehicleDocument, Contract, Geofence } from '../models/index.js';
import { IVehicle, VehicleStatus, GeoJSONPoint, ContractStatus } from '../types/index.js';
import { getOrganizationObjectId } from '../config/index.js';

/**
 * Service de gestion des véhicules/engins
 * Couche métier entre les contrôleurs et les modèles
 */
export class VehicleService {
  /**
   * Crée un nouveau véhicule
   */
  async createVehicle(
    vehicleData: Omit<IVehicle, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<IVehicleDocument> {
    const vehicle = new Vehicle(vehicleData);
    return vehicle.save();
  }

  /**
   * Récupère tous les véhicules d'une organisation avec pagination
   */
  async getVehiclesByOrganization(
    organizationId: string,
    options: {
      page?: number;
      limit?: number;
      status?: VehicleStatus;
      type?: string;
      search?: string;
    } = {}
  ): Promise<{
    vehicles: IVehicleDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20, status, type, search } = options;
    const skip = (page - 1) * limit;

    // Construire le filtre
    const filter: Record<string, unknown> = {
      organizationId: getOrganizationObjectId(organizationId),
    };

    if (status) {
      filter.status = status;
    }

    if (type) {
      filter.type = type;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } },
        { internalCode: { $regex: search, $options: 'i' } },
      ];
    }

    const [vehicles, total] = await Promise.all([
      Vehicle.find(filter)
        .sort({ lastLocationUpdate: -1 })
        .skip(skip)
        .limit(limit)
        .populate('assignedGeofences', 'name color')
        .exec(),
      Vehicle.countDocuments(filter),
    ]);

    return {
      vehicles,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Récupère un véhicule par son ID avec ses relations
   */
  async getVehicleById(vehicleId: string): Promise<IVehicleDocument | null> {
    return Vehicle.findById(vehicleId)
      .populate('assignedGeofences', 'name color area isActive')
      .exec();
  }

  /**
   * Récupère un véhicule avec son contrat actif et le client associé
   */
  async getVehicleWithActiveContract(vehicleId: string): Promise<{
    vehicle: IVehicleDocument | null;
    contract: InstanceType<typeof Contract> | null;
    client: unknown;
  }> {
    const vehicle = await this.getVehicleById(vehicleId);
    if (!vehicle) {
      return { vehicle: null, contract: null, client: null };
    }

    // Trouver le contrat actif pour ce véhicule
    const contract = await Contract.findOne({
      vehicleId: vehicle._id,
      status: ContractStatus.ACTIF,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).populate('clientId');

    return {
      vehicle,
      contract,
      client: contract?.clientId || null,
    };
  }

  /**
   * Met à jour un véhicule
   */
  async updateVehicle(
    vehicleId: string,
    updates: Partial<IVehicle>
  ): Promise<IVehicleDocument | null> {
    // Empêcher la modification de certains champs
    const { organizationId, _id, createdAt, ...safeUpdates } = updates;

    return Vehicle.findByIdAndUpdate(
      vehicleId,
      { $set: safeUpdates },
      { new: true, runValidators: true }
    ).exec();
  }

  /**
   * Met à jour le statut d'un véhicule
   */
  async updateVehicleStatus(
    vehicleId: string,
    status: VehicleStatus
  ): Promise<IVehicleDocument | null> {
    return Vehicle.findByIdAndUpdate(
      vehicleId,
      { $set: { status } },
      { new: true }
    ).exec();
  }

  /**
   * Met à jour la position d'un véhicule
   */
  async updateVehicleLocation(
    vehicleId: string,
    location: GeoJSONPoint
  ): Promise<IVehicleDocument | null> {
    return Vehicle.findByIdAndUpdate(
      vehicleId,
      {
        $set: {
          location,
          lastLocationUpdate: new Date(),
        },
      },
      { new: true }
    ).exec();
  }

  /**
   * Assigne une geofence à un véhicule
   */
  async assignGeofence(
    vehicleId: string,
    geofenceId: string
  ): Promise<IVehicleDocument | null> {
    // Vérifier que la geofence existe
    const geofence = await Geofence.findById(geofenceId);
    if (!geofence) {
      throw new Error(`Geofence non trouvée: ${geofenceId}`);
    }

    // Ajouter la geofence au véhicule (sans doublons)
    const vehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      { $addToSet: { assignedGeofences: new mongoose.Types.ObjectId(geofenceId) } },
      { new: true }
    ).exec();

    // Ajouter le véhicule à la geofence
    await Geofence.findByIdAndUpdate(geofenceId, {
      $addToSet: { assignedVehicles: new mongoose.Types.ObjectId(vehicleId) },
    });

    return vehicle;
  }

  /**
   * Retire une geofence d'un véhicule
   */
  async removeGeofence(
    vehicleId: string,
    geofenceId: string
  ): Promise<IVehicleDocument | null> {
    const vehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      { $pull: { assignedGeofences: new mongoose.Types.ObjectId(geofenceId) } },
      { new: true }
    ).exec();

    await Geofence.findByIdAndUpdate(geofenceId, {
      $pull: { assignedVehicles: new mongoose.Types.ObjectId(vehicleId) },
    });

    return vehicle;
  }

  /**
   * Supprime un véhicule (soft delete via changement de statut)
   */
  async deleteVehicle(vehicleId: string): Promise<boolean> {
    // Vérifier qu'il n'y a pas de contrat actif
    const activeContract = await Contract.findOne({
      vehicleId: new mongoose.Types.ObjectId(vehicleId),
      status: ContractStatus.ACTIF,
    });

    if (activeContract) {
      throw new Error('Impossible de supprimer un véhicule avec un contrat actif');
    }

    const result = await Vehicle.findByIdAndUpdate(vehicleId, {
      $set: { status: VehicleStatus.HORS_SERVICE },
    });

    return result !== null;
  }

  /**
   * Obtient les statistiques des véhicules pour le dashboard
   */
  async getVehicleStats(organizationId: string): Promise<{
    total: number;
    byStatus: Record<VehicleStatus, number>;
    byType: Record<string, number>;
  }> {
    const orgId = getOrganizationObjectId(organizationId);

    const [statusStats, typeStats, total] = await Promise.all([
      Vehicle.aggregate([
        { $match: { organizationId: orgId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Vehicle.aggregate([
        { $match: { organizationId: orgId } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      Vehicle.countDocuments({ organizationId: orgId }),
    ]);

    const byStatus: Record<VehicleStatus, number> = {
      [VehicleStatus.DISPONIBLE]: 0,
      [VehicleStatus.EN_LOCATION]: 0,
      [VehicleStatus.EN_MAINTENANCE]: 0,
      [VehicleStatus.HORS_SERVICE]: 0,
      [VehicleStatus.VOLE]: 0,
    };
    for (const stat of statusStats) {
      byStatus[stat._id as VehicleStatus] = stat.count;
    }

    const byType: Record<string, number> = {};
    for (const stat of typeStats) {
      byType[stat._id] = stat.count;
    }

    return { total, byStatus, byType };
  }
}

// Export d'une instance singleton
export const vehicleService = new VehicleService();
export default vehicleService;
