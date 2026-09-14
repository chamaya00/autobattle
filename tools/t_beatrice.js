/* Beatrice — đo thật trong game, không đọc code.
   Chạy: node tools/t_beatrice.js

   Mấy phép đo bám theo HẰNG SỐ CÂN BẰNG thì gọi thẳng hàm chứ đừng đo theo dòng thời gian
   (mục 9 của CLAUDE.md): trận vẫn chạy nên đòn thường và chiêu của đối thủ xen vào là con
   số lệch ngay. Chỗ nào cần đo nhịp thì chạy tay từng bước bằng __step(). */
const { openGame } = require('./probe');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? '  DAT  ' : '  HONG ') + m); c ? pass++ : fail++; };
const near = (a, b, eps) => Math.abs(a - b) <= eps;

(async () => {
  /* ---------------- trận 1: Beatrice vs ChiChi (cận chiến) ---------------- */
  const { browser, page, errors } = await openGame('beatrice', 'chichi', { play: false });

  const C = await page.evaluate(() => {
    const B = window.__BEA, RT = window.__RT;
    return { R: B.R, range: B.range, refl: B.refl, bodyW: B.bodyW, bodyH: B.bodyH,
             minyaDmg: B.minyaDmg, minyaCd: B.minyaCd * RT, stun: B.minyaStun * RT,
             stunOdds: B.minyaStunOdds,
             shamacDmg: B.shamacDmg, shamacCd: B.shamacCd * RT, shamacStun: B.shamacStun * RT,
             weak: B.shamacWeak, weakT: B.shamacWeakT * RT,
             murakCd: B.murakCd * RT, murakT: B.murakT * RT, murakRes: B.murakRes,
             emtCd: B.emtCd * RT, emtT: B.emtT * RT, emtRefl: B.emtRefl,
             ultCd: B.ultCd * RT, ultAim: B.ultAim * RT, ultGap: B.ultGap * RT,
             ultN: B.ultN, ultDmg: B.ultDmg,
             slowT: B.slowT * RT, slowMul: B.slowMul,
             eroT: B.eroT * RT, eroDps: B.eroDps / RT, eroMax: B.eroMax,
             doorT: B.doorT * RT };
  });

  console.log('\n=== 1. Thong so goc: 800 mau, tam danh 5 x R ===');
  const hp = await page.evaluate(() => window.__HP.beatrice);
  ok(hp === 800, `mau toi da 800 (do: ${hp})`);
  ok(C.R === Math.round(Math.hypot(C.bodyW, C.bodyH) / 2),
     `R = nua duong cheo hop than ${C.bodyW}x${C.bodyH} = ${C.R}`);
  ok(C.range === C.R * 5, `Basic Attack Range = 5 x R = ${C.range}`);
  ok(near(C.refl, C.R * 2.5, .001), `Reflection Radius = 2.5 x R = ${C.refl}`);
  ok(C.minyaDmg === 10 && near(C.minyaCd, 1, .001),
     `Minya ${C.minyaDmg} dmg, mot don moi ${C.minyaCd}s nguoi choi`);
  ok(near(C.stunOdds, .13, .001) && near(C.stun, .5, .001),
     `Minya Stun ${Math.round(C.stunOdds * 100)}% x ${C.stun}s`);
  ok(C.shamacDmg === 9 && near(C.shamacCd, 8.5, .001), `Al Shamac ${C.shamacDmg} dmg / ${C.shamacCd}s`);
  ok(near(C.murakCd, 11.5, .001) && near(C.murakT, 2, .001), `Murak ${C.murakCd}s cd, giu ${C.murakT}s`);
  ok(near(C.emtCd, 13.5, .001) && near(C.emtT, 1.35, .001), `E.M.T ${C.emtCd}s cd, giu ${C.emtT}s`);
  ok(C.ultN === 3 && C.ultDmg === 34 && near(C.ultCd, 11.5, .001),
     `El Minya ${C.ultN} tia x ${C.ultDmg} dmg / ${C.ultCd}s`);
  ok(near(C.eroDps, 1.2, .001) && C.eroMax === 3 && near(C.eroT, 3, .001),
     `Mana Erosion ${C.eroDps} HP/s, tran ${C.eroMax} stack, moi stack ${C.eroT}s`);

  console.log('\n=== 2. Man ra mat: cua Forbidden Library dung 1.5 giay ===');
  const ent = await page.evaluate(async doorT => {
    const G = window.__G(), step = window.__step;
    const f = G.fighters.find(x => x.key === 'beatrice');
    const e = G.fighters.find(x => x.key === 'chichi');
    const hp0 = e.hp, ex = e.x, ey = e.y;
    const hidden = [];
    let locked = 0, frames = 0, tEnd = -1;
    // chay tay tung buoc 1/120 giay trong tran cho toi khi cua bien mat
    for (let i = 0; i < 400 && tEnd < 0; i++) {
      step(1 / 120); frames++;
      if (f.beaEntry) { hidden.push(f.beaHide); if (e.lock > 0) locked++; }
      else tEnd = G.t;
    }
    return { tEnd, frames, locked, hiddenEarly: hidden.slice(0, 4).every(Boolean),
             shownLate: hidden.length > 40 && hidden[hidden.length - 1] === false,
             foeMoved: Math.hypot(e.x - ex, e.y - ey), foeHp: hp0 - e.hp,
             doorT, entryGone: !f.beaEntry, beaHide: f.beaHide };
  }, C.doorT);
  ok(near(ent.tEnd * 2, 1.5, .06), `cua song dung ${(ent.tEnd * 2).toFixed(2)}s nguoi choi (moc 1.5)`);
  ok(ent.hiddenEarly, 'hai pha dau: Beatrice chua co mat tren san');
  ok(ent.shownLate && !ent.beaHide, 'pha ba tro di: co da buoc ra khoi cua');
  ok(ent.locked >= ent.frames - 3, `doi phuong bi khoa suot man ra mat (${ent.locked}/${ent.frames} nhip)`);
  ok(ent.foeMoved < 1, `doi phuong khong di chuyen mot buoc nao (do: ${ent.foeMoved.toFixed(2)}px)`);
  ok(ent.foeHp === 0, 'khong ai mat mot giot mau nao trong man ra mat');

  await page.click('#play');
  await page.waitForTimeout(200);

  console.log('\n=== 3. Minya: 15 dmg, choang 20% va KHONG cong don ===');
  const minya = await page.evaluate(() => {
    const G = window.__G(), B = window.__BEA;
    const f = G.fighters.find(x => x.key === 'beatrice');
    const e = G.fighters.find(x => x.key === 'chichi');
    // khoa ca hai nguoi lai roi ban tay tung vien, khoi bi don khac xen vao
    const freeze = () => { e.stun = 0; e.dash = null; for (const k in e.cds) e.cds[k] = 99; f.cds.s2 = f.cds.s4 = 99; };
    freeze(); e.evade = 0; e.dodge = 0; e.hp = 800;
    const p = { dmg: B.minyaDmg, owner: f };
    const before = e.hp;
    window.__beaMinyaHit(p, e);
    const dmg = before - e.hp;

    // choang: bat cung 100% roi ban hai vien lien tiep, thoi gian phai LAM MOI chu khong cong
    const rnd0 = Math.random;
    Math.random = () => 0;                        // chance(p) = Math.random()<p => luon trung
    e.stun = 0; window.__beaMinyaHit(p, e);
    const s1 = e.stun;
    e.stun = B.minyaStun * .4;                    // con mot phan choang cu dang chay
    window.__beaMinyaHit(p, e);
    const s2 = e.stun;
    Math.random = rnd0;
    return { dmg, s1: s1 * window.__RT, s2: s2 * window.__RT, cap: B.minyaStun * window.__RT };
  });
  ok(minya.dmg === 10, `mot mui Minya an dung ${minya.dmg} dmg`);
  ok(near(minya.s1, C.stun, .01), `choang ra dung ${minya.s1.toFixed(2)}s`);
  ok(near(minya.s2, C.stun, .01),
     `ban them mot vien khi dang choang: LAM MOI ve ${minya.s2.toFixed(2)}s, khong cong thanh ${(C.stun * 1.4).toFixed(2)}s`);

  console.log('\n=== 4. Al Shamac: nem ra sat ria 5R + Shamac Weakness ===');
  const sham = await page.evaluate(() => {
    const G = window.__G(), B = window.__BEA, step = window.__step;
    const f = G.fighters.find(x => x.key === 'beatrice');
    const e = G.fighters.find(x => x.key === 'chichi');
    const out = {};
    /* Đo choáng NGAY lúc nó được đặt: vòng chạy tay còn chạy tiếp sau đó nên đồng hồ đã
       trôi bớt một quãng — đọc ở cuối vòng là ra 0.68 thay vì 1.00. */
    let maxStun = 0;
    const runShamac = () => {
      f.beaUlt = null; f.beaShamac = null; e.beaWarp = null;
      f.lock = 0; f.stun = 0; maxStun = 0;
      window.__beaShamac(f, e);
      for (let i = 0; i < 200 && f.beaShamac; i++) { step(1 / 120); if (e.stun > maxStun) maxStun = e.stun; }
    };
    // dung QUA GAN: phai bi day ra sat ria tam danh
    e.x = f.x + 40; e.y = f.y; e.hp = 800; e.evade = 0; e.dodge = 0; e.stun = 0;
    const nearBefore = Math.hypot(e.x - f.x, e.y - f.y);
    runShamac();
    out.fromNear = Math.hypot(e.x - f.x, e.y - f.y);
    out.nearBefore = nearBefore;
    out.dmg = 800 - e.hp;
    out.stun = maxStun * window.__RT;
    out.weak = e.beaWeak * window.__RT;
    out.inArena = e.x > 0 && e.x < 620 && e.y > 0 && e.y < 620;
    // khong chong len model cua ai
    out.clear = G.fighters.every(o => o === e || !o.alive || Math.hypot(o.x - e.x, o.y - e.y) >= o.r + e.r);
    // Beatrice quay mat ve phia cho moi cua muc tieu
    out.facing = (e.x - f.x >= 0 ? 1 : -1) === f.face || Math.abs(e.x - f.x) <= 18;

    // dung QUA XA: phai bi keo ve sat ria
    e.x = Math.min(600, f.x + 520); e.y = f.y; e.hp = 800; e.stun = 0; e.beaWeak = 0;
    const farBefore = Math.hypot(e.x - f.x, e.y - f.y);
    runShamac();
    out.fromFar = Math.hypot(e.x - f.x, e.y - f.y);
    out.farBefore = farBefore;

    // Shamac Weakness: giam 20% MOI sat thuong muc tieu gay ra, va KHONG cong don
    e.beaWeak = 0; window.__statusTick(e, 0); const outClean = e.dmgOut;
    window.__beaWeaken(e); window.__statusTick(e, 0); const outWeak = e.dmgOut;
    const t1 = e.beaWeak;
    e.beaWeak = B.shamacWeakT * .3;                       // con mot phan dang chay
    window.__beaWeaken(e);
    out.refresh = e.beaWeak;
    out.stackFree = e.beaWeak <= B.shamacWeakT + 1e-6;
    out.cut = outWeak / outClean;
    out.weakT1 = t1 * window.__RT;
    /* Đo thật: một đòn 100 raw của mục tiêu chỉ còn 80. Phải DỰNG LẠI hệ số của Beatrice
       sau khi tắt Murak — dmgTake là thứ statusTick gán mỗi nhịp, tắt cờ không thôi thì nó
       vẫn giữ con số của nhịp trước và phép đo ra 64 thay vì 80. */
    f.beaEmt = 0; f.beaMurak = 0; f.dmgRes = 0; f.evade = 0; f.dodge = 0;
    window.__statusTick(f, 0);
    f.hp = 800; window.__hurt(f, 100, e, false, 'test');
    out.hit = 800 - f.hp;
    return out;
  });
  ok(sham.fromNear > sham.nearBefore && near(sham.fromNear, C.range, C.range * .09),
     `dung qua gan (${sham.nearBefore.toFixed(0)}px) bi day ra ${sham.fromNear.toFixed(0)}px, sat ria ${C.range}`);
  ok(sham.fromFar < sham.farBefore && near(sham.fromFar, C.range, C.range * .09),
     `dung qua xa (${sham.farBefore.toFixed(0)}px) bi keo ve ${sham.fromFar.toFixed(0)}px`);
  ok(sham.fromNear <= C.range, `cho dap KHONG bao gio vuot qua 5R (${sham.fromNear.toFixed(0)} <= ${C.range})`);
  ok(sham.inArena && sham.clear, 'cho dap nam han trong san va khong chong len model nao');
  ok(sham.facing, 'Beatrice quay mat ve phia cho moi cua muc tieu');
  ok(sham.dmg === 9, `hien ra o cho moi an dung ${sham.dmg} dmg`);
  ok(near(sham.stun, 1, .05), `choang ${sham.stun.toFixed(2)}s`);
  ok(near(sham.weakT1, 4, .01), `Shamac Weakness dai ${sham.weakT1.toFixed(2)}s`);
  ok(near(sham.cut, .80, .001), `Shamac Weakness cat ${Math.round((1 - sham.cut) * 100)}% sat thuong gay ra`);
  ok(sham.stackFree && sham.hit === 80,
     `khong cong don (chi lam moi ve 4s) va don 100 raw cua muc tieu chi con ${sham.hit}`);
  // Shamac Weakness KHONG bi dong nerf dung toi: van dung -20%

  console.log('\n=== 5. Murak: pha choang ngay ca khi dang bi khong che ===');
  const murak = await page.evaluate(() => {
    const G = window.__G(), B = window.__BEA, step = window.__step;
    const f = G.fighters.find(x => x.key === 'beatrice');
    const e = G.fighters.find(x => x.key === 'chichi');
    const out = {};
    // dat co dang bi CHOANG NANG + lam cham + dong bang, roi cho hoi chieu ve 0
    f.beaMurak = 0; f.cds.s3 = 0; f.beaShamac = null; f.beaUlt = null; f.beaEmt = 0;
    f.stun = 3; f.frozen = 2; f.exhaust = 4; f.kameSlow = 4; f.beaSlow = B.slowT;
    f.kbx = 200; f.kby = 200;
    f.dots.push({ dps: 10, left: 5, acc: 0, src: e, tint: 'red' });
    const dotsBefore = f.dots.length;
    step(1 / 120);                                   // beatriceTick chay TRONG luc dang choang
    out.stun = f.stun; out.frozen = f.frozen; out.exhaust = f.exhaust;
    out.slow = f.beaSlow; out.kb = Math.hypot(f.kbx, f.kby);
    out.dots = f.dots.length; out.dotsBefore = dotsBefore;
    out.on = f.beaMurak > 0;
    out.cd = f.cds.s3 * window.__RT;
    // mien khong che 100%: stunFx phai tra ve false
    out.stunBlocked = window.__stunFx(f, 2, 'spark') === false && f.stun <= 0;
    /* Giảm 20% sát thương nhận vào. Kẻ tấn công phải SẠCH debuff thì mới đo được đúng ví
       dụ người dùng nêu (100 dmg + choáng 2s ⇒ 80 dmg, không choáng) — Shamac Weakness còn
       sót trên người họ từ mục 4 là ra 64 vì hai lớp NHÂN chồng nhau. */
    window.__statusTick(f, 0);
    out.take = f.dmgTake;
    e.beaWeak = 0; window.__statusTick(e, 0);
    f.hp = 800; f.evade = 0; f.dodge = 0; f.dmgRes = 0;
    window.__hurt(f, 100, e, false, 'test');
    out.hit = 800 - f.hp;
    /* Và đây là chỗ chứng minh hai lớp giảm sát thương NHÂN chồng chứ không cộng: Shamac
       Weakness −20% cộng Murak Protection −20% ra 64, không phải 60 (cộng phần trăm) và
       tuyệt đối không bao giờ gộp lại thành miễn thương 100%. */
    window.__beaWeaken(e); window.__statusTick(e, 0);
    f.hp = 800; window.__hurt(f, 100, e, false, 'test');
    out.stacked = 800 - f.hp;
    e.beaWeak = 0; window.__statusTick(e, 0);
    // van di lai, van danh thuong, van tung chieu khac duoc
    out.canAct = !(f.lock > 0) && f.moveMul >= 1;
    return out;
  });
  ok(murak.on, 'Murak tu bung ra ngay khi hoi chieu xong, DU dang bi choang');
  ok(murak.stun === 0 && murak.frozen === 0, 'pha choang va dong bang ngay lap tuc, khong bat cho het choang');
  ok(murak.exhaust === 0 && murak.slow === 0 && murak.kb === 0,
     'go sach kiet suc, lam cham va da bi hat tung');
  ok(murak.dots === murak.dotsBefore, `KHONG xoa sat thuong duy tri (con dung ${murak.dots} dot)`);
  ok(murak.stunBlocked, 'trong Murak Protection: moi cu choang bi vo hieu hoa hoan toan');
  ok(near(murak.take, C.murakRes, .001) && near(murak.hit, 88, .01),
     `don 100 dmg + choang 2s => an dung ${murak.hit} dmg va khong choang`);
  ok(near(murak.stacked, 70.4, .05),
     `hai lop giam sat thuong NHAN chong: -20% Shamac Weakness + -12% Murak => ${murak.stacked} dmg, khong phai 68 (cong phan tram)`);
  ok(murak.canAct, 'van di chuyen va tung chieu duoc trong luc Murak Protection con');
  ok(near(murak.cd, C.murakCd, .05), `hoi chieu ${murak.cd.toFixed(1)}s bat dau ngay luc kich hoat`);

  console.log('\n=== 6. E.M.T: chan 100% sat thuong, phan lai % da chan trong 2.5R ===');
  const emt = await page.evaluate(() => {
    const G = window.__G(), B = window.__BEA;
    const f = G.fighters.find(x => x.key === 'beatrice');
    const e = G.fighters.find(x => x.key === 'chichi');
    const out = {};
    f.beaMurak = 0; f.beaEmt = 0; f.cds.s5 = 0; f.hp = 800;
    f.evade = 0; f.dodge = 0; f.dmgRes = 0;
    window.__beaEmtOn(f);
    out.on = f.beaEmt > 0;
    out.cd = f.cds.s5 * window.__RT;

    // dung TRONG ban kinh phan don: an dung 20% cho vua chan
    e.x = f.x + B.refl * .5; e.y = f.y; e.hp = 800; e.evade = 0; e.dodge = 0;
    e.beaWeak = 0; e.beaEmt = 0; window.__statusTick(e, 0);
    window.__hurt(f, 100, e, false, 'test');
    out.taken100 = 800 - f.hp;
    out.refl100 = 800 - e.hp;
    e.hp = 800; window.__hurt(f, 50, e, false, 'test');
    out.refl50 = 800 - e.hp;
    e.hp = 800; window.__hurt(f, 200, e, false, 'test');
    out.refl200 = 800 - e.hp;

    // sat thuong duy tri cung bi chan, va moi tick phan rieng
    e.hp = 800; window.__hurt(f, 5, e, false, 'dot', 'red');
    out.dotTaken = 800 - f.hp;
    out.dotRefl = 800 - e.hp;

    // dung NGOAI ban kinh phan don thi khong dinh gi
    e.x = f.x + B.refl + 60; e.hp = 800;
    window.__hurt(f, 100, e, false, 'test');
    out.reflFar = 800 - e.hp;

    // don phan KHONG duoc phan lai lan nua: bat E.M.T cho ca hai roi phan
    e.x = f.x + B.refl * .5; e.hp = 800; e.beaEmt = B.emtT;
    f.hp = 800;
    window.__hurt(f, 100, e, false, 'test');
    out.chainBack = 800 - f.hp;                    // f khong duoc an them mot diem nao
    out.chainTgt = 800 - e.hp;                     // e cung chan sach
    e.beaEmt = 0;
    out.blockedAll = f.hp === 800;
    return out;
  });
  ok(emt.on && near(emt.cd, C.emtCd, .05), `E.M.T bung ra, hoi chieu ${emt.cd.toFixed(1)}s`);
  ok(emt.taken100 === 0, `don 100 dmg vao ket gioi: nhan dung ${emt.taken100} dmg`);
  ok(emt.refl100 === 12 && emt.refl50 === 6 && emt.refl200 === 24,
     `phan lai 12%: chan 50 => ${emt.refl50}, chan 100 => ${emt.refl100}, chan 200 => ${emt.refl200}`);
  ok(emt.dotTaken === 0 && emt.dotRefl > 0,
     `moi tick doc cung bi chan (${emt.dotTaken} dmg) va phan rieng ${emt.dotRefl} dmg`);
  ok(emt.reflFar === 0, `ke tan cong dung ngoai 2.5R thi khong nhan don phan (${emt.reflFar} dmg)`);
  ok(emt.chainBack === 0 && emt.chainTgt === 0 && emt.blockedAll,
     'hai Beatrice doi dau: don phan bi chan chu KHONG phan lai lan nua, khong co vong lap');

  console.log('\n=== 7. El Minya: ba mui tach biet, Minya Slow va Mana Erosion ===');
  const ult = await page.evaluate(() => {
    const G = window.__G(), B = window.__BEA, RT = window.__RT, step = window.__step;
    const f = G.fighters.find(x => x.key === 'beatrice');
    const e = G.fighters.find(x => x.key === 'chichi');
    const out = { shots: [] };
    f.beaShamac = null; f.beaUlt = null; f.stun = 0; f.lock = 0;
    G.proj.length = 0;
    const t0 = G.t;
    window.__beaElMinya(f, e);
    let seen = 0;
    for (let i = 0; i < 400 && f.beaUlt; i++) {
      step(1 / 120);
      const n = G.proj.filter(p => p.type === 'elminya').length + seen - G.proj.filter(p => p.type === 'elminya').length;
      const now = G.proj.filter(p => p.type === 'elminya').length;
      if (f.beaUlt && f.beaUlt.fired > out.shots.length) out.shots.push((G.t - t0) * RT);
    }
    out.count = out.shots.length;

    // moi mui 50 dmg + Minya Slow + mot stack Mana Erosion
    e.hp = 800; e.evade = 0; e.dodge = 0; e.beaSlow = 0;
    e.dots = e.dots.filter(d => !d.bea);
    const p = { dmg: B.ultDmg, owner: f };
    window.__beaUltHit(p, e); out.hit1 = 800 - e.hp; out.ero1 = window.__beaEroStacks(e).length;
    const slow1 = e.beaSlow;
    window.__beaUltHit(p, e); out.ero2 = window.__beaEroStacks(e).length;
    window.__beaUltHit(p, e); out.ero3 = window.__beaEroStacks(e).length;
    window.__beaUltHit(p, e); out.ero4 = window.__beaEroStacks(e).length;   // qua tran: van dung 3
    out.direct = 800 - e.hp;
    // ba stack cung chay => 6 HP moi giay nguoi choi
    out.dps = e.dots.filter(d => d.bea).reduce((a, d) => a + d.dps, 0) / RT;
    // Minya Slow khong cong don phan tram
    e.beaSlow = B.slowT; window.__statusTick(e, 0);
    out.slowMul = e.moveMul;
    out.slowT = slow1 * RT;
    return out;
  });
  ok(ult.count === 3, `ban dung ${ult.count} mui TACH BIET`);
  ok(near(ult.shots[0], C.ultAim, .06) && near(ult.shots[1], C.ultAim + C.ultGap, .06) &&
     near(ult.shots[2], C.ultAim + 2 * C.ultGap, .06),
     `moc ban: ${ult.shots.map(x => x.toFixed(2)).join(' / ')}s (moc 0.65 / 0.90 / 1.15)`);
  ok(ult.hit1 === 34, `mot mui an dung ${ult.hit1} dmg`);
  ok(ult.direct === 136 && ult.ero3 === 3 && ult.ero4 === 3,
     `Mana Erosion cong don toi ${ult.ero3} stack roi dung han (mui thu tu van ${ult.ero4})`);
  ok(near(ult.dps, 3.6, .001), `ba stack cung chay: ${ult.dps} HP moi giay nguoi choi`);
  ok(near(ult.slowT, 3, .01) && near(ult.slowMul, .5, .001),
     `Minya Slow ${ult.slowT.toFixed(1)}s, tong lai van dung -${Math.round((1 - ult.slowMul) * 100)}% chu khong phai -150%`);

  console.log('\n=== 7b. El Minya bi choang trong 0.4s dau thi huy, cho nua hoi chieu ===');
  const brk = await page.evaluate(() => {
    const G = window.__G(), B = window.__BEA, RT = window.__RT, step = window.__step;
    const f = G.fighters.find(x => x.key === 'beatrice');
    const e = G.fighters.find(x => x.key === 'chichi');
    const out = {};
    // choang NGAY trong quang chuan bi: chieu phai dut va hoi chieu chi con 50%
    f.beaShamac = null; f.beaUlt = null; f.stun = 0; f.lock = 0; f.cds.s4 = 0;
    G.proj.length = 0;
    window.__beaElMinya(f, e);
    f.stun = 2;
    step(1 / 120);
    out.cancelled = !f.beaUlt;
    out.cd = f.cds.s4 * RT;
    out.want = B.ultCd * B.ultBreakCut * RT;
    out.shots = G.proj.filter(p => p.type === 'elminya').length;
    // ban duoc mui dau roi thi choang KHONG cat duoc nua, mui hai va ba van ra
    /* Đếm theo SỐ LẦN BẮN chứ đừng đếm viên đạn còn sống: trận vẫn chạy nên mấy mũi bắn
       trước đã chạm người hoặc bay khỏi sàn và bị xoá mất — đo kiểu đó ra 0. */
    f.beaUlt = null; f.stun = 0; f.lock = 0; G.proj.length = 0;
    window.__beaElMinya(f, e);
    let fired = 0;
    for (let i = 0; i < 400 && f.beaUlt; i++) {
      step(1 / 120);
      if (f.beaUlt) {
        fired = Math.max(fired, f.beaUlt.fired);
        if (f.beaUlt.fired === 1) f.stun = 2;                // choang ngay sau mui dau
      }
    }
    out.after = fired;
    f.stun = 0;
    return out;
  });
  ok(brk.cancelled && brk.shots === 0, 'choang trong quang chuan bi: chieu dut, khong mui nao bay ra');
  ok(near(brk.cd, brk.want, .05),
     `hoi chieu chi con ${brk.cd.toFixed(1)}s = ${Math.round(brk.want / (C.ultCd) * 100)}% cua ${C.ultCd}s`);
  ok(brk.after === 3,
     `ban duoc mui dau roi thi choang khong cat duoc nua — van du ${brk.after} mui`);

  console.log('\n=== 8. Chu hien thi deu bang TIENG ANH ===');
  const words = await page.evaluate(() => {
    const C = window.__CHARS.beatrice, D = window.__DEX.beatrice;
    const txt = C.skills.join(' ') + ' ' + C.name + ' ' + C.tag + ' ' +
                D.role.en + ' ' + D.skills.map(s => s.name + ' ' + s.en).join(' ');
    return { txt, names: D.skills.map(s => s.name) };
  });
  const need = ['Beatrice', 'Mage', 'Minya', 'Minya Stun', 'Al Shamac', 'Shamac Weakness',
                'Murak', 'Murak Protection', 'E.M.T', 'E.M.T Reflection', 'El Minya',
                'Minya Slow', 'Mana Erosion', 'Forbidden Library'];
  for (const n of need) ok(words.txt.indexOf(n) >= 0, `co chu "${n}"`);
  ok(!/[àáảãạăâđèéẻẽẹêìíỉĩịòóỏõọôơùúủũụưỳýỷỹỵ]/i.test(words.txt),
     'khong lan mot chu tieng Viet co dau nao trong phan hien thi');

  console.log('\n=== 8b. Muoi o tieng: du o, du case du phong trong synth() ===');
  const sfxOk = await page.evaluate(() => {
    const E = window.__SFXE.map(x => x[0]);
    const src = window.__synthSrc();
    const groups = window.__SFXGROUPS;
    const alias = window.__SFXALIAS || {};
    const want = ['bea_door', 'bea_book', 'bea_minya', 'bea_shamac', 'bea_warp',
                  'bea_murak', 'bea_emt', 'bea_reflect', 'bea_elminya', 'bea_down'];
    return { want,
             missing: want.filter(k => E.indexOf(k) < 0),
             noCase: want.filter(k => src.indexOf(`'${k}'`) < 0 && !alias[k]),
             group: groups.bea_door,
             // đấm/trúng đòn mượn ô có sẵn, đừng dựng ô mới
             noExtra: E.filter(k => /^bea_/.test(k) && want.indexOf(k) < 0) };
  });
  ok(sfxOk.missing.length === 0, `du ${sfxOk.want.length} o tieng rieng`);
  ok(sfxOk.noCase.length === 0,
     `moi o deu co case du phong trong synth()${sfxOk.noCase.length ? ' — thieu: ' + sfxOk.noCase : ''}`);
  ok(sfxOk.group === 'Beatrice', `o dau mo mot nhom rieng trong bang nap tieng ("${sfxOk.group}")`);
  ok(sfxOk.noExtra.length === 0,
     `khong dung them o thua — trung don muon thang sfx('hit') nhu Horikita / Ginyu / Doraemon / Superman`);

  console.log('\n=== 9. Ho so nhan vat: bieu do chin truc + mo ta day du ===');
  const dex = await page.evaluate(() => {
    const D = window.__DEX.beatrice, AX = window.__PW_AXES;
    const card = window.__dexCard('beatrice');
    return { axes: AX.map(a => D.pw[a.key]), st: D.st,
             bioVi: !!(D.bio && D.bio.vi), bioEn: !!(D.bio && D.bio.en),
             nSkills: D.skills.length,
             bothLang: D.skills.every(s => s.vi && s.en),
             hasRadar: card.indexOf('<svg') >= 0, hasHp: card.indexOf('dexHpIn') >= 0,
             avg: window.__pwAvg('beatrice'),
             dup: Object.keys(window.__DEX).filter(k => k !== 'beatrice' &&
               AX.every(a => window.__DEX[k].pw[a.key] === D.pw[a.key])).length };
  });
  ok(dex.axes.length === 9 && dex.axes.every(v => v >= 0 && v <= 100),
     `du chin truc, deu nam trong 0-100: ${dex.axes.join(' ')}`);
  ok(dex.dup === 0, 'khong copy nguyen bo diem cua nhan vat nao khac');
  ok(dex.bioVi && dex.bioEn && dex.bothLang && dex.nSkills >= 5,
     `tieu su va ${dex.nSkills} the chieu deu song ngu`);
  ok(dex.hasRadar, 'the ho so ve ra bieu do suc manh that (co the <svg>)');
  ok(dex.hasHp, 'the ho so co o chinh mau');
  ok(dex.st && dex.st.tech === undefined, 'khong dung lai thanh "do kho" da bo');

  /* Người dùng chốt riêng hai trục này: *"as với cons lên cao nữa á, 2 cái đó của beatrice
     là S"*. Đọc qua pwGrade() chứ đừng ghim con số — đổi thang bậc là mục này tự đúng theo. */
  const bac = await page.evaluate(() => {
    const D = window.__DEX.beatrice;
    return { as: D.pw.as, con: D.pw.con,
             gAs: window.__pwGrade(D.pw.as), gCon: window.__pwGrade(D.pw.con) };
  });
  ok(bac.gAs === 'S', `toc danh la bac S (${bac.as} -> ${bac.gAs})`);
  ok(bac.gCon === 'S', `on dinh la bac S (${bac.con} -> ${bac.gCon})`);

  console.log('\n=== 9b. Chu effect luc cast skill nho lai (BEA_FX) ===');
  /* *"cast skill thì mấy chữ effect của beatrice nhỏ lại"*. Đo CỠ CHỮ THẬT qua floatScale()
     — đó là con số drawFloat() dùng cho cả font lẫn bề dày viền. */
  const co = await page.evaluate(() => {
    const px = f => (f.big ? 27 : 21) * window.__floatScale(f);
    const mau = [
      ['SHAMAC WEAKNESS', { banner: true, gold: true }],
      ['MANA EROSION', { banner: true, sc: .6 }],
      ['AL SHAMAC!', { banner: true, bubble: true, gold: true, big: true, sc: .72 }]
    ];
    return { fx: window.__BEA_FX(),
             do: mau.map(([t, o]) => ({ t, cu: px(o), moi: px(Object.assign({ beaFx: true }, o)) })),
             /* sàn cỡ chữ: dòng phụ nhỏ nhất cũng không được rơi xuống dưới 8px */
             day: px({ banner: true, sc: .3, beaFx: true }) };
  });
  ok(co.fx < 1, `he so thu nho rieng cua Beatrice la ${co.fx}`);
  for (const d of co.do)
    ok(d.moi < d.cu, `${d.t}: ${d.cu.toFixed(1)}px -> ${d.moi.toFixed(1)}px`);
  ok(co.day >= 8, `van co san co chu, khong roi xuong duoi 8px (${co.day.toFixed(1)}px)`);

  /* Và cờ đó phải bám vào ĐÚNG float của Beatrice, không lây sang nhân vật khác. */
  const co2 = await page.evaluate(async () => {
    const G = window.__G(), thay = {};
    const push = G.floats.push.bind(G.floats);
    G.floats.push = f => { if (f.banner) thay[f.txt] = !!f.beaFx; return push(f); };
    for (const id of ['testBeaShamac', 'testBeaMurak', 'testBeaEmt', 'testBeaUlt']) {
      const b = document.getElementById(id); if (b) b.click();
      for (let i = 0; i < 320; i++) window.__step(1 / 120);
    }
    for (let i = 0; i < 900; i++) window.__step(1 / 120);
    G.floats.push = push;
    const key = Object.keys(thay);
    return { bea: key.filter(k => thay[k]), khac: key.filter(k => !thay[k]) };
  });
  ok(co2.bea.length >= 5, `cac dong effect cua Beatrice deu duoc gan co (${co2.bea.length}: ${co2.bea.slice(0, 4).join(' / ')})`);
  ok(co2.khac.every(k => !/MINYA|SHAMAC|MURAK|E\.M\.T|EROSION/.test(k)),
     `khong dong effect nao cua co bi bo sot (${co2.khac.join(' / ') || 'khong con dong nao khac'})`);

  console.log('\n=== 10. AI: ngoai 5R thi di vao, trong 5R thi dung lai danh xa ===');
  /* Bản mô tả nói rõ hai vế: ngoài tầm thì tiến tới cho đến khi mục tiêu nằm trong 5R, và
     cô KHÔNG bao giờ chủ động áp sát tới cự ly cận chiến. Bị địch cận chiến dí sát thì cô
     cũng không tự chạy trốn — Al Shamac mới là thứ đẩy họ ra. Vì vậy phép đo phải dùng một
     đối thủ ĐỨNG YÊN, chứ đo với ChiChi đang lao vào thì đo nhầm sang hành vi của ChiChi. */
  const walk = await page.evaluate(range => new Promise(res => {
    const G = window.__G();
    const f = G.fighters.find(x => x.key === 'beatrice');
    const e = G.fighters.find(x => x.key === 'chichi');
    /* DỰNG LẠI TRẬN CHO SỐNG rồi mới đo. Mấy mục trên đánh thật nên trận có thể đã KẾT
       THÚC trước khi tới đây (ChiChi gục) — mà trận xong thì không ai đi lại nữa, nên phép
       đo bước chân đọc ra 0 và cả ba mục dưới đổ oan. Đặt lại `hp` là KHÔNG ĐỦ: phải bật
       lại `alive` và xoá `G.over` / `G.endT` / `G.kos`, không thì `step()` vẫn coi là trận
       đã xong. (Đây là chỗ phép đo trước đây sống nhờ may: chỉ cần trang nặng thêm một nhịp
       là ChiChi gục sớm hơn và cả mục này đổ.) */
    G.over = null; G.winner = null; G.winTeam = null; G.endT = 0; G.announced = false;
    G.kos.length = 0; G.freeze = 0; G.freezeAt = null; G.callBanner = null;
    for (const o of [f, e]) { o.alive = true; o.hp = o.maxHp; o.dots.length = 0; o.pose = 'idle'; }
    f.beaEmt = 0; f.beaMurak = 0; f.stun = 0;
    G.proj.length = 0;
    // đặt địch ra XA hẳn ngoài tầm rồi ghim chân họ lại
    f.x = 120; f.y = 300; e.x = 560; e.y = 300;
    const d0 = Math.hypot(e.x - f.x, e.y - f.y);
    /* Hai chặng tách bạch: chặng ĐI VÀO (đo cô mất bao lâu để kéo mục tiêu vào trong 5R)
       rồi mới tới chặng ĐỨNG ĐÁNH (đo quãng cô giữ khi đã ổn định). Gộp chung một cửa sổ
       ngắn là đo nhầm cả quãng đang chạy tới — đo được đỉnh 291px chỉ vì cửa sổ bắt đầu
       lúc cô còn ở tận 440px. */
    let arrived = -1, n = 0;
    const settle = [];
    const iv = setInterval(() => {
      e.x = 560; e.y = 300; e.vx = 0; e.vy = 0; e.lock = 1; e.stun = 1;
      f.cds.s2 = 999;                       // khoá Al Shamac: đang đo BƯỚC CHÂN, không đo cú dịch chuyển
      n++;
      const d = Math.hypot(f.x - e.x, f.y - e.y);
      if (arrived < 0 && d <= range) arrived = n;
      else if (arrived > 0 && n > arrived + 60) settle.push(d);
      if (settle.length >= 140 || n > 700) {
        clearInterval(iv);
        res({ d0, arrived, range,
              min: settle.length ? Math.min(...settle) : -1,
              max: settle.length ? Math.max(...settle) : -1,
              n: settle.length });
      }
    }, 40);
  }), C.range);
  ok(walk.d0 > walk.range, `dat dich o ${walk.d0.toFixed(0)}px, ngoai han tam ${walk.range}`);
  ok(walk.arrived > 0, `co di vao cho toi khi muc tieu nam trong 5R (mat ${walk.arrived} nhip do)`);
  ok(walk.n > 100 && walk.max <= walk.range,
     `on dinh roi thi GIU muc tieu trong 5R: ${walk.min.toFixed(0)}-${walk.max.toFixed(0)}px, khong bao gio vuot ${walk.range}`);
  ok(walk.min > 90,
     `KHONG bao gio tu xap vao cu ly can chien voi dich dung yen (gan nhat ${walk.min.toFixed(0)}px)`);

  console.log('\n=== 11. Tran that chay tron ven, khong loi trang ===');
  const run = await page.evaluate(() => new Promise(res => {
    const G = window.__G();
    const iv = setInterval(() => {
      if (G.t > 75 || G.over) {
        clearInterval(iv);
        res({ t: +G.t.toFixed(1), over: !!G.over, winner: G.winner && G.winner.key });
      }
    }, 50);
  }));
  ok(run.over || run.t > 70, `tran ${run.over ? 'ket thuc, thang: ' + run.winner : 'con danh o giay ' + run.t}`);
  ok(errors.length === 0, `khong co loi trang (${errors.length})`);
  await browser.close();

  /* ---------------- trận 2: Beatrice vs Shikamaru — né đòn và dải bóng ---------------- */
  console.log('\n=== 12. Murak cat duoc dai bong cua Shikamaru ===');
  const g2 = await openGame('beatrice', 'shika');
  await g2.page.waitForTimeout(400);
  const bind = await g2.page.evaluate(() => new Promise(res => {
    const G = window.__G();
    const iv = setInterval(() => {
      const f = G.fighters.find(x => x.key === 'beatrice');
      const k = G.fighters.find(x => x.key === 'shika');
      if (!f || !k) return;
      if (!f.beaEntry) {
        clearInterval(iv);
        // dung tay mot dai bong roi bat Murak: dai bong phai dut ngay
        k.lazy = false; k.awake = true; k.bind = { e: f, ph: 'hold', t: 3, len: 100 };
        f.lock = 2; f.stun = 2;
        f.cds.s3 = 0; f.beaMurak = 0;
        window.__step(1 / 120);
        res({ bind: !!k.bind, stun: f.stun, murak: f.beaMurak > 0 });
      }
    }, 40);
  }));
  ok(bind.murak && !bind.bind && bind.stun === 0,
     'Murak go duoc dai bong Shadow-Neck Bind (dai bong nam tren nguoi ket an, phai cat tu dau ben do)');
  ok(g2.errors.length === 0, `khong co loi trang (${g2.errors.length})`);
  await g2.browser.close();

  /* ---------------- trận 3: Beatrice vs Captain Ginyu — cướp xác ---------------- */
  console.log('\n=== 13. CHANGE cuop xac: than xac Beatrice MAT sach lop bao ve ===');
  const g3 = await openGame('beatrice', 'ginyu');
  await g3.page.waitForTimeout(3000);
  const swap = await g3.page.evaluate(() => {
    const G = window.__G(), B = window.__BEA;
    const b = G.fighters.find(x => x.key === 'beatrice');
    const g = G.fighters.find(x => x.key === 'ginyu');
    if (b.beaEntry) { b.beaEntry = null; b.beaHide = false; }
    b.beaEmt = B.emtT; b.beaMurak = B.murakT; b.beaShamac = null; b.beaUlt = null;
    g.gnChangeDone = false; g.gnChange = null; g.gnEntry = null;
    window.__ginyuPossess(g, b);
    /* ginyuPossess() mở một phân cảnh dài 1.8 giây và step() return sớm suốt lúc đóng băng.
       Đang đo phần ĐIỀU KHIỂN sau khi hoán đổi chứ không đo phân cảnh, nên bỏ qua nó —
       để nguyên thì mọi nhịp step() ở dưới đều rơi vào phân cảnh và chiêu nhìn như đứng hình. */
    G.freeze = 0; G.freezeAt = null;
    const body = G.fighters.find(x => x.key === 'beatrice');
    const out = { swapAs: body.swapAs, name: body.name, emt: body.beaEmt, murak: body.beaMurak };
    body.hp = 800; body.evade = 0; body.dodge = 0;
    window.__statusTick(body, 0);
    window.__hurt(body, 100, g, false, 'test');
    out.taken = 800 - body.hp;
    out.stunned = window.__stunFx(body, 1, 'spark');
    // hồn Beatrice ngồi trong thân xác Ginyu vẫn tung được chiêu bấm tay của chính mình
    const ghost = G.fighters.find(x => x.key === 'ginyu' && x.swapAs === 'foe');
    out.soul = ghost && ghost.gnSoul;
    if (ghost) {
      ghost.stun = 0; ghost.lock = 0; ghost.beaShamac = null; ghost.cds.s2 = 0;
      ghost.gnEntry = null; ghost.gnChange = null; ghost.gnState = null;
      window.__gnSoulThink(ghost, body, 200, true);
      out.castShamac = !!ghost.beaShamac;
      /* Và nó phải CHẠY TIẾP tới khi xong chứ không đứng hình. Đếm số nhịp đã chạy: hết
         vòng mà chiêu vẫn còn là đứng hình thật. Đừng đo bằng `lock` — quãng khoá của chính
         chiêu còn trôi thêm vài nhịp sau khi chiêu xong, đo kiểu đó là đổ oan. */
      let it = 0;
      for (; it < 200 && ghost.beaShamac; it++) window.__step(1 / 120);
      out.shamacDone = !ghost.beaShamac && it < 200;
      out.iters = it;
    }
    return out;
  });
  ok(swap.emt === 0 && swap.murak === 0 && swap.taken === 100 && swap.stunned,
     `than xac vua cuop duoc MAT sach E.M.T va Murak: an du ${swap.taken} dmg va van bi choang`);
  ok(swap.soul === 'beatrice' && swap.castShamac,
     'hon Beatrice ngoi trong than xac Ginyu van tung duoc Al Shamac cua chinh minh');
  ok(swap.shamacDone,
     `va chieu do CHAY TIEP toi khi xong chu khong dung hinh (xong sau ${swap.iters} nhip — gnSoulTick phai nhac beaShamacTick)`);
  ok(g3.errors.length === 0, `khong co loi trang (${g3.errors.length})`);
  await g3.browser.close();

  console.log(`\n${fail === 0 ? 'DAT' : 'HONG'}  ${pass} dat / ${fail} hong`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
