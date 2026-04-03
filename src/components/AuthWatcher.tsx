"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuthModal } from "@/providers/AuthModalProvider";

export default function AuthWatcher() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { onOpen } = useAuthModal();

  useEffect(() => {
    // Nếu thấy trên URL có auth=required
    if (searchParams.get("auth") === "required") {
      onOpen(); // Bật Modal lên ngay lập tức

      // Xóa cái tham số trên URL đi cho đẹp (Clean URL)
      const params = new URLSearchParams(searchParams.toString());
      params.delete("auth");
      router.replace(
        `${pathname}${params.toString() ? `?${params.toString()}` : ""}`,
      );
    }
  }, [searchParams, onOpen, pathname, router]);

  return null; // Component này không hiển thị gì cả
}
