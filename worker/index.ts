/// <reference lib="webworker" />

import { PushPayload } from "@/types/webpush";

export {};

const sw = self as unknown as ServiceWorkerGlobalScope;

// Bỏ qua giai đoạn "Waiting" (Chờ đợi)
sw.addEventListener("install", () => {
  sw.skipWaiting(); // Ép kích hoạt ngay
});

// Chiếm quyền điều khiển toàn bộ các Tab đang mở
sw.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(sw.clients.claim()); // Đè bản cũ ngay lập tức
});

interface StrictNotificationOptions extends NotificationOptions {
  vibrate?: number[];
  image?: string;
  badge?: string;
  tag?: string;
}

sw.addEventListener("push", function (event: PushEvent) {
  if (!event.data) return;

  let data: PushPayload;
  try {
    data = event.data.json() as PushPayload;
  } catch (e) {
    console.error("Failed to parse push data:", e);
    return;
  }

  const options: StrictNotificationOptions = {
    body: data.body,
    icon: data.icon,
    image: data.image,
    badge: data.badge,
    vibrate: [200, 100, 200],
    tag: data.movieSlug || "v-movie-default",
    data: { url: data.url || "/" },
  };

  event.waitUntil(
    sw.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const windowClients = clients as WindowClient[];
        let isAppInFocus = false;

        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.visibilityState === "visible") {
            isAppInFocus = true;
            break;
          }
        }

        // Logic của bạn: Nếu đang mở web thì không hiện Push ngoài màn hình
        if (isAppInFocus) {
          console.log("User đang dùng web, bỏ qua Web Push ngoài màn hình.");
          return;
        }

        return sw.registration.showNotification(data.title, options);
      }),
  );
});

sw.addEventListener("notificationclick", function (event: NotificationEvent) {
  event.notification.close();

  // 1. Lấy URL đích từ payload
  const targetUrlStr = event.notification.data?.url || "/";
  const targetUrl = new URL(targetUrlStr, sw.location.origin);
  // Hàm chuẩn hóa URL: Bỏ dấu gạch chéo '/' ở cuối và bỏ param để so sánh cho chuẩn
  const normalizeUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.origin + u.pathname.replace(/\/$/, ""); // Xóa dấu '/' ở đuôi nếu có
    } catch {
      return url;
    }
  };

  const targetNormalized = normalizeUrl(targetUrl.href);

  event.waitUntil(
    sw.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const windowClients = clients as WindowClient[];

        // TRƯỜNG HỢP 1: Tìm xem có tab nào đang mở ĐÚNG phim đó không
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (
            normalizeUrl(client.url) === targetNormalized &&
            "focus" in client
          ) {
            return client.focus();
          }
        }

        // TRƯỜNG HỢP 2: Không có tab phim đó, nhưng CÓ MỞ WEB CỦA MÌNH (trang chủ, phim khác...)
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          try {
            const clientOrigin = new URL(client.url).origin;
            // Nếu chung Domain (Origin) -> Dùng tab đó chuyển hướng sang phim mới
            if (
              clientOrigin === targetUrl.origin &&
              "navigate" in client &&
              "focus" in client
            ) {
              return client
                .navigate(targetUrl.href)
                .then((c) => (c ? c.focus() : null));
            }
          } catch (error) {
            console.warn("Error when checking client origin", error);
          }
        }

        // TRƯỜNG HỢP 3: Tắt sạch web -> Buộc phải mở tab mới
        if (sw.clients.openWindow) {
          return sw.clients.openWindow(targetUrl.href);
        }
      }),
  );
});
