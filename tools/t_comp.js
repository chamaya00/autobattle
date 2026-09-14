/* Hai chế độ giải đấu: LEAGUE (vòng tròn tính điểm) và TOURNAMENT (loại trực tiếp).
   Kiểm: lịch vòng tròn ai cũng gặp ai đúng một lượt, bảng xếp hạng cộng điểm và xếp
   thứ tự đúng, sơ đồ nhánh đủ vòng + trận tranh hạng ba, xếp nhánh bốc thăm / tự xếp,
   và cả hai giải chạy được từ trận đầu tới lúc có nhà vô địch. */
const path = require('path');
const { buildPlay, playwright } = require('./probe');

let loi = [];
const ok = (dk, msg) => { console.log(`${dk ? ' dat  ' : ' HONG '} ${msg}`); if (!dk) loi.push(msg); };

/* Trang chơi giờ có màn VS trước mỗi trận và một nút đi tiếp sau khi thắng, thay cho lối
   tự nhảy sang bảng xếp hạng. Hai hàm con này đi qua đúng hai chỗ đó. */
/* Bấm qua `evaluate` chứ đừng `page.click`: máy chạy test lúc nghẹt thì Playwright bấm
   xong còn ngồi chờ "trang đứng yên" và hết giờ (đã dính đúng ở nút này). */
/* MỖI TRẬN CỦA GIẢI GIỜ ĐƯỢC CHỌN SÀN RIÊNG — người dùng: "league match thì mỗi trận vào
   là đc chọn 1 background chứ k phải là chọn 1 background cho cả league". Nên bấm ▶ xong
   phải chốt sàn rồi trận mới bắt đầu. */
async function quaChonSan(page, san) {
  for (let i = 0; i < 20; i++) {
    if (!await page.evaluate(() => { const e = document.getElementById('arcStage');
                                     return !!e && !e.classList.contains('off'); })) return;
    if (san) await page.evaluate(k => {
      const b = document.querySelector(`#arcStageList .sTile[data-stage="${k}"]`); if (b) b.click();
    }, san);
    await page.evaluate(() => document.getElementById('arcStageGo').click());
    await page.waitForTimeout(80);
  }
}
async function boQuaVs(page) {
  for (let i = 0; i < 20; i++) {
    if (!await page.evaluate(() => { const e = document.getElementById('arcVs');
                                     return !!e && !e.classList.contains('off'); })) return;
    await page.evaluate(() => document.getElementById('arcVs').click());
    await page.waitForTimeout(80);
  }
}
/* Đẩy đồng hồ kết trận BẰNG TAY tới mốc hiện nút (`G.endT >= 2`) rồi mới bấm: chờ theo
   đồng hồ thật thì một giải tám trận ngồi chờ cả phút, mà máy nghẹt còn không tới mốc. */
async function tuaHetTran(page) {
  await page.evaluate(() => {
    for (let i = 0; i < 3000 && window.__G().endT < 2.05; i++) window.__step(1 / 120);
  });
}
async function sangBang(page) {
  await tuaHetTran(page);
  for (let i = 0; i < 80; i++) {
    if (await page.evaluate(() => { const e = document.getElementById('compBoard');
                                    return !!e && !e.classList.contains('off'); })) return;
    await page.evaluate(() => { const b = document.getElementById('arcComp');
                                if (b && b.offsetParent) b.click(); });
    await page.waitForTimeout(200);
  }
}
/* Đá cho hết một giải: mỗi trận cứ ép bên A thắng ngay, khỏi ngồi xem đủ mấy chục giây. */
async function daHet(page, tran) {
  for (let i = 0; i < tran + 2; i++) {
    if (!await page.evaluate(() => !!window.__compNext())) break;
    await page.evaluate(() => document.getElementById('compGo').click());
    await quaChonSan(page);
    await boQuaVs(page);
    await page.waitForTimeout(320);
    const cap = await page.evaluate(() => window.__G().fighters.filter(f => !f.summon).map(f => f.key));
    await page.evaluate(k => window.__compWin(k), cap[0]);
    await sangBang(page);
  }
}

(async () => {
  const { chromium } = playwright();
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 880, height: 1200 } });
  await page.route('**://fonts.*/**', r => r.abort());
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + buildPlay(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const doc = (fn, a) => page.evaluate(fn, a);

  /* ---------- lịch vòng tròn ---------- */
  const lich = await doc(() => {
    const out = {};
    for (const n of [3, 4, 5, 8, 9, 12]) {
      const rs = window.__roundRobin(n);
      const dem = {}, cap = new Set();
      let tran = 0;
      for (const vong of rs) for (const [a, b] of vong) {
        tran++; cap.add([a, b].sort().join('-'));
        dem[a] = (dem[a] || 0) + 1; dem[b] = (dem[b] || 0) + 1;
      }
      out[n] = { vong: rs.length, tran, rieng: cap.size, du: Object.keys(dem).length,
                 deu: Object.values(dem).every(v => v === n - 1) };
    }
    return out;
  });
  for (const n of [3, 4, 5, 8, 9, 12]) {
    const L = lich[n], can = n * (n - 1) / 2;
    ok(L.tran === can && L.rieng === can, `${n} nguoi: ${can} tran, khong cap nao gap lai (${L.tran}/${L.rieng})`);
    ok(L.deu && L.du === n, `${n} nguoi: ai cung da dung ${n - 1} tran (${L.du} nguoi)`);
    ok(L.vong === (n % 2 ? n : n - 1), `${n} nguoi: ${L.vong} vong`);
  }

  await page.click('#arcStart');
  await page.waitForTimeout(250);
  /* PRESS START hoi CACH CHOI truoc (ban auto / ban nguoi choi). Giai dau o day di duong
     AUTO — dung bang cu. */
  await page.click('#whoAuto');
  await page.waitForTimeout(400);

  /* ---------- LEAGUE ---------- */
  await page.click('#mTabLeague');
  await page.waitForTimeout(300);
  /* Bấm START ra MÀN CHỌN CHẾ ĐỘ trước (mục 2e), chốt chế độ rồi mới tới dàn đấu thủ. */
  await page.click('#cselGo');
  await page.waitForTimeout(350);
  const lp = await doc(() => ({
    h2: document.querySelector('#charSelect h2').textContent,
    go: document.getElementById('cselGo').textContent,
    n: window.__TMP().comp.length
  }));
  ok(/LEAGUE/i.test(lp.h2), `tieu de doi sang chon dan dau thu (${lp.h2})`);
  /* Giải đấu KHÔNG hỏi sàn ở đây — sàn hỏi riêng cho từng trận. Hỏi cả hai chỗ là
     người chơi phải chọn hai lần liền mà lần đầu chẳng dùng vào đâu. */
  ok(await doc(() => window.__cselSteps().indexOf('stage')) < 0,
     `che do giai KHONG con buoc chon man (${await doc(() => window.__cselSteps().join(' -> '))})`);
  ok(/competition|Khai m/i.test(lp.go), `nut doc thang la khai mac giai (${lp.go})`);

  /* Bấm vào một ô đang có trong dàn thì BỎ RA, bấm lại thì thêm vào — không có bản sao.
     Hai cú phải giãn hơn DBL_TAP (380ms), không thì game hiểu là chạm hai lần và mở bảng
     thông số thay vì bật/tắt. */
  await page.click('#grpList0 .cTile[data-key="kono"]');
  await page.waitForTimeout(500);
  const bo = await doc(() => window.__TMP().comp.slice());
  await page.click('#grpList0 .cTile[data-key="kono"]');
  await page.waitForTimeout(500);
  const them = await doc(() => window.__TMP().comp.slice());
  ok(bo.indexOf('kono') < 0, `bam lan nua thi BO RA khoi dan (${bo.join(',')})`);
  ok(them.filter(k => k === 'kono').length === 1, `bam lai thi them dung mot lan (${them.join(',')})`);

  /* ---------- trần người chơi = CẢ BẢNG NHÂN VẬT ----------
     Người dùng: "chỉnh chế độ league cho tối đa nhiều ng chơi nha, chứ có mỗi 8 ng thì
     league quá kém, sau này có nhiều nhân vật hơn thì k thể chỉ có 8 ng đâu". Giải vòng
     tròn không có bản sao nên trần chính là số nhân vật đang có — `LG_MAX = CKEYS.length`.
     Test đọc số ô trong lưới chứ KHÔNG ghim con số 9: thêm nhân vật thì mục này tự đúng. */
  const o = await doc(() => [...document.querySelectorAll('#grpList0 .cTile')].map(x => x.dataset.key));
  for (const k of o) {
    if (await doc(k => window.__TMP().comp.indexOf(k) >= 0, k)) continue;
    await page.click(`#grpList0 .cTile[data-key="${k}"]`);
    await page.waitForTimeout(430);   // giãn hơn DBL_TAP, không thì thành chạm hai lần
  }
  const het = await doc(() => ({
    n: window.__TMP().comp.length,
    khoa: document.getElementById('cselGo').disabled,
    sub: document.querySelector('#charSelect .cselSub').textContent,
    hint: document.querySelector('#lgLegs span:last-child').textContent
  }));
  ok(het.n === o.length, `xep duoc ca bang ${o.length} nhan vat vao mot giai (${het.n})`);
  ok(!het.khoa, 'du ca bang thi nut vao giai van mo');
  ok(het.sub.indexOf('–' + o.length) >= 0, `dong phu ghi dung tran ${o.length} nguoi (${het.sub.trim()})`);
  ok(het.hint.indexOf(String(o.length * (o.length - 1) / 2)) === 0,
     `hang the thuc dem dung so tran (${het.hint})`);

  /* Khối "kết quả đã đá" phải CẮT BỚT khi giải đông người: cả bảng đá lượt đi lượt về là
     hàng trăm trận, mà compPaint() dựng lại cả khối sau MỖI trận. */
  const cat = await doc(() => {
    const ks = window.__TMP().comp.slice();
    const C = window.__leagueNew(ks, 2);
    for (const m of C.fix) { m.w = m.a; m.ga = 0; m.gb = 100; }
    window.__setComp(C, false); window.__compPaint();
    const rows = [...document.querySelectorAll('#compBody .rsList .rsRow')];
    return { tran: C.fix.length, rows: rows.length, cuoi: rows[rows.length - 1].textContent };
  });
  ok(cat.tran > cat.rows, `${cat.tran} tran nhung chi ve ${cat.rows} dong`);
  ok(/\d/.test(cat.cuoi) && cat.rows > 10,
     `dong cuoi dem so tran cu con lai (${cat.cuoi})`);
  await doc(() => { window.__setComp(null, false); });
  for (const k of o.slice(4)) {      // trả dàn về bốn người cho mấy mục sau
    await page.click(`#grpList0 .cTile[data-key="${k}"]`);
    await page.waitForTimeout(430);
  }

  /* ---------- một lượt hay lượt đi lượt về ----------
     Người dùng hỏi lại: "đánh vòng tròn này chưa có lượt đi lượt về đúng không?" — mặc định
     đúng là MỘT LƯỢT, giờ có thêm lựa chọn đá lại lượt về đảo sân. */
  ok(await page.locator('#lgLegs').isVisible(), 'giai vong tron co hang chon the thuc');
  const luot = await doc(() => [...document.querySelectorAll('#lgLegs button')]
    .map(b => b.dataset.legs + (b.className === 'on' ? '*' : '')).join(','));
  ok(luot === '1*,2', `mac dinh la mot luot (${luot})`);

  const hai = await doc(() => {
    const mot = window.__leagueNew(['kono', 'chichi', 'tsubasa', 'shika'], 1);
    const hai = window.__leagueNew(['kono', 'chichi', 'tsubasa', 'shika'], 2);
    const cap = f => f.fix.map(m => m.a + '>' + m.b);
    const c1 = cap(mot), c2 = cap(hai);
    return { n1: mot.fix.length, n2: hai.fix.length, nr1: mot.nr, nr2: hai.nr,
             dau: c2.slice(0, c1.length).join() === c1.join(),
             daoSan: c2.slice(c1.length).every(x => c1.indexOf(x.split('>').reverse().join('>')) >= 0),
             trung: new Set(c2).size === c2.length,
             leg: hai.fix[hai.fix.length - 1].leg };
  });
  ok(hai.n1 === 6 && hai.n2 === 12, `luot ve nhan doi so tran (${hai.n1} -> ${hai.n2})`);
  ok(hai.nr1 === 3 && hai.nr2 === 6, `so vong cung nhan doi (${hai.nr1} -> ${hai.nr2})`);
  ok(hai.dau, 'nua dau cua lich luot ve giong het lich mot luot');
  ok(hai.daoSan, 'nua sau DAO SAN: ai o ben A luot di thi luot ve o ben B');
  ok(hai.trung, 'khong cap nao bi lap y nguyen ca hai luot');
  ok(hai.leg === 2, `tran cuoi mang co luot ve (${hai.leg})`);

  /* GIẢI ĐẤU không còn bước chọn màn ở màn chọn nhân vật — một cú bấm là khai mạc.
     Sàn hỏi riêng cho TỪNG trận, ngay trước khi vào (xem `quaChonSan`). */
  await page.click('#cselGo'); await page.waitForTimeout(500);
  const lb = await doc(() => ({
    mo: !document.getElementById('compBoard').classList.contains('off'),
    hang: document.querySelectorAll('#compBody .lgTab tbody tr').length,
    cot: document.querySelectorAll('#compBody .lgTab thead th').length,
    tong: window.__compTotal(), da: window.__compPlayed(),
    lab: document.querySelector('#compBody .nextLab').textContent
  }));
  ok(lb.mo, 'khai mac xong thi hien BANG XEP HANG chu khong vao tran luon');
  /* Người dùng quay được đúng cảnh này: bấm "Khai mạc giải" mà chớp ra màn VS của CẶP ĐẤU
     TRƯỚC còn sót trong `G.fighters`, kèm nhạc và tiếng của trận cũ chạy sau lưng bảng.
     Nguyên nhân: `#cselGo` gọi `arcFight()` vô điều kiện, kể cả khi vừa mở giải. */
  const kh = await doc(() => ({
    vs: !document.getElementById('arcVs').classList.contains('off'),
    chay: window.__running()
  }));
  ok(!kh.vs, 'khai mac giai thi KHONG chop ra man VS cua tran cu');
  ok(!kh.chay, 'va tran cu khong chay ngam sau lung bang xep hang');
  ok(lb.hang === 4 && lb.tong === 6, `bon nguoi: bang bon hang, sau tran (${lb.hang}/${lb.tong})`);
  ok(lb.cot === 7, `bang du bay cot: hang, ten, P, W, L, hieu so, diem (${lb.cot})`);
  ok(/1\/3/.test(lb.lab), `tran ke tiep ghi ro vong may (${lb.lab})`);

  /* một trận thật: điểm và hiệu số phải nhảy đúng */
  await page.evaluate(() => document.getElementById('compGo').click());
  /* Chọn sàn riêng cho trận này rồi mới vào — mỗi trận một sàn, không dùng lại sàn của
     cả giải nữa. */
  const coSan = await page.evaluate(() => { const e = document.getElementById('arcStage');
                                            return !!e && !e.classList.contains('off'); });
  ok(coSan, 'bam danh tran nay thi hoi CHON SAN rieng cho tran do');
  await quaChonSan(page, 'snow');
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => window.__STAGE()) === 'snow',
     'san chon cho tung tran an vao dung tran do');
  const coVs = await page.evaluate(() => { const e = document.getElementById('arcVs');
                                           return !!e && !e.classList.contains('off'); });
  ok(coVs, 'moi tran cua giai cung mo man VS truoc');
  await boQuaVs(page);
  await page.waitForTimeout(350);
  const cap = await doc(() => window.__G().fighters.filter(f => !f.summon).map(f => f.key));
  /* ---------- HIỆU SỐ = MÁU NGƯỜI THẮNG TRỪ MÁU NGƯỜI THUA ----------
     Thua vì cạn máu thì vế kia là 0 nên con số vẫn đúng bằng máu người thắng như trước;
     chỉ TRẬN HẾT GIỜ mới khác, và đó chính là chỗ người dùng bác: 800–744 là một trận sát
     nút mà bảng lại ghi +800 / −800. Ghim máu hai bên rồi mới kết trận để đo số chính xác. */
  const hs = await doc(k => {
    const G = window.__G();
    const w = G.fighters.find(f => !f.summon && f.key === k);
    const l = G.fighters.find(f => !f.summon && f.key !== k);
    w.hp = 137; l.hp = 0;
    window.__compWin(k);                                 // cho bên B thắng
    const T = window.__COMP().tab, gd = x => T[x].gf - T[x].ga;
    const tr = window.__COMP().fix.find(m => m.w);
    return { win: gd(k), thua: gd(l.key), ga: tr.ga, gb: tr.gb, wk: k, ak: tr.a };
  }, cap[1]);
  ok(hs.win === 137, `doi thu ve 0 mau thi hieu so dung bang mau nguoi thang: +137 (${hs.win})`);
  ok(hs.thua === -137, `nguoi thua bi tru dung bay nhieu (${hs.thua})`);
  ok((hs.wk === hs.ak ? hs.ga : hs.gb) === 137 && (hs.wk === hs.ak ? hs.gb : hs.ga) === 0,
    `dong ket qua in mau con lai cua ca hai ben (${hs.ga}-${hs.gb})`);
  /* ---------- hiệu ứng bảng xếp hạng ----------
     Người dùng: "làm hiệu ứng khi 1 người thắng trận rồi movement thay đổi vị trí và điểm
     số trên bxh cho nó hay". Rình đúng lúc bảng bật lên: style nội tuyến bị đặt về 0 ngay
     từ đầu nên phải đọc `getComputedStyle` mới thấy hàng đang trên đường trượt. */
  /* Không còn tự nhảy sang bảng xếp hạng nữa: giữ màn WINNER rồi hiện nút, người chơi tự
     bấm. Kiểm luôn cả hai vế đó ở đây. */
  await page.waitForTimeout(2400);
  const tuMo = await page.evaluate(() => { const e = document.getElementById('compBoard');
                                           return !!e && !e.classList.contains('off'); });
  ok(!tuMo, 'thang xong thi DUNG lai o man WINNER, khong tu nhay sang bang xep hang');
  /* Nút chỉ hiện khi `G.endT` qua mốc 2 giây TRONG TRẬN. Tua đồng hồ bằng tay rồi chờ
     dải nút theo TRẠNG THÁI — chính cái `setInterval` 250ms bật nó cũng bị trễ khi máy nghẹt. */
  await tuaHetTran(page);
  await page.waitForFunction(() => { const b = document.getElementById('arcComp');
                                     return b && b.offsetParent !== null; },
                             null, { timeout: 25000 }).catch(() => {});
  ok(await page.evaluate(() => { const b = document.getElementById('arcComp');
                                 return !!b && b.offsetParent !== null; }),
    'hien nut di tiep cho nguoi choi tu bam');
  await sangBang(page);
  const hieuUng = await doc(() => new Promise(res => {
    let xa = 0, soCu = 0, n = 0;
    const xem = () => {
      for (const r of document.querySelectorAll('#compBody .lgTab tbody tr')) {
        const m = getComputedStyle(r).transform;
        if (m && m !== 'none') { const y = Math.abs(parseFloat(m.split(',')[5] || 0)); if (y > xa) xa = y; }
      }
      for (const c of document.querySelectorAll('#compBody .lgTab td[data-b]'))
        if (c.textContent.replace('+', '') !== c.dataset.b) soCu++;
      if (++n < 90) requestAnimationFrame(xem); else res({ xa, soCu });
    };
    requestAnimationFrame(xem);
  }));
  ok(hieuUng.xa > 4, `hang truot that tu cho cu ve cho moi (${hieuUng.xa.toFixed(1)}px)`);
  ok(hieuUng.soCu > 0, `so dem dan len chu khong nhay thang sang so moi (${hieuUng.soCu} khung)`);
  const dep = await doc(() => ({
    mui: document.querySelectorAll('#compBody .lgTab td.r i').length,
    vua: document.querySelectorAll('#compBody .lgTab tr.just').length,
    dung: [...document.querySelectorAll('#compBody .lgTab td[data-b]')]
            .every(c => c.textContent.replace('+', '') === c.dataset.b),
    con: [...document.querySelectorAll('#compBody .lgTab tbody tr')]
            .filter(r => r.style.transform && r.style.transform !== 'translateY(0px)').length,
    anh: !!window.__lgAnim()
  }));
  ok(dep.vua === 2, `hai nguoi vua da duoc to sang (${dep.vua})`);
  ok(dep.mui >= 1, `co mui ten len xuong cho ai doi thu hang (${dep.mui})`);
  ok(dep.dung && dep.con === 0, 'chay xong thi so dung va moi hang ve dung cho');
  ok(!dep.anh, 'anh chup bang da duoc xoa, khong chay lai lan hai');

  await page.waitForTimeout(400);
  const sau = await doc(k => ({
    mo: !document.getElementById('compBoard').classList.contains('off'),
    thang: window.__COMP().tab[k[1]], thua: window.__COMP().tab[k[0]],
    dau: window.__lgOrder()[0], da: window.__compPlayed()
  }), cap);
  ok(sau.mo, 'da xong mot tran thi bang tu bat lai len');
  ok(sau.thang.w === 1 && sau.thang.pts === 3 && sau.thua.l === 1 && sau.thua.pts === 0,
     `thang duoc 3 diem, thua duoc 0 (${sau.thang.pts}/${sau.thua.pts})`);
  ok(sau.dau === cap[1], `nguoi thang len dau bang (${sau.dau})`);
  ok(sau.da === 1, `moi da mot tran (${sau.da})`);

  await daHet(page, 6);
  const lx = await doc(() => ({ het: window.__compDone(), vd: window.__compChampion(),
    da: window.__compPlayed(), diem: window.__lgOrder().map(k => window.__COMP().tab[k].pts) }));
  ok(lx.het && lx.da === 6, `da het sau tran (${lx.da})`);
  ok(!!lx.vd, `co nha vo dich (${lx.vd})`);
  ok(lx.diem.every((v, i) => i === 0 || lx.diem[i - 1] >= v), `bang xep theo diem giam dan (${lx.diem.join(',')})`);
  ok(!await page.locator('#compGo').isVisible(), 'giai xong thi giau nut danh tran ke tiep');

  /* ---------- TOURNAMENT ---------- */
  await page.click('#compPick'); await page.waitForTimeout(300);
  await page.click('#mTabCup'); await page.waitForTimeout(300);
  await page.click('#cselGo'); await page.waitForTimeout(350);
  ok(await page.locator('#cupSeed').isVisible(), 'che do loai truc tiep co hang chon cach xep nhanh');
  const seed = await doc(() => [...document.querySelectorAll('#cupSeed button')].map(b => b.dataset.seed));
  ok(seed.join(',') === 'random,manual', `du hai lua chon: boc tham va tu xep (${seed.join(',')})`);

  /* 5 người thì nhánh lệch — nút vào giải phải khoá lại */
  await page.click('#grpList0 .cTile[data-key="suzune"]');
  await page.waitForTimeout(250);
  const nam = await doc(() => ({ n: window.__TMP().comp.length, khoa: document.getElementById('cselGo').disabled }));
  ok(nam.n === 5 && nam.khoa, `nam nguoi thi khoa nut vao giai (${nam.n})`);
  await page.click('#grpList0 .cTile[data-key="ginyu"]');
  await page.waitForTimeout(420);
  await page.click('#grpList0 .cTile[data-key="dora"]');
  await page.waitForTimeout(420);
  await page.click('#grpList0 .cTile[data-key="superman"]');
  await page.waitForTimeout(420);
  ok(await doc(() => window.__TMP().comp.length) === 8 && !await doc(() => document.getElementById('cselGo').disabled),
     'du tam nguoi thi mo khoa');

  /* tự xếp nhánh: bấm hai người trong dàn là tráo chỗ cho nhau */
  await page.click('#cupSeed button[data-seed="manual"]');
  await page.waitForTimeout(250);
  const truoc = await doc(() => window.__TMP().comp.slice());
  await page.click('#grpSlots0 .cChip:nth-of-type(1)');
  await page.click('#grpSlots0 .cChip:nth-of-type(3)');
  await page.waitForTimeout(250);
  const traoRoi = await doc(() => window.__TMP().comp.slice());
  ok(traoRoi[0] === truoc[2] && traoRoi[2] === truoc[0],
     `tu xep: bam hai nguoi la trao cho (${truoc.slice(0,3).join(',')} -> ${traoRoi.slice(0,3).join(',')})`);

  /* bốc thăm thì xáo lại thứ tự */
  const trrand = await doc(() => {
    const cu = window.__TMP().comp.slice();
    document.querySelector('#cupSeed button[data-seed="random"]').click();
    return { cu, moi: window.__TMP().comp.slice() };
  });
  await page.waitForTimeout(250);
  ok(trrand.cu.slice().sort().join() === trrand.moi.slice().sort().join(),
     'boc tham chi xao thu tu chu khong doi nguoi');

  /* GIẢI ĐẤU không còn bước chọn màn ở màn chọn nhân vật — một cú bấm là khai mạc.
     Sàn hỏi riêng cho TỪNG trận, ngay trước khi vào (xem `quaChonSan`). */
  await page.click('#cselGo'); await page.waitForTimeout(500);
  const cb = await doc(() => ({
    cot: [...document.querySelectorAll('#compBody .brCol .brHead')].map(h => h.textContent),
    tran: document.querySelectorAll('#compBody .bracket .brM').length,
    ba: !!document.querySelector('#compBody .brThird'),
    tong: window.__compTotal(),
    lab: document.querySelector('#compBody .nextLab').textContent
  }));
  ok(cb.cot.length === 3, `tam nguoi thi co ba vong (${cb.cot.join(' / ')})`);
  ok(cb.tran === 7, `so do co bay tran: 4 tu ket + 2 ban ket + 1 chung ket (${cb.tran})`);
  ok(cb.ba, 'co san o cho tran tranh hang ba');
  ok(cb.tong === 8, `tong tam tran ke ca tranh hang ba (${cb.tong})`);
  ok(/Quarter/i.test(cb.lab), `tran dau tien la tu ket (${cb.lab})`);

  await daHet(page, 8);
  const cx = await doc(() => {
    const C = window.__COMP(), R = C.rounds.length;
    return { het: window.__compDone(), vd: window.__compChampion(), da: window.__compPlayed(),
             ba: C.third.w, ck: C.rounds[R - 1][0] };
  });
  ok(cx.het && cx.da === 8, `da du tam tran (${cx.da})`);
  ok(!!cx.vd && cx.vd === cx.ck.w, `nha vo dich la nguoi thang chung ket (${cx.vd})`);
  ok(!!cx.ba && cx.ba !== cx.vd, `tranh hang ba co ket qua rieng (${cx.ba})`);

  /* ---------- giải lưu dở theo lối tính hiệu số CŨ ----------
     Bản trước lấy sát thương làm hiệu số. Cộng tiếp số của lối mới vào đó là trộn hai đơn
     vị, bảng đọc ra vô nghĩa — nên `loadSaved()` thấy `sc` cũ thì xoá cột hiệu số về 0 mà
     vẫn giữ nguyên điểm / thắng / thua. */
  const cu = await doc(async () => {
    const c = { kind: 'league', sc: 1, keys: ['kono', 'chichi'],
      tab: { kono: { p: 1, w: 1, l: 0, gf: 851, ga: 369, pts: 3 },
             chichi: { p: 1, w: 0, l: 1, gf: 369, ga: 851, pts: 0 } },
      fix: [{ r: 0, a: 'kono', b: 'chichi', w: 'kono', ga: 851, gb: 369, leg: 1 }],
      nr: 1, legs: 1, cur: null };
    await window.__Store.set('cfg_comp', JSON.stringify(c));
    await window.__loadSaved();
    await new Promise(r => setTimeout(r, 400));
    const C = window.__COMP();
    return { sc: C.sc, gf: C.tab.kono.gf, ga: C.tab.kono.ga, pts: C.tab.kono.pts, w: C.tab.kono.w };
  });
  ok(cu.gf === 0 && cu.ga === 0, `giai luu theo loi cu: cot hieu so ve 0 (${cu.gf}/${cu.ga})`);
  ok(cu.pts === 3 && cu.w === 1, `nhung diem va so tran thang giu nguyen (${cu.pts}d / ${cu.w}t)`);
  ok(cu.sc === 3, `danh dau lai sang loi tinh moi (sc=${cu.sc})`);

  /* ---------- trận HẾT GIỜ: chỉ tính phần CHÊNH ----------
     Thua vì cạn máu thì vế kia là 0 nên hiệu số vẫn đúng bằng máu người thắng (đo ở trên).
     Chỗ người dùng bác là trận hết giờ: 800–744 sát nút mà bảng ghi +800 / −800. Dựng một
     giải RIÊNG rồi gọi thẳng `compResult()` — đo theo hằng số thì gọi thẳng hàm, đừng đo
     qua dòng thời gian (mục 8). */
  const ht = await doc(() => {
    const C = window.__leagueNew(['kono', 'chichi'], 1);
    window.__setComp(C, true);
    const m = C.fix[0];
    C.cur = { a: m.a, b: m.b, ref: m };
    const G = window.__G();
    const mains = G.fighters.filter(f => !f.summon);
    const A = mains[0], B = mains[1];
    A.key = m.a; A.gnSoul = null; A.hp = 800; A.summon = false;
    B.key = m.b; B.gnSoul = null; B.hp = 744; B.summon = false;
    window.__compResult(A);
    const T = window.__COMP().tab, gd = x => T[x].gf - T[x].ga;
    return { thang: gd(m.a), thua: gd(m.b), ga: m.ga, gb: m.gb };
  });
  ok(ht.thang === 56, `tran het gio 800-744 chi tinh phan chenh 56 (${ht.thang})`);
  ok(ht.thua === -56, `ben thua cung chi -56 chu khong phai -800 (${ht.thua})`);
  ok(ht.ga === 800 && ht.gb === 744, `dong ket qua van in mau con lai cua ca hai ben (${ht.ga}-${ht.gb})`);

  ok(errors.length === 0, `khong co loi trang (${errors.slice(0, 2).join(' | ')})`);
  await browser.close();

  console.log(loi.length ? `\nHONG ${loi.length} muc` : '\nDAT het');
  process.exit(loi.length ? 1 : 0);
})();
