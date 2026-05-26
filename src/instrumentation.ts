import { scheduleInitialNotionSync } from "@/lib/startup-sync";

export async function register() {
  scheduleInitialNotionSync();
}
