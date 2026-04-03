"use client";

import React, { createContext, useContext, useState } from "react";

interface AuthModalContextType {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(
  undefined,
);

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
      {children}
    </AuthModalContext.Provider>
  );
}

export const useAuthModal = () => {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error("useAuthModal must be used within in AuthModalProvider");
  }
  return context;
};
