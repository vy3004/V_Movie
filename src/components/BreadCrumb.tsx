"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronDoubleRightIcon, HomeIcon } from "@heroicons/react/24/solid";

import { BreadCrumb as BreadCrumbType } from "@/lib/types";

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
      <div className="flex items-center space-x-2">
        <button
          className="hover:text-primary"
          onClick={() => setDropdownOpen((prev) => !prev)}
        >
          •••
        </button>
        <ChevronDoubleRightIcon className="size-5" />
      </div>
      {isDropdownOpen && (
        <div className="absolute w-max bg-gray-800 rounded mt-2 z-10">
          <ul>
            {items.map((item, index) => (
              <li key={index}>
                <Link
                  href={item.slug || "#"}
                  className="block p-2 hover:text-primary"
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
    if (item.isCurrent) return <div key={idx}>{item.name}</div>;

    return (
      <div key={idx} className="flex items-center space-x-2">
        <Link href={item.slug || "#"} className="hover:text-primary">
          {item.name}
        </Link>
        <ChevronDoubleRightIcon className="size-5" />
      </div>
    );
  };

  return (
    <nav
      aria-label="breadcrumb"
      className="flex items-center space-x-2 select-none"
    >
      {/* Home link */}
      <div className="flex items-center space-x-2">
        <Link href="/">
          <HomeIcon className="size-6 hover:text-primary" />
        </Link>
        <ChevronDoubleRightIcon className="size-5" />
      </div>

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
