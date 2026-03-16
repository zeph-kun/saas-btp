import { api } from '@/services/api';
import type { ApiResponse } from '@/types';
import { VehicleType, VehicleStatus } from '@/types';

export interface VehicleItem {
  _id: string;
  id: string;
  registrationNumber: string;
  internalCode: string;
  name: string;
  type: VehicleType;
  brand: string;
  model: string;
  year: number;
  serialNumber?: string;
  status: VehicleStatus;
  fuelLevel?: number;
  engineHours?: number;
  odometer?: number;
  trackerId?: string;
  notes?: string;
  location: { type: 'Point'; coordinates: [number, number] };
  lastLocationUpdate?: string;
  assignedGeofences: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehiclePayload {
  registrationNumber: string;
  internalCode: string;
  name: string;
  type: VehicleType;
  brand: string;
  model: string;
  year: number;
  serialNumber?: string;
  trackerId?: string;
  notes?: string;
}

export type UpdateVehiclePayload = Partial<CreateVehiclePayload>;

export interface VehiclesListResponse {
  vehicles: VehicleItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface VehicleStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

class VehiclesService {
  async listVehicles(params?: {
    status?: VehicleStatus;
    type?: VehicleType;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<VehiclesListResponse> {
    const { data } = await api.get<ApiResponse<VehicleItem[]>>('/vehicles', { params });
    if (data.success && data.data) {
      return {
        vehicles: data.data,
        total: data.meta?.total ?? data.data.length,
        page: data.meta?.page ?? 1,
        limit: data.meta?.limit ?? 20,
        totalPages: data.meta?.totalPages ?? 1,
      };
    }
    throw new Error(data.error?.message ?? 'Erreur lors du chargement des véhicules');
  }

  async getVehicle(id: string): Promise<VehicleItem> {
    const { data } = await api.get<ApiResponse<VehicleItem>>(`/vehicles/${id}`);
    if (data.success && data.data) return data.data;
    throw new Error(data.error?.message ?? 'Véhicule introuvable');
  }

  async getStats(): Promise<VehicleStats> {
    const { data } = await api.get<ApiResponse<VehicleStats>>('/vehicles/stats');
    if (data.success && data.data) return data.data;
    throw new Error(data.error?.message ?? 'Erreur lors du chargement des statistiques');
  }

  async createVehicle(payload: CreateVehiclePayload): Promise<VehicleItem> {
    const { data } = await api.post<ApiResponse<VehicleItem>>('/vehicles', payload);
    if (data.success && data.data) return data.data;
    throw new Error(data.error?.message ?? 'Erreur lors de la création');
  }

  async updateVehicle(id: string, payload: UpdateVehiclePayload): Promise<VehicleItem> {
    const { data } = await api.put<ApiResponse<VehicleItem>>(`/vehicles/${id}`, payload);
    if (data.success && data.data) return data.data;
    throw new Error(data.error?.message ?? 'Erreur lors de la mise à jour');
  }

  async updateStatus(id: string, status: VehicleStatus): Promise<VehicleItem> {
    const { data } = await api.patch<ApiResponse<VehicleItem>>(`/vehicles/${id}/status`, { status });
    if (data.success && data.data) return data.data;
    throw new Error(data.error?.message ?? 'Erreur lors du changement de statut');
  }

  async deleteVehicle(id: string): Promise<void> {
    const { data } = await api.delete<ApiResponse<null>>(`/vehicles/${id}`);
    if (!data.success) throw new Error(data.error?.message ?? 'Erreur lors de la suppression');
  }
}

export const vehiclesService = new VehiclesService();
export default vehiclesService;
