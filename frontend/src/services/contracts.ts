import { api } from '@/services/api';
import type { ApiResponse } from '@/types';
import { ContractStatus } from '@/types';

// ============================================
// Interfaces
// ============================================

export interface ContractItem {
  _id: string;
  id: string;
  contractNumber: string;
  clientId: string | { _id: string; companyName: string; contactName: string };
  vehicleId: string | { _id: string; name: string; registrationNumber: string; internalCode: string };
  startDate: string;
  endDate: string;
  dailyRate: number;
  deposit?: number;
  totalAmount?: number;
  deliveryAddress: string;
  deliveryLocation: { type: 'Point'; coordinates: [number, number] };
  geofenceId?: string;
  status: ContractStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractPayload {
  clientId: string;
  vehicleId: string;
  startDate: string;       // ISO date YYYY-MM-DD
  endDate: string;
  dailyRate: number;
  deposit?: number;
  deliveryAddress: string;
  deliveryLocation: { type: 'Point'; coordinates: [number, number] };
  geofenceId?: string;
  notes?: string;
}

export type UpdateContractPayload = Partial<CreateContractPayload> & { status?: ContractStatus };

export interface ContractsListResponse {
  contracts: ContractItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// Service
// ============================================

class ContractsService {
  async listContracts(params?: {
    status?: ContractStatus;
    clientId?: string;
    vehicleId?: string;
    page?: number;
    limit?: number;
  }): Promise<ContractsListResponse> {
    const { data } = await api.get<ApiResponse<ContractItem[]>>('/contracts', { params });
    if (data.success && data.data) {
      return {
        contracts: data.data,
        total: data.meta?.total ?? data.data.length,
        page: data.meta?.page ?? 1,
        limit: data.meta?.limit ?? 20,
        totalPages: data.meta?.totalPages ?? 1,
      };
    }
    throw new Error(data.error?.message ?? 'Erreur lors du chargement des contrats');
  }

  async getContract(id: string): Promise<ContractItem> {
    const { data } = await api.get<ApiResponse<ContractItem>>(`/contracts/${id}`);
    if (data.success && data.data) return data.data;
    throw new Error(data.error?.message ?? 'Contrat introuvable');
  }

  async createContract(payload: CreateContractPayload): Promise<ContractItem> {
    const { data } = await api.post<ApiResponse<ContractItem>>('/contracts', payload);
    if (data.success && data.data) return data.data;
    throw new Error(data.error?.message ?? 'Erreur lors de la création du contrat');
  }

  async updateContract(id: string, payload: UpdateContractPayload): Promise<ContractItem> {
    const { data } = await api.patch<ApiResponse<ContractItem>>(`/contracts/${id}`, payload);
    if (data.success && data.data) return data.data;
    throw new Error(data.error?.message ?? 'Erreur lors de la mise à jour du contrat');
  }

  async deleteContract(id: string): Promise<void> {
    const { data } = await api.delete<ApiResponse<null>>(`/contracts/${id}`);
    if (!data.success) throw new Error(data.error?.message ?? 'Erreur lors de la suppression du contrat');
  }
}

export const contractsService = new ContractsService();
export default contractsService;
