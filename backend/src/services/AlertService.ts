import mongoose from 'mongoose';
import { Alert, IAlertDocument, Vehicle } from '../models/index.js';
import {
  IAlert,
  AlertType,
  AlertSeverity,
  AlertStatus,
  GeoJSONPoint,
  AlertNotification,
} from '../types/index.js';
import { getOrganizationObjectId } from '../config/index.js';

/**
 * Service de gestion des alertes de sécurité
 * Gère la création, la mise à jour et la notification des alertes
 */
export class AlertService {
  /**
   * Crée une nouvelle alerte et la retourne avec les infos véhicule
   */
  async createAlert(
    vehicleId: string,
    type: AlertType,
    severity: AlertSeverity,
    message: string,
    location: GeoJSONPoint,
    geofenceId?: string
  ): Promise<AlertNotification> {
    // Récupérer le véhicule pour l'organisation
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      throw new Error(`Véhicule non trouvé: ${vehicleId}`);
    }

    // Vérifier qu'il n'y a pas déjà une alerte active du même type pour ce véhicule
    const existingAlert = await Alert.findOne({
      vehicleId: new mongoose.Types.ObjectId(vehicleId),
      type,
      status: AlertStatus.ACTIVE,
    });

    if (existingAlert) {
      // Mettre à jour l'alerte existante avec la nouvelle position
      existingAlert.location = location;
      existingAlert.message = message;
      await existingAlert.save();

      return {
        alert: {
          ...existingAlert.toObject(),
          _id: existingAlert._id.toString(),
          vehicleId: existingAlert.vehicleId.toString(),
          geofenceId: existingAlert.geofenceId?.toString(),
          organizationId: existingAlert.organizationId.toString(),
          acknowledgedBy: existingAlert.acknowledgedBy?.toString(),
          resolvedBy: existingAlert.resolvedBy?.toString(),
        } as unknown as IAlert,
        vehicle: {
          _id: vehicle._id.toString(),
          name: vehicle.name,
          registrationNumber: vehicle.registrationNumber,
          type: vehicle.type,
        },
      };
    }

    // Créer une nouvelle alerte
    const alert = await Alert.create({
      type,
      severity,
      status: AlertStatus.ACTIVE,
      vehicleId: vehicle._id,
      geofenceId: geofenceId ? new mongoose.Types.ObjectId(geofenceId) : undefined,
      organizationId: vehicle.organizationId,
      message,
      location,
      triggeredAt: new Date(),
    });

    return {
      alert: {
        ...alert.toObject(),
        _id: alert._id.toString(),
        vehicleId: alert.vehicleId.toString(),
        geofenceId: alert.geofenceId?.toString(),
        organizationId: alert.organizationId.toString(),
      } as unknown as IAlert,
      vehicle: {
        _id: vehicle._id.toString(),
        name: vehicle.name,
        registrationNumber: vehicle.registrationNumber,
        type: vehicle.type,
      },
    };
  }

  /**
   * Récupère les alertes actives pour une organisation
   */
  async getActiveAlerts(organizationId: string): Promise<IAlertDocument[]> {
    return Alert.find({
      organizationId: getOrganizationObjectId(organizationId),
      status: AlertStatus.ACTIVE,
    })
      .sort({ severity: -1, triggeredAt: -1 }) // CRITICAL d'abord, puis les plus récentes
      .populate('vehicleId', 'name registrationNumber type status')
      .populate('geofenceId', 'name color')
      .exec();
  }

  /**
   * Acquitte une alerte (prise en compte)
   */
  async acknowledgeAlert(
    alertId: string,
    userId: string
  ): Promise<IAlertDocument | null> {
    const alert = await Alert.findById(alertId);
    if (!alert) {
      return null;
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedAt = new Date();
    (alert as any).acknowledgedBy = new mongoose.Types.ObjectId(userId);
    await alert.save();

    return alert;
  }

  /**
   * Résout une alerte
   */
  async resolveAlert(
    alertId: string,
    userId: string,
    notes?: string
  ): Promise<IAlertDocument | null> {
    const alert = await Alert.findById(alertId);
    if (!alert) {
      return null;
    }

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = new Date();
    (alert as any).resolvedBy = new mongoose.Types.ObjectId(userId);
    if (notes) {
      alert.resolutionNotes = notes;
    }
    await alert.save();

    return alert;
  }

  /**
   * Récupère l'historique des alertes d'un véhicule
   */
  async getVehicleAlertHistory(
    vehicleId: string,
    limit = 50
  ): Promise<IAlertDocument[]> {
    return Alert.find({
      vehicleId: new mongoose.Types.ObjectId(vehicleId),
    })
      .sort({ triggeredAt: -1 })
      .limit(limit)
      .populate('geofenceId', 'name')
      .exec();
  }

  /**
   * Obtient les statistiques d'alertes pour le dashboard
   */
  async getAlertStats(organizationId: string): Promise<{
    total: number;
    active: number;
    acknowledged: number;
    bySeverity: Record<AlertSeverity, number>;
    byType: Record<AlertType, number>;
  }> {
    const orgId = getOrganizationObjectId(organizationId);

    // Agrégation pour les stats
    const [statusStats, severityStats, typeStats] = await Promise.all([
      // Stats par statut
      Alert.aggregate([
        { $match: { organizationId: orgId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Stats par sévérité (actives seulement)
      Alert.aggregate([
        {
          $match: {
            organizationId: orgId,
            status: { $in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
          },
        },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      // Stats par type (actives seulement)
      Alert.aggregate([
        {
          $match: {
            organizationId: orgId,
            status: { $in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
          },
        },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);

    // Formater les résultats
    const bySeverity: Record<AlertSeverity, number> = {
      [AlertSeverity.INFO]: 0,
      [AlertSeverity.WARNING]: 0,
      [AlertSeverity.CRITICAL]: 0,
    };
    for (const stat of severityStats) {
      bySeverity[stat._id as AlertSeverity] = stat.count;
    }

    const byType: Record<AlertType, number> = {
      [AlertType.GEOFENCE_EXIT]: 0,
      [AlertType.MOVEMENT_OUTSIDE_HOURS]: 0,
      [AlertType.BATTERY_LOW]: 0,
      [AlertType.DEVICE_OFFLINE]: 0,
      [AlertType.SPEED_EXCEEDED]: 0,
      [AlertType.POTENTIAL_THEFT]: 0,
    };
    for (const stat of typeStats) {
      byType[stat._id as AlertType] = stat.count;
    }

    let total = 0;
    let active = 0;
    let acknowledged = 0;
    for (const stat of statusStats) {
      total += stat.count;
      if (stat._id === AlertStatus.ACTIVE) active = stat.count;
      if (stat._id === AlertStatus.ACKNOWLEDGED) acknowledged = stat.count;
    }

    return {
      total,
      active,
      acknowledged,
      bySeverity,
      byType,
    };
  }

  /**
   * Supprime les alertes résolues plus anciennes qu'une certaine date
   * (Maintenance / nettoyage)
   */
  async cleanupOldAlerts(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await Alert.deleteMany({
      status: AlertStatus.RESOLVED,
      resolvedAt: { $lt: cutoffDate },
    });

    return result.deletedCount;
  }
}

// Export d'une instance singleton
export const alertService = new AlertService();
export default alertService;
