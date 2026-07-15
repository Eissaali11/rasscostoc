import type { MatchRecord } from "./types.js";

export interface TechnicianRepository {
  findById(technician_id: string): Promise<{ id: string; name: string } | null>;
  listAll(): Promise<Array<{ id: string; name: string }>>;
}

export interface RequestRepository {
  findById(request_id: number): Promise<{ request_id: number; incident?: string | null } | null>;
}

export interface ExecutionRepository {
  /** Primary lookup surface for cascade matching (read-only fixtures). */
  search(query: {
    serial_number?: string | null;
    sim_serial?: string | null;
    tid?: string | null;
    mobile?: string | null;
    merchant?: string | null;
    incident?: string | null;
    branch?: string | null;
    city?: string | null;
  }): Promise<MatchRecord[]>;
  listAll(): Promise<MatchRecord[]>;
}

export interface MerchantRepository {
  findByName(name: string): Promise<{ name: string; branch?: string; city?: string } | null>;
}

export interface BranchRepository {
  findByName(name: string): Promise<{ name: string; city?: string } | null>;
}

export type MatchingDataPorts = {
  technicians: TechnicianRepository;
  requests: RequestRepository;
  executions: ExecutionRepository;
  merchants: MerchantRepository;
  branches: BranchRepository;
};
