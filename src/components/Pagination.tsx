import Link from "next/link";

import { ChevronLeftIcon } from "@heroicons/react/24/solid";
import { ChevronRightIcon } from "@heroicons/react/24/solid";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
};

const Pagination = ({ currentPage, totalPages }: PaginationProps) => {
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

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex justify-center">
      <ul className="flex">
        <Link
          className={`border rounded-l-lg px-3 py-2 flex items-center ${
            currentPage === 1
              ? "opacity-50 cursor-not-allowed"
              : "hover:text-primary"
          }`}
          href={`${currentPage > 1 ? `?page=${currentPage - 1}` : "#"}`}
        >
          <ChevronLeftIcon className="size-5" />
        </Link>
        {pageNumbers.map((number, index) => (
          <Link
            key={index}
            className={`border px-3 py-2 cursor-pointer ${
              currentPage === number
                ? "bg-primary border-primary"
                : "hover:text-primary"
            } ${number === "..." ? "cursor-not-allowed" : ""}`}
            href={`${number !== "..." ? `?page=${number}` : "#"}`}
          >
            {number}
          </Link>
        ))}
        <Link
          className={`border rounded-r-lg px-3 py-2 flex items-center ${
            currentPage === totalPages
              ? "opacity-50 cursor-not-allowed"
              : "hover:text-primary"
          }`}
          href={`${
            currentPage < totalPages ? `?page=${currentPage + 1}` : "#"
          }`}
        >
          <ChevronRightIcon className="size-5" />
        </Link>
      </ul>
    </div>
  );
};

export default Pagination;
