export type ConfidenceTone = "high" | "mid" | "low";

export function confidenceTone(confidence: number): ConfidenceTone {
  if (confidence >= 80) return "high";
  if (confidence >= 50) return "mid";
  return "low";
}

export function confidenceLabel(confidence: number): string {
  if (confidence >= 95) return "عالية جدًا";
  if (confidence >= 80) return "جيدة";
  if (confidence >= 50) return "متوسطة";
  return "ضعيفة";
}

/** Exit-criteria bands: مرتفع / متوسط / منخفض */
export function confidenceBandLabel(confidence: number): string {
  const tone = confidenceTone(confidence);
  if (tone === "high") return "مرتفع";
  if (tone === "mid") return "متوسط";
  return "منخفض";
}
