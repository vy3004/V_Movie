"use client";

import React, { useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import SearchModal from "@/components/SearchModal";

const SearchInput = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center sm:justify-between size-8 sm:h-10 sm:w-52 sm:px-4 rounded-full sm:rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 transition-all group"
      >
        <span className="hidden sm:inline text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
          Tìm kiếm phim
        </span>

        <MagnifyingGlassIcon className="size-5 sm:size-6 group-hover:text-white transition-colors" />
      </button>

      {/* MODAL (ẨN BÊN DƯỚI) */}
      <SearchModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export default SearchInput;
