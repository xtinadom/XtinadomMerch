import { revalidatePath } from "next/cache";
import { ADMIN_BACKEND_BASE_PATH, ADMIN_MAIN_BASE_PATH } from "@/lib/admin-dashboard-urls";

/** Invalidate both admin surfaces after mutations (tabs live on either path). */
export function revalidateAdminViews(): void {
  revalidatePath(ADMIN_MAIN_BASE_PATH);
  revalidatePath(ADMIN_BACKEND_BASE_PATH);
}
