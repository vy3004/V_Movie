import React, { useMemo } from "react";
import { WSRV_PROXY, MOVIE_IMG_PATH } from "@/lib/configs";

interface ImageCustomProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  widths?: number[];
  quality?: number;
}

// Định nghĩa kiểu dữ liệu trả về rõ ràng
interface ImageSource {
  main: string;
  srcSet: string;
}

const ImageCustom: React.FC<ImageCustomProps> = ({
  widths = [300, 600, 900],
  quality = 65,
  src,
  alt,
  ...props
}) => {
  // Chỉ định kiểu ImageSource cho useMemo
  const finalSrc = useMemo((): ImageSource => {
    // Nếu không có src, trả về object trống thay vì chuỗi rỗng ""
    if (!src) return { main: "", srcSet: "" };

    let rawUrl = src.startsWith("http") ? src : `${MOVIE_IMG_PATH}${src}`;

    if (rawUrl.includes("googleusercontent.com")) {
      rawUrl = rawUrl.replace(/=s\d+(-c)?$/, "=s120-c");
    }

    const getProxyUrl = (w?: number) => {
      const widthParam = w ? `&w=${w}` : "";
      return `${WSRV_PROXY}/?output=webp&q=${quality}&url=${encodeURIComponent(rawUrl)}${widthParam}`;
    };

    const srcSet = widths.map((w) => `${getProxyUrl(w)} ${w}w`).join(", ");

    return {
      main: getProxyUrl(widths[0]),
      srcSet,
    };
  }, [src, widths, quality]);

  // Early return nếu không có src để tránh render thẻ img lỗi
  if (!src) {
    return <div className={`bg-zinc-800 animate-pulse ${props.className}`} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={finalSrc.main}
      srcSet={finalSrc.srcSet}
      alt={alt || "Image"}
      decoding={props.fetchPriority === "high" ? "auto" : "async"}
      referrerPolicy="no-referrer"
      {...props}
    />
  );
};

export default ImageCustom;
