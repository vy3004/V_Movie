"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
};

const Pagination = ({ currentPage, totalPages }: PaginationProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const getPageNumbers = () => {
    const pageNumbers = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pageNumbers.push(1, 2, 3, "...", totalPages);
      } else if (currentPage > totalPages - 3) {
        pageNumbers.push(1, "...", totalPages - 2, totalPages - 1, totalPages);
      } else {
        pageNumbers.push(
          1,
          "...",
          currentPage - 1,
          currentPage,
          currentPage + 1,
          "...",
          totalPages
        );
      }
    }
    return pageNumbers;
  };

  const handlePageChange = (pageNumber: number | string) => {
    if (pageNumber === currentPage || pageNumber === "...") return;

    const current = new URLSearchParams(searchParams.toString());

    current.set("page", pageNumber.toString());
    router.push(`?${current.toString()}`);
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex items-center justify-center rounded-lg bg-background w-fit mx-auto p-1">
      <button
        aria-label="Trang trước"
        className={`px-1 sm:px-2 py-1 flex items-center justify-center ${
          currentPage === 1
            ? "opacity-50 cursor-not-allowed"
            : "hover:text-main"
        }`}
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeftIcon className="size-5" />
      </button>

      {pageNumbers.map((number, index) => (
        <button
          aria-label={`Trang ${number}`}
          key={index}
          className={`sm:px-3 py-1 rounded cursor-pointer ${
            currentPage === number ? "bg-primary" : "hover:text-main"
          } ${number === "..." ? "cursor-not-allowed px-0.5" : "px-2"}`}
          onClick={() => handlePageChange(number)}
          disabled={number === "..."}
        >
          {number}
        </button>
      ))}

      <button
        aria-label="Trang sau"
        className={`px-1 sm:px-2 py-1 flex items-center justify-center ${
          currentPage === totalPages
            ? "opacity-50 cursor-not-allowed"
            : "hover:text-main"
        }`}
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <ChevronRightIcon className="size-5" />
      </button>
    </div>
  );
};

export default Pagination;
