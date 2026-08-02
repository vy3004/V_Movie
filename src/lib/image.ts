import { WSRV_PROXY, MOVIE_IMG_PATH } from "@/lib/configs";

// Domain đã tự tối ưu ảnh / không cho phép proxy bên ngoài
// -> dùng thẳng URL gốc, không qua WSRV
export const SKIP_PROXY_DOMAINS = [
  "phimimg.com",
  // "cdn.example.com",
  // "img.another-source.com",
];

/**
 * Chuẩn hoá src thành URL tuyệt đối, xử lý các case đặc biệt
 * (googleusercontent, domain skip-proxy...) và trả về URL cuối
 * dùng để build proxy URL hoặc dùng thẳng.
 */
function normalizeRawUrl(src: string): { rawUrl: string; skipProxy: boolean } {
  const rawUrl = src.startsWith("http") ? src : `${MOVIE_IMG_PATH}${src}`;

  if (SKIP_PROXY_DOMAINS.some((domain) => rawUrl.includes(domain))) {
    return { rawUrl, skipProxy: true };
  }

  if (rawUrl.includes("googleusercontent.com")) {
    return {
      rawUrl: rawUrl.replace(/=?s\d+(-c)?$/, "=s120-c"),
      skipProxy: false,
    };
  }

  return { rawUrl, skipProxy: false };
}

/**
 * Trả về 1 URL ảnh đã qua xử lý (proxy hoặc gốc), dùng cho
 * trường hợp chỉ cần 1 src duy nhất (không cần srcSet).
 */
export function resolveImageUrl(
  src: string,
  width?: number,
  quality = 65
): string {
  if (!src) return "";

  const { rawUrl, skipProxy } = normalizeRawUrl(src);

  if (skipProxy) return rawUrl;

  const widthParam = width ? `&w=${width}` : "";
  return `${WSRV_PROXY}/?output=webp&q=${quality}&url=${encodeURIComponent(rawUrl)}${widthParam}`;
}

/**
 * Trả về cả main src + srcSet, dùng cho <img> responsive
 * (trường hợp ImageCustom).
 */
export function resolveImageSource(
  src: string,
  widths: number[],
  quality = 65
): { main: string; srcSet: string } {
  if (!src) return { main: "", srcSet: "" };

  const { rawUrl, skipProxy } = normalizeRawUrl(src);

  if (skipProxy) {
    return { main: rawUrl, srcSet: "" };
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
}
