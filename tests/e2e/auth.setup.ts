import { test as setup, expect } from '@playwright/test';

const HOST_STORAGE = 'tests/e2e/auth/host.json';
const GUEST_STORAGE = 'tests/e2e/auth/guest.json';

// Hàm helper để thực hiện đăng nhập qua Modal
async function loginViaModal(page: any, email: string, pass: string) {
  await page.goto('http://localhost:3000/');
  
  // Bấm nút mở Modal
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // Điền Email
  const emailInput = page.getByRole('textbox', { name: 'Email' });
  await emailInput.click();
  await emailInput.fill(email);

  // Điền Mật khẩu
  const passInput = page.getByRole('textbox', { name: 'Mật khẩu' });
  await passInput.click();
  await passInput.fill(pass);

  // Bấm nút Đăng nhập bên trong Modal (getByText như code của bạn)
  await page.getByText('Đăng nhập').click();

  // Đợi Modal biến mất hoặc trang web cập nhật trạng thái đã đăng nhập
  // Ở đây mình dùng kiểm tra xem nút Đăng nhập còn tồn tại không
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).not.toBeVisible({ timeout: 10000 });
  
  // Đợi 1 chút để Supabase kịp lưu Token vào LocalStorage
  await page.waitForTimeout(1000);
}

setup('Setup Session cho Host', async ({ page }) => {
  // Thay email/pass của tài khoản Host thật trong DB của bạn
  await loginViaModal(page, 'tang@gmail.com', '111111');
  await page.context().storageState({ path: HOST_STORAGE });
});

setup('Setup Session cho Guest', async ({ page }) => {
  // Thay email/pass của tài khoản Guest thật trong DB của bạn
  await loginViaModal(page, 'vinh@gmail.com', '111111');
  await page.context().storageState({ path: GUEST_STORAGE });
});