import { api } from '@/services/api';
import type { ApiResponse } from '@/types';

export interface ClientItem {
  _id: string;
  id: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientPayload {
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

export type UpdateClientPayload = Partial<CreateClientPayload>;

export interface ClientsListResponse {
  clients: ClientItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class ClientsService {
  async listClients(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ClientsListResponse> {
    const { data } = await api.get<ApiResponse<ClientItem[]>>('/clients', { params });
    if (data.success && data.data) {
      return {
        clients: data.data,
        total: data.meta?.total ?? data.data.length,
        page: data.meta?.page ?? 1,
        limit: data.meta?.limit ?? 20,
        totalPages: data.meta?.totalPages ?? 1,
      };
    }
    throw new Error(data.error?.message ?? 'Erreur lors du chargement des clients');
  }

  async getClient(id: string): Promise<ClientItem> {
    const { data } = await api.get<ApiResponse<ClientItem>>(`/clients/${id}`);
    if (data.success && data.data) return data.data;
    throw new Error(data.error?.message ?? 'Client introuvable');
  }

  async createClient(payload: CreateClientPayload): Promise<ClientItem> {
    const { data } = await api.post<ApiResponse<ClientItem>>('/clients', payload);
    if (data.success && data.data) return data.data;
    throw new Error(data.error?.message ?? 'Erreur lors de la création');
  }

  async updateClient(id: string, payload: UpdateClientPayload): Promise<ClientItem> {
    const { data } = await api.patch<ApiResponse<ClientItem>>(`/clients/${id}`, payload);
    if (data.success && data.data) return data.data;
    throw new Error(data.error?.message ?? 'Erreur lors de la mise à jour');
  }

  async deleteClient(id: string): Promise<void> {
    const { data } = await api.delete<ApiResponse<null>>(`/clients/${id}`);
    if (!data.success) throw new Error(data.error?.message ?? 'Erreur lors de la suppression');
  }
}

export const clientsService = new ClientsService();
export default clientsService;
