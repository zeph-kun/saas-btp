import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  ApiResponse,
  Vehicle,
  Geofence,
  Alert,
  VehicleStats,
  AlertStats,
  VehicleStatus,
} from '@/types';
import { authService } from './auth';

/**
 * Client API pour communiquer avec le backend
 */
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Intercepteur pour ajouter le token d'authentification
    this.client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      const token = authService.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Ajouter l'organization ID depuis l'utilisateur connecté
      const user = authService.getStoredUser();
      if (user) {
        config.headers['X-Organization-Id'] = user.organizationId;
      }
      
      return config;
    });

    // Intercepteur pour gérer les erreurs et le refresh token
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiResponse<unknown>>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        
        // Si erreur 401 et pas déjà en retry, tenter de rafraîchir le token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            const newToken = await authService.refreshTokens();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh échoué, déconnecter l'utilisateur
            authService.clearTokens();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }
        
        const message = error.response?.data?.error?.message || 'Erreur de connexion';
        console.error('API Error:', message);
        throw error;
      }
    );
  }

  // ============================================
  // Vehicles
  // ============================================

  async getVehicles(params?: {
    page?: number;
    limit?: number;
    status?: VehicleStatus;
    type?: string;
    search?: string;
  }): Promise<ApiResponse<Vehicle[]>> {
    const { data } = await this.client.get('/vehicles', { params });
    return data;
  }

  async getVehicle(id: string): Promise<ApiResponse<Vehicle>> {
    const { data } = await this.client.get(`/vehicles/${id}`);
    return data;
  }

  async getVehicleDetails(id: string): Promise<ApiResponse<{
    vehicle: Vehicle;
    contract: unknown;
    client: unknown;
    recentAlerts: Alert[];
  }>> {
    const { data } = await this.client.get(`/vehicles/${id}/details`);
    return data;
  }

  async createVehicle(vehicleData: Partial<Vehicle>): Promise<ApiResponse<Vehicle>> {
    const { data } = await this.client.post('/vehicles', vehicleData);
    return data;
  }

  async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<ApiResponse<Vehicle>> {
    const { data } = await this.client.put(`/vehicles/${id}`, updates);
    return data;
  }

  async updateVehicleStatus(id: string, status: VehicleStatus): Promise<ApiResponse<Vehicle>> {
    const { data } = await this.client.patch(`/vehicles/${id}/status`, { status });
    return data;
  }

  async getVehicleStats(): Promise<ApiResponse<VehicleStats>> {
    const { data } = await this.client.get('/vehicles/stats');
    return data;
  }

  async findVehiclesNear(longitude: number, latitude: number, radiusMeters: number): Promise<ApiResponse<Vehicle[]>> {
    const { data } = await this.client.get('/vehicles/near', {
      params: { longitude, latitude, radiusMeters },
    });
    return data;
  }

  // ============================================
  // Geofences
  // ============================================

  async getGeofences(isActive?: boolean): Promise<ApiResponse<Geofence[]>> {
    const { data } = await this.client.get('/geofences', {
      params: isActive !== undefined ? { isActive } : undefined,
    });
    return data;
  }

  async getGeofence(id: string): Promise<ApiResponse<Geofence>> {
    const { data } = await this.client.get(`/geofences/${id}`);
    return data;
  }

  async createGeofence(geofenceData: Partial<Geofence>): Promise<ApiResponse<Geofence>> {
    const { data } = await this.client.post('/geofences', geofenceData);
    return data;
  }

  async updateGeofence(id: string, updates: Partial<Geofence>): Promise<ApiResponse<Geofence>> {
    const { data } = await this.client.put(`/geofences/${id}`, updates);
    return data;
  }

  async deleteGeofence(id: string): Promise<ApiResponse<null>> {
    const { data } = await this.client.delete(`/geofences/${id}`);
    return data;
  }

  // ============================================
  // Alerts
  // ============================================

  async getActiveAlerts(): Promise<ApiResponse<Alert[]>> {
    const { data } = await this.client.get('/alerts');
    return data;
  }

  async getAlertStats(): Promise<ApiResponse<AlertStats>> {
    const { data } = await this.client.get('/alerts/stats');
    return data;
  }

  async getVehicleAlerts(vehicleId: string, limit?: number): Promise<ApiResponse<Alert[]>> {
    const { data } = await this.client.get(`/alerts/vehicle/${vehicleId}`, {
      params: limit ? { limit } : undefined,
    });
    return data;
  }

  async acknowledgeAlert(id: string): Promise<ApiResponse<Alert>> {
    const { data } = await this.client.patch(`/alerts/${id}/acknowledge`);
    return data;
  }

  async resolveAlert(id: string, resolutionNotes?: string): Promise<ApiResponse<Alert>> {
    const { data } = await this.client.patch(`/alerts/${id}/resolve`, { resolutionNotes });
    return data;
  }

  // ============================================
  // Health
  // ============================================

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const { data } = await this.client.get('/health');
    return data;
  }
}

// Export d'une instance singleton
export const api = new ApiClient();
export default api;
