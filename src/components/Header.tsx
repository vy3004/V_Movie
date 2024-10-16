"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BookmarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

import Container from "@/components/Container";
import Menu from "@/components/Menu";

const Header = () => {
  const pathName = usePathname();

  const [bgColor, setBgColor] = useState("bg-transparent");

  const handleScroll = () => {
    const scrollPosition = window.scrollY;
    if (scrollPosition > 50) {
      setBgColor("bg-background");
    } else {
      setBgColor("bg-transparent");
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div
      className={`w-full top-0 z-50 transition-all duration-500 ${bgColor} ${
        pathName === "/" ? "fixed" : "sticky"
      }`}
    >
      <Container className="flex items-center justify-between py-1">
        <div className="flex items-center space-x-8">
          <Link href={"/"}>
            <Image
              className="w-44"
              src="/logo.png"
              alt="Logo"
              width={192}
              height={56.1}
              priority
            />
          </Link>

          <Menu />
        </div>

        <div className="flex items-center space-x-4 mt-1">
          <button>
            <MagnifyingGlassIcon className="h-6 w-6 hover:text-primary" />
          </button>
          <button>
            <BookmarkIcon className="h-6 w-6 hover:text-primary" />
          </button>
        </div>
      </Container>
    </div>
  );
};

export default Header;
