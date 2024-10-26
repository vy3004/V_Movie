import Image from "next/image";

const Banner = () => {
  return (
    <div className="relative aspect-[1.5] sm:aspect-[2] md:aspect-[4] overflow-hidden rounded-lg w-full">
      <Image
        src={"/banner.jpg"}
        alt="Banner"
        fill
        sizes="100vw"
        blurDataURL="/blur_img.jpg"
        placeholder="blur"
        className="absolute inset-0 object-cover"
      />
      <div className="absolute inset-0 bg-banner-gradient" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center w-full md:w-5/6 lg:w-2/3 xl:w-1/2 space-y-4 p-4">
        <h1 className="text-lg sm:text-xl lg:text-3xl font-bold line-clamp-3">
          <span className="text-primary">V·Movie</span> là nền tảng tốt nhất để
          xem phim và chương trình yêu thích của bạn, mọi lúc, mọi nơi.
        </h1>
        <p className="text-sm sm:text-base line-clamp-3">
          Bạn có thể thưởng thức nhiều nội dung đa dạng, bao gồm các bộ phim bom
          tấn mới nhất, phim kinh điển, chương trình truyền hình nổi tiếng, v.v.
        </p>
      </div>
    </div>
  );
};

export default Banner;
