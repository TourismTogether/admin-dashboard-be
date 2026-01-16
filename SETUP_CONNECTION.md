# Hướng dẫn Setup Connection String cho Supabase

## Vấn đề: Lỗi ENOTFOUND

Nếu bạn gặp lỗi `ENOTFOUND` khi chạy migrations, có nghĩa là hostname không thể resolve được.
**Giải pháp tốt nhất là lấy connection string trực tiếp từ Supabase Dashboard.**

## Cách lấy Connection String

### Bước 1: Vào Supabase Dashboard

1. Đăng nhập vào [Supabase Dashboard](https://app.supabase.com)
2. Chọn project của bạn
3. Vào **Settings** (biểu tượng bánh răng) → **Database**

### Bước 2: Copy Connection String

1. Tìm phần **Connection string**
2. Bạn sẽ thấy 3 tabs:

   - **URI** - Direct connection (có thể không hoạt động)
   - **Transaction** - Transaction pooler (port 6543) - **Khuyến nghị cho migrations**
   - **Session** - Session pooler (port 5432)

3. Chọn tab **Transaction** (hoặc **Session** nếu Transaction không có)
4. Click vào icon copy để copy connection string

### Bước 3: Thêm vào .env

Thêm vào file `.env` trong thư mục `admin-dashboard-server`:

```env
SUPABASE_DB_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**Lưu ý:**

- Thay `[PASSWORD]` bằng database password thực tế
- Connection string sẽ có dạng như:
  ```
  postgresql://postgres.ehvutrxybbhawozozpat:YOUR_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
  ```

### Bước 4: Chạy migrations

```bash
pnpm run db:migrate
```

## Format Connection String

Connection string từ Supabase có format:

```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:[PORT]/postgres
```

Ví dụ:

```
postgresql://postgres.ehvutrxybbhawozozpat:your_password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

## Troubleshooting

### Nếu vẫn gặp lỗi ENOTFOUND:

1. Kiểm tra lại connection string đã copy đúng chưa
2. Thử dùng tab **Session** thay vì **Transaction**
3. Kiểm tra password có đúng không
4. Đảm bảo project Supabase đang active

### Nếu muốn tự build connection string:

Thêm vào `.env`:

```env
SUPABASE_URL=https://ehvutrxybbhawozozpat.supabase.co
SUPABASE_DB_PASSWORD=your_password
SUPABASE_USE_TRANSACTION_POOLER=true
```

Nhưng cách này có thể không hoạt động vì format hostname có thể khác.
