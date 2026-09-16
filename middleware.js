// Vercel Edge Middleware — cổng duy nhất làm cho bản DEV NỘI BỘ khác bản PROD CÔNG KHAI.
//
// Cùng một repo, cùng một site/ dựng ra từ tools/vercel_build.sh, deploy vào HAI project
// Vercel riêng (xem docs/deploy-vercel.md). Middleware này chạy trên CẢ HAI, nhưng chỉ
// thật sự chặn khi project đó có khai hai biến môi trường DEV_BASIC_AUTH_USER /
// DEV_BASIC_AUTH_PASS — tức chỉ đúng project "dev". Project "prod" không khai hai biến đó
// nên middleware() return ngay, không thêm một mili-giây nào vào đường công khai.
//
// Chọn HTTP Basic Auth qua Edge Middleware (không phải "Deployment Protection" trả phí của
// Vercel) vì nó chạy được trên MỌI gói Vercel, kể cả Hobby miễn phí — "internal only" không
// nên phụ thuộc vào việc có nâng cấp Pro hay không. Ai có gói Pro/Team và muốn khoá chắc
// hơn (SSO, IP allowlist…) thì bật thêm Deployment Protection song song, không cần đụng
// vào file này.
export const config = {
  matcher: '/:path*',
};

const REALM = 'Multiverse Battler internal dev'; // ASCII thuần: header HTTP không nhận Unicode

function unauthorized() {
  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${REALM}"` },
  });
}

function timingSafeEqual(a, b) {
  // Chuỗi ngắn (user/pass gõ tay) nên phép so sánh không cần thư viện mã hoá; vẫn tránh
  // trả sớm ngay ký tự đầu sai để đỡ lộ độ dài qua thời gian phản hồi.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default function middleware(request) {
  const wantUser = process.env.DEV_BASIC_AUTH_USER;
  const wantPass = process.env.DEV_BASIC_AUTH_PASS;

  // Chưa khai đủ hai biến (đúng trường hợp project "prod") ⇒ đi qua thẳng, không khoá gì cả.
  if (!wantUser || !wantPass) return;

  const header = request.headers.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    let decoded = '';
    try {
      decoded = atob(encoded);
    } catch {
      return unauthorized();
    }
    const sep = decoded.indexOf(':');
    if (sep !== -1) {
      const user = decoded.slice(0, sep);
      const pass = decoded.slice(sep + 1);
      if (timingSafeEqual(user, wantUser) && timingSafeEqual(pass, wantPass)) {
        return; // đúng — cho qua
      }
    }
  }
  return unauthorized();
}
