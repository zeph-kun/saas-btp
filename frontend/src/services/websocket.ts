import { io, Socket } from 'socket.io-client';
import { VehicleLocationUpdate, AlertNotification, Vehicle } from '@/types';

type LocationUpdateHandler = (update: VehicleLocationUpdate) => void;
type AlertHandler = (notification: AlertNotification) => void;
type PositionsHandler = (vehicles: Vehicle[]) => void;

/**
 * Service WebSocket pour la communication temps réel
 * Gère la connexion Socket.io et les événements
 */
class WebSocketService {
  private socket: Socket | null = null;
  private organizationId: string | null = null;
  
  // Event handlers
  private locationUpdateHandlers: Set<LocationUpdateHandler> = new Set();
  private newAlertHandlers: Set<AlertHandler> = new Set();
  private alertUpdateHandlers: Set<AlertHandler> = new Set();
  private positionsHandlers: Set<PositionsHandler> = new Set();

  /**
   * Connecte au serveur WebSocket
   */
  connect(organizationId: string): void {
    if (this.socket?.connected) {
      console.log('WebSocket déjà connecté');
      return;
    }

    this.organizationId = organizationId;
    
    this.socket = io({
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connecté');
      // Rejoindre la room de l'organisation
      this.socket?.emit('join:organization', organizationId);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Déconnecté:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Erreur de connexion:', error);
    });

    // Écouter les mises à jour de position
    this.socket.on('vehicle:location', (update: VehicleLocationUpdate) => {
      this.locationUpdateHandlers.forEach((handler) => handler(update));
    });

    // Écouter les nouvelles alertes
    this.socket.on('alert:new', (notification: AlertNotification) => {
      console.log('[Alert] Nouvelle alerte:', notification);
      this.newAlertHandlers.forEach((handler) => handler(notification));
    });

    // Écouter les mises à jour d'alertes
    this.socket.on('alert:updated', (notification: AlertNotification) => {
      this.alertUpdateHandlers.forEach((handler) => handler(notification));
    });

    // Écouter les positions de tous les véhicules (broadcast périodique)
    this.socket.on('vehicles:positions', (vehicles: Vehicle[]) => {
      this.positionsHandlers.forEach((handler) => handler(vehicles));
    });
  }

  /**
   * Déconnecte du serveur WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      if (this.organizationId) {
        this.socket.emit('leave:organization', this.organizationId);
      }
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Vérifie si connecté
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // ============================================
  // Abonnements aux événements
  // ============================================

  onLocationUpdate(handler: LocationUpdateHandler): () => void {
    this.locationUpdateHandlers.add(handler);
    return () => this.locationUpdateHandlers.delete(handler);
  }

  onNewAlert(handler: AlertHandler): () => void {
    this.newAlertHandlers.add(handler);
    return () => this.newAlertHandlers.delete(handler);
  }

  onAlertUpdate(handler: AlertHandler): () => void {
    this.alertUpdateHandlers.add(handler);
    return () => this.alertUpdateHandlers.delete(handler);
  }

  onPositionsUpdate(handler: PositionsHandler): () => void {
    this.positionsHandlers.add(handler);
    return () => this.positionsHandlers.delete(handler);
  }

  // ============================================
  // Envoi d'événements (pour simuler un tracker GPS)
  // ============================================

  sendLocationUpdate(vehicleId: string, location: { type: 'Point'; coordinates: [number, number] }): void {
    if (!this.socket?.connected) {
      console.warn('WebSocket non connecté');
      return;
    }

    this.socket.emit('tracker:location', {
      vehicleId,
      location,
      speed: Math.random() * 30,
      heading: Math.random() * 360,
      batteryLevel: 85 + Math.random() * 15,
    });
  }
}

// Export d'une instance singleton
export const wsService = new WebSocketService();
export default wsService;
