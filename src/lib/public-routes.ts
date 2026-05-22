export const ISR_WARM_PATHS = ["/", "/phim-le", "/phim-bo", "/tv-shows", "/hoat-hinh"] as const;

export function shouldSkipAuthRefresh(pathname: string) {
  return ISR_WARM_PATHS.includes(pathname as (typeof ISR_WARM_PATHS)[number]);
}
