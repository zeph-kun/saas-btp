/**
 * Types partagés pour la plateforme SaaS BTP
 * Types GeoJSON et interfaces de base
 */

// ============================================
// Types GeoJSON (Standard RFC 7946)
// ============================================

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: [number, number][][]; // Array de rings (premier = extérieur)
}

// ============================================
// Enums
// ============================================

export enum VehicleType {
  MINI_PELLE = 'mini_pelle',
  CHARGEUSE = 'chargeuse',
  TRACTOPELLE = 'tractopelle',
  NACELLE = 'nacelle',
  COMPACTEUR = 'compacteur',
  GROUPE_ELECTROGENE = 'groupe_electrogene',
  REMORQUE = 'remorque',
  AUTRE = 'autre'
}

export enum VehicleStatus {
  DISPONIBLE = 'disponible',
  EN_LOCATION = 'en_location',
  EN_MAINTENANCE = 'en_maintenance',
  HORS_SERVICE = 'hors_service',
  VOLE = 'vole'
}

export enum ContractStatus {
  BROUILLON = 'brouillon',
  ACTIF = 'actif',
  TERMINE = 'termine',
  ANNULE = 'annule'
}

export enum AlertType {
  GEOFENCE_EXIT = 'geofence_exit',
  MOVEMENT_OUTSIDE_HOURS = 'movement_outside_hours',
  BATTERY_LOW = 'battery_low',
  DEVICE_OFFLINE = 'device_offline',
  SPEED_EXCEEDED = 'speed_exceeded',
  POTENTIAL_THEFT = 'potential_theft'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved'
}

// ============================================
// Interfaces de documents MongoDB
// ============================================

export interface IVehicle {
  _id?: string;
  // Identification
  registrationNumber: string; // Immatriculation ou numéro de série
  internalCode: string; // Code interne parc
  name: string;
  
  // Technique
  type: VehicleType;
  brand: string;
  vehicleModel: string; // Renommé pour éviter conflit avec Document.model
  year: number;
  serialNumber: string;
  
  // Localisation GPS
  location: GeoJSONPoint;
  lastLocationUpdate: Date;
  trackerId?: string; // ID du tracker GPS
  
  // État
  status: VehicleStatus;
  fuelLevel?: number; // Pourcentage
  engineHours?: number;
  odometer?: number;
  
  // Métadonnées
  organizationId: string;
  assignedGeofences: string[]; // IDs des geofences autorisées
  notes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IGeofence {
  _id?: string;
  name: string;
  description?: string;
  
  // Zone géographique (Polygon GeoJSON)
  area: GeoJSONPolygon;
  
  // Configuration
  isActive: boolean;
  allowedHours?: {
    start: string; // Format "HH:mm"
    end: string;
  };
  allowedDays?: number[]; // 0=Dimanche, 1=Lundi, etc.
  
  // Relations
  organizationId: string;
  assignedVehicles: string[];
  
  // Couleur pour l'affichage carte
  color: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IClient {
  _id?: string;
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
  siret?: string;
  
  organizationId: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IContract {
  _id?: string;
  contractNumber: string;
  
  // Relations
  clientId: string;
  vehicleId: string;
  organizationId: string;
  
  // Dates
  startDate: Date;
  endDate: Date;
  
  // Financier
  dailyRate: number;
  deposit?: number;
  totalAmount?: number;
  
  // Lieu de livraison (où le matériel doit rester)
  deliveryLocation: GeoJSONPoint;
  deliveryAddress: string;
  
  // Geofence associée automatiquement
  geofenceId?: string;
  
  status: ContractStatus;
  notes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IAlert {
  _id?: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  
  // Relations
  vehicleId: string;
  geofenceId?: string;
  organizationId: string;
  
  // Détails
  message: string;
  location: GeoJSONPoint;
  triggeredAt: Date;
  
  // Résolution
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrganization {
  _id?: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  
  // Configuration
  settings: {
    defaultGeofenceRadius: number;
    alertCheckInterval: number;
    timezone: string;
  };
  
  // Abonnement
  subscription: {
    plan: 'starter' | 'professional' | 'enterprise';
    maxVehicles: number;
    maxUsers: number;
    expiresAt: Date;
  };
  
  isActive: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IUser {
  _id?: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'operator' | 'viewer';
  
  organizationId: string;
  
  isActive: boolean;
  lastLoginAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Types pour les réponses API
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// Types pour les WebSockets
// ============================================

export interface VehicleLocationUpdate {
  vehicleId: string;
  location: GeoJSONPoint;
  timestamp: Date;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
}

export interface AlertNotification {
  alert: IAlert;
  vehicle: Pick<IVehicle, '_id' | 'name' | 'registrationNumber' | 'type'>;
}

// ============================================
// Types pour l'authentification
// ============================================

// Re-export depuis le modèle User
export { UserRole, Permission, DEFAULT_PERMISSIONS } from '../models/User.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
  role?: string;
}

