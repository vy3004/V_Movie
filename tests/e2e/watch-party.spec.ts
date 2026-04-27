// import { test, expect } from "@playwright/test";

// test("Guest (Ẩn danh) phải đồng bộ chuẩn xác sau khi Host tua điên cuồng 5 lần", async ({
//   browser,
// }) => {
//   // 1. Tạo 2 Tab Ẩn danh độc lập hoàn toàn
//   const hostContext = await browser.newContext();
//   const guestContext = await browser.newContext();

//   const hostPage = await hostContext.newPage();
//   const guestPage = await guestContext.newPage();

//   const roomUrl = "http://localhost:3000/xem-chung/BWWY8Q";

//   // 2. Cho 2 người vào phòng
//   await hostPage.goto(roomUrl);
//   await guestPage.goto(roomUrl);

//   // Đợi Video.js render xong HTML
//   await hostPage.waitForSelector("video");
//   await guestPage.waitForSelector("video");

//   // Chờ 2 giây để Supabase Realtime kết nối thành công (Rất quan trọng)
//   await hostPage.waitForTimeout(2000);

//   // 3. KỊCH BẢN TÀN PHÁ: Host tua liên tục 5 lần để test giới hạn "3 lần"
//   const seekTimes = [10, 45, 120, 300, 600]; // Mốc thời gian (giây)

//   for (let i = 0; i < seekTimes.length; i++) {
//     const targetTime = seekTimes[i];
//     console.log(`Host đang tua lần ${i + 1} tới mốc ${targetTime}s...`);

//     // Dùng evaluate chọc thẳng vào DOM để mô phỏng sự kiện seek của user
//     await hostPage.evaluate((time) => {
//       const videoEl = document.querySelector("video");
//       if (videoEl) {
//         videoEl.currentTime = time;
//       }
//     }, targetTime);

//     // Chờ 500ms (lớn hơn cái Debounce 300ms của chúng ta) để lệnh bay qua mạng
//     await hostPage.waitForTimeout(500);
//   }

//   // 4. Chờ thêm 1 giây để máy Guest xử lý lệnh cuối cùng
//   await guestPage.waitForTimeout(1000);

//   // 5. Kiểm tra thời gian hiện tại của Guest
//   const guestTime = await guestPage.evaluate(() => {
//     const videoEl = document.querySelector("video");
//     return videoEl ? videoEl.currentTime : 0;
//   });

//   console.log(`Thời gian chốt sổ của Guest: ${guestTime}s (Kỳ vọng: ~600s)`);

//   // 6. KIỂM CHỨNG: Sai số tối đa cho phép giữa 2 máy là 2.5 giây
//   expect(Math.abs(guestTime - 600)).toBeLessThan(2.5);
// });
