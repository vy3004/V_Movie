import Image from "next/image";

const Banner = () => {
  return (
    <div className="relative overflow-hidden rounded-lg w-full">
      <Image
        src={"/banner.jpg"}
        alt="Banner"
        width={1920}
        height={380}
        blurDataURL="/blur_img.jpg"
        placeholder="blur"
        className="w-full object-cover"
      />
      <div className="absolute inset-0 bg-banner-gradient" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center w-1/2 space-y-4">
        <h1 className="text-3xl font-bold">
          <span className="text-primary">V·Movie</span> là nền tảng tốt nhất để
          xem phim và chương trình yêu thích của bạn, mọi lúc, mọi nơi.
        </h1>
        <p>
          Bạn có thể thưởng thức nhiều nội dung đa dạng, bao gồm các bộ phim bom
          tấn mới nhất, phim kinh điển, chương trình truyền hình nổi tiếng, v.v.
          Bạn cũng có thể tạo danh sách theo dõi của riêng mình để có thể dễ
          dàng tìm thấy nội dung bạn muốn xem.
        </p>
      </div>
    </div>
  );
};

export default Banner;
