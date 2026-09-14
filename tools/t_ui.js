/* Đổi tên game, hai ngôn ngữ Anh–Việt, hồ sơ nhân vật và nhạc nền tự chỉnh.
   Kiểm: tên mới có mặt ở cả hai trang, đổi ngôn ngữ là mọi chữ người chơi thấy đổi theo
   và được nhớ lại, hồ sơ tám nhân vật đủ song ngữ và vẽ ra thẻ thật, nhạc nền mặc định
   TẮT và chạy theo ô nhạc bạn tự nạp. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openGame, build, buildPlay, playwright, ROOT } = require('./probe');

let loi = [];
const ok = (dk, msg) => { console.log(`${dk ? ' dat  ' : ' HONG '} ${msg}`); if (!dk) loi.push(msg); };

function fileNhac() {
  const sr = 8000, n = sr / 4, d = Buffer.alloc(44 + n * 2);
  d.write('RIFF', 0); d.writeUInt32LE(36 + n * 2, 4); d.write('WAVE', 8);
  d.write('fmt ', 12); d.writeUInt32LE(16, 16); d.writeUInt16LE(1, 20); d.writeUInt16LE(1, 22);
  d.writeUInt32LE(sr, 24); d.writeUInt32LE(sr * 2, 28); d.writeUInt16LE(2, 32); d.writeUInt16LE(16, 34);
  d.write('data', 36); d.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) d.writeInt16LE(Math.round(Math.sin(i / 20) * 6000), 44 + i * 2);
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-')), 'theme.wav');
  fs.writeFileSync(p, d); return p;
}

(async () => {
  /* ---------- tên game ---------- */
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const play = fs.readFileSync(path.join(ROOT, 'play.html'), 'utf8');
  ok(/<title>Multiverse Battler<\/title>/.test(idx), 'xuong doi ten thanh Multiverse Battler');
  ok(idx.includes('MULTIVERSE <span>BATTLER</span>'), 'tieu de trang xuong da doi ten');
  ok(play.includes('MULTIVERSE<b>BATTLER</b>'), 'man tieu de trang choi da doi ten');
  ok(!/ĐẤU TRƯỜNG|CHIBA/.test(idx), 'khong con ten cu o dau trong index.html');

  const { browser, page, errors } = await openGame('kono', 'chichi', { play: false });
  const doc = (fn, a) => page.evaluate(fn, a);

  /* ---------- hồ sơ nhân vật: đủ song ngữ cho cả tám người ---------- */
  const dex = await doc(() => {
    const out = { thieu: [], it: [] };
    /* Chỉ soi NHÂN VẬT CHƠI ĐƯỢC. Quái của chế độ Phiêu lưu cũng nằm trong `CHARS` (để mọi
       chỗ `CHARS[f.key]` chạy y nguyên) nhưng chúng KHÔNG có thẻ hồ sơ — chúng không bao giờ
       hiện ở màn chọn nhân vật. `CKEYS` là danh sách đã lọc. */
    for (const k of window.__CKEYS()) {
      const d = window.__DEX[k];
      if (!d) { out.thieu.push(k); continue; }
      const st = d.st || {};
      // thanh "do kho" da bo theo yeu cau nguoi dung, chi con bon chi so
      const duSt = ['pow', 'spd', 'rng', 'def'].every(x => st[x] >= 1 && st[x] <= 5) &&
        st.tech === undefined;
      const duNgu = d.role && d.role.vi && d.role.en && d.bio && d.bio.vi && d.bio.en &&
        (d.skills || []).every(s => s.name && s.vi && s.en);
      if (!duSt || !duNgu || (d.skills || []).length < 4) out.it.push(k);
    }
    out.chars = window.__CKEYS().length;
    return out;
  });
  ok(dex.thieu.length === 0, `ca ${dex.chars} nhan vat deu co ho so (thieu: ${dex.thieu.join(',') || 'khong'})`);
  ok(dex.it.length === 0, `ho so nao cung du 4 chi so (khong con do kho), 2 ngon ngu va >=4 chieu (${dex.it.join(',') || 'du'})`);

  // năm thanh chỉ số và số liệu thô giờ nằm ở lối xem CHI TIẾT, nên bật nó lên rồi mới đo
  const the = await doc(() => {
    window.__dexView('full');
    const box = document.getElementById('detailA');
    return { pips: box.querySelectorAll('.pips b').length, on: box.querySelectorAll('.pips b.on').length,
             sk: box.querySelectorAll('.sk').length, chiTiet: !!box.querySelector('.dexRaw .cSkills'),
             hp: (box.querySelector('.dexHpIn') || {}).value };
  });
  ok(the.pips === 20, `bon thanh chi so ve du 20 o (${the.pips})`);
  ok(the.on > 0 && the.on < 20, `thanh chi so co day co vong (${the.on}/20)`);
  ok(the.sk >= 4, `the chieu hien ra day du (${the.sk} chieu)`);
  ok(the.chiTiet, 'van con phan "xem chi tiet so lieu" doc mang skills cu');
  ok(the.hp === '800', `o mau chinh duoc, mac dinh dung chuan 800 (${the.hp})`);
  await doc(() => window.__dexView('simple'));

  /* ---------- đổi ngôn ngữ ----------
     openGame() đã bấm "Vào trận" nên màn chọn đang đóng; mở lại mới bấm được nút trong đó. */
  /* Mặc định là TIẾNG ANH — người dùng: "cứ ưu tiên tiếng anh". */
  ok(await doc(() => window.__LANG()) === 'en', 'mac dinh la tieng Anh');
  await page.click('#pick');
  await page.waitForTimeout(200);
  const en = await doc(() => ({ lang: document.documentElement.lang,
                                go: document.getElementById('cselGo').textContent,
                                sk: document.querySelector('#detailA .sk p').textContent,
                                stage: document.querySelector('#stageList .sTile i').textContent,
                                head: document.querySelector('#charSelect h2').textContent }));
  const CO_DAU = /[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
  ok(en.lang === 'en', 'the html mang lang="en" ngay tu dau');
  ok(/Fight/i.test(en.go), `nut vao tran bang tieng Anh (${en.go})`);
  ok(!CO_DAU.test(en.sk), `mo ta chieu bang tieng Anh ("${en.sk.slice(0, 46)}…")`);
  ok(/SELECT/i.test(en.head), `tieu de man chon bang tieng Anh (${en.head})`);

  await page.click('#charSelect [data-lang-toggle]');
  await page.waitForTimeout(250);
  const vi = await doc(() => ({ lang: document.documentElement.lang,
                                go: document.getElementById('cselGo').textContent,
                                sk: document.querySelector('#detailA .sk p').textContent,
                                stage: document.querySelector('#stageList .sTile i').textContent,
                                head: document.querySelector('#charSelect h2').textContent }));
  ok(vi.lang === 'vi', 'bam nut la doi sang tieng Viet');
  ok(vi.go !== en.go && /Vào trận/i.test(vi.go), `nut vao tran doi chu (${en.go} -> ${vi.go})`);
  ok(vi.sk !== en.sk && CO_DAU.test(vi.sk), `mo ta chieu doi sang tieng Viet ("${vi.sk.slice(0, 46)}…")`);
  ok(vi.stage !== en.stage, `phu de man doi theo (${en.stage} -> ${vi.stage})`);
  ok(/CHỌN/i.test(vi.head), `tieu de man chon doi theo (${vi.head})`);

  const nho = await doc(async () => await window.__Store.get('cfg_lang'));
  ok(nho === 'vi', `ngon ngu duoc nho lai trong kho (${nho})`);
  await page.click('#charSelect [data-lang-toggle]');
  await page.waitForTimeout(200);
  ok(await doc(() => window.__LANG()) === 'en', 'bam lan nua thi ve tieng Anh');

  /* ---------- nhạc nền ----------
     Đóng màn chọn lại: nó phủ kín trang, không bấm được vào bảng ô nhạc phía dưới. */
  await page.click('#cselCancel');
  await page.waitForTimeout(200);
  const m0 = await doc(() => ({ on: window.__MUSIC.on, synth: window.__MUSIC.synth,
                                slots: window.__BGM_SLOTS.length, man: window.__STAGES.length,
                                o: document.getElementById('musicOn').checked }));
  ok(m0.on === false && m0.o === false, 'nhac nen MAC DINH TAT');
  ok(m0.synth === false, 'nhac tu tao cung mac dinh tat');
  /* Đọc theo SỐ MÀN chứ đừng ghim con số: thêm sàn đấu là bảng nhạc tự dài ra một ô. */
  ok(m0.slots === 2 + m0.man, `du o nhac: menu + chung + ${m0.man} man (${m0.slots})`);

  /* Bật nhạc lúc CHƯA có file nào: phải chạy nhạc tự tạo chứ không im ru.
     Trước đây rơi thẳng vào `stopMusic()` — gói phát hành chưa có ô nhạc nào nên người chơi
     bấm bật nhạc xong chẳng nghe gì, cũng chẳng có dòng nào giải thích. */
  const rong = await doc(async () => {
    document.getElementById('musicOn').click();
    await new Promise(r => setTimeout(r, 400));
    return { on: window.__MUSIC.on, chay: !!window.__MUSIC.gain,
             /* nhãn ô nhạc và dòng nhật ký này song ngữ — mặc định giờ là tiếng Anh,
                nên nhận cả hai bản chứ đừng ghim một thứ tiếng */
             noi: [...document.querySelectorAll('#log div')]
                    .some(d => /nhạc tự tạo|built-in track/i.test(d.textContent)) };
  });
  ok(rong.on && rong.chay, 'chua co file nhac nao ma bat nhac thi chay nhac tu tao');
  ok(rong.noi, 'va noi ra mot dong cho biet vi sao');
  await doc(async () => { document.getElementById('musicOn').click(); await new Promise(r => setTimeout(r, 200)); });

  /* Bám theo THỨ TỰ ô chứ đừng bám theo nhãn: nhãn song ngữ, đổi mặc định ngôn ngữ là
     tìm không ra. BGM_SLOTS = menu, chung, rồi sáu màn theo đúng thứ tự STAGES —
     màn Vũ trụ (space) là ô thứ bảy. */
  const oNhac = page.locator('#bgmArea .slotwrap').nth(6);
  await oNhac.locator('input[type=file]').setInputFiles(fileNhac());
  await page.waitForFunction(() => !!window.__BGM.src.bgm_space, null, { timeout: 20000 });
  const m1 = await doc(async () => ({
    co: !!window.__BGM.src.bgm_space,
    kho: !!(await window.__Store.get('bgm_space')),
    chonKhiDangOMan: (window.__setStage('space'), window.__bgmPick()),
    chonManKhac: (window.__setStage('dojo'), window.__bgmPick())
  }));
  ok(m1.co && m1.kho, 'nap nhac vao o thi luu duoc vao kho');
  ok(m1.chonKhiDangOMan === 'bgm_space', `dang danh man Vu tru thi chon dung bai cua man do (${m1.chonKhiDangOMan})`);
  ok(m1.chonManKhac === null, `man chua co nhac va chua co bai chung thi im lang (${m1.chonManKhac})`);

  const goi = await doc(() => { const p = window.__packBuild(); return Object.keys(p.bgm || {}); });
  ok(goi.indexOf('bgm_space') >= 0, `goi phat hanh mang theo ca nhac (${goi.join(',')})`);

  ok(errors.length === 0, `khong co loi trang (${errors.slice(0, 2).join(' | ')})`);
  await browser.close();

  /* ---------- trang chơi cũng đổi được ngôn ngữ ---------- */
  const { chromium } = playwright();
  const b2 = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p2 = await b2.newPage({ viewport: { width: 820, height: 980 } });
  await p2.route('**://fonts.*/**', r => r.abort());
  const e2 = []; p2.on('pageerror', e => e2.push(e.message));
  await p2.goto('file://' + buildPlay(), { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(700);
  ok(await p2.locator('#arcTitle [data-lang-toggle]').isVisible(), 'man tieu de co nut doi ngon ngu');
  ok(await p2.evaluate(() => document.documentElement.lang) === 'en', 'trang choi MO RA LA tieng Anh');
  await p2.click('#arcTitle [data-lang-toggle]');
  await p2.waitForTimeout(200);
  ok(await p2.evaluate(() => document.documentElement.lang) === 'vi', 'bam nut thi doi sang tieng Viet');
  await p2.click('#arcTitle [data-lang-toggle]');
  await p2.waitForTimeout(200);
  ok(await p2.evaluate(() => document.documentElement.lang) === 'en', 'bam lan nua thi ve tieng Anh');
  ok(await p2.locator('#musicOn').count() === 1, 'trang choi van co nut bat nhac');
  ok(await p2.evaluate(() => document.querySelectorAll('#bgmArea').length) === 0,
     'nhung KHONG co bang o nhac (do la do nghe cua xuong)');
  ok(e2.length === 0, `trang choi khong co loi (${e2.slice(0, 2).join(' | ')})`);
  await b2.close();

  /* ---------- tiếng của GIAO DIỆN ----------
     Chín ô mới nằm trong nhóm "Giao diện". Kiểm ba thứ: có đủ ô, ô nào cũng có tiếng tự
     tạo riêng trong `synth()` (đừng rơi vào nhánh `default` — nghe ô nào cũng như ô nào),
     và bấm thật vào màn chọn thì có tiếng phát ra. */
  const UI9 = ['ui_start', 'ui_pick', 'ui_tap', 'ui_next', 'ui_back',
               'ui_vs', 'ui_go', 'ui_board', 'ui_rank'];
  const thieuO = UI9.filter(k => !idx.includes(`['${k}',`));
  ok(thieuO.length === 0, `bang o tieng co du chin o giao dien (thieu: ${thieuO.join(',') || 'khong'})`);
  const thieuCase = UI9.filter(k => !idx.includes(`case '${k}':`));
  ok(thieuCase.length === 0,
     `o nao cung co tieng tu tao rieng trong synth() (thieu: ${thieuCase.join(',') || 'khong'})`);
  ok(idx.includes("ui_start:'Giao diện'"), 'bang nap tieng co tieu de nhom Giao diện');

  const b3 = await playwright().chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p3 = await b3.newPage({ viewport: { width: 900, height: 1000 } });
  await p3.route('**://fonts.*/**', r => r.abort());
  /* Đếm ngay ở tầng WebAudio: `sfx()` nằm trong IIFE nên không bọc từ ngoài được, mà mọi
     tiếng tự tạo đều đi qua `createOscillator`. Đếm nó là biết có kêu hay không. */
  await p3.addInitScript(() => {
    window.__osc = 0;
    const A = window.AudioContext || window.webkitAudioContext;
    const g = A.prototype.createOscillator;
    A.prototype.createOscillator = function () { window.__osc++; return g.call(this); };
  });
  await p3.goto('file://' + build(), { waitUntil: 'domcontentloaded' });
  await p3.waitForTimeout(500);
  const dem = () => p3.evaluate(() => { const n = window.__osc; window.__osc = 0; return n; });
  await dem();
  await p3.click('#listA .cTile[data-key="shika"]');
  await p3.waitForTimeout(250);
  ok(await dem() > 0, 'bam chon nhan vat thi co tieng');
  await p3.click('.sTile[data-stage="forest"]');
  await p3.waitForTimeout(250);
  ok(await dem() > 0, 'bam o man dau thi co tieng');
  await p3.click('#mTabFfa');
  await p3.waitForTimeout(250);
  ok(await dem() > 0, 'bam nut che do thi co tieng');

  /* ---------- THOÁT RA MỘT LÚC RỒI VÀO LẠI VẪN CÒN TIẾNG (iPhone) ----------
     Người dùng: "thoát ra khoảng 1 tg là vào lại game mất tiếng (trên iphone)".
     iOS treo AudioContext khi chạy nền; hai kiểu hỏng đều phải tự cứu được. */
  await p3.click('#mTabDuel');            // cú bấm trên vừa đổi sang hỗn chiến, lưới A bị giấu
  await p3.waitForTimeout(300);
  const trThai = () => p3.evaluate(() => { const c = window.__ac(); return c ? c.state : null; });
  ok(await trThai() !== null, 'da mo AudioContext sau may cu bam');

  /* 1 · state 'suspended' — đúng cảnh chuyển app rồi quay lại */
  await p3.evaluate(() => window.__ac().suspend());
  await p3.waitForTimeout(150);
  ok(await trThai() === 'suspended', 'gia lap thoat app: context bi treo');
  await p3.evaluate(() => window.__audioWake());
  await p3.waitForTimeout(400);
  ok(await trThai() === 'running', `vao lai thi context tu chay lai (${await trThai()})`);
  await dem();
  await p3.click('#listA .cTile[data-key="kono"]');
  await p3.waitForTimeout(250);
  ok(await dem() > 0, 'va bam nut thi lai co tieng');

  /* 2 · cú CHẠM cũng phải tự đánh thức — trên iOS `resume()` chỉ chắc ăn trong cử chỉ
        người dùng, nên đừng chỉ trông vào sự kiện trang hiện lại. */
  await p3.evaluate(() => window.__ac().suspend());
  await p3.waitForTimeout(150);
  await p3.click('#listA .cTile[data-key="chichi"]');
  await p3.waitForTimeout(400);
  ok(await trThai() === 'running', `mot cu cham bat ky cung danh thuc tieng (${await trThai()})`);

  /* 3 · context CHẾT hẳn (state báo running mà đồng hồ đứng, hoặc đã closed) thì phải
        DỰNG LẠI cái mới chứ `resume()` không cứu nổi. */
  const cu = await p3.evaluate(async () => { const c = window.__ac(); await c.close(); return c.state; });
  ok(cu === 'closed', `gia lap context chet han (${cu})`);
  await p3.evaluate(() => window.__audioWake());
  await p3.waitForTimeout(500);
  ok(await trThai() === 'running' || await trThai() === 'suspended',
     `context chet thi dung lai cai moi (${await trThai()})`);
  await dem();
  await p3.click('#listA .cTile[data-key="shika"]');
  await p3.waitForTimeout(300);
  ok(await dem() > 0, 'dung lai xong van keu binh thuong');

  /* 4 · NHẠC TỰ SINH cũng phải sống lại. `startMusic()` gác ở `if(MUSIC.gain) return`,
        mà mấy node đó thuộc context vừa chết — không dọn là nhạc im hẳn, đúng cái
        "vào lại mất tiếng" người dùng báo. */
  await p3.evaluate(() => { window.__MUSIC.on = true; window.__MUSIC.synth = true; window.__musicStart(); });
  await p3.waitForTimeout(300);
  ok(await p3.evaluate(() => !!window.__MUSIC.gain), 'bat nhac tu sinh thi co node nhac');
  await p3.evaluate(async () => { await window.__ac().close(); });
  await p3.evaluate(() => window.__audioWake());
  await p3.waitForTimeout(500);
  const nhac = await p3.evaluate(() => ({
    co: !!window.__MUSIC.gain, ctx: window.__ac() ? window.__ac().state : null }));
  ok(nhac.co && nhac.ctx !== 'closed',
     `context chet roi song lai thi nhac tu sinh cung dung lai (node: ${nhac.co} · ${nhac.ctx})`);
  await b3.close();

  console.log(loi.length ? `\nHONG ${loi.length} muc` : '\nDAT het');
  process.exit(loi.length ? 1 : 0);
})();
