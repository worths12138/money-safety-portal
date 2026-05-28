import type { UploadedMaterial } from "@/lib/material-audit";

type CacheEntry = {
  materials: UploadedMaterial[];
  fileNames: string[];
  expiresAt: number;
};

const store = new Map<string, CacheEntry>();

/** 默认 3 小时；生产可在 .env 设置 MATERIAL_CACHE_TTL_SEC=86400（24h） */
const DEFAULT_TTL_SEC = 10_800;

function ttlMs(): number {
  const raw = Number.parseInt(process.env.MATERIAL_CACHE_TTL_SEC ?? String(DEFAULT_TTL_SEC), 10);
  const sec = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_SEC;
  return sec * 1000;
}

function purgeExpired(reportId?: string) {
  const now = Date.now();
  if (reportId) {
    const entry = store.get(reportId);
    if (entry && entry.expiresAt <= now) {
      store.delete(reportId);
    }
    return;
  }
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}

/** 提交/评估时暂存凭证，默认数小时内可预览与重新识图，到期自动销毁（PM2 重启会清空） */
export function saveServerMaterials(reportId: string, materials: UploadedMaterial[]): void {
  if (!reportId || materials.length === 0) return;
  purgeExpired();

  const vision = materials.filter((m) => m.b64?.trim());
  if (vision.length === 0) return;

  store.set(reportId, {
    materials: vision,
    fileNames: vision.map((m) => m.name),
    expiresAt: Date.now() + ttlMs(),
  });
}

export function loadServerMaterials(reportId: string): UploadedMaterial[] | null {
  purgeExpired(reportId);
  const entry = store.get(reportId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(reportId);
    return null;
  }
  return entry.materials;
}

export type MaterialCacheStatus = {
  available: boolean;
  count: number;
  ttlSecondsLeft: number;
  fileNames: string[];
};

export function getMaterialCacheStatus(reportId: string): MaterialCacheStatus {
  purgeExpired(reportId);
  const entry = store.get(reportId);
  if (!entry) {
    return { available: false, count: 0, ttlSecondsLeft: 0, fileNames: [] };
  }

  const ttlSecondsLeft = Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  if (ttlSecondsLeft <= 0) {
    store.delete(reportId);
    return { available: false, count: 0, ttlSecondsLeft: 0, fileNames: [] };
  }

  return {
    available: true,
    count: entry.materials.length,
    ttlSecondsLeft,
    fileNames: entry.fileNames,
  };
}

export function materialCacheTtlSec(): number {
  return Math.round(ttlMs() / 1000);
}

/** 教师/学生查看凭证时顺延暂存，避免审阅中途过期 */
export function touchServerMaterials(reportId: string, extendSec = 1800): void {
  const entry = store.get(reportId);
  if (!entry) return;
  const now = Date.now();
  if (entry.expiresAt <= now) {
    store.delete(reportId);
    return;
  }
  entry.expiresAt = Math.max(entry.expiresAt, now + extendSec * 1000);
}

export function getServerMaterialMeta(reportId: string) {
  purgeExpired(reportId);
  const entry = store.get(reportId);
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }
  return entry;
}

export function getServerMaterialByIndex(reportId: string, index: number): UploadedMaterial | null {
  const entry = getServerMaterialMeta(reportId);
  if (!entry || index < 0 || index >= entry.materials.length) {
    return null;
  }
  return entry.materials[index] ?? null;
}
