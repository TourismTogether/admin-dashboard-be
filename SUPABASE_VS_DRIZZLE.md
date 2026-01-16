# So sánh Supabase Client vs Drizzle ORM

## Tổng quan

| Tính năng | Supabase Client | Drizzle ORM |
|-----------|----------------|-------------|
| **Kết nối** | Qua REST API | Trực tiếp PostgreSQL |
| **Tốc độ** | Chậm hơn (qua HTTP) | Nhanh hơn (trực tiếp) |
| **Row Level Security (RLS)** | ✅ Có (với anon key) | ❌ Không (trừ khi config) |
| **Authentication** | ✅ Built-in | ❌ Không |
| **Storage** | ✅ Có | ❌ Không |
| **Realtime** | ✅ Có | ❌ Không |
| **Type Safety** | ⚠️ Một phần | ✅ Hoàn toàn (TypeScript) |
| **Complex Queries** | ⚠️ Hạn chế | ✅ Đầy đủ (JOIN, transactions) |
| **Raw SQL** | ❌ Không | ✅ Có |
| **Use Case** | Frontend/Client-side | Backend/Server-side |

## Khi nào dùng gì?

### Dùng **Supabase Client** khi:
- ✅ Cần Authentication (login, signup, JWT)
- ✅ Cần Storage (upload files, images)
- ✅ Cần Realtime (live updates, subscriptions)
- ✅ Cần RLS (Row Level Security) cho multi-tenant
- ✅ Frontend/client-side code
- ✅ Cần các tính năng built-in của Supabase

### Dùng **Drizzle ORM** khi:
- ✅ Backend/server-side code
- ✅ Cần performance cao (queries phức tạp)
- ✅ Cần transactions
- ✅ Cần JOIN nhiều bảng
- ✅ Cần type safety với TypeScript
- ✅ Cần raw SQL
- ✅ Admin operations (bypass RLS)

## Ví dụ thực tế

### Scenario 1: Lấy danh sách users

**Với Supabase Client:**
```typescript
// Qua REST API - chậm hơn
const { data, error } = await fastify.supabase
  .from("users")
  .select("*")
  .limit(10);
```

**Với Drizzle:**
```typescript
// Trực tiếp PostgreSQL - nhanh hơn
const users = await fastify.drizzle
  .select()
  .from(users)
  .limit(10);
```

### Scenario 2: Query phức tạp với JOIN

**Với Supabase Client:**
```typescript
// Khó khăn, phải query nhiều lần
const { data: users } = await fastify.supabase.from("users").select("*");
const { data: groups } = await fastify.supabase.from("groups").select("*");
// Phải join manually trong code
```

**Với Drizzle:**
```typescript
// Dễ dàng với JOIN
const result = await fastify.drizzle
  .select({
    user: users,
    group: groups,
  })
  .from(users)
  .leftJoin(groups, eq(users.groupId, groups.id));
```

### Scenario 3: Transaction

**Với Supabase Client:**
```typescript
// ❌ Không hỗ trợ transactions
```

**Với Drizzle:**
```typescript
// ✅ Hỗ trợ transactions
await fastify.drizzle.transaction(async (tx) => {
  await tx.insert(users).values({ email: "user@example.com" });
  await tx.insert(groups).values({ name: "New Group" });
});
```

### Scenario 4: Authentication

**Với Supabase Client:**
```typescript
// ✅ Built-in authentication
const { data, error } = await fastify.supabase.auth.signUp({
  email: "user@example.com",
  password: "password123",
});
```

**Với Drizzle:**
```typescript
// ❌ Phải tự implement authentication
```

## Kết luận

- **Backend/Admin Dashboard**: Dùng **Drizzle ORM** (nhanh, type-safe, queries phức tạp)
- **Frontend/Client**: Dùng **Supabase Client** (auth, storage, realtime, RLS)

**Trong project này:**
- Drizzle ORM: Cho admin operations, queries phức tạp
- Supabase Client: Tùy chọn, nếu cần auth/storage/realtime
