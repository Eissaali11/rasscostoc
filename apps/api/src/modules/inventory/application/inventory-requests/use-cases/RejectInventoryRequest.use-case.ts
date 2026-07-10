import type { InventoryRequest } from "@shared/schema";
import type {
  IInventoryRequestApprovalUnitOfWork,
  InventoryRequestApprovalActor,
} from '../contracts/IInventoryRequestApprovalUnitOfWork';
import { InventoryRequestApprovalError } from './InventoryRequestApproval.errors';

export type RejectInventoryRequestInput = {
  requestId: string;
  adminNotes: string;
  actor: InventoryRequestApprovalActor;
};

export class RejectInventoryRequestUseCase {
  constructor(private readonly unitOfWork: IInventoryRequestApprovalUnitOfWork) {}

  async execute(input: RejectInventoryRequestInput): Promise<InventoryRequest> {
    return this.unitOfWork.execute(async ({
      inventoryRequestRepository,
      userRegionLookupRepository,
    }) => {
      if (input.actor.role === 'supervisor') {
        const request = await inventoryRequestRepository.getById(input.requestId);
        if (!request) {
          throw new InventoryRequestApprovalError(404, 'Request not found');
        }

        const technician = await userRegionLookupRepository.getById(request.technicianId);
        if (!technician || technician.regionId !== input.actor.regionId) {
          throw new InventoryRequestApprovalError(403, 'لا يمكنك معالجة طلبات من خارج منطقتك');
        }
      }

      const rejectedRequest = await inventoryRequestRepository.markRejected({
        id: input.requestId,
        adminNotes: input.adminNotes,
        respondedBy: input.actor.id,
        respondedAt: new Date(),
      });

      if (!rejectedRequest) {
        throw new InventoryRequestApprovalError(404, 'Request not found');
      }

      return rejectedRequest;
    });
  }
}
