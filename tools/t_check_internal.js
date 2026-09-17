// Kiểm rằng KHÔNG có trang HTML nội bộ nào lọt ra gốc site công khai.
//
// Luật (xem docs/deploy-vercel.md, "Gating /studio/ on the public project"): trang
// duy nhất được phép đứng ở "site/<tên>.html" (gốc site, công khai) là play.html ->
// site/index.html. Mọi trang khác — showcase-v4-preview.html hôm nay, bất cứ trang
// nội bộ nào thêm sau này — PHẢI đổ vào "site/studio/<tên>" trong CẢ HAI kịch bản
// build (.github/workflows/pages.yml và tools/vercel_build.sh), để nó đi chung với
// gate STUDIO_BASIC_AUTH_* của middleware.js thay vì chỉ "giấu đường dẫn".
//
// Test này không chạy trình duyệt — chỉ đọc hai kịch bản build như văn bản và soi
// từng dòng `cp *.html ...`. Không cần biết tên file mới là gì: quên đổ nó vào
// site/studio/ ở MỘT trong hai script là test đổ ngay, không phải nhớ thêm entry
// vào đây mỗi lần thêm trang.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('OK   ' + name); }
  else { fail++; console.log('FAIL ' + name); }
}

const PAGES_YML = path.join(ROOT, '.github', 'workflows', 'pages.yml');
const VERCEL_SH = path.join(ROOT, 'tools', 'vercel_build.sh');

// Trang DUY NHẤT được phép đứng ở gốc site (công khai): play.html -> site/index.html.
const PUBLIC_ENTRY_SRC = 'play.html';
const PUBLIC_ENTRY_DEST = 'site/index.html';

function extractCopies(text) {
  // `cp <src>.html <dest>.html`, bỏ qua nhánh điều kiện `[ -f x ] &&` phía trước —
  // regex chỉ cần bắt đúng cặp src/dest ngay sau "cp ".
  const re = /\bcp\s+(\S+\.html)\s+(\S+\.html)\b/g;
  const out = [];
  let m;
  while ((m = re.exec(text))) out.push({ src: m[1], dest: m[2] });
  return out;
}

function baseName(p) { return path.basename(p); }

function run() {
  const pagesText = fs.readFileSync(PAGES_YML, 'utf8');
  const vercelText = fs.readFileSync(VERCEL_SH, 'utf8');

  const pagesCopies = extractCopies(pagesText);
  const vercelCopies = extractCopies(vercelText);

  check('pages.yml có ít nhất một dòng cp *.html', pagesCopies.length > 0);
  check('vercel_build.sh có ít nhất một dòng cp *.html', vercelCopies.length > 0);

  function checkScript(name, copies) {
    for (const { src, dest } of copies) {
      const isPublicEntry = src === PUBLIC_ENTRY_SRC && dest === PUBLIC_ENTRY_DEST;
      const isUnderStudio = dest.includes('/studio/');
      check(
        `${name}: "${src}" -> "${dest}" là public entry hoặc nằm trong /studio/`,
        isPublicEntry || isUnderStudio
      );
    }
  }
  checkScript('pages.yml', pagesCopies);
  checkScript('vercel_build.sh', vercelCopies);

  // Hai script phải ĐỒNG BỘ: file nào một bên đổ vào /studio/ thì bên kia cũng phải
  // đổ đúng file đó vào /studio/ — đây chính là lỗi đã sửa (vercel_build.sh từng
  // không ship showcase-v4-preview.html chút nào, khác hẳn pages.yml).
  const pagesStudio = new Set(pagesCopies.filter(c => c.dest.includes('/studio/')).map(c => baseName(c.src)));
  const vercelStudio = new Set(vercelCopies.filter(c => c.dest.includes('/studio/')).map(c => baseName(c.src)));
  for (const f of pagesStudio) {
    check(`"${f}" vào /studio/ ở pages.yml thì vercel_build.sh cũng phải vậy`, vercelStudio.has(f));
  }
  for (const f of vercelStudio) {
    check(`"${f}" vào /studio/ ở vercel_build.sh thì pages.yml cũng phải vậy`, pagesStudio.has(f));
  }

  // Mọi file *.html nằm ở GỐC REPO mà không phải index.html/play.html (hai file
  // nguồn của chính engine) đều phải được một trong hai script đổ vào /studio/ —
  // không được đứng yên, không được đi qua tay ai (nằm ngoài cả hai script thì
  // không có trang nào deploy nó, chuyện đó vẫn an toàn hơn là lọt ra gốc site).
  const rootHtml = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
  const engineSrc = new Set(['index.html', 'play.html']);
  for (const f of rootHtml) {
    if (engineSrc.has(f)) continue;
    const inPagesStudio = pagesStudio.has(f);
    const inVercelStudio = vercelStudio.has(f);
    check(
      `trang nội bộ mới "${f}" đã được đổ vào /studio/ ở CẢ HAI script`,
      inPagesStudio && inVercelStudio
    );
  }

  // Markup NỘI BỘ nằm bên TRONG index.html (khác với file đứng riêng ở trên) đi qua
  // cơ chế khác: bọc trong <!--STUDIO-->…<!--/STUDIO--> để mk_play.py cắt hẳn khỏi
  // play.html. Không có cách nào tự đoán "phần tử này có phải nội bộ không" từ hình
  // dạng của nó, NHƯNG một lớp phần tử đã có sẵn quy ước đặt tên — nút thử tay
  // id="test<TênChiêu>" (mục 8 CLAUDE.md: #testEagle, #testForest, #testGinyuAura…).
  // Quên bọc STUDIO cho một nút như vậy thì nó lọt thẳng ra play.html; kiểm bằng
  // cách so KHOÁ ID giữa index.html (có đủ) và play.html đã dựng sẵn (phải KHÔNG có).
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const playHtml = fs.readFileSync(path.join(ROOT, 'play.html'), 'utf8');
  const testIds = [...new Set([...indexHtml.matchAll(/\bid="(test[A-Z][A-Za-z0-9]*)"/g)].map(m => m[1]))];
  check('có ít nhất một nút id="test…" để kiểm (quy ước ở mục 8 CLAUDE.md)', testIds.length > 0);
  for (const id of testIds) {
    check(`nút thử "#${id}" đã bị mk_play.py cắt khỏi play.html (được bọc STUDIO)`, !playHtml.includes(`id="${id}"`));
  }

  console.log(fail === 0 ? 'DAT t_check_internal' : ('LOI ' + fail + ' muc t_check_internal'));
  process.exit(fail === 0 ? 0 : 1);
}

run();
