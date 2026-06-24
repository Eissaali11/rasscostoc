import { 
  User, 
  UserSafe, 
  InsertUser, 
  SupervisorTechnician, 
  InsertSupervisorTechnician,
  SupervisorWarehouse,
  InsertSupervisorWarehouse
} from "@shared/schema";

/**
 * User Repository Interface
 * Defines contract for user data operations
 */
export interface IUserRepository {
  // Basic CRUD operations
  getUsers(): Promise<UserSafe[]>;
  getUser(id: string): Promise<UserSafe | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<UserSafe>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<UserSafe>;
  deleteUser(id: string): Promise<boolean>;

  // User role management
  getUsersByRole(role: string): Promise<UserSafe[]>;
  getUsersByRegion(regionId: string): Promise<UserSafe[]>;
  
  // Supervisor-Technician relationships
  assignTechnicianToSupervisor(supervisorId: string, technicianId: string): Promise<SupervisorTechnician>;
  removeTechnicianFromSupervisor(supervisorId: string, technicianId: string): Promise<boolean>;
  getSupervisorTechnicians(supervisorId: string): Promise<string[]>;
  getTechnicianSupervisor(technicianId: string): Promise<string | null>;

  // Supervisor-Warehouse relationships
  assignWarehouseToSupervisor(supervisorId: string, warehouseId: string): Promise<SupervisorWarehouse>;
  removeWarehouseFromSupervisor(supervisorId: string, warehouseId: string): Promise<boolean>;
  getSupervisorWarehouses(supervisorId: string): Promise<string[]>;
}