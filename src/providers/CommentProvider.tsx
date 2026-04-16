"use client";

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
} from "react";
import { useSearchParams } from "next/navigation";
import { CommentItem } from "@/types";

interface CommentContextType {
  activePath: string[];
  setActivePath: (path: string[]) => void;
  targetId: string | null;
  lineageData: CommentItem[]; // Khai báo lineageData
  setLineageData: (data: CommentItem[]) => void;
}

const CommentContext = createContext<CommentContextType | undefined>(undefined);

export function CommentProvider({
  children,
  movieSlug,
}: {
  children: React.ReactNode;
  movieSlug: string;
}) {
  const searchParams = useSearchParams();
  const targetId = searchParams.get("commentId");
  const [localActivePath, setLocalActivePath] = useState<string[]>([]);
  const [lineageData, setLineageData] = useState<CommentItem[]>([]); // State chứa cây gia phả

  // Reset khi đổi phim
  useEffect(() => {
    setLocalActivePath([]);
    setLineageData([]);
  }, [movieSlug]);

  const value = useMemo(
    () => ({
      activePath: localActivePath,
      setActivePath: setLocalActivePath,
      targetId,
      lineageData,
      setLineageData,
    }),
    [localActivePath, targetId, lineageData],
  );

  return (
    <CommentContext.Provider value={value}>{children}</CommentContext.Provider>
  );
}

export const useCommentContext = () => {
  const context = useContext(CommentContext);
  if (!context)
    throw new Error("useCommentContext must be used within CommentProvider");
  return context;
};
