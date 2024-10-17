import React from "react";

import Container from "@/components/Container";
import Sidebar from "@/components/Sidebar";

const MoviesLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <Container className="min-h-screen grid grid-cols-12 gap-4">
      {children}
      <Sidebar />
    </Container>
  );
};

export default MoviesLayout;
