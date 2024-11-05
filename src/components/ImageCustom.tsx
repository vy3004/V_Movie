import React from "react";

import { apiConfig } from "@/lib/configs";

interface ImageCustomProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  widths: number[];
}

const ImageCustom: React.FC<ImageCustomProps> = ({ widths, ...props }) => {
  const { src, alt } = props;

  const srcSet = widths
    .map((width) => `${apiConfig.IMG_URL}${src}&w=${width} ${width}w`)
    .join(", ");

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${apiConfig.IMG_URL}${src}`}
      srcSet={srcSet}
      alt={alt}
      {...props}
    />
  );
};

export default ImageCustom;
