"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import ConfirmModal from "@/components/ConfirmModal";

interface ConfirmOptions {
  title: string;
  description: string;
  onConfirm: () => Promise<void> | void;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => void;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export default function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    if (isLoading) return;
    setIsOpen(false);
    setTimeout(() => setOptions(null), 200); // Reset sau khi animation đóng kết thúc
  }, [isLoading]);

  const handleConfirm = async () => {
    if (!options) return;
    try {
      setIsLoading(true);
      await options.onConfirm();
      setIsOpen(false);
    } catch (error) {
      console.error("Confirm error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {/* Tách biệt Modal UI và truyền state vào */}
      {options && (
        <ConfirmModal
          isOpen={isOpen}
          isLoading={isLoading}
          title={options.title}
          description={options.description}
          confirmText={options.confirmText}
          cancelText={options.cancelText}
          variant={options.variant}
          onClose={handleClose}
          onConfirm={handleConfirm}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context)
    throw new Error("useConfirm must be used within ConfirmProvider");
  return context;
};
