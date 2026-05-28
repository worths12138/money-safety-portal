import type { QueueItem } from "@/lib/site-data";

export type TeacherDashboardQueueItem = QueueItem & {
  summary: string;
  submittedAtIso: string;
  riskTier: string;
  riskTierLabel: string;
};
