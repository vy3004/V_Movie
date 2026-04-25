import React from "react";
import dynamic from "next/dynamic";

import Container from "@/components/Container";
const Sidebar = dynamic(() => import("@/components/Sidebar"), { ssr: false });

const MoviesLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <Container className="min-h-screen grid grid-cols-12 gap-4">
      {children}
      <Sidebar />
    </Container>
  );
};

export default MoviesLayout;
