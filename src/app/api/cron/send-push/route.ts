import { NextResponse } from "next/server";
import { WebPushError } from "web-push";
import webpush from "@/lib/webpush";
import { qstashReceiver } from "@/lib/qstash";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PushPayload, PushSubscriptionRecord } from "@/types/webpush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 1. XÁC THỰC BẢO MẬT QSTASH
    const bodyText = await req.text();
    const signature = req.headers.get("upstash-signature");

    if (!signature)
      return NextResponse.json({ error: "No signature" }, { status: 401 });

    const isValid = await qstashReceiver.verify({
      signature,
      body: bodyText,
    });

    if (!isValid)
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

    // 2. PHÂN TÍCH DỮ LIỆU ĐẦU VÀO
    let parsedBody: PushPayload;
    try {
      parsedBody = JSON.parse(bodyText) as PushPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { title, body, url, icon, image, badge, movieSlug, episodeSlug } =
      parsedBody;

    let subscriptionsToNotify: PushSubscriptionRecord[] = [];

    // 3. LỌC NGƯỜI NHẬN
    if (movieSlug) {
      const { data: followers, error: followerError } = await supabaseAdmin
        .from("user_subscriptions")
        .select("user_id")
        .eq("movie_slug", movieSlug);

      if (followerError) throw followerError;

      if (!followers || followers.length === 0) {
        return NextResponse.json({
          message: `Bỏ qua: Không có ai theo dõi phim ${movieSlug}`,
        });
      }

      const userIdsToNotify = followers
        .map((f) => f.user_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);

      if (userIdsToNotify.length === 0) {
        return NextResponse.json({
          message: `Bỏ qua: Không có user_id hợp lệ cho phim ${movieSlug}`,
        });
      }

      const { data: subs, error: subsError } = await supabaseAdmin
        .from("push_subscriptions")
        .select("id, subscription, user_id")
        .in("user_id", userIdsToNotify)
        .returns<PushSubscriptionRecord[]>();

      if (subsError) throw subsError;
      subscriptionsToNotify = subs || [];
    } else {
      let query = supabaseAdmin
        .from("push_subscriptions")
        .select("id, subscription, user_id")
        .order("id", { ascending: true })
        .limit(500);

      // Nếu có cursor từ lần chạy trước truyền vào, thì lấy những ID lớn hơn cursor đó
      if (parsedBody.cursor) {
        query = query.gt("id", parsedBody.cursor);
      }

      const { data: subs, error: dbError } =
        await query.returns<PushSubscriptionRecord[]>();

      if (dbError) throw dbError;
      subscriptionsToNotify = subs || [];
    }

    if (subscriptionsToNotify.length === 0) {
      return NextResponse.json({ message: "Không có thiết bị nhận khả dụng" });
    }

    // 4. CHUẨN BỊ PAYLOAD (ĐÃ THÊM MOVIESLUG VÀO ĐÂY)
    const pushPayload = JSON.stringify({
      title: title || "V-Movie Thông báo",
      body: body || "Có nội dung mới đang chờ bạn!",
      url: url || "/",
      icon: icon || "/icons/icon-192x192.png",
      image: image,
      badge: badge || "/icons/badge-96x96.png",
      movieSlug: movieSlug,
    });

    // 5. THỰC THI GỬI THÔNG BÁO
    const results = await Promise.allSettled(
      subscriptionsToNotify.map((sub) =>
        webpush.sendNotification(
          sub.subscription as webpush.PushSubscription,
          pushPayload,
        ),
      ),
    );

    // 6. DỌN DẸP THIẾT BỊ LỖI
    const deadIds: string[] = [];
    let successCount = 0;

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successCount++;
      } else {
        const error = result.reason;
        if (error instanceof WebPushError) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            deadIds.push(subscriptionsToNotify[index].id);
          }
        }
      }
    });

    if (deadIds.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", deadIds);
    }

    // BƯỚC ĐỆ QUY (Chỉ áp dụng cho Loa Phường)
    if (!movieSlug && subscriptionsToNotify.length === 500) {
      const nextCursor = subscriptionsToNotify[499].id; // Lấy ID của người cuối cùng làm mốc
      const qstashToken = process.env.QSTASH_TOKEN;

      if (qstashToken) {
        // Gọi lại chính cái API này thông qua QStash, mang theo cái mốc (cursor) mới
        await fetch(
          `https://qstash-us-east-1.upstash.io/v2/publish/${req.url}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${qstashToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...parsedBody,
              cursor: nextCursor, // Truyền mốc đi để chạy tiếp
            }),
          },
        ).catch((err) => console.error("Lỗi khi tự gọi đệ quy QStash:", err));
      } else {
        console.warn(
          "Không tìm thấy QSTASH_TOKEN để chạy phân trang Broadcast!",
        );
      }
    }

    return NextResponse.json({
      success: true,
      mode: movieSlug ? "Targeted" : "Broadcast",
      delivered: successCount,
      removed: deadIds.length,
      episode: episodeSlug || "N/A",
    });
  } catch (error: unknown) {
    console.error("[PUSH_DISPATCHER_ERROR]:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
