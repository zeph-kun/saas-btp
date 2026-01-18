import { Vehicle, Geofence, Alert, IVehicleDocument, IGeofenceDocument } from '../models/index.js';
import {
  GeoJSONPoint,
  AlertType,
  AlertSeverity,
  AlertStatus,
  VehicleStatus,
} from '../types/index.js';
import { getOrganizationObjectId } from '../config/index.js';

/**
 * Service de géolocalisation et détection de violations de zone
 * 
 * Ce service utilise les opérateurs géospatiaux natifs de MongoDB:
 * - $geoWithin: Vérifie si un point est à l'intérieur d'une géométrie
 * - $geoIntersects: Vérifie si deux géométries se chevauchent
 * - $near: Trouve les documents proches d'un point (triés par distance)
 * - $nearSphere: Comme $near mais sur une sphère (plus précis pour la Terre)
 */
export class LocationService {
  /**
   * Met à jour la position d'un véhicule et vérifie les violations de geofence
   * 
   * @param vehicleId - ID du véhicule
   * @param location - Nouvelle position GeoJSON
   * @returns Objet contenant le véhicule mis à jour et les éventuelles alertes générées
   */
  async updateVehicleLocation(
    vehicleId: string,
    location: GeoJSONPoint
  ): Promise<{
    vehicle: IVehicleDocument;
    alerts: { type: AlertType; severity: AlertSeverity; message: string }[];
  }> {
    const alerts: { type: AlertType; severity: AlertSeverity; message: string }[] = [];

    // 1. Récupérer le véhicule
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      throw new Error(`Véhicule non trouvé: ${vehicleId}`);
    }

    // 2. Sauvegarder l'ancienne position pour comparaison
    const previousLocation = vehicle.location;

    // 3. Mettre à jour la position
    vehicle.location = location;
    vehicle.lastLocationUpdate = new Date();
    await vehicle.save();

    // 4. Vérifier les violations de geofence si le véhicule est en location
    if (vehicle.status === VehicleStatus.EN_LOCATION) {
      const geofenceViolations = await this.checkGeofenceViolations(vehicle, location);
      alerts.push(...geofenceViolations);

      // 5. Vérifier les mouvements hors horaires
      const hourViolations = await this.checkAllowedHoursViolations(vehicle, location, previousLocation);
      alerts.push(...hourViolations);
    }

    return { vehicle, alerts };
  }

  /**
   * Vérifie si le véhicule est sorti de ses zones autorisées
   * 
   * LOGIQUE:
   * 1. Récupère toutes les geofences assignées au véhicule
   * 2. Utilise $geoIntersects pour vérifier si le point est dans chaque zone
   * 3. Si le véhicule n'est dans AUCUNE zone autorisée -> ALERTE
   */
  async checkGeofenceViolations(
    vehicle: IVehicleDocument,
    location: GeoJSONPoint
  ): Promise<{ type: AlertType; severity: AlertSeverity; message: string }[]> {
    const alerts: { type: AlertType; severity: AlertSeverity; message: string }[] = [];

    // Si le véhicule n'a pas de geofences assignées, pas de vérification
    if (!vehicle.assignedGeofences || vehicle.assignedGeofences.length === 0) {
      return alerts;
    }

    // Chercher les geofences actives qui contiennent ce point
    // On utilise $geoIntersects qui est plus flexible que $geoWithin pour les points
    const containingGeofences = await Geofence.find({
      _id: { $in: vehicle.assignedGeofences },
      isActive: true,
      area: {
        $geoIntersects: {
          $geometry: location,
        },
      },
    });

    // Si aucune geofence ne contient le véhicule, c'est une violation
    if (containingGeofences.length === 0) {
      // Récupérer les noms des zones autorisées pour le message
      const authorizedZones = await Geofence.find({
        _id: { $in: vehicle.assignedGeofences },
      }).select('name');

      const zoneNames = authorizedZones.map((z: { name: string }) => z.name).join(', ');

      alerts.push({
        type: AlertType.GEOFENCE_EXIT,
        severity: AlertSeverity.CRITICAL,
        message: `⚠️ ALERTE: ${vehicle.name} (${vehicle.registrationNumber}) est sorti de sa zone autorisée (${zoneNames}). Position: [${location.coordinates[1].toFixed(6)}, ${location.coordinates[0].toFixed(6)}]`,
      });
    }

    return alerts;
  }

  /**
   * Vérifie si un mouvement a eu lieu en dehors des horaires autorisés
   */
  async checkAllowedHoursViolations(
    vehicle: IVehicleDocument,
    newLocation: GeoJSONPoint,
    previousLocation: GeoJSONPoint
  ): Promise<{ type: AlertType; severity: AlertSeverity; message: string }[]> {
    const alerts: { type: AlertType; severity: AlertSeverity; message: string }[] = [];

    // Vérifier si la position a changé significativement (>10m)
    const distance = this.calculateDistance(
      previousLocation.coordinates,
      newLocation.coordinates
    );

    if (distance < 10) {
      return alerts; // Pas de mouvement significatif
    }

    // Récupérer les geofences avec restrictions horaires
    const restrictedGeofences = await Geofence.find({
      _id: { $in: vehicle.assignedGeofences },
      isActive: true,
      allowedHours: { $exists: true },
    });

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = now.getDay();

    for (const geofence of restrictedGeofences) {
      // Vérifier les jours autorisés
      if (geofence.allowedDays && geofence.allowedDays.length > 0) {
        if (!geofence.allowedDays.includes(currentDay)) {
          alerts.push({
            type: AlertType.MOVEMENT_OUTSIDE_HOURS,
            severity: AlertSeverity.WARNING,
            message: `🚨 Mouvement détecté pour ${vehicle.name} un jour non autorisé (${this.getDayName(currentDay)})`,
          });
          continue;
        }
      }

      // Vérifier les heures autorisées
      if (geofence.allowedHours) {
        const isOutsideHours =
          currentTime < geofence.allowedHours.start ||
          currentTime > geofence.allowedHours.end;

        if (isOutsideHours) {
          alerts.push({
            type: AlertType.MOVEMENT_OUTSIDE_HOURS,
            severity: AlertSeverity.CRITICAL,
            message: `🚨 ALERTE: Mouvement de ${vehicle.name} détecté à ${currentTime} (horaires autorisés: ${geofence.allowedHours.start}-${geofence.allowedHours.end})`,
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Trouve tous les véhicules dans un rayon donné autour d'un point
   * Utilise l'opérateur $near de MongoDB avec index 2dsphere
   * 
   * @param longitude - Longitude du centre
   * @param latitude - Latitude du centre
   * @param radiusMeters - Rayon de recherche en mètres
   * @param organizationId - Filtre par organisation
   */
  async findVehiclesNearPoint(
    longitude: number,
    latitude: number,
    radiusMeters: number,
    organizationId?: string
  ): Promise<IVehicleDocument[]> {
    const query: Record<string, unknown> = {
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: radiusMeters,
        },
      },
    };

    if (organizationId) {
      query.organizationId = getOrganizationObjectId(organizationId);
    }

    return Vehicle.find(query).exec();
  }

  /**
   * Trouve tous les véhicules à l'intérieur d'une geofence spécifique
   * Utilise $geoWithin pour une requête d'inclusion
   * 
   * @param geofenceId - ID de la geofence
   */
  async findVehiclesInGeofence(geofenceId: string): Promise<IVehicleDocument[]> {
    const geofence = await Geofence.findById(geofenceId);
    if (!geofence) {
      throw new Error(`Geofence non trouvée: ${geofenceId}`);
    }

    return Vehicle.find({
      location: {
        $geoWithin: {
          $geometry: geofence.area,
        },
      },
    }).exec();
  }

  /**
   * Trouve toutes les geofences contenant un point donné
   * Utile pour savoir dans quelles zones se trouve un véhicule
   */
  async findGeofencesContainingPoint(
    longitude: number,
    latitude: number,
    organizationId?: string
  ): Promise<IGeofenceDocument[]> {
    const query: Record<string, unknown> = {
      isActive: true,
      area: {
        $geoIntersects: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
        },
      },
    };

    if (organizationId) {
      query.organizationId = getOrganizationObjectId(organizationId);
    }

    return Geofence.find(query).exec();
  }

  /**
   * Calcule la distance entre deux points en mètres (formule de Haversine)
   */
  private calculateDistance(
    coord1: [number, number],
    coord2: [number, number]
  ): number {
    const [lng1, lat1] = coord1;
    const [lng2, lat2] = coord2;

    const R = 6371000; // Rayon de la Terre en mètres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Retourne le nom du jour en français
   */
  private getDayName(day: number): string {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[day];
  }

  /**
   * Détecte un vol potentiel basé sur plusieurs critères
   * - Sortie de zone + mouvement hors horaires = VOL POTENTIEL
   */
  async detectPotentialTheft(
    vehicleId: string,
    recentAlerts: { type: AlertType }[]
  ): Promise<boolean> {
    const hasGeofenceExit = recentAlerts.some(
      (a) => a.type === AlertType.GEOFENCE_EXIT
    );
    const hasOutsideHoursMovement = recentAlerts.some(
      (a) => a.type === AlertType.MOVEMENT_OUTSIDE_HOURS
    );

    // Si les deux conditions sont réunies dans un court laps de temps
    if (hasGeofenceExit && hasOutsideHoursMovement) {
      // Créer une alerte de vol potentiel
      const vehicle = await Vehicle.findById(vehicleId);
      if (vehicle) {
        await Alert.create({
          type: AlertType.POTENTIAL_THEFT,
          severity: AlertSeverity.CRITICAL,
          status: AlertStatus.ACTIVE,
          vehicleId: vehicle._id,
          organizationId: vehicle.organizationId,
          message: `🚨🚨 VOL POTENTIEL DÉTECTÉ: ${vehicle.name} (${vehicle.registrationNumber}) - Sortie de zone combinée à un mouvement hors horaires`,
          location: vehicle.location,
          triggeredAt: new Date(),
        });
        return true;
      }
    }

    return false;
  }
}

// Export d'une instance singleton
export const locationService = new LocationService();
export default locationService;
