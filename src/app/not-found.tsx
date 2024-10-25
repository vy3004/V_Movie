import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";

export default function NotFound() {
  return (
    <div className="w-full py-4 flex flex-col justify-center items-center h-screen">
      <div className="relative">
        <h1 className="text-9xl font-extrabold text-white tracking-widest">
          404
        </h1>
        <div className="bg-primary px-2 text-sm rounded rotate-12 absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 w-max">
          Oops! Không tìm thấy trang
        </div>
      </div>
      <p className="my-4 text-center">
        Xin lỗi! Trang bạn truy cập không tồn tại hoặc đã bị xóa trước đó
      </p>
      <Link
        href="/"
        className="bg-foreground flex items-center justify-center w-48 rounded-2xl h-14 relative text-background text-xl font-semibold group"
      >
        <div className="bg-custom-gradient rounded-xl h-12 w-1/4 flex items-center justify-center absolute left-1 top-[4px] group-hover:w-[184px] z-10 duration-500">
          <ArrowLeftIcon className="size-6" />
        </div>
        <p className="translate-x-2">Trang chủ</p>
      </Link>
    </div>
  );
}
