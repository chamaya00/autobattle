/* Biểu đồ sức mạnh chín trục, hai lối xem skill, và ô máu chỉnh thoải mái ở trang chơi.
   Kiểm: đủ chín tiêu chí cho cả tám nhân vật trên thang 0–100, biểu đồ vẽ ra SVG thật ở
   CẢ HAI lối xem, bảng chấm điểm thang 100 chỉ có ở lối chi tiết, máu chuẩn là 800 và
   người chơi trang công cộng chỉnh được cả từng người lẫn cả bảng, màn rừng đã bỏ chữ Nara. */
const fs = require('fs');
const path = require('path');
const { openGame, buildPlay, playwright, ROOT } = require('./probe');

let loi = [];
const ok = (dk, msg) => { console.log(`${dk ? ' dat  ' : ' HONG '} ${msg}`); if (!dk) loi.push(msg); };

(async () => {
  const { browser, page, errors } = await openGame('shika', 'superman', { play: false });
  const doc = (fn, a) => page.evaluate(fn, a);

  /* ---------- dữ liệu chấm điểm ---------- */
  const so = await doc(() => {
    const out = { truc: window.__PW_AXES.length, thieu: [], ngoai: [], ten: [], tb: {} };
    /* Chỉ soi NHÂN VẬT CHƠI ĐƯỢC — `CKEYS` đã lọc quái của chế độ Phiêu lưu ra. Quái nằm
       trong `CHARS` để mọi chỗ `CHARS[f.key]` chạy y nguyên, nhưng chúng không có biểu đồ
       sức mạnh và không bao giờ hiện ở màn chọn nhân vật. */
    for (const k of window.__CKEYS()) {
      const pw = (window.__DEX[k] || {}).pw;
      if (!pw) { out.thieu.push(k); continue; }
      for (const ax of window.__PW_AXES) {
        const v = pw[ax.key];
        if (typeof v !== 'number' || v < 0 || v > 100) out.ngoai.push(k + '.' + ax.key);
      }
      out.tb[k] = window.__pwAvg(k);
    }
    for (const ax of window.__PW_AXES)
      if (!ax.s || !ax.s.vi || !ax.s.en || !ax.n.vi || !ax.n.en || !ax.d.vi || !ax.d.en) out.ten.push(ax.key);
    return out;
  });
  ok(so.truc === 9, `du chin tieu chi (${so.truc})`);
  ok(so.thieu.length === 0, `toan bo nhan vat deu co bang cham diem (thieu: ${so.thieu.join(',') || 'khong'})`);
  ok(so.ngoai.length === 0, `moi diem nam trong thang 0-100 (${so.ngoai.join(',') || 'dung het'})`);
  ok(so.ten.length === 0, `ten va mo ta tieu chi du hai ngon ngu (${so.ten.join(',') || 'du'})`);
  const tb = Object.values(so.tb);
  ok(Math.min(...tb) >= 40 && Math.max(...tb) <= 85,
    `diem trung binh cua tam nguoi nam trong khoang hop ly (${Math.min(...tb)}-${Math.max(...tb)})`);
  ok(new Set(tb).size >= 5, `moi nguoi mot dang, khong phai copy so cua nhau (${new Set(tb).size} muc khac nhau)`);

  const bac = await doc(() => [0, 10, 20, 40, 55, 70, 90].map(v => window.__pwGrade(v)).join(''));
  ok(bac === 'EEDCBAS', `bac chu cai chia dung sau nac E-D-C-B-A-S (${bac})`);

  /* ---------- biểu đồ vẽ ra SVG thật ---------- */
  await page.click('#pick');
  await page.waitForTimeout(250);
  const don = await doc(() => {
    const box = document.getElementById('detailA'), svg = box.querySelector('svg.radar');
    const b = svg.getBoundingClientRect();
    return { svg: !!svg, vong: svg.querySelectorAll('polygon[stroke-dasharray]').length,
             nan: svg.querySelectorAll('line').length, bac: svg.querySelectorAll('.rGrade').length,
             nhan: svg.querySelectorAll('.rLab').length, cham: svg.querySelectorAll('circle').length,
             rong: Math.round(b.width), cao: Math.round(b.height),
             bang: box.querySelectorAll('.pwRow').length, pips: box.querySelectorAll('.pips b').length,
             tho: !!box.querySelector('.dexRaw') };
  });
  ok(don.svg, 'lo xem DON GIAN co bieu do');
  ok(don.vong === 6, `sau vong net dut, dung bang so bac chu cai (${don.vong})`);
  ok(don.nan === 9 && don.nhan === 9 && don.cham === 9,
    `chin nan hoa, chin nhan, chin cham (${don.nan}/${don.nhan}/${don.cham})`);
  ok(don.bac === 6, `co bac chu cai E-S doc truc 12 gio (${don.bac})`);
  ok(don.rong > 200 && don.cao > 200, `bieu do ve ra co kich thuoc that (${don.rong}x${don.cao})`);
  ok(don.bang === 0 && don.pips === 0 && !don.tho,
    `lo don gian KHONG kem bang cham diem lan so lieu tho (${don.bang}/${don.pips})`);

  /* nhãn phải nằm gọn trong khung SVG — từng bị cắt cụt chữ đầu khi chỗ chừa quá hẹp */
  const tran = await doc(() => {
    const svg = document.querySelector('#detailA svg.radar'), box = svg.getBoundingClientRect();
    let ra = 0;
    for (const t of svg.querySelectorAll('.rLab')) {
      const r = t.getBoundingClientRect();
      if (r.left < box.left - .5 || r.right > box.right + .5) ra++;
    }
    return ra;
  });
  ok(tran === 0, `khong nhan nao bi cat ra ngoai khung (${tran} cai tran)`);

  /* ---------- chạm hai lần vào ô nhân vật thì bật bảng thông số ----------
     Người dùng: "double tap vào icon nhân vật để hiện bảng thông số nhân vật
     (2 nút xem skill sơ lược / chi tiết)". Bắt bằng nhịp bấm chứ không phải sự kiện
     `dblclick` — trên điện thoại cú chạm đôi bị trình duyệt nuốt để phóng to trang. */
  ok(!await page.locator('#dexPop').isVisible(), 'chua cham thi bang thong so dang an');
  await page.click('#listA .cTile[data-key="shika"]');
  await page.waitForTimeout(700);
  ok(!await page.locator('#dexPop').isVisible(), 'mot cu bam thi chi CHON, khong mo bang');

  await page.click('#listA .cTile[data-key="ginyu"]');
  await page.click('#listA .cTile[data-key="ginyu"]');
  await page.waitForTimeout(300);
  const pop = await doc(() => ({
    hien: !document.getElementById('dexPop').classList.contains('off'),
    ten: (document.querySelector('#dexPopBody .dexId b') || {}).textContent,
    nut: document.querySelectorAll('#dexPop .vTab').length,
    radar: !!document.querySelector('#dexPopBody svg.radar'),
    bang: document.querySelectorAll('#dexPopBody .pwRow').length
  }));
  ok(pop.hien, 'cham hai lan thi bang thong so bat len');
  ok(/Ginyu/i.test(pop.ten || ''), `dung nhan vat vua cham (${pop.ten})`);
  ok(pop.nut === 2, `trong bang co du HAI nut xem skill (${pop.nut})`);
  ok(pop.radar && pop.bang === 0, `lo so luoc: co bieu do, chua co bang cham diem (${pop.bang})`);

  await page.click('#dexPop .vTab[data-view="full"]');
  await page.waitForTimeout(250);
  const popCt = await doc(() => ({
    bang: document.querySelectorAll('#dexPopBody .pwRow').length,
    ngoai: [...document.querySelectorAll('.cselOpts .vTab')]
             .filter(b => b.classList.contains('on')).map(b => b.dataset.view).join('')
  }));
  ok(popCt.bang === 9, `bam Chi tiet ngay trong bang thi hien du chin dong (${popCt.bang})`);
  ok(popCt.ngoai === 'full', `cap nut ngoai man chon di theo cung mot lua chon (${popCt.ngoai})`);

  await page.click('#dexPopX');
  await page.waitForTimeout(200);
  ok(!await page.locator('#dexPop').isVisible(), 'bam X thi dong bang');
  await page.click('#listA .cTile[data-key="dora"]');
  await page.click('#listA .cTile[data-key="dora"]');
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ok(!await page.locator('#dexPop').isVisible(), 'phim Esc cung dong duoc');

  /* hai cú bấm cách xa nhau thì KHÔNG được tính là chạm hai lần */
  await page.click('#listA .cTile[data-key="kono"]');
  await page.waitForTimeout(900);
  await page.click('#listA .cTile[data-key="kono"]');
  await page.waitForTimeout(250);
  ok(!await page.locator('#dexPop').isVisible(), 'hai cu bam cach xa nhau thi khong mo bang');
  /* Ở hỗn chiến / đánh đội, chạm vào ô là THÊM một bản sao — cú thứ hai chỉ được mở bảng
     chứ không được nhét thêm người vào đội. */
  await page.click('#mTabFfa');
  await page.waitForTimeout(300);
  const truoc = await doc(() => window.__TMP().ffa.length);
  await page.click('#grpList0 .cTile[data-key="superman"]');
  await page.click('#grpList0 .cTile[data-key="superman"]');
  await page.waitForTimeout(300);
  const sau = await doc(() => window.__TMP().ffa.length);
  ok(!await page.locator('#dexPop').isVisible() === false, 'cham hai lan trong doi hinh cung mo bang');
  ok(sau === truoc + 1, `cham hai lan chi them DUNG MOT nguoi vao doi hinh (${truoc} -> ${sau})`);
  await page.click('#dexPopX');
  await page.waitForTimeout(200);
  await page.click('#mTabDuel');
  await page.waitForTimeout(300);

  /* trả ô A về Shikamaru: mấy mục đo máu phía dưới gõ vào chính ô của người đang chọn */
  await page.click('#listA .cTile[data-key="shika"]');
  await page.click('#vSimple');
  await page.waitForTimeout(200);

  await page.click('#vFull');
  await page.waitForTimeout(200);
  const chi = await doc(() => {
    const box = document.getElementById('detailA');
    return { svg: !!box.querySelector('svg.radar'), bang: box.querySelectorAll('.pwRow').length,
             thanh: box.querySelectorAll('.pwBar i').length, so: box.querySelectorAll('.pwNum').length,
             mota: box.querySelectorAll('.pwRow p').length, pips: box.querySelectorAll('.pips b').length,
             tho: !!box.querySelector('.dexRaw .cSkills'),
             dau: (box.querySelector('.pwNum') || {}).textContent };
  });
  ok(chi.svg, 'lo xem CHI TIET van co bieu do (yeu cau rieng cua nguoi dung)');
  ok(chi.bang === 9 && chi.thanh === 9 && chi.so === 9 && chi.mota === 9,
    `bang cham diem du chin dong, moi dong co thanh - so - mo ta (${chi.bang}/${chi.thanh}/${chi.so}/${chi.mota})`);
  ok(chi.pips === 20, `van con bon thanh chi so 1-5, da bo hang "do kho" (${chi.pips})`);
  ok(chi.tho, 'van mo ra duoc so lieu tho cua mang skills');
  ok(/^\d+[SABCDE]$/.test((chi.dau || '').trim()), `moi dong ghi ca diem lan bac (${chi.dau})`);

  const nho = await doc(async () => {
    window.__dexView('simple');
    await new Promise(r => setTimeout(r, 120));
    return { view: window.__DEXVIEW(), bang: document.querySelectorAll('#detailA .pwRow').length };
  });
  ok(nho.view === 'simple' && nho.bang === 0, 'bam lai nut don gian thi bang cham diem thu ve');

  /* ---------- máu: chuẩn 800, chỉnh thoải mái ---------- */
  const chuan = await doc(() => ({ std: window.__HP_STD, hp: Object.assign({}, window.__HP) }));
  ok(chuan.std === 800, `mau chuan la 800 (${chuan.std})`);
  ok(Object.values(chuan.hp).every(v => v === 800), `ca tam nguoi deu bat dau o 800 (${Object.values(chuan.hp).join(',')})`);

  await page.fill('#detailA .dexHpIn', '2500');
  await page.dispatchEvent('#detailA .dexHpIn', 'change');
  await page.waitForTimeout(200);
  const rieng = await doc(() => ({ shika: window.__HP.shika, sup: window.__HP.superman,
                                   tran: window.__G().fighters.find(f => f.key === 'shika').maxHp }));
  ok(rieng.shika === 2500 && rieng.sup === 800,
    `o mau trong the ho so chi doi dung nguoi do (${rieng.shika} / ${rieng.sup})`);
  ok(rieng.tran === 2500, `mau moi vao thang tran dau (${rieng.tran})`);

  await page.fill('#detailA .dexHpIn', '99999');
  await page.dispatchEvent('#detailA .dexHpIn', 'change');
  await page.waitForTimeout(150);
  ok(await doc(() => window.__HP.shika) === 9999, 'go qua tay thi bi chan lai o tran 9999');

  await page.fill('#hpAll', '1500');
  await page.dispatchEvent('#hpAll', 'change');
  await page.waitForTimeout(200);
  ok(await doc(() => Object.values(window.__HP).every(v => v === 1500)), 'o "mau moi nhan vat" ap cho ca bang');

  await page.click('#hpStd');
  await page.waitForTimeout(200);
  ok(await doc(() => Object.values(window.__HP).every(v => v === 800)), 'nut Chuan keo ca bang ve 800');

  /* ---------- màn rừng bỏ chữ Nara ---------- */
  const man = await doc(() => window.__STAGES.find(s => s.key === 'forest'));
  ok(!/nara/i.test(man.name + man.vn + man.sub.vi + man.sub.en),
    `man rung khong con chu Nara (${man.name} / ${man.vn} / ${man.sub.vi})`);
  ok(man.name === 'FOREST', `ten man la FOREST (${man.name})`);
  const the = await doc(() => [...document.querySelectorAll('.sTile b')].map(b => b.textContent).join('|'));
  ok(the.includes('FOREST') && !/NARA/.test(the), `luoi chon man da doi theo (${the})`);
  // lãnh địa của Shikamaru thì VẪN mang tên nhà Nara — đó là tên chiêu, không phải tên màn
  ok(await doc(() => window.__DEX.shika.skills.some(s => /Nara Clan Forest/.test(s.name))),
    'tuyet chieu cua Shikamaru van giu ten Nara Clan Forest');

  ok(errors.length === 0, `khong co loi trang (${errors.slice(0, 2).join(' | ')})`);
  await browser.close();

  /* ---------- trang chơi: ba thứ trên đều phải có mặt ---------- */
  const { chromium } = playwright();
  const browser2 = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page2 = await browser2.newPage({ viewport: { width: 900, height: 980 } });
  await page2.route('**://fonts.*/**', r => r.abort());
  const loiChoi = [];
  page2.on('pageerror', e => loiChoi.push(e.message));
  await page2.goto('file://' + buildPlay(), { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(700);
  await page2.click('#arcStart');                 // trang chơi vào bằng màn tiêu đề
  await page2.waitForTimeout(250);
  await page2.click('#whoAuto');                  // rồi chọn cách chơi: đây đi đường AUTO
  await page2.waitForTimeout(300);
  await page2.click('#cselGo');                   // bước đầu là CHỌN CHẾ ĐỘ, chốt rồi mới tới nhân vật
  await page2.waitForTimeout(350);
  const doc2 = (fn) => page2.evaluate(fn);
  const choi = await doc2(() => ({
    tab: document.querySelectorAll('.cselOpts .vTab').length,   // bảng bật lên có thêm hai nút nữa
    hpAll: !!document.getElementById('hpAll'), hpStd: !!document.getElementById('hpStd'),
    hpIn: !!document.querySelector('#detailA .dexHpIn'),
    radar: !!document.querySelector('#detailA svg.radar'),
    xuong: !!document.getElementById('hpK') && !!document.querySelector('#slotArea') }));
  ok(choi.tab === 2, `trang choi co du hai nut lo xem skill (${choi.tab})`);
  ok(choi.hpAll && choi.hpStd && choi.hpIn, 'trang choi chinh duoc mau: ca o rieng lan o chung lan nut Chuan');
  ok(choi.radar, 'trang choi co bieu do suc manh');
  ok(!choi.xuong, 'trang choi van khong co thanh cong cu cua xuong');

  await page2.fill('#detailA .dexHpIn', '1200');
  await page2.dispatchEvent('#detailA .dexHpIn', 'change');
  await page2.waitForTimeout(200);
  ok(await doc2(() => window.__HP[document.querySelector('#detailA .dexHpIn').dataset.hpkey]) === 1200,
    'nguoi choi doi mau tren trang cong cong duoc');
  ok(loiChoi.length === 0, `trang choi khong co loi (${loiChoi.slice(0, 2).join(' | ')})`);
  await browser2.close();

  /* ---------- play.html là bản dựng đúng từ index.html ---------- */
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(!/NARA FOREST/.test(idx), 'khong con chuoi NARA FOREST trong bang STAGES');
  ok(/const HP_STD=800/.test(idx), 'mau chuan khai bang mot hang so duy nhat');

  console.log(loi.length ? `\nHONG ${loi.length} muc` : '\nDAT het');
  process.exit(loi.length ? 1 : 0);
})();
