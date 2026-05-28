import type { UploadedMaterial } from "@/lib/material-audit";

const PRIORITY_RULES: { pattern: RegExp; score: number }[] = [
  { pattern: /发票|fapiao|invoice|税|vat/i, score: 100 },
  { pattern: /支付|微信|支付宝|转账|payment|pay|receipt/i, score: 95 },
  { pattern: /订单|清单|明细|order|shopping|cart/i, score: 88 },
  { pattern: /签领|签收|领用/i, score: 82 },
  { pattern: /说明|情况|财务|statement/i, score: 75 },
  { pattern: /pdf/i, score: 40 },
];

function materialKey(m: UploadedMaterial): string {
  return `${m.name}::${m.b64.length}`;
}

function scoreMaterialName(name: string): number {
  let score = 10;
  for (const rule of PRIORITY_RULES) {
    if (rule.pattern.test(name)) {
      score = Math.max(score, rule.score);
    }
  }
  return score;
}

export function pickPrimaryMaterialsForMultimodal(
  images: UploadedMaterial[],
  max: number,
): { primary: UploadedMaterial[]; overflow: UploadedMaterial[] } {
  if (images.length <= max) {
    return { primary: [...images], overflow: [] };
  }

  const scored = images.map((img, index) => ({
    img,
    index,
    score: scoreMaterialName(img.name),
  }));

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  const primary = scored.slice(0, max).map((s) => s.img);
  const primaryKeys = new Set(primary.map(materialKey));
  const overflow = images.filter((img) => !primaryKeys.has(materialKey(img)));

  return { primary, overflow };
}
