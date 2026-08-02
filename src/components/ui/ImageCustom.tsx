import React, { useMemo } from "react";
import { resolveImageSource } from "@/lib/image";

interface ImageCustomProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  widths?: number[];
  quality?: number;
}

const DEFAULT_WIDTHS = [300, 600, 900];

const ImageCustom: React.FC<ImageCustomProps> = ({
  widths = DEFAULT_WIDTHS,
  quality = 65,
  src,
  alt,
  ...props
}) => {
  const finalSrc = useMemo(
    () => resolveImageSource(src || "", widths, quality),
    [src, widths, quality]
  );

  if (!src) {
    return <div className={`bg-zinc-800 animate-pulse ${props.className}`} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      src={finalSrc.main}
      srcSet={finalSrc.srcSet || undefined}
      alt={alt || "Image"}
      decoding={props.fetchPriority === "high" ? "auto" : "async"}
      referrerPolicy="no-referrer"
    />
  );
};

export default ImageCustom;
