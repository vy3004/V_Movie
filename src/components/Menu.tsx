import Link from "next/link";
import { usePathname } from "next/navigation";

import Button from "@/components/Button";
import Loading from "@/components/Loading";

import { useData } from "@/providers/BaseDataContextProvider";

import { CateCtr } from "@/lib/types";
import { menuConfig } from "@/lib/configs";

const DropdownMenu = ({
  title,
  items,
}: {
  title: string;
  items?: CateCtr[];
}) => (
  <div className="relative group inline-block">
    <Button className="group-hover:bg-custom-gradient">{title}</Button>
    <div className="absolute left-1/2 -translate-x-1/2 hidden group-hover:block w-max z-10">
      <div className="h-4 opacity-0" />
      <div className="absolute left-1/2 -translate-x-1/2 top-2 border-b-8 border-b-secondary border-x-8 border-x-transparent size-0" />
      <div className="p-4 grid grid-cols-3 gap-4 bg-secondary rounded-md">
        {items && items.length > 0 ? (
          items.map((item) => (
            <Link
              key={item.slug}
              href={item.slug}
              className="text-center hover:text-primary"
            >
              {item.name}
            </Link>
          ))
        ) : (
          <Loading />
        )}
      </div>
    </div>
  </div>
);

const Menu = () => {
  const pathname = usePathname();
  const { categories, countries } = useData();

  return (
    <nav className="flex items-center space-x-2 mt-1 relative">
      {menuConfig.map((item) => (
        <Link key={item.slug} href={item.slug}>
          <Button
            className={pathname === item.slug ? "bg-custom-gradient" : ""}
          >
            {item.name}
          </Button>
        </Link>
      ))}

      <DropdownMenu title="Thể loại" items={categories} />

      <DropdownMenu title="Quốc gia" items={countries} />
    </nav>
  );
};

export default Menu;