/**
 * Types partagés pour le frontend
 * Correspondant aux types du backend
 */

// ============================================
// Types GeoJSON
// ============================================

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
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
// Interfaces des entités
// ============================================

export interface Vehicle {
  id: string;
  _id: string;
  registrationNumber: string;
  internalCode: string;
  name: string;
  type: VehicleType;
  brand: string;
  model: string;
  year: number;
  serialNumber: string;
  location: GeoJSONPoint;
  lastLocationUpdate: string;
  trackerId?: string;
  status: VehicleStatus;
  fuelLevel?: number;
  engineHours?: number;
  odometer?: number;
  organizationId: string;
  assignedGeofences: Geofence[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Geofence {
  id: string;
  _id: string;
  name: string;
  description?: string;
  area: GeoJSONPolygon;
  isActive: boolean;
  allowedHours?: {
    start: string;
    end: string;
  };
  allowedDays?: number[];
  organizationId: string;
  assignedVehicles: string[];
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  _id: string;
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
}

export interface Contract {
  id: string;
  _id: string;
  contractNumber: string;
  clientId: string | Client;
  vehicleId: string;
  startDate: string;
  endDate: string;
  dailyRate: number;
  deposit?: number;
  totalAmount?: number;
  deliveryLocation: GeoJSONPoint;
  deliveryAddress: string;
  geofenceId?: string;
  status: ContractStatus;
  notes?: string;
}

export interface Alert {
  id: string;
  _id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  vehicleId: string | Vehicle;
  geofenceId?: string | Geofence;
  organizationId: string;
  message: string;
  location: GeoJSONPoint;
  triggeredAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

// ============================================
// Types API Response
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

// ============================================
// Types WebSocket
// ============================================

export interface VehicleLocationUpdate {
  vehicleId: string;
  location: GeoJSONPoint;
  timestamp: string;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
}

export interface AlertNotification {
  alert: Alert;
  vehicle: Pick<Vehicle, '_id' | 'name' | 'registrationNumber' | 'type'>;
}

// ============================================
// Types pour les statistiques
// ============================================

export interface VehicleStats {
  total: number;
  byStatus: Record<VehicleStatus, number>;
  byType: Record<string, number>;
}

export interface AlertStats {
  total: number;
  active: number;
  acknowledged: number;
  bySeverity: Record<AlertSeverity, number>;
  byType: Record<AlertType, number>;
}

// ============================================
// Types pour l'authentification
// ============================================

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  OPERATOR = 'operator',
}

export enum Permission {
  VEHICLES_READ = 'vehicles:read',
  VEHICLES_CREATE = 'vehicles:create',
  VEHICLES_UPDATE = 'vehicles:update',
  VEHICLES_DELETE = 'vehicles:delete',
  VEHICLES_LOCATION = 'vehicles:location',
  GEOFENCES_READ = 'geofences:read',
  GEOFENCES_CREATE = 'geofences:create',
  GEOFENCES_UPDATE = 'geofences:update',
  GEOFENCES_DELETE = 'geofences:delete',
  ALERTS_READ = 'alerts:read',
  ALERTS_ACKNOWLEDGE = 'alerts:acknowledge',
  ALERTS_RESOLVE = 'alerts:resolve',
  CLIENTS_READ = 'clients:read',
  CLIENTS_CREATE = 'clients:create',
  CLIENTS_UPDATE = 'clients:update',
  CLIENTS_DELETE = 'clients:delete',
  CONTRACTS_READ = 'contracts:read',
  CONTRACTS_CREATE = 'contracts:create',
  CONTRACTS_UPDATE = 'contracts:update',
  CONTRACTS_DELETE = 'contracts:delete',
  USERS_READ = 'users:read',
  USERS_CREATE = 'users:create',
  USERS_UPDATE = 'users:update',
  USERS_DELETE = 'users:delete',
  ORGANIZATION_SETTINGS = 'organization:settings',
}

export interface User {
  id: string;
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  permissions: Permission[];
  organizationId: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: User;
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
  role?: UserRole;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
