import { ReactNode } from "react";
import { requireAdminUser } from "@/services/admin-movie-indexer/admin.service";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminUser();
  return <>{children}</>;
}
