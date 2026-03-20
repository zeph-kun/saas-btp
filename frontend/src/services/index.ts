export { api } from './api';
export { wsService } from './websocket';
export { authService } from './auth';
export { usersService } from './users';
export type { UserItem, CreateUserPayload, UpdateUserPayload, UsersListResponse } from './users';
export { vehiclesService } from './vehicles';
export type {
  VehicleItem,
  CreateVehiclePayload,
  UpdateVehiclePayload,
  VehiclesListResponse,
  VehicleStats,
} from './vehicles';
export { contractsService } from './contracts';
export type {
  ContractItem,
  CreateContractPayload,
  UpdateContractPayload,
  ContractsListResponse,
} from './contracts';
export { clientsService } from './clients';
export type {
  ClientItem,
  CreateClientPayload,
  UpdateClientPayload,
  ClientsListResponse,
} from './clients';

