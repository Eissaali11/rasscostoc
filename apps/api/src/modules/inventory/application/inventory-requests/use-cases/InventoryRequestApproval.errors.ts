export class InventoryRequestApprovalError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'InventoryRequestApprovalError';
  }
}
