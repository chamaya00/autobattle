/* Hai trang, một engine: `index.html` là XƯỞNG, `play.html` là TRANG CHƠI công khai.
   Kiểm: play.html đúng bằng bản dựng lại từ index.html, đã cắt sạch bảng xưởng, luồng
   arcade chạy đủ ba bước (tiêu đề → nhân vật → màn → đánh), hết trận thì hiện dải nút,
   gói phát hành assets/pack/pack.json được nạp, và xưởng vẫn vào trận bằng MỘT cú bấm. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { build, buildPlay, playwright, ROOT } = require('./probe');

let loi = [];
const ok = (dk, msg) => { console.log(`${dk ? ' dat  ' : ' HONG '} ${msg}`); if (!dk) loi.push(msg); };

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAF0lEQVR42mP8z8BQz8DAwMDEgAQGoQAAaEcCAy0i0LcAAAAASUVORK5CYII=';
function wavUrl() {
  const sr = 8000, n = sr / 10, d = Buffer.alloc(44 + n * 2);
  d.write('RIFF', 0); d.writeUInt32LE(36 + n * 2, 4); d.write('WAVE', 8);
  d.write('fmt ', 12); d.writeUInt32LE(16, 16); d.writeUInt16LE(1, 20); d.writeUInt16LE(1, 22);
  d.writeUInt32LE(sr, 24); d.writeUInt32LE(sr * 2, 28); d.writeUInt16LE(2, 32); d.writeUInt16LE(16, 34);
  d.write('data', 36); d.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) d.writeInt16LE(Math.round(Math.sin(i / 6) * 8000), 44 + i * 2);
  return 'data:audio/wav;base64,' + d.toString('base64');
}

(async () => {
  /* ---------- 1. play.html trong repo có đúng là bản dựng từ index.html không ---------- */
  const truoc = fs.existsSync(path.join(ROOT, 'play.html'))
    ? fs.readFileSync(path.join(ROOT, 'play.html'), 'utf8') : '';
  execFileSync('python3', [path.join(ROOT, 'tools', 'mk_play.py')], { stdio: 'pipe' });
  const sau = fs.readFileSync(path.join(ROOT, 'play.html'), 'utf8');
  ok(truoc === sau, 'play.html trong repo dung bang ban dung lai tu index.html (dung sua tay)');

  /* ---------- 2. đã cắt sạch bảng xưởng, engine thì còn nguyên ---------- */
  for (const id of ['slotArea', 'sfxArea', 'testGoku', 'hpK', 'colK', 'rec', 'packExport'])
    ok(!sau.includes(`id="${id}"`), `trang choi khong con o xuong id="${id}"`);
  for (const id of ['arena', 'charSelect', 'stageList', 'arcTitle', 'arcOver', 'play'])
    ok(sau.includes(`id="${id}"`), `trang choi van con id="${id}"`);
  ok(sau.includes('window.ARCADE=1'), 'trang choi bat co ARCADE');

  /* ---------- 3. luồng arcade chạy thật, kèm gói phát hành ---------- */
  const dir = path.dirname(buildPlay());
  fs.mkdirSync(path.join(dir, 'assets', 'pack'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets', 'pack', 'pack.json'), JSON.stringify({
    v: 1, at: '2026-09-08', spr: { kono: { idle: [PNG] }, ginyu: { idle: [PNG] } }, sfx: { punch: wavUrl() }
  }));
  const mime = f => f.endsWith('.json') ? 'application/json' : f.endsWith('.wav') ? 'audio/wav' : 'text/html';
  const sv = http.createServer((rq, rs) => {
    const p = path.join(dir, decodeURIComponent(rq.url.split('?')[0]));
    if (!p.startsWith(dir) || !fs.existsSync(p)) { rs.statusCode = 404; rs.end(); return; }
    rs.setHeader('content-type', mime(p)); rs.end(fs.readFileSync(p));
  });
  await new Promise(r => sv.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${sv.address().port}/play.html`;

  const { chromium } = playwright();
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 820, height: 980 } });
  await page.route('**://fonts.*/**', r => r.abort());
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  ok(await page.evaluate(() => window.__ARCADE()), 'trang choi chay o che do arcade');
  ok(await page.locator('#arcTitle').isVisible(), 'vao trang la thay man tieu de PRESS START');
  ok(!await page.locator('#charSelect').isVisible(), 'chua bam start thi chua mo man chon');

  await page.click('#arcStart');
  await page.waitForTimeout(250);
  /* ---------- PRESS START hoi CACH CHOI truoc ----------
     Nguoi dung: "luc load bam xong start game la chon che do: auto va nguoi choi".
     Ban AUTO la dung ban cu, nen test nay di tiep bang #whoAuto va moi muc ben duoi
     phai ra y nguyen nhu truoc. */
  ok(await page.locator('#arcWho').isVisible(), 'bam START thi hoi CACH CHOI truoc');
  ok(!await page.locator('#charSelect').isVisible(), 'chua chon cach choi thi chua mo man chon');
  ok(await page.evaluate(() =>
       [...document.querySelectorAll('#arcWho .whoCard')].filter(b => b.offsetParent).length) === 2,
     'man hoi cach choi co dung hai the');
  await page.click('#whoAuto');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.__PLAYKIND()) === 'auto', 'chon ban AUTO thi PLAYKIND=auto');
  ok(await page.locator('#charSelect').isVisible(), 'bam START thi mo man chon nhan vat');
  /* Ban AUTO khong duoc thay the Phieu luu, va van du dung sau the che do cu. */
  ok(await page.evaluate(() =>
       getComputedStyle(document.getElementById('mTabAdv')).display) === 'none',
     'ban AUTO khong thay the Phieu luu');
  /* ---------- BƯỚC ĐẦU TIÊN LÀ CHỌN CHẾ ĐỘ ----------
     Người dùng: "vào game ấn phát là chọn trc chế độ chơi, xong rồi mới vào phần chọn
     nhân vật". Dải nút chế độ giờ nở ra thành một màn riêng, và mấy bước sau thì
     nó biến mất hẳn. Sáu thẻ: tay đôi · hỗn chiến · đánh đội · ĐÁNH TUẦN TỰ · vòng
     tròn · loại trực tiếp. */
  const md = await page.evaluate(() => ({
    page: document.getElementById('charSelect').dataset.page,
    step: document.getElementById('charSelect').dataset.step,
    h2: document.querySelector('#charSelect h2').textContent,
    the: [...document.querySelectorAll('.cselModes .mTab')].filter(b => b.offsetParent).length,
    luoi: [...document.querySelectorAll('#listA .cTile')].filter(b => b.offsetParent).length,
    lui: !document.getElementById('cselBack').classList.contains('off')
  }));
  ok(md.page === 'mode', `bam START la ra man CHON CHE DO truoc (${md.page})`);
  ok(md.step === 'mode', `mang data-step mode (${md.step})`);
  ok(/MODE|CHE DO|CHẾ ĐỘ/i.test(md.h2), `tieu de ghi dang chon che do (${md.h2})`);
  ok(md.the === 6, `du sau the che do tren man rieng (${md.the})`);
  ok(md.luoi === 0, 'man chon che do chua hien luoi nhan vat');
  ok(!md.lui, 'buoc dau khong co nut quay lai');
  await page.click('#cselGo');
  await page.waitForTimeout(250);
  ok(await page.evaluate(() => document.getElementById('charSelect').dataset.page) === 'p1',
     'chon che do xong moi toi NGUOI CHOI 1');
  ok(await page.evaluate(() =>
       [...document.querySelectorAll('.cselModes .mTab')].filter(b => b.offsetParent).length) === 0,
     'sang buoc chon nhan vat thi dai che do bien mat');
  ok(!await page.locator('#stageList .sTile').first().isVisible(), 'trang nhan vat thi chua hien luoi man');

  /* Chọn P1 xong mới tới P2 — người dùng bác lối để hai cột cạnh nhau.
     Cột của bên kia phải ĐANG ẨN, không thì vẫn là màn hai cột như cũ. */
  ok(!await page.locator('#colB').isVisible(), 'buoc P1 thi con cua P2 dang an');
  ok(await page.evaluate(() => document.querySelectorAll('.pickChip').length) === 0,
     'buoc P1 chua co dai "da chon"');
  await page.click('#listA .cTile[data-key="ginyu"]');
  const khoa = await page.evaluate(() => ({
    hien: document.getElementById('pickSplash').classList.contains('show'),
    ten: document.getElementById('pickSplashName').textContent,
    art: !!document.querySelector('#pickSplashArt img, #pickSplashArt i')
  }));
  ok(khoa.hien && /GINYU/i.test(khoa.ten) && khoa.art,
     `chon fighter co splash art khoa nhan vat (${khoa.ten})`);
  await page.waitForTimeout(1100);
  const giu = await page.evaluate(() => {
    const box=document.getElementById('pickSplash');
    const art=document.getElementById('pickSplashArt');
    return {
      hien:box.classList.contains('show')&&getComputedStyle(box).display!=='none',
      key:box.dataset.key,
      motion:getComputedStyle(art).animationName,
      rig:art.querySelectorAll('.pickRig img').length,
      motes:art.querySelectorAll('.pickMote').length,
      ring:!!art.querySelector('.pickEnergyRing'),
      streaks:document.querySelectorAll('#pickSplash .pickStreak').length
    };
  });
  ok(giu.hien && giu.key==='ginyu', 'showcase Ginyu van nam canh roster sau hon 1 giay');
  ok(/pickArtIdle/.test(giu.motion), `showcase co idle sway/breath motion (${giu.motion})`);
  ok(giu.rig===3, `showcase tach thanh chan/than/dau de chuyen dong 2.5D (${giu.rig} lop)`);
  ok(giu.motes===8 && giu.ring && giu.streaks===3,
     `showcase co aura particles, energy ring va streaks (${giu.motes}/${giu.streaks})`);
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('#pickSplashArt'),'::after').animationName==='pickBodyAura'),
     'showcase co aura bao quanh toan than');
  await page.click('#cselGo');
  await page.waitForTimeout(250);
  const buoc2 = await page.evaluate(() => ({
    page: document.getElementById('charSelect').dataset.page,
    h2: document.querySelector('#charSelect h2').textContent,
    chips: [...document.querySelectorAll('.pickChip b')].map(x => x.childNodes[0].textContent),
    lui: !document.getElementById('cselBack').classList.contains('off')
  }));
  ok(buoc2.page === 'p2', `bam tiep thi sang buoc chon NGUOI CHOI 2 (${buoc2.page})`);
  ok(/2/.test(buoc2.h2), `tieu de doi theo buoc (${buoc2.h2})`);
  ok(buoc2.chips.length === 2, `hien dai "da chon" de van thay P1 (${buoc2.chips.join(' vs ')})`);
  ok(buoc2.lui, 'co nut quay lai o buoc P2');
  ok(!await page.locator('#colA').isVisible(), 'buoc P2 thi con cua P1 dang an');

  await page.click('#listB .cTile[data-key="dora"]');
  await page.click('#cselGo');
  await page.waitForTimeout(250);
  const trang2 = await page.evaluate(() => ({
    page: document.getElementById('charSelect').dataset.page,
    chay: window.__running(), nhan: document.getElementById('cselGo').textContent
  }));
  ok(trang2.page === 'stage', `chon xong P2 thi sang trang CHON MAN (${trang2.page})`);
  ok(!trang2.chay, 'sang trang chon man thi tran VAN CHUA bat dau');
  ok(/FIGHT/i.test(trang2.nhan), `nut doi chu thanh vao tran (${trang2.nhan})`);
  ok(await page.locator('#stageList .sTile[data-stage="space"]').isVisible(), 'luoi man hien ra');

  await page.click('#cselBack');
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => document.getElementById('charSelect').dataset.page) === 'p2',
     'tu trang chon man bam Quay lai thi ve dung buoc P2');
  await page.click('#cselGo');
  await page.waitForTimeout(200);

  await page.click('#stageList .sTile[data-stage="space"]');
  await page.click('#cselGo');
  await page.waitForTimeout(400);
  /* ---------- màn VS trước trận ----------
     Người dùng gửi ảnh màn chọn của Street Fighter II: "icon nhân vật rồi VS rõ ràng rồi
     mới vào". Trận phải ĐỨNG YÊN suốt lúc đó, kể cả màn ra mắt của Ginyu. */
  const vsm = await page.evaluate(() => ({
    hien: !document.getElementById('arcVs').classList.contains('off'),
    mat: document.querySelectorAll('#arcVs .vsPanel').length,
    vs: document.querySelectorAll('#arcVs .vsBig').length,
    ten: [...document.querySelectorAll('#arcVs .vsName')].map(e => e.textContent).join('/'),
    san: (document.getElementById('vsStage') || {}).textContent,
    nen: (document.getElementById('vsStageBg') || {}).style.backgroundImage,
    hud: document.querySelectorAll('#arcVs .vsPlate').length,
    t: window.__G().t
  }));
  ok(vsm.hien, 'bam vao tran thi mo man VS truoc');
  ok(vsm.mat === 2 && vsm.vs === 1, `hai khung nhan vat va mot chu VS (${vsm.mat} khung / ${vsm.vs} VS)`);
  ok(vsm.hud === 2 && /^url\(/.test(vsm.nen), `VS co hai HUD plate va nen san dau that (${vsm.hud} plate)`);
  /* Người dùng: "đừng để nó là icon — để nó là full body với nhiều effect trông như một
     battle thật". Khung phải CAO hơn rộng và vẽ trọn cả người, kèm quầng sáng / vệt tốc độ
     / vũng sáng dưới chân / burst sau chữ VS. */
  const vsfx = await page.evaluate(() => {
    const r = document.getElementById('vsRow'), pn = r.querySelector('.vsPanel');
    const b = pn && pn.getBoundingClientRect();
    return { cao: b ? Math.round(b.height) : 0, rong: b ? Math.round(b.width) : 0,
             fit: getComputedStyle(r.querySelector('.vsBody')).alignItems,
             glow: r.querySelectorAll('.vsGlow').length, lines: r.querySelectorAll('.vsLines').length,
             floor: r.querySelectorAll('.vsFloor').length, burst: r.querySelectorAll('.vsBurst').length,
             lat: getComputedStyle(r.querySelector('.vsSide.b .vsBody')).transform };
  });
  ok(vsfx.cao > vsfx.rong * 1.2 && vsfx.cao > 150,
     `khung doc ve tron ca nguoi chu khong phai icon vuong (${vsfx.rong}x${vsfx.cao})`);
  ok(vsfx.fit === 'flex-end', 'canh day cho hai ben dung cung mot mat san');
  ok(vsfx.glow === 2 && vsfx.lines === 2 && vsfx.floor === 2 && vsfx.burst === 1,
     `du hieu ung: quang sang ${vsfx.glow} · vet toc do ${vsfx.lines} · vung sang chan ${vsfx.floor} · burst ${vsfx.burst}`);
  ok(/GINYU/i.test(vsm.ten) && /DORA/i.test(vsm.ten), `du ten hai ben (${vsm.ten})`);
  ok(vsm.san === 'DEEP SPACE', `co ten man dau (${vsm.san})`);
  await page.waitForTimeout(600);
  const tVs = await page.evaluate(() => window.__G().t);
  ok(tVs === vsm.t, `tran dung yen suot man VS (${vsm.t} -> ${tVs})`);
  await page.click('#arcVs');                       // chạm là vào ngay
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.getElementById('arcVs').classList.contains('off')),
     'cham vao man VS la vao tran ngay');

  const vao = await page.evaluate(() => ({ stage: window.__STAGE(), chay: window.__running(), t: window.__G().t,
    cap: window.__G().fighters.filter(f => !f.summon).map(f => f.key).join(' vs ') }));
  ok(vao.stage === 'space', `vao tran dung man vua chon (${vao.stage})`);
  ok(vao.cap === 'ginyu vs dora', `vao tran dung cap vua chon tung buoc (${vao.cap})`);
  ok(vao.chay, 'tran tu chay ngay, khong bat nguoi choi bam them nut');
  await page.waitForTimeout(600);
  const t2 = await page.evaluate(() => window.__G().t);
  ok(t2 > vao.t, `dong ho tran chay that (${vao.t.toFixed(2)} -> ${t2.toFixed(2)})`);

  /* ---------- hết trận: GIỮ màn WINNER rồi mới hiện dải nút ----------
     Người dùng chốt: "lúc thắng rồi thì hold lại để hiện winner, xong sau đó cho người
     chơi nút". Mốc là `G.endT >= 2` — đúng lúc băng-rôn và pháo giấy bung ra.
     Đo Ở ĐÂY, TRƯỚC lượt chờ nạp gói: giải mã 89 ảnh làm nghẹt luồng chính và đồng hồ
     trận bò rất chậm (đo được `G.t` mới có 0.28 sau cả chục giây), lúc đó mốc endT 2 mất
     hàng phút mới tới và cú bấm cũng không dispatch nổi. */
  await page.evaluate(() => { const g = window.__G(); window.__finish(g.fighters[0]); });
  await page.waitForTimeout(250);
  ok(!await page.locator('#arcOver').isVisible(),
     'vua thang thi CHUA hien nut, con dang giu man WINNER');
  /* Đẩy đồng hồ kết trận BẰNG TAY thay vì ngồi chờ nhịp khung hình: máy chạy test lúc
     nghẹt thì `G.t` bò rất chậm (đo được 0.72 sau 30 giây thật), chờ theo đồng hồ thật là
     đổ oan. Đây là phép đo bám hằng số cân bằng nên gọi thẳng hàm, đúng lối `t_dora` đã
     làm với Time Machine (mục 8). */
  await page.evaluate(() => {
    for (let i = 0; i < 2000 && window.__G().endT < 2.05; i++) window.__step(1 / 120);
  });
  /* Dải nút bật lên trong một `setInterval` 250ms. Máy chạy test lúc nghẹt thì chính cái
     timer đó cũng bị trễ, nên chờ theo TRẠNG THÁI chứ đừng chờ theo một quãng cố định. */
  await page.waitForFunction(() => { const e = document.getElementById('arcOver');
                                     return e && !e.classList.contains('off'); },
                             null, { timeout: 30000 }).catch(() => {});
  ok(await page.locator('#arcOver').isVisible(), 'giu man WINNER xong moi hien dai nut');
  ok(await page.evaluate(() => window.__G().endT >= 2),
     `dai nut hien sau moc endT 2 (${await page.evaluate(() => +window.__G().endT.toFixed(2))})`);
  /* Bấm QUA `evaluate` chứ đừng `page.click`: lúc này luồng chính đang giải mã 89 ảnh của
     gói phát hành, `page.click` dispatch xong còn ngồi chờ trang rảnh tay rồi mới trả về —
     đo được nó treo đủ 30 giây rồi đổ, cả trên nhánh này lẫn trên bản chưa sửa gì.
     Đây là lối `t_comp.js` đã dùng cho `#compGo` / `#arcComp`. */
  await page.evaluate(() => document.getElementById('arcAgain').click());
  await page.waitForTimeout(300);
  /* MỖI TRẬN MỘT SÀN — người dùng: "mỗi trận log vào có thể trc hết là chọn stadium".
     Bấm "Đánh lại" thì hỏi sàn trước, chứ không lao thẳng vào sàn cũ. */
  ok(await page.evaluate(() => !document.getElementById('arcStage').classList.contains('off')),
     'bam Danh lai thi hoi CHON SAN truoc');
  ok(await page.evaluate(() => document.querySelectorAll('#arcStageList .sTile').length) === 12,
     'man hoi san liet ke du muoi hai san');
  await page.evaluate(() => document.querySelector('#arcStageList .sTile[data-stage="roof"]').click());
  await page.evaluate(() => document.getElementById('arcStageGo').click());
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.__STAGE()) === 'roof',
     'san vua chon an vao tran moi (roof)');
  await page.evaluate(() => { const e = document.getElementById('arcVs');
                              if (e && !e.classList.contains('off')) e.click(); });   // bỏ qua màn VS của trận mới
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => window.__running() && !window.__G().over), 'bam Danh lai thi vao tran moi');

  /* gói phát hành: ảnh và tiếng trong pack.json phải vào đúng ô.
     Chờ hẳn bằng waitForFunction — nạp gói còn phải giải mã ảnh và âm thanh. */
  await page.waitForFunction(() => (window.__SPR.kono.idle || []).length > 0, null, { timeout: 25000 })
    .catch(() => {});
  const pack = await page.evaluate(() => ({
    anh: (window.__SPR.kono.idle || []).length, tieng: !!window.__SFXSRC.punch
  }));
  ok(pack.anh === 1, `anh trong goi phat hanh vao dung o (${pack.anh})`);
  ok(pack.tieng, 'tieng trong goi phat hanh cung duoc nap');


  /* ---------- 3b. ĐÁNH ĐỘI cũng đi từng đội một, đúng quy trình 1v1 ----------
     Người dùng: "theo đội cũng vậy — chọn đội 1 trước đội 2 sau, quy trình như 1v1 chứ". */
  await page.click('#pick');
  await page.waitForTimeout(250);
  await page.click('#mTabTeam');
  await page.waitForTimeout(250);
  ok(await page.evaluate(() => document.getElementById('charSelect').dataset.page) === 'mode',
     'bam Doi nhan vat cung ve man CHON CHE DO truoc');
  await page.click('#cselGo');                       // chốt chế độ rồi mới tới đội hình
  await page.waitForTimeout(300);
  const d1 = await page.evaluate(() => ({
    page: document.getElementById('charSelect').dataset.page,
    step: document.getElementById('charSelect').dataset.step,
    h2: document.querySelector('#charSelect h2').textContent,
    khung: [...document.querySelectorAll('#multiPane .cselCol')].filter(b => !b.classList.contains('off')).length,
    chips: document.querySelectorAll('.pickChip').length,
    go: document.getElementById('cselGo').textContent
  }));
  ok(d1.page === 't0', `danh doi bat dau o buoc DOI 1 (${d1.page})`);
  ok(d1.step === 'pick0', `buoc dau mang data-step pick0 (${d1.step})`);
  ok(/TEAM 1/i.test(d1.h2), `tieu de ghi dang chon doi 1 (${d1.h2})`);
  ok(d1.khung === 1, `chi hien DUNG MOT khung doi hinh (${d1.khung})`);
  ok(d1.chips === 0, 'buoc doi 1 chua co dai "da chon"');
  ok(/Team 2/i.test(d1.go), `nut ghi "Tiep - Doi 2" (${d1.go})`);
  ok(await page.locator('#teamNum').isVisible(), 'buoc doi 1 co hang chon SO DOI');

  await page.click('#cselGo');
  await page.waitForTimeout(300);
  const d2 = await page.evaluate(() => ({
    page: document.getElementById('charSelect').dataset.page,
    h2: document.querySelector('#charSelect h2').textContent,
    khung: [...document.querySelectorAll('#multiPane .cselCol')].filter(b => !b.classList.contains('off')).length,
    nhan: [...document.querySelectorAll('.pickChip i')].map(x => x.textContent).join('|'),
    go: document.getElementById('cselGo').textContent
  }));
  ok(d2.page === 't1', `bam Tiep thi sang buoc DOI 2 (${d2.page})`);
  ok(/TEAM 2/i.test(d2.h2), `tieu de doi theo buoc (${d2.h2})`);
  ok(d2.khung === 1, `buoc doi 2 van chi mot khung (${d2.khung})`);
  ok(/Team 1/i.test(d2.nhan) && /Team 2/i.test(d2.nhan), `dai "da chon" giu doi 1 lai (${d2.nhan})`);
  ok(/Stage/i.test(d2.go), `doi cuoi thi nut ghi "Tiep - Chon man" chu khong phai doi 3 (${d2.go})`);
  ok(!await page.locator('#teamNum').isVisible(), 'tu buoc thu hai tro di giau hang chon so doi');

  /* đổi sang 3 đội thì danh sách bước dài thêm một bước */
  await page.click('#cselBack');
  await page.waitForTimeout(200);
  await page.click('#teamNum button:nth-of-type(2)');   // 2 3 4 -> chọn 3
  await page.waitForTimeout(300);
  const ba = await page.evaluate(() => ({
    doi: window.__G && [...document.querySelectorAll('#teamNum button.on')].map(b => b.textContent).join(''),
    page: document.getElementById('charSelect').dataset.page,
    go: document.getElementById('cselGo').textContent
  }));
  ok(ba.doi === '3', `bam so 3 thi thanh ba doi (${ba.doi})`);
  ok(ba.page === 't0' && /Team 2/i.test(ba.go), `van dung o buoc doi 1 (${ba.page} / ${ba.go})`);
  await page.click('#teamNum button:nth-of-type(1)');   // về lại 2 đội
  await page.waitForTimeout(250);

  await page.click('#cselGo'); await page.waitForTimeout(200);
  await page.click('#cselGo'); await page.waitForTimeout(250);
  ok(await page.evaluate(() => document.getElementById('charSelect').dataset.page) === 'stage',
     'chon xong doi cuoi thi sang trang CHON MAN');
  await page.click('#cselGo');
  await page.waitForTimeout(700);
  const tran = await page.evaluate(() => {
    const g = window.__G(), m = g.fighters.filter(f => !f.summon);
    return { mode: g.mode, nguoi: m.length, phe: [...new Set(m.map(f => f.team))].length };
  });
  ok(tran.mode === 'team' && tran.phe === 2, `vao tran dung che do doi, hai phe (${tran.mode}/${tran.phe})`);
  ok(tran.nguoi >= 2, `co du nguoi tren san (${tran.nguoi})`);

  ok(errors.length === 0, `trang choi khong co loi (${errors.slice(0, 2).join(' | ')})`);
  await browser.close(); sv.close();

  /* ---------- 4. xưởng KHÔNG dính vỏ arcade: một cú bấm là vào trận ---------- */
  const b2 = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p2 = await b2.newPage({ viewport: { width: 820, height: 980 } });
  await p2.route('**://fonts.*/**', r => r.abort());
  const e2 = []; p2.on('pageerror', e => e2.push(e.message));
  await p2.goto('file://' + build(), { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(700);
  ok(!await p2.evaluate(() => window.__ARCADE()), 'xuong khong bat che do arcade');
  ok(!await p2.locator('#arcTitle').isVisible(), 'xuong khong co man tieu de');
  ok(await p2.locator('#charSelect').isVisible(), 'xuong mo thang man chon nhan vat');
  await p2.click('#cselGo');
  await p2.waitForTimeout(300);
  ok(!await p2.locator('#charSelect').isVisible(), 'xuong: mot cu bam #cselGo la vao tran (test cu van chay)');
  ok(e2.length === 0, `xuong khong co loi (${e2.slice(0, 2).join(' | ')})`);
  await b2.close();

  /* ---------- 5. bản dựng GIỐNG GITHUB PAGES: xưởng nằm trong /studio/ ----------
     Đây là chỗ đã hỏng thật: `assets` nằm ở gốc site, mà trang xưởng ở trong thư mục con
     nên đường dẫn tương đối thành /studio/assets/… và ăn 404 IM LẶNG — người dùng dán
     ảnh, xuất gói, đẩy lên repo mà mở trang xưởng vẫn thấy model vector. */
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  fs.mkdirSync(path.join(site, 'studio'), { recursive: true });
  fs.mkdirSync(path.join(site, 'assets', 'pack'), { recursive: true });
  fs.copyFileSync(buildPlay(), path.join(site, 'index.html'));       // trang chơi ở GỐC
  fs.copyFileSync(build(), path.join(site, 'studio', 'index.html')); // xưởng trong THƯ MỤC CON
  fs.writeFileSync(path.join(site, 'assets', 'pack', 'pack.json'), JSON.stringify({
    v: 1, at: '2026-09-08', spr: { kono: { idle: [PNG] } }, sfx: { punch: wavUrl() }
  }));
  const sv2 = http.createServer((rq, rs) => {
    const p = path.join(site, decodeURIComponent(rq.url.split('?')[0]).replace(/\/$/, '/index.html'));
    if (!p.startsWith(site) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rs.statusCode = 404; rs.end(); return; }
    rs.setHeader('content-type', mime(p)); rs.end(fs.readFileSync(p));
  });
  await new Promise(r => sv2.listen(0, '127.0.0.1', r));
  const goc = `http://127.0.0.1:${sv2.address().port}`;

  const b3 = await chromium.launch();
  /* Trang XƯỞNG cần rộng bụng hơn hẳn: nó đọc kho của máy TRƯỚC (hơn tám chục khoá
     IndexedDB, mục 2e) rồi mới tới gói, mà `fetchAsset` còn phải ăn một cú 404 ở mức ''
     trước khi dò sang '../'. Ba giây là quá sát — đo được nó đổ ngay cả khi gói vẫn về đủ. */
  for (const [ten, u, cho] of [['trang choi', goc + '/', 4], ['xuong', goc + '/studio/', 12]]) {
    const p3 = await b3.newPage({ viewport: { width: 820, height: 980 } });
    await p3.route('**://fonts.*/**', r => r.abort());
    const e3 = []; p3.on('pageerror', e => e3.push(e.message));
    await p3.goto(u, { waitUntil: 'domcontentloaded' });
    let n = 0;
    for (let i = 0; i < cho * 4; i++) {
      n = await p3.evaluate(() => ((window.__SPR.kono || {}).idle || []).length);
      if (n) break;
      await p3.waitForTimeout(250);
    }
    ok(n === 1, `${ten}: goi phat hanh o goc site van nap duoc (${n} anh)`);
    ok(e3.length === 0, `${ten}: khong co loi trang (${e3.slice(0, 2).join(' | ')})`);
    await p3.close();
  }
  await b3.close(); sv2.close();

  /* ---------- 6. màn chờ: LOAD HẾT RỒI MỚI CHO VÀO ----------
     Người dùng bác nút "Vào luôn, khỏi chờ": vào sớm là thấy model vector. Giờ không có
     cửa vào sớm nào cả — chỉ có nút TẢI LẠI khi cú tải đứt giữa chừng, và site không hề
     có gói thì vẫn phải cho vào (bắt bấm ở đó là nhốt luôn người chơi). */
  const site2 = fs.mkdtempSync(path.join(os.tmpdir(), 'boot-'));
  fs.mkdirSync(path.join(site2, 'assets', 'pack'), { recursive: true });
  fs.copyFileSync(buildPlay(), path.join(site2, 'index.html'));
  const goi = JSON.stringify({ v: 1, at: '2026-09-09', spr: { kono: { idle: [PNG] } }, sfx: {} });
  fs.writeFileSync(path.join(site2, 'assets', 'pack', 'pack.json'), goi);
  let dut = 0, coGoi = true;              // dut>0: cú tải đầu bị cắt ngang giữa thân file
  const sv3 = http.createServer((rq, rs) => {
    const rel = decodeURIComponent(rq.url.split('?')[0]).replace(/\/$/, '/index.html');
    if (rel.endsWith('pack.json')) {
      if (!coGoi) { rs.statusCode = 404; rs.end(); return; }
      rs.setHeader('content-type', 'application/json');
      rs.setHeader('content-length', String(Buffer.byteLength(goi)));
      if (dut > 0) { dut--; rs.write(goi.slice(0, 40)); setTimeout(() => rs.socket.destroy(), 40); return; }
      rs.end(goi); return;
    }
    const f = path.join(site2, rel);
    if (!f.startsWith(site2) || !fs.existsSync(f)) { rs.statusCode = 404; rs.end(); return; }
    rs.setHeader('content-type', mime(f)); rs.end(fs.readFileSync(f));
  });
  await new Promise(r => sv3.listen(0, '127.0.0.1', r));
  const goc3 = `http://127.0.0.1:${sv3.address().port}/`;
  const b4 = await chromium.launch();
  const moBoot = async () => {
    const q = await b4.newPage({ viewport: { width: 820, height: 980 } });
    await q.route('**://fonts.*/**', r => r.abort());
    await q.goto(goc3, { waitUntil: 'domcontentloaded' });
    return q;
  };
  const hienRa = (q, id) => q.evaluate(i => {
    const e = document.getElementById(i);
    return !!e && !e.classList.contains('off') && e.style.display !== 'none';
  }, id);
  const demAnh = q => q.evaluate(() => ((window.__SPR.kono || {}).idle || []).length);

  let q1 = await moBoot();
  ok(await q1.evaluate(() => !document.getElementById('bootSkip')), 'man cho: khong con nut "vao luon, khoi cho"');
  ok(await q1.evaluate(() => !/khỏi chờ|Skip and play/.test(document.body.innerText || '')),
    'man cho: khong con dong chu nao moi vao som');
  let na = 0;
  for (let i = 0; i < 40 && !na; i++) { na = await demAnh(q1); if (!na) await q1.waitForTimeout(200); }
  ok(na === 1, `man cho: goi ve du roi moi thoi (${na} anh)`);
  await q1.waitForTimeout(400);
  ok(!(await hienRa(q1, 'arcBoot')), 'man cho: tai xong thi tat');
  ok(await hienRa(q1, 'arcTitle'), 'man cho: sang thang man tieu de');
  await q1.close();

  dut = 1;
  const q2 = await moBoot();
  let bao = false;
  for (let i = 0; i < 60 && !bao; i++) { bao = await hienRa(q2, 'bootFail'); if (!bao) await q2.waitForTimeout(200); }
  ok(bao, 'tai dut giua chung: hien dong loi + nut tai lai');
  ok(await hienRa(q2, 'arcBoot'), 'tai dut: van dung nguyen trong man cho, KHONG tha vao game');
  ok((await demAnh(q2)) === 0, 'tai dut: chua nap duoc anh nao');
  await q2.click('#bootRetry');
  na = 0;
  for (let i = 0; i < 40 && !na; i++) { na = await demAnh(q2); if (!na) await q2.waitForTimeout(200); }
  ok(na === 1, `bam tai lai: goi ve du (${na} anh)`);
  await q2.waitForTimeout(400);
  ok(!(await hienRa(q2, 'arcBoot')), 'bam tai lai: xong roi moi tat man cho');
  await q2.close();

  coGoi = false;
  const q3 = await moBoot();
  let tat = false;
  for (let i = 0; i < 40 && !tat; i++) { tat = !(await hienRa(q3, 'arcBoot')); if (!tat) await q3.waitForTimeout(200); }
  ok(tat, 'site khong he co pack.json thi van vao duoc, khong nhot nguoi choi');
  await q3.close();
  await b4.close(); sv3.close();

  console.log(loi.length ? `\nHONG ${loi.length} muc` : '\nDAT het');
  process.exit(loi.length ? 1 : 0);
})();
