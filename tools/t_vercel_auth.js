// Kiểm middleware.js — cổng Basic Auth cho project Vercel "dev" (nội bộ).
// Chạy bằng Node thẳng (Request/Response/Headers/atob là global từ Node 18+),
// không cần Vercel CLI hay deploy thật.
'use strict';
const assert = require('assert');
const { pathToFileURL } = require('url');

let fail = 0;
function check(name, cond) {
  if (cond) { console.log('OK   ' + name); }
  else { fail++; console.log('FAIL ' + name); }
}

function b64(s) { return Buffer.from(s, 'utf8').toString('base64'); }

async function run() {
  const mod = await import(pathToFileURL(require('path').join(__dirname, '..', 'middleware.js')).href);
  const middleware = mod.default;
  const config = mod.config;

  // Matcher phải chặn mọi TRANG nhưng bỏ qua /assets/** (xem middleware.js) — dò bằng
  // đúng cú pháp negative-lookahead của path-to-regexp mà Next.js/Vercel tài liệu hoá cho
  // kiểu loại trừ này, không phải chuỗi '/:path*' cũ (chuỗi đó chặn CẢ assets, chính là
  // đường vòng qua Edge Middleware gây kẹt màn tải trên bản prod — xem CLAUDE.md mục 9).
  const matcherOk = Array.isArray(config && config.matcher) && config.matcher.length === 1
    && typeof config.matcher[0] === 'string' && /\(\?!assets\//.test(config.matcher[0]);
  check('config.matcher loại trừ /assets/** khỏi cú pháp negative-lookahead', matcherOk);
  if (matcherOk) {
    const re = new RegExp('^' + config.matcher[0] + '$');
    check('matcher: /assets/pack/pack.json bị LOẠI (CDN phục vụ thẳng, không qua middleware)', !re.test('/assets/pack/pack.json'));
    check('matcher: / (trang chơi) vẫn bị chặn', re.test('/'));
    check('matcher: /studio/ (trang xưởng) vẫn bị chặn', re.test('/studio/'));
  }

  const OLD_USER = process.env.DEV_BASIC_AUTH_USER;
  const OLD_PASS = process.env.DEV_BASIC_AUTH_PASS;
  try {
    // ---- Prod: không khai biến môi trường ⇒ đi qua thẳng ----
    delete process.env.DEV_BASIC_AUTH_USER;
    delete process.env.DEV_BASIC_AUTH_PASS;
    const req1 = new Request('https://prod.example/index.html');
    const res1 = middleware(req1);
    check('không khai user/pass (prod) => đi qua thẳng (return undefined)', res1 === undefined);

    // ---- Dev: có khai biến môi trường ----
    process.env.DEV_BASIC_AUTH_USER = 'team';
    process.env.DEV_BASIC_AUTH_PASS = 'hunter2';

    const reqNoAuth = new Request('https://dev.example/studio/');
    const resNoAuth = middleware(reqNoAuth);
    check('dev, không có header Authorization => 401', resNoAuth instanceof Response && resNoAuth.status === 401);
    check('dev, 401 kèm WWW-Authenticate: Basic', /Basic realm=/.test(resNoAuth.headers.get('www-authenticate') || ''));

    const reqWrong = new Request('https://dev.example/', {
      headers: { authorization: 'Basic ' + b64('team:wrongpass') },
    });
    const resWrong = middleware(reqWrong);
    check('dev, sai mật khẩu => 401', resWrong instanceof Response && resWrong.status === 401);

    const reqWrongUser = new Request('https://dev.example/', {
      headers: { authorization: 'Basic ' + b64('nobody:hunter2') },
    });
    const resWrongUser = middleware(reqWrongUser);
    check('dev, sai tên đăng nhập => 401', resWrongUser instanceof Response && resWrongUser.status === 401);

    const reqRight = new Request('https://dev.example/', {
      headers: { authorization: 'Basic ' + b64('team:hunter2') },
    });
    const resRight = middleware(reqRight);
    check('dev, đúng user:pass => đi qua thẳng', resRight === undefined);

    const reqMalformed = new Request('https://dev.example/', {
      headers: { authorization: 'Basic %%%not-base64%%%' },
    });
    const resMalformed = middleware(reqMalformed);
    check('dev, header Authorization hỏng cú pháp => 401 (không ném lỗi)', resMalformed instanceof Response && resMalformed.status === 401);

    const reqBearer = new Request('https://dev.example/', {
      headers: { authorization: 'Bearer sometoken' },
    });
    const resBearer = middleware(reqBearer);
    check('dev, scheme khác Basic => 401', resBearer instanceof Response && resBearer.status === 401);
  } finally {
    if (OLD_USER === undefined) delete process.env.DEV_BASIC_AUTH_USER; else process.env.DEV_BASIC_AUTH_USER = OLD_USER;
    if (OLD_PASS === undefined) delete process.env.DEV_BASIC_AUTH_PASS; else process.env.DEV_BASIC_AUTH_PASS = OLD_PASS;
  }

  console.log(fail === 0 ? 'DAT t_vercel_auth' : ('LOI ' + fail + ' muc t_vercel_auth'));
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
