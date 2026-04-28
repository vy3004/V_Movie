"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  Suspense,
  useRef,
} from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";

interface AuthModalContextType {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(
  undefined,
);

// --- COMPONENT TÀNG HÌNH (LẮNG NGHE URL) ---
function AuthQueryListener({ onOpen }: { onOpen: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const hasTriggered = useRef(false); // Chống gọi 2 lần trong Strict Mode

  useEffect(() => {
    const authStatus = searchParams.get("auth");

    if (authStatus === "required" && !hasTriggered.current) {
      hasTriggered.current = true;

      onOpen();
      toast.error("Vui lòng đăng nhập để tiếp tục!");

      // Xóa ?auth=required khỏi URL
      const currentParams = new URLSearchParams(searchParams.toString());
      currentParams.delete("auth");
      const newUrl =
        pathname +
        (currentParams.toString() ? `?${currentParams.toString()}` : "");

      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, pathname, router, onOpen]);

  return null;
}

export default function AuthModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);

  return (
    <AuthModalContext.Provider value={{ isOpen, onOpen, onClose }}>
      <Suspense fallback={null}>
        <AuthQueryListener onOpen={onOpen} />
      </Suspense>

      {children}
    </AuthModalContext.Provider>
  );
}

export const useAuthModal = () => {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error("useAuthModal must be used within an AuthModalProvider");
  }
  return context;
};
