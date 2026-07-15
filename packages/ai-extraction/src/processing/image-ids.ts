/** Stable image identity — never rely on array order alone. */

export function createStableImageId(args: {
  document_id: string;
  page: number;
  region_index: number;
}): string {
  const doc = args.document_id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `img:${doc}:p${args.page}:r${args.region_index}`;
}

export function createRegionId(page: number, region_index: number): string {
  return `p${page}-r${region_index}`;
}
