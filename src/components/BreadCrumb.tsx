"use client";

import React, { useState, useEffect, useRef, Fragment } from "react";
import Link from "next/link";
import { ChevronRightIcon, HomeIcon } from "@heroicons/react/24/solid";

import { BreadCrumb as BreadCrumbType } from "@/lib/types";
import { formatUrl } from "@/lib/utils";

interface BreadCrumbProps {
  breadCrumb: BreadCrumbType[];
}

// Function to group items by position
const groupByPosition = (breadCrumb: BreadCrumbType[]) =>
  breadCrumb.reduce((acc, item) => {
    const { position } = item;
    acc[position] = acc[position] || [];
    acc[position].push(item);
    return acc;
  }, {} as Record<number, BreadCrumbType[]>);

const BreadCrumb = ({ breadCrumb }: BreadCrumbProps) => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const groupedBreadCrumbs = groupByPosition(breadCrumb);

  const renderDropdown = (items: BreadCrumbType[], idx: number) => (
    <div key={idx} className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-0.5 sm:gap-2">
        <button
          className="hover:text-main"
          onClick={() => setDropdownOpen((prev) => !prev)}
        >
          •••
        </button>
        <ChevronRightIcon className="size-4 sm:size-5" />
      </div>
      {isDropdownOpen && (
        <div className="absolute w-max bg-gray-800 rounded mt-2 z-10">
          <ul>
            {items.map((item, index) => (
              <li key={index}>
                <Link
                  href={formatUrl(item.slug)}
                  className="block p-2 hover:text-main"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const renderSingleItem = (item: BreadCrumbType, idx: number) => {
    if (item.isCurrent)
      return (
        <div key={idx} className="line-clamp-1">
          {item.name}
        </div>
      );

    return (
      <Fragment key={idx}>
        <Link
          href={formatUrl(item.slug)}
          className="hover:text-main line-clamp-1"
        >
          {item.name}
        </Link>
        <ChevronRightIcon className="size-4 sm:size-5" />
      </Fragment>
    );
  };

  return (
    <nav
      aria-label="breadcrumb"
      className="flex items-center gap-0.5 sm:gap-2 select-none text-sm sm:text-base"
    >
      {/* Home link */}
      {/* <div className="flex items-center gap-0.5 sm:gap-2"> */}
      <Link aria-label="Trang chủ" href="/">
        <HomeIcon className="size-5 sm:size-6 hover:text-main" />
      </Link>
      <ChevronRightIcon className="size-4 sm:size-5" />
      {/* </div> */}

      {/* Map through grouped breadcrumbs */}
      {Object.keys(groupedBreadCrumbs).map((position, idx) => {
        const items = groupedBreadCrumbs[Number(position)];
        return items.length > 1
          ? renderDropdown(items, idx)
          : renderSingleItem(items[0], idx);
      })}
    </nav>
  );
};

export default BreadCrumb;
