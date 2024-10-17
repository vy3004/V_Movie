"use client";

import { usePathname } from "next/navigation";

const Sidebar = () => {
  const pathName = usePathname();

  if (pathName === "/") return null;

  return <div className="border col-span-4">Sidebar</div>;
};

export default Sidebar;
