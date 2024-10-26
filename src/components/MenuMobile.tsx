import { useState } from "react";
import {
  Bars3BottomLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/solid";

import Loading from "@/components/Loading";

import { useData } from "@/providers/BaseDataContextProvider";
import { typesMovie } from "@/lib/configs";

interface MenuItem {
  name: string;
  slug: string;
  subItems?: MenuItem[];
}

const MenuMobile = () => {
  const { categories, countries } = useData();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [openSubItems, setOpenSubItems] = useState<{
    [key: number]: boolean;
  }>({});

  const toggleSidebar = () => {
    setIsOpen((prev) => !prev);
  };

  const toggleSubItems = (index: number) => {
    setOpenSubItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const menuItems: MenuItem[] = [
    ...Object.values(typesMovie).splice(0, 5),
    {
      name: "Thể loại",
      slug: `${typesMovie.NEW.slug}/?category=`,
      subItems: categories,
    },
    {
      name: "Quốc gia",
      slug: `${typesMovie.NEW.slug}/?country=`,
      subItems: countries,
    },
  ];

  return (
    <>
      <button
        aria-label="Menu"
        className="flex items-center xl:hidden"
        onClick={toggleSidebar}
      >
        <Bars3BottomLeftIcon className="size-6 hover:text-primary" />
      </button>

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-background overflow-y-scroll transition-transform transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } z-50`}
      >
        <ul className="p-4 space-y-2">
          {menuItems.map((item: MenuItem, index: number) => (
            <li key={index}>
              {!item.subItems ? (
                <a
                  href={item.slug}
                  className="px-3 py-2 rounded hover:bg-gray-800 block"
                >
                  {item.name}
                </a>
              ) : (
                <>
                  <button
                    className="flex justify-between w-full text-left px-3 py-2 rounded hover:bg-gray-800"
                    onClick={() => toggleSubItems(index)}
                  >
                    {item.name}
                    <ChevronRightIcon
                      className={`size-5 transition-all duration-150 ${
                        openSubItems[index] ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                  {openSubItems[index] && (
                    <ul className="mt-4 pl-4">
                      {item.subItems.length > 0 ? (
                        item.subItems.map(
                          (subItem: MenuItem, subIndex: number) => (
                            <a
                              key={subIndex}
                              href={`/${item.slug}${subItem.slug}`}
                            >
                              <li className="px-3 py-2 rounded hover:bg-gray-800">
                                {subItem.name}
                              </li>
                            </a>
                          )
                        )
                      ) : (
                        <Loading />
                      )}
                    </ul>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black opacity-50 z-40"
          onClick={toggleSidebar}
        ></div>
      )}
    </>
  );
};

export default MenuMobile;
