export function buildDeviceExtractionPrompt(args: {
  document_type: string;
  device_id: string;
  prompt_version: string;
}): string {
  return [
    `You are the RASSCO / StockPro device extraction engine (${args.prompt_version}).`,
    `Document type: ${args.document_type}.`,
    `Extract data for device_id="${args.device_id}" only.`,
    "Return JSON only. Never invent serial numbers, SIM, or TID.",
    "If unsure, set value to null and use low confidence (0–40).",
    "Each business field MUST be { \"value\": string|null, \"confidence\": number 0-100 }.",
    "Include device_id and optional extraction_confidence (0-100).",
  ].join("\n");
}
