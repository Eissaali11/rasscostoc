import type { MatchRecord } from "./types.js";
import type {
  BranchRepository,
  ExecutionRepository,
  MatchingDataPorts,
  MerchantRepository,
  RequestRepository,
  TechnicianRepository,
} from "./repositories.js";

function norm(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim().toLowerCase();
  return t.length ? t : null;
}

function eq(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = norm(a);
  const y = norm(b);
  return !!x && !!y && x === y;
}

export class InMemoryTechnicianRepository implements TechnicianRepository {
  constructor(private readonly rows: Array<{ id: string; name: string }> = []) {}
  async findById(id: string) {
    return this.rows.find((r) => r.id === id) ?? null;
  }
  async listAll() {
    return [...this.rows];
  }
}

export class InMemoryRequestRepository implements RequestRepository {
  constructor(
    private readonly rows: Array<{ request_id: number; incident?: string | null }> = [],
  ) {}
  async findById(request_id: number) {
    return this.rows.find((r) => r.request_id === request_id) ?? null;
  }
}

export class InMemoryExecutionRepository implements ExecutionRepository {
  constructor(private readonly rows: MatchRecord[] = []) {}

  async listAll() {
    return [...this.rows];
  }

  async search(query: {
    serial_number?: string | null;
    sim_serial?: string | null;
    tid?: string | null;
    mobile?: string | null;
    merchant?: string | null;
    incident?: string | null;
    branch?: string | null;
    city?: string | null;
  }): Promise<MatchRecord[]> {
    return this.rows.filter((r) => {
      if (query.serial_number && eq(r.serial_number, query.serial_number)) return true;
      if (query.sim_serial && eq(r.sim_serial, query.sim_serial)) return true;
      if (query.tid && eq(r.tid, query.tid)) return true;
      if (query.mobile && eq(r.mobile, query.mobile)) return true;
      if (query.merchant && eq(r.merchant, query.merchant)) return true;
      if (query.incident && eq(r.incident, query.incident)) return true;
      if (query.branch && eq(r.branch, query.branch)) return true;
      if (query.city && eq(r.city, query.city)) return true;
      return false;
    });
  }
}

export class InMemoryMerchantRepository implements MerchantRepository {
  constructor(
    private readonly rows: Array<{ name: string; branch?: string; city?: string }> = [],
  ) {}
  async findByName(name: string) {
    const n = norm(name);
    return this.rows.find((r) => norm(r.name) === n) ?? null;
  }
}

export class InMemoryBranchRepository implements BranchRepository {
  constructor(private readonly rows: Array<{ name: string; city?: string }> = []) {}
  async findByName(name: string) {
    const n = norm(name);
    return this.rows.find((r) => norm(r.name) === n) ?? null;
  }
}

export function createInMemoryMatchingPorts(data: {
  technicians?: Array<{ id: string; name: string }>;
  requests?: Array<{ request_id: number; incident?: string | null }>;
  executions?: MatchRecord[];
  merchants?: Array<{ name: string; branch?: string; city?: string }>;
  branches?: Array<{ name: string; city?: string }>;
}): MatchingDataPorts {
  return {
    technicians: new InMemoryTechnicianRepository(data.technicians ?? []),
    requests: new InMemoryRequestRepository(data.requests ?? []),
    executions: new InMemoryExecutionRepository(data.executions ?? []),
    merchants: new InMemoryMerchantRepository(data.merchants ?? []),
    branches: new InMemoryBranchRepository(data.branches ?? []),
  };
}

/** Alias — fixtures are in-memory seeded datasets. */
export const createFixtureMatchingPorts = createInMemoryMatchingPorts;
