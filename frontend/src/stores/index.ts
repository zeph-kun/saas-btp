import { create } from 'zustand';
import { api, wsService, authService } from '@/services';
import {
  Vehicle,
  Alert,
  Geofence,
  VehicleStats,
  AlertStats,
  VehicleLocationUpdate,
  AlertNotification,
  VehicleStatus,
  User,
  LoginRequest,
  RegisterRequest,
  Permission,
} from '@/types';

// ============================================
// Auth Store
// ============================================

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  checkAuth: () => void;
  hasPermission: (permission: Permission) => boolean;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: authService.getStoredUser(),
  isAuthenticated: authService.isAuthenticated(),
  isLoading: false,
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login(credentials);
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
      // Initialiser la connexion WebSocket après login
      initializeWebSocket(response.user.organizationId);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur de connexion',
        isLoading: false,
      });
      throw error;
    }
  },

  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.register(userData);
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
      initializeWebSocket(response.user.organizationId);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de l\'inscription',
        isLoading: false,
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
      wsService.disconnect();
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  refreshUser: async () => {
    try {
      const user = await authService.getProfile();
      set({ user });
    } catch (error) {
      // Si erreur, déconnecter
      set({ user: null, isAuthenticated: false });
    }
  },

  checkAuth: () => {
    const isAuthenticated = authService.isAuthenticated();
    const user = authService.getStoredUser();
    set({ isAuthenticated, user });
    
    // Si authentifié, initialiser WebSocket
    if (isAuthenticated && user) {
      initializeWebSocket(user.organizationId);
    }
  },

  hasPermission: (permission) => {
    const { user } = get();
    if (!user) return false;
    return user.permissions.includes(permission);
  },

  clearError: () => set({ error: null }),
}));

// ============================================
// Vehicle Store
// ============================================

interface VehicleState {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  stats: VehicleStats | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchVehicles: (params?: { status?: VehicleStatus; search?: string }) => Promise<void>;
  fetchVehicle: (id: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  updateVehicleLocation: (update: VehicleLocationUpdate) => void;
  setSelectedVehicle: (vehicle: Vehicle | null) => void;
  clearError: () => void;
}

export const useVehicleStore = create<VehicleState>((set, get) => ({
  vehicles: [],
  selectedVehicle: null,
  stats: null,
  isLoading: false,
  error: null,

  fetchVehicles: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getVehicles(params);
      if (response.success && response.data) {
        set({ vehicles: response.data, isLoading: false });
      }
    } catch (error) {
      set({ error: 'Erreur lors du chargement des véhicules', isLoading: false });
    }
  },

  fetchVehicle: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getVehicle(id);
      if (response.success && response.data) {
        set({ selectedVehicle: response.data, isLoading: false });
      }
    } catch (error) {
      set({ error: 'Erreur lors du chargement du véhicule', isLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const response = await api.getVehicleStats();
      if (response.success && response.data) {
        set({ stats: response.data });
      }
    } catch (error) {
      console.error('Erreur stats:', error);
    }
  },

  updateVehicleLocation: (update: VehicleLocationUpdate) => {
    const { vehicles } = get();
    const updatedVehicles = vehicles.map((v) =>
      v._id === update.vehicleId
        ? { ...v, location: update.location, lastLocationUpdate: update.timestamp }
        : v
    );
    set({ vehicles: updatedVehicles });
  },

  setSelectedVehicle: (vehicle) => set({ selectedVehicle: vehicle }),
  clearError: () => set({ error: null }),
}));

// ============================================
// Alert Store
// ============================================

interface AlertState {
  alerts: Alert[];
  stats: AlertStats | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchAlerts: () => Promise<void>;
  fetchStats: () => Promise<void>;
  addAlert: (notification: AlertNotification) => void;
  updateAlert: (notification: AlertNotification) => void;
  acknowledgeAlert: (id: string) => Promise<void>;
  resolveAlert: (id: string, notes?: string) => Promise<void>;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  stats: null,
  isLoading: false,
  error: null,

  fetchAlerts: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getActiveAlerts();
      if (response.success && response.data) {
        set({ alerts: response.data, isLoading: false });
      }
    } catch (error) {
      set({ error: 'Erreur lors du chargement des alertes', isLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const response = await api.getAlertStats();
      if (response.success && response.data) {
        set({ stats: response.data });
      }
    } catch (error) {
      console.error('Erreur stats alertes:', error);
    }
  },

  addAlert: (notification: AlertNotification) => {
    const { alerts } = get();
    // Ajouter l'alerte au début de la liste
    set({ alerts: [notification.alert, ...alerts] });
  },

  updateAlert: (notification: AlertNotification) => {
    const { alerts } = get();
    const updatedAlerts = alerts.map((a) =>
      a._id === notification.alert._id ? notification.alert : a
    );
    set({ alerts: updatedAlerts });
  },

  acknowledgeAlert: async (id: string) => {
    try {
      const response = await api.acknowledgeAlert(id);
      if (response.success && response.data) {
        const { alerts } = get();
        const updatedAlerts = alerts.map((a) =>
          a._id === id ? response.data! : a
        );
        set({ alerts: updatedAlerts });
      }
    } catch (error) {
      console.error('Erreur acquittement:', error);
    }
  },

  resolveAlert: async (id: string, notes?: string) => {
    try {
      const response = await api.resolveAlert(id, notes);
      if (response.success && response.data) {
        // Retirer l'alerte résolue de la liste
        const { alerts } = get();
        set({ alerts: alerts.filter((a) => a._id !== id) });
      }
    } catch (error) {
      console.error('Erreur résolution:', error);
    }
  },
}));

// ============================================
// Geofence Store
// ============================================

interface GeofenceState {
  geofences: Geofence[];
  isLoading: boolean;
  error: string | null;
  
  fetchGeofences: () => Promise<void>;
}

export const useGeofenceStore = create<GeofenceState>((set) => ({
  geofences: [],
  isLoading: false,
  error: null,

  fetchGeofences: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getGeofences(true);
      if (response.success && response.data) {
        set({ geofences: response.data, isLoading: false });
      }
    } catch (error) {
      set({ error: 'Erreur lors du chargement des geofences', isLoading: false });
    }
  },
}));

// ============================================
// WebSocket connection initializer
// ============================================

export function initializeWebSocket(organizationId: string): void {
  wsService.connect(organizationId);

  // S'abonner aux mises à jour de position
  wsService.onLocationUpdate((update) => {
    useVehicleStore.getState().updateVehicleLocation(update);
  });

  // S'abonner aux nouvelles alertes
  wsService.onNewAlert((notification) => {
    useAlertStore.getState().addAlert(notification);
  });

  // S'abonner aux mises à jour d'alertes
  wsService.onAlertUpdate((notification) => {
    useAlertStore.getState().updateAlert(notification);
  });
}
