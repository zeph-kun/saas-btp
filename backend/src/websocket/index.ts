import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { locationService, alertService } from '../services/index.js';
import { Vehicle } from '../models/index.js';
import {
  GeoJSONPoint,
  VehicleLocationUpdate,
  AlertNotification,
} from '../types/index.js';
import config from '../config/index.js';

/**
 * Configuration et gestion du serveur WebSocket
 * Utilise Socket.io pour la communication temps réel
 * 
 * ÉVÉNEMENTS:
 * 
 * Client -> Serveur:
 * - join:organization     : Rejoindre la room d'une organisation
 * - tracker:location      : Mise à jour de position d'un tracker GPS
 * 
 * Serveur -> Client:
 * - vehicle:location      : Diffuse les nouvelles positions
 * - alert:new             : Nouvelle alerte de sécurité
 * - alert:updated         : Alerte mise à jour (acquittée/résolue)
 */
export class WebSocketServer {
  private io: Server;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    this.startLocationBroadcast();
  }

  /**
   * Configure les gestionnaires d'événements Socket.io
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`[WebSocket] Client connecté: ${socket.id}`);

      // Rejoindre la room de l'organisation
      socket.on('join:organization', (organizationId: string) => {
        socket.join(`org:${organizationId}`);
        console.log(`[WebSocket] Socket ${socket.id} a rejoint org:${organizationId}`);
      });

      // Quitter la room
      socket.on('leave:organization', (organizationId: string) => {
        socket.leave(`org:${organizationId}`);
      });

      // Réception d'une mise à jour de position d'un tracker GPS
      socket.on('tracker:location', async (data: {
        vehicleId: string;
        location: GeoJSONPoint;
        speed?: number;
        heading?: number;
        batteryLevel?: number;
      }) => {
        try {
          await this.handleLocationUpdate(data);
        } catch (error) {
          console.error('Erreur lors de la mise à jour de position:', error);
          socket.emit('error', { message: 'Erreur de mise à jour de position' });
        }
      });

      // Déconnexion
      socket.on('disconnect', (reason) => {
        console.log(`[WebSocket] Client déconnecté: ${socket.id} (${reason})`);
      });
    });
  }

  /**
   * Traite une mise à jour de position et diffuse les alertes si nécessaire
   */
  private async handleLocationUpdate(data: {
    vehicleId: string;
    location: GeoJSONPoint;
    speed?: number;
    heading?: number;
    batteryLevel?: number;
  }): Promise<void> {
    const { vehicleId, location, speed, heading, batteryLevel } = data;

    // Utiliser le service de localisation pour la mise à jour + vérification
    const result = await locationService.updateVehicleLocation(vehicleId, location);
    
    // Récupérer l'organisation du véhicule
    const organizationId = result.vehicle.organizationId.toString();

    // Diffuser la nouvelle position à tous les clients de l'organisation
    const locationUpdate: VehicleLocationUpdate = {
      vehicleId,
      location,
      timestamp: new Date(),
      speed,
      heading,
      batteryLevel,
    };

    this.io.to(`org:${organizationId}`).emit('vehicle:location', locationUpdate);

    // Si des alertes ont été générées, les créer et les diffuser
    if (result.alerts.length > 0) {
      for (const alertData of result.alerts) {
        const alertNotification = await alertService.createAlert(
          vehicleId,
          alertData.type,
          alertData.severity,
          alertData.message,
          location
        );

        // Diffuser l'alerte
        this.io.to(`org:${organizationId}`).emit('alert:new', alertNotification);
      }

      // Vérifier si c'est un vol potentiel (combinaison de facteurs)
      const isTheft = await locationService.detectPotentialTheft(vehicleId, result.alerts);
      if (isTheft) {
        console.log(`[Alert] VOL POTENTIEL DETECTE pour le véhicule ${vehicleId}`);
      }
    }
  }

  /**
   * Diffuse les positions de tous les véhicules périodiquement
   * Utile pour les clients qui se connectent et veulent l'état actuel
   */
  private startLocationBroadcast(): void {
    // Toutes les 30 secondes, diffuser les positions de tous les véhicules
    setInterval(async () => {
      try {
        // Récupérer tous les véhicules groupés par organisation
        const vehicles = await Vehicle.find({}, {
          _id: 1,
          location: 1,
          status: 1,
          organizationId: 1,
          lastLocationUpdate: 1,
        }).lean();

        // Grouper par organisation
        const byOrg = new Map<string, typeof vehicles>();
        for (const vehicle of vehicles) {
          const orgId = vehicle.organizationId.toString();
          if (!byOrg.has(orgId)) {
            byOrg.set(orgId, []);
          }
          byOrg.get(orgId)!.push(vehicle);
        }

        // Diffuser à chaque organisation
        for (const [orgId, orgVehicles] of byOrg) {
          this.io.to(`org:${orgId}`).emit('vehicles:positions', orgVehicles);
        }
      } catch (error) {
        console.error('Erreur lors de la diffusion des positions:', error);
      }
    }, 30000); // 30 secondes
  }

  /**
   * Émet une alerte à une organisation spécifique
   */
  public emitAlert(organizationId: string, alert: AlertNotification): void {
    this.io.to(`org:${organizationId}`).emit('alert:new', alert);
  }

  /**
   * Émet une mise à jour d'alerte (acquittée/résolue)
   */
  public emitAlertUpdate(organizationId: string, alert: AlertNotification): void {
    this.io.to(`org:${organizationId}`).emit('alert:updated', alert);
  }

  /**
   * Retourne l'instance Socket.io pour une utilisation externe
   */
  public getIO(): Server {
    return this.io;
  }
}

// Variable pour stocker l'instance
let wsServer: WebSocketServer | null = null;

/**
 * Initialise le serveur WebSocket
 */
export function initWebSocket(httpServer: HttpServer): WebSocketServer {
  wsServer = new WebSocketServer(httpServer);
  return wsServer;
}

/**
 * Récupère l'instance du serveur WebSocket
 */
export function getWebSocketServer(): WebSocketServer | null {
  return wsServer;
}

export default WebSocketServer;
