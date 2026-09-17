// Vercel Edge Middleware — cổng Basic Auth cho cả bản DEV NỘI BỘ lẫn trang XƯỞNG (/studio/).
//
// Cùng một repo, cùng một site/ dựng ra từ tools/vercel_build.sh, deploy vào HAI project
// Vercel riêng (xem docs/deploy-vercel.md). Middleware này chạy trên CẢ HAI, và có HAI cổng
// độc lập, xét theo thứ tự:
//
//   1. CẢ TRANG — DEV_BASIC_AUTH_USER / DEV_BASIC_AUTH_PASS. Khai đủ hai biến này thì MỌI
//      đường dẫn của project đó (kể cả trang chơi ở "/") đòi mật khẩu — đúng project "dev".
//   2. CHỈ /studio/ — STUDIO_BASIC_AUTH_USER / STUDIO_BASIC_AUTH_PASS. Khai đủ hai biến này
//      thì riêng trang xưởng đòi mật khẩu, còn trang chơi ở "/" vẫn công khai — đúng project
//      "prod": người chơi vào thẳng, nhưng "/studio/" không còn chỉ là ẩn đường dẫn (ai biết
//      URL vẫn mở được xem thẳng như trước) mà đòi mật khẩu thật.
//
// Project nào không khai biến nào trong một cặp thì middleware() không chặn phần tương ứng —
// không thêm một mili-giây nào vào đường công khai của "/".
//
// Chọn HTTP Basic Auth qua Edge Middleware (không phải "Deployment Protection" trả phí của
// Vercel) vì nó chạy được trên MỌI gói Vercel, kể cả Hobby miễn phí — "internal only" không
// nên phụ thuộc vào việc có nâng cấp Pro hay không. Ai có gói Pro/Team và muốn khoá chắc
// hơn (SSO, IP allowlist…) thì bật thêm Deployment Protection song song, không cần đụng
// vào file này.
// Bỏ /assets/** ra khỏi middleware — CHỈ chặn TRANG (index.html, /studio/), không chặn
// từng file trong gói phát hành. Hai lý do:
//   1. Basic Auth chỉ cần giấu cái SITE, không cần giấu từng byte ảnh/tiếng bên trong;
//      ai không biết trang tồn tại thì cũng không đoán ra URL của assets/pack/pack.json.
//   2. Route một file tĩnh vài chục MB (gói phát hành, xem CLAUDE.md mục 2e "Gói nặng")
//      qua Edge Middleware — dù chỉ để rồi cho qua thẳng — là đường vòng không cần thiết
//      và có thể đổi cách CDN trả header (Content-Length / chunked) so với việc để CDN
//      phục vụ thẳng file tĩnh. Client (`packRead()` trong index.html) dùng Content-Length
//      để vừa đếm % tải vừa đặt đồng hồ chết máy cho thanh tải trên trang chơi (mục 9,
//      "kẹt ở màn tải trên bản Vercel prod") — bớt một tầng trung gian không cần thiết
//      trên đúng cái file đó là bớt một chỗ có thể sinh ra sự cố.
export const config = {
  matcher: ['/((?!assets/).*)'],
};

function unauthorized(realm) {
  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${realm}"` }, // ASCII thuần: header HTTP không nhận Unicode
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

// Kiểm request có đúng Basic Auth wantUser:wantPass không. Đúng thì trả undefined (cho qua),
// sai/thiếu/hỏng cú pháp thì trả 401 kèm realm truyền vào — dùng chung cho cả hai cổng.
function requireBasicAuth(request, wantUser, wantPass, realm) {
  const header = request.headers.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    let decoded = '';
    try {
      decoded = atob(encoded);
    } catch {
      return unauthorized(realm);
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
  return unauthorized(realm);
}

export default function middleware(request) {
  // Cổng 1: cả trang (project "dev"). Có đủ hai biến thì đây là cổng DUY NHẤT được xét —
  // đã đòi mật khẩu cho cả site rồi thì "/studio/" bên trong đó không cần xét thêm cổng 2.
  const siteUser = process.env.DEV_BASIC_AUTH_USER;
  const sitePass = process.env.DEV_BASIC_AUTH_PASS;
  if (siteUser && sitePass) {
    return requireBasicAuth(request, siteUser, sitePass, 'Multiverse Battler internal dev');
  }

  // Cổng 2: chỉ "/studio/" (project "prod"). Đường dẫn khác "/studio/" thì đi qua thẳng dù
  // có khai biến này hay không.
  const path = new URL(request.url).pathname;
  const isStudio = path === '/studio' || path.startsWith('/studio/');
  if (isStudio) {
    const studioUser = process.env.STUDIO_BASIC_AUTH_USER;
    const studioPass = process.env.STUDIO_BASIC_AUTH_PASS;
    if (studioUser && studioPass) {
      return requireBasicAuth(request, studioUser, studioPass, 'Multiverse Battler studio');
    }
  }

  return; // không có cổng nào áp cho đường dẫn này ⇒ đi qua thẳng
}
