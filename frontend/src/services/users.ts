import { api } from '@/services/api';
import { ApiResponse } from '@/types';

export interface UserItem {
  _id: string;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
}

export interface UsersListResponse {
  users: UserItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class UsersService {
  async listUsers(params?: {
    search?: string;
    role?: string;
    page?: number;
    limit?: number;
  }): Promise<UsersListResponse> {
    const { data } = await api.get<ApiResponse<UserItem[]>>('/users', { params });
    if (data.success && data.data) {
      return {
        users: data.data,
        total: data.meta?.total ?? data.data.length,
        page: data.meta?.page ?? 1,
        limit: data.meta?.limit ?? 20,
        totalPages: data.meta?.totalPages ?? 1,
      };
    }
    throw new Error(data.error?.message ?? 'Erreur lors du chargement des utilisateurs');
  }

  async createUser(payload: CreateUserPayload): Promise<UserItem> {
    const { data } = await api.post<ApiResponse<UserItem>>('/users', payload);
    if (data.success && data.data) return data.data;
    throw new Error(data.error?.message ?? 'Erreur lors de la création');
  }

  async updateUser(id: string, payload: UpdateUserPayload): Promise<UserItem> {
    const { data } = await api.patch<ApiResponse<UserItem>>(`/users/${id}`, payload);
    if (data.success && data.data) return data.data;
    throw new Error(data.error?.message ?? 'Erreur lors de la mise à jour');
  }

  async deactivateUser(id: string): Promise<void> {
    const { data } = await api.delete<ApiResponse<null>>(`/users/${id}`);
    if (!data.success) throw new Error(data.error?.message ?? 'Erreur lors de la désactivation');
  }
}

export const usersService = new UsersService();
export default usersService;
