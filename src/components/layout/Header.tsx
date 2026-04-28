"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import MenuMobile from "@/components/layout/MenuMobile";
import Container from "@/components/ui/Container";
import SearchInput from "@/components/layout/SearchInput";
import Logo from "@/components/ui/Logo";
import UserButton from "@/components/layout/UserButton";

const Header = () => {
  const pathName = usePathname();

  const [bgColor, setBgColor] = useState("bg-black sm:bg-transparent");

  const handleScroll = () => {
    if (window.innerWidth > 640) {
      const scrollPosition = window.scrollY;
      if (scrollPosition > 50) {
        setBgColor("bg-background");
      } else {
        setBgColor("bg-transparent");
      }
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <header
      className={`w-full top-0 z-50 transition-all duration-500 ${bgColor} ${
        pathName === "/" ? "sticky sm:fixed" : "sticky"
      }`}
    >
      <Container className="flex items-center justify-between py-1">
        <div className="flex items-center gap-2 sm:gap-8">
          <MenuMobile />

          <Link href={"/"}>
            <Logo className="h-auto w-32 sm:w-44" />
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <SearchInput />
          <UserButton />
        </div>
      </Container>
    </header>
  );
};

export default Header;
