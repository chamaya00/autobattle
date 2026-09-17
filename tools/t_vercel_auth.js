// Kiểm middleware.js — hai cổng Basic Auth: cả trang (project "dev") và chỉ /studio/
// (project "prod"). Chạy bằng Node thẳng (Request/Response/Headers/atob là global từ
// Node 18+), không cần Vercel CLI hay deploy thật.
'use strict';
const assert = require('assert');
const { pathToFileURL } = require('url');

let fail = 0;
function check(name, cond) {
  if (cond) { console.log('OK   ' + name); }
  else { fail++; console.log('FAIL ' + name); }
}

function b64(s) { return Buffer.from(s, 'utf8').toString('base64'); }

const SITE_VARS = ['DEV_BASIC_AUTH_USER', 'DEV_BASIC_AUTH_PASS'];
const STUDIO_VARS = ['STUDIO_BASIC_AUTH_USER', 'STUDIO_BASIC_AUTH_PASS'];

function clearEnv(names) { for (const n of names) delete process.env[n]; }

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

  const saved = {};
  for (const n of [...SITE_VARS, ...STUDIO_VARS]) saved[n] = process.env[n];

  try {
    // ---- Prod trần: không khai biến nào ⇒ mọi đường dẫn đi qua thẳng, kể cả /studio/ ----
    clearEnv(SITE_VARS);
    clearEnv(STUDIO_VARS);
    check('không khai gì (prod trần) => "/" đi qua thẳng',
      middleware(new Request('https://prod.example/index.html')) === undefined);
    check('không khai gì (prod trần) => "/studio/" cũng đi qua thẳng',
      middleware(new Request('https://prod.example/studio/')) === undefined);

    // ---- Cổng 1: DEV_BASIC_AUTH_* — chặn CẢ TRANG (project "dev") ----
    process.env.DEV_BASIC_AUTH_USER = 'team';
    process.env.DEV_BASIC_AUTH_PASS = 'hunter2';

    const resNoAuth = middleware(new Request('https://dev.example/studio/'));
    check('dev, không có header Authorization => 401', resNoAuth instanceof Response && resNoAuth.status === 401);
    check('dev, 401 kèm WWW-Authenticate: Basic', /Basic realm=/.test(resNoAuth.headers.get('www-authenticate') || ''));

    const resRootNoAuth = middleware(new Request('https://dev.example/'));
    check('dev, cổng cả trang cũng chặn luôn "/" (không riêng /studio/)',
      resRootNoAuth instanceof Response && resRootNoAuth.status === 401);

    const resWrong = middleware(new Request('https://dev.example/', {
      headers: { authorization: 'Basic ' + b64('team:wrongpass') },
    }));
    check('dev, sai mật khẩu => 401', resWrong instanceof Response && resWrong.status === 401);

    const resWrongUser = middleware(new Request('https://dev.example/', {
      headers: { authorization: 'Basic ' + b64('nobody:hunter2') },
    }));
    check('dev, sai tên đăng nhập => 401', resWrongUser instanceof Response && resWrongUser.status === 401);

    const resRight = middleware(new Request('https://dev.example/', {
      headers: { authorization: 'Basic ' + b64('team:hunter2') },
    }));
    check('dev, đúng user:pass => đi qua thẳng', resRight === undefined);

    const resRightStudio = middleware(new Request('https://dev.example/studio/', {
      headers: { authorization: 'Basic ' + b64('team:hunter2') },
    }));
    check('dev, đúng user:pass thì /studio/ cũng qua', resRightStudio === undefined);

    const resMalformed = middleware(new Request('https://dev.example/', {
      headers: { authorization: 'Basic %%%not-base64%%%' },
    }));
    check('dev, header Authorization hỏng cú pháp => 401 (không ném lỗi)', resMalformed instanceof Response && resMalformed.status === 401);

    const resBearer = middleware(new Request('https://dev.example/', {
      headers: { authorization: 'Bearer sometoken' },
    }));
    check('dev, scheme khác Basic => 401', resBearer instanceof Response && resBearer.status === 401);

    // ---- Cổng 2: STUDIO_BASIC_AUTH_* — chỉ chặn /studio/, project "prod" ----
    clearEnv(SITE_VARS);
    process.env.STUDIO_BASIC_AUTH_USER = 'crew';
    process.env.STUDIO_BASIC_AUTH_PASS = 'workshop9';

    check('prod + cổng studio, "/" vẫn công khai',
      middleware(new Request('https://prod.example/')) === undefined);
    check('prod + cổng studio, "/index.html" vẫn công khai',
      middleware(new Request('https://prod.example/index.html')) === undefined);

    const resStudioNoAuth = middleware(new Request('https://prod.example/studio/'));
    check('prod + cổng studio, "/studio/" không auth => 401', resStudioNoAuth instanceof Response && resStudioNoAuth.status === 401);
    check('prod + cổng studio, 401 kèm WWW-Authenticate: Basic', /Basic realm=/.test(resStudioNoAuth.headers.get('www-authenticate') || ''));

    const resStudioNoSlash = middleware(new Request('https://prod.example/studio'));
    check('prod + cổng studio, "/studio" (không có dấu / cuối) cũng bị chặn',
      resStudioNoSlash instanceof Response && resStudioNoSlash.status === 401);

    const resStudioSub = middleware(new Request('https://prod.example/studio/deep/path.js'));
    check('prod + cổng studio, đường dẫn con của /studio/ cũng bị chặn',
      resStudioSub instanceof Response && resStudioSub.status === 401);

    const resStudioWrong = middleware(new Request('https://prod.example/studio/', {
      headers: { authorization: 'Basic ' + b64('crew:wrongpass') },
    }));
    check('prod + cổng studio, sai mật khẩu => 401', resStudioWrong instanceof Response && resStudioWrong.status === 401);

    const resStudioRight = middleware(new Request('https://prod.example/studio/', {
      headers: { authorization: 'Basic ' + b64('crew:workshop9') },
    }));
    check('prod + cổng studio, đúng user:pass => đi qua thẳng', resStudioRight === undefined);

    // Cổng studio dùng RIÊNG cặp user/pass — mật khẩu của dev không mở được studio ở đây.
    const resStudioDevCreds = middleware(new Request('https://prod.example/studio/', {
      headers: { authorization: 'Basic ' + b64('team:hunter2') },
    }));
    check('prod + cổng studio, mật khẩu của cổng dev KHÔNG mở được /studio/',
      resStudioDevCreds instanceof Response && resStudioDevCreds.status === 401);
  } finally {
    for (const n of [...SITE_VARS, ...STUDIO_VARS]) {
      if (saved[n] === undefined) delete process.env[n]; else process.env[n] = saved[n];
    }
  }

  console.log(fail === 0 ? 'DAT t_vercel_auth' : ('LOI ' + fail + ' muc t_vercel_auth'));
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
