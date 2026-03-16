// Export de tous les services
export { LocationService, locationService } from './LocationService.js';
export { AlertService, alertService } from './AlertService.js';
export { VehicleService, vehicleService } from './VehicleService.js';
export { AuthService, authService, JWTPayload, AuthResult, RegisterData } from './AuthService.js';
export {
  UserService,
  userService,
  UserFilters,
  CreateUserData,
  UpdateUserData,
  UserNotFoundError,
  UserForbiddenError,
  UserConflictError,
} from './UserService.js';
export {
  ContractService,
  contractService,
  ContractFilters,
  CreateContractData,
  UpdateContractData,
  ContractNotFoundError,
  ContractConflictError,
  ContractValidationError,
} from './ContractService.js';
export {
  ClientService,
  clientService,
  ClientFilters,
  CreateClientData,
  UpdateClientData,
  ClientNotFoundError,
  ClientConflictError,
} from './ClientService.js';
