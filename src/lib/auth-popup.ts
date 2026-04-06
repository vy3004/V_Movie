export const openAuthPopup = (url: string): Window => {
  const w = 600,
    h = 700;
  const left = window.screenX + (window.outerWidth - w) / 2;
  const top = window.screenY + (window.outerHeight - h) / 2;

  const popup = window.open(
    url,
    "auth-popup",
    `width=${w},height=${h},top=${top},left=${left},status=no,menubar=no,toolbar=no,location=no`,
  );

  // Nếu trình duyệt chặn popup, biến popup sẽ là null
  if (!popup) {
    throw new Error(
      "Trình duyệt đã chặn cửa sổ đăng nhập. Vui lòng kiểm tra cài đặt popup.",
    );
  }

  return popup;
};
