/* Đánh tuần tự (relay) — hai đội, mỗi đội một hàng chờ, ai gục thì người kế tiếp bước ra
   còn người thắng Ở LẠI SÂN với đúng lượng máu còn lại.

   Mọi phép đo ở đây ĐO THẬT trong trận: hạ người thật bằng `__defeat()` rồi chạy tay từng
   bước bằng `__step()` cho tới khi người thay ca bước ra. Đo bằng đồng hồ thật thì headless
   trôi chậm hơn nhiều lần (mục 8 của CLAUDE.md).                                          */
const { openMulti } = require('./probe');

let pass = 0, fail = 0;
const ok = (dieu, nhan, them) => {
  if (dieu) { pass++; console.log(`  DAT  ${nhan}${them ? ' — ' + them : ''}`); }
  else { fail++; console.log(`  HONG ${nhan}${them ? ' — ' + them : ''}`); }
};
const muc = n => console.log(`\n=== ${n} ===`);

/* Chạy tay `n` nhịp 1/120 giây trong trận. Hàng chờ thay ca đi qua `later(..., cine)` nên
   nó vẫn chạy trong lúc sàn đóng băng — không phải làm gì thêm. */
const chay = (page, giay) => page.evaluate(s => {
  const b = 1 / 120;
  for (let i = 0; i < Math.round(s / b); i++) window.__step(b);
}, giay);

(async () => {
  // ---------------------------------------------------------------- 1. dựng trận
  muc('1. Dựng trận: mỗi đội chỉ MỘT người ra sân, phần còn lại ngồi chờ');
  const { browser, page, errors } = await openMulti(
    'relay', [['kono', 'chichi', 'tsubasa'], ['shika', 'suzune', 'ginyu']]);

  const dau = await page.evaluate(() => {
    const G = window.__G();
    return {
      mode: G.mode,
      tren: G.fighters.filter(f => !f.summon).map(f => ({ key: f.key, team: f.team, hp: f.hp })),
      hang: (G.relay || []).map(q => q.map(e => ({ key: e.key, st: e.st }))),
      nha: (G.relayHome || []).map(h => h && { x: Math.round(h.x), y: Math.round(h.y) })
    };
  });
  ok(dau.mode === 'relay', 'G.mode là relay', dau.mode);
  ok(dau.tren.length === 2, 'trên sàn đúng HAI người dù đội hình có sáu',
     dau.tren.map(f => f.key).join(' vs '));
  ok(dau.tren[0].key === 'kono' && dau.tren[1].key === 'shika',
     'người ra sân là NGƯỜI ĐẦU của mỗi đội', dau.tren.map(f => f.key).join(' / '));
  ok(dau.tren[0].team === 0 && dau.tren[1].team === 1, 'hai người khác phe');
  ok(dau.hang.length === 2 && dau.hang.every(q => q.length === 3),
     'hàng chờ giữ đủ ba người mỗi đội', dau.hang.map(q => q.length).join('/'));
  ok(dau.hang.every(q => q[0].st === 'live' && q[1].st === 'wait' && q[2].st === 'wait'),
     'người đầu là "live", hai người sau là "wait"');
  ok(dau.nha.length === 2 && dau.nha[0] && dau.nha[1] && dau.nha[0].y !== dau.nha[1].y,
     'mỗi đội nhớ một chỗ đứng riêng ở hai đầu sàn',
     dau.nha.map(h => `${h.x},${h.y}`).join(' | '));

  // ---------------------------------------------------------------- 2. thay ca
  muc('2. Một người gục thì người kế tiếp của ĐÚNG đội đó bước ra');
  const thay = await page.evaluate(async () => {
    const G = window.__G();
    const k = G.fighters.find(f => f.key === 'kono');
    const s = G.fighters.find(f => f.key === 'shika');
    s.hp = 611;                                   // máu của người ở lại, để đo mục 3
    window.__defeat(k, s);
    const ngay = {
      over: !!G.over,
      st: G.relay[0].map(e => e.st),
      con: G.fighters.filter(f => !f.summon && f.alive).length
    };
    // chạy tay cho tới khi người thay ca thật sự bước ra
    const b = 1 / 120;
    let n = 0;
    while (n++ < 900 && !G.fighters.some(f => f.key === 'chichi')) window.__step(b);
    return {
      ngay,
      nhip: n,
      sau: G.fighters.filter(f => !f.summon).map(f => ({ key: f.key, team: f.team, alive: f.alive })),
      st: G.relay[0].map(e => e.st),
      doiKia: G.relay[1].map(e => e.st),
      over: !!G.over
    };
  });
  ok(!thay.ngay.over, 'hạ một người thì trận CHƯA kết thúc');
  ok(thay.ngay.st[0] === 'out', 'người vừa gục chuyển sang "out"', thay.ngay.st.join('/'));
  ok(thay.sau.some(f => f.key === 'chichi' && f.team === 0),
     'người thứ hai của ĐÚNG đội 0 bước ra', thay.sau.map(f => f.key).join(', '));
  ok(!thay.sau.some(f => f.key === 'kono'),
     'cái xác được dọn khỏi sàn, không nằm chắn chỗ người mới');
  ok(thay.st.join('/') === 'out/live/wait', 'hàng chờ đội 0 tiến đúng một nấc', thay.st.join('/'));
  ok(thay.doiKia.join('/') === 'live/wait/wait', 'hàng chờ đội 1 KHÔNG bị đụng tới', thay.doiKia.join('/'));
  ok(!thay.over, 'trận vẫn đang chạy sau cú thay ca');

  // ---------------------------------------------------------------- 3. giữ máu
  muc('3. Người ở lại sân GIỮ NGUYÊN máu còn lại — đây là luật cốt lõi của chế độ');
  const mau = await page.evaluate(() => {
    const G = window.__G();
    const s = G.fighters.find(f => f.key === 'shika');
    const c = G.fighters.find(f => f.key === 'chichi');
    return { o: s && s.hp, moi: c && c.hp, moiMax: c && c.maxHp };
  });
  ok(Math.abs(mau.o - 611) < 12, 'người thắng lượt trước vẫn ở mức máu cũ (~611)',
     `còn ${Math.round(mau.o)}`);
  ok(mau.moi === mau.moiMax, 'người mới ra sân thì đầy máu',
     `${mau.moi}/${mau.moiMax}`);

  // ---------------------------------------------------------------- 4. dọn tàn dư
  muc('4. Cái xác không được hạ nốt người còn lại: dot và trói của họ tắt theo');
  const don = await page.evaluate(() => {
    const G = window.__G();
    const c = G.fighters.find(f => f.key === 'chichi');
    const s = G.fighters.find(f => f.key === 'shika');
    // Shikamaru dán một vệt cháy lên ChiChi rồi chính anh gục: vệt đó phải biến mất
    c.dots.push({ dps: 40, left: 9, acc: 0, src: s, tint: 'red' });
    c.dots.push({ dps: 40, left: 9, acc: 0, src: c, tint: 'red' });   // dot của chính c thì giữ
    const truoc = c.dots.length;
    c.stun = 3;
    window.__defeat(s, c);
    const b = 1 / 120;
    let n = 0;
    while (n++ < 900 && !G.fighters.some(f => f.key === 'suzune')) window.__step(b);
    return { truoc, sau: c.dots.length, conCuaMinh: c.dots.some(d => d.src === c), stun: c.stun,
             raSan: G.fighters.some(f => f.key === 'suzune') };
  });
  ok(don.raSan, 'đội 1 cũng thay ca được (Suzune ra sân)');
  ok(don.truoc === 2 && don.sau === 1, 'dot do người vừa rời sàn dán thì bị xoá',
     `${don.truoc} → ${don.sau}`);
  ok(don.conCuaMinh, 'dot của người khác thì GIỮ NGUYÊN, không xoá bừa cả mảng');
  ok(don.stun === 0, 'choáng đang dính được gỡ lúc thay ca (người gây ra đã rời sàn)');

  // ---------------------------------------------------------------- 5. kết thúc
  muc('5. Hết sạch người thì đội đó thua — và chỉ lúc đó trận mới kết thúc');
  const het = await page.evaluate(() => {
    const G = window.__G();
    const b = 1 / 120;
    const buoc = () => { for (let i = 0; i < 120; i++) window.__step(b); };
    const moc = [];
    // hạ nốt hai người còn lại của đội 0 (chichi đang đứng, tsubasa còn chờ)
    for (let vong = 0; vong < 4 && !G.over; vong++) {
      const nan = G.fighters.find(f => !f.summon && f.alive && f.team === 0);
      if (!nan) break;
      const thu = G.fighters.find(f => !f.summon && f.alive && f.team === 1);
      window.__defeat(nan, thu);
      moc.push({ ha: nan.key, over: !!G.over, con: window.__relayLeft(0) });
      let n = 0;
      while (n++ < 900 && !G.over && !G.fighters.some(f => !f.summon && f.alive && f.team === 0))
        window.__step(b);
    }
    buoc();
    const w = G.winner;
    return { moc, over: G.over, winTeam: G.winTeam, win: w && w.key, winHp: w && Math.round(w.hp),
             conDoi1: window.__relayLeft(1) };
  });
  console.log('   ' + het.moc.map(m => `hạ ${m.ha} ⇒ over=${m.over} dự bị còn ${m.con}`).join(' | '));
  ok(het.moc.length >= 2, 'phải hạ nhiều lượt mới xong, không phải một cú là hết trận',
     `${het.moc.length} lượt`);
  ok(het.moc.slice(0, -1).every(m => !m.over), 'mấy lượt giữa chừng thì trận vẫn chạy');
  ok(!!het.over, 'hạ người CUỐI CÙNG của một đội thì trận mới kết thúc', String(het.over));
  ok(het.winTeam === 1, 'đội còn người là đội thắng', 'winTeam=' + het.winTeam);
  ok(het.winHp > 0, 'người thắng đứng cuối trận với máu còn lại', het.winHp + ' máu');

  // ---------------------------------------------------------------- 6. băng-rôn
  muc('6. Băng-rôn tên cặp đấu kể được cả hàng chờ');
  const bang = await page.evaluate(() => {
    const seg = window.__vsSegments(false);
    return seg.map(g => ({ txt: g.txt.trim(), out: !!g.out, dim: !!g.dim, small: !!g.small }));
  });
  console.log('   ' + bang.map(g => g.txt + (g.out ? '✕' : g.dim ? '·' : '')).join(' '));
  const ten = bang.filter(g => !g.small || g.out || g.dim);
  ok(ten.length >= 6, 'liệt kê đủ cả sáu người của hai hàng chờ', ten.length + ' tên');
  ok(bang.some(g => g.txt === 'KONOHAMARU' && g.out), 'người đã gục thì bị đánh dấu "out"');
  ok(bang.some(g => g.out) && bang.some(g => !g.out && !g.small),
     'vẫn phân biệt được người đang đánh với người đã gục');

  // ---------------------------------------------------------------- 7. giới hạn
  muc('7. Giới hạn đội hình của chế độ tuần tự tách hẳn khỏi đánh đội');
  const lim = await page.evaluate(() => ({
    relay: window.__squadLim('relay'), team: window.__squadLim('team'),
    r: window.__RELAY, sq: [window.__squadMode('relay'), window.__squadMode('team'),
                            window.__squadMode('ffa'), window.__squadMode('duel')]
  }));
  ok(lim.relay.total > lim.team.total,
     'trần người của tuần tự rộng hơn đánh đội (chỉ 2–4 thanh máu trên sàn một lúc)',
     `${lim.relay.total} vs ${lim.team.total}`);
  ok(lim.relay.min >= 2, 'mỗi đội tối thiểu 2 người, không thì chẳng có ai để thay ca',
     'min=' + lim.relay.min);
  ok(lim.sq[0] && lim.sq[1] && !lim.sq[2] && !lim.sq[3],
     'squadMode() chỉ nhận đúng team và relay');
  ok(lim.r.in < lim.r.cine, 'người thay ca bước ra TRONG lúc sàn còn đóng băng',
     `vào ${lim.r.in.toFixed(3)} < băng ${lim.r.cine.toFixed(3)}`);

  // ---------------------------------------------------------------- 8. ba đội
  muc('8. Ba đội: quét sạch một đội mà còn hai đội thì trận vẫn chạy');
  await browser.close();
  const ba = await openMulti('relay',
    [['kono', 'chichi'], ['shika', 'suzune'], ['tsubasa', 'ginyu']]);
  const r3 = await ba.page.evaluate(() => {
    const G = window.__G();
    const b = 1 / 120;
    const tren = () => G.fighters.filter(f => !f.summon && f.alive).length;
    const dau = { doi: G.relay.length, tren: tren() };
    // xoá sổ đội 0: hạ người đang đứng, chờ người thay ca, rồi hạ nốt
    const moc = [];
    for (let v = 0; v < 3; v++) {
      const nan = G.fighters.find(f => !f.summon && f.alive && f.team === 0);
      if (!nan) break;
      window.__defeat(nan, G.fighters.find(f => !f.summon && f.alive && f.team !== 0));
      moc.push({ ha: nan.key, over: !!G.over, phe: window.__relayTeamsLeft().length });
      let n = 0;
      while (n++ < 900 && !G.over && !G.fighters.some(f => !f.summon && f.alive && f.team === 0))
        window.__step(b);
    }
    return { dau, moc, over: !!G.over, tren: tren(),
             phe: window.__relayTeamsLeft().sort().join(',') };
  });
  ok(r3.dau.doi === 3 && r3.dau.tren === 3, 'ba đội thì ba người ra sân cùng lúc',
     `${r3.dau.doi} đội / ${r3.dau.tren} người`);
  console.log('   ' + r3.moc.map(m => `hạ ${m.ha} ⇒ còn ${m.phe} phe`).join(' | '));
  ok(r3.moc.length === 2, 'đội hai người thì phải hạ đúng hai lượt mới xoá sổ được',
     r3.moc.length + ' lượt');
  ok(!r3.over, 'xoá sổ một đội mà còn hai đội thì trận VẪN chạy tiếp');
  ok(r3.phe === '1,2', 'chỉ còn đúng hai đội trong cuộc', 'phe ' + r3.phe);
  ok(r3.tren === 2, 'trên sàn còn đúng hai người', r3.tren + ' người');

  // ---------------------------------------------------------------- 9. cầm tay
  muc('9. Người chơi cầm tay: thay ca xong thì cầm NGƯỜI MỚI, không cầm cái xác');
  const tay = await ba.page.evaluate(() => {
    const b = 1 / 120;
    /* Ô chế độ điều khiển gọi luôn `newGame()`, tức DỰNG LẠI cả G — phải đọc `__G()` SAU
       cú bấm, ôm lấy G cũ là đo trên một trận đã chết. */
    const sel = document.getElementById('mode');
    sel.value = 'p1'; sel.dispatchEvent(new Event('change'));
    const G = window.__G();
    const truoc = G.k && G.k.key, phe = G.kTeam;
    const camDau = G.fighters.filter(f => !f.summon && f.human).map(f => f.key);
    // hạ chính người mình đang cầm, xem quyền điều khiển có sang người thay ca không
    const nan = G.k;
    window.__defeat(nan, G.fighters.find(f => !f.summon && f.alive && f.team !== nan.team));
    const phe0 = nan.team;
    let n = 0;
    while (n++ < 900 && !G.over && !G.fighters.some(f => !f.summon && f.alive && f.team === phe0))
      window.__step(b);
    const nguoiCam = G.fighters.filter(f => !f.summon && f.human);
    return { truoc, phe, phe0, camDau, kTeam: G.kTeam,
             k: G.k && G.k.key, kAlive: G.k && G.k.alive, kTeamNay: G.k && G.k.team,
             cam: nguoiCam.map(f => f.key), soCam: nguoiCam.length,
             camMoi: nguoiCam[0] && nguoiCam[0].key, camSong: nguoiCam[0] && nguoiCam[0].alive,
             cAlive: G.c && G.c.alive };
  });
  ok(tay.camDau.length === 1 && tay.camDau[0] === tay.truoc,
     'trước khi thay ca, người chơi đang cầm đúng G.k', tay.camDau.join(',') || 'không ai');
  ok(tay.kTeamNay === tay.phe0, 'G.k vẫn bám đúng PHE cũ sau khi thay ca', 'phe ' + tay.kTeamNay);
  ok(tay.kAlive === true && tay.k !== tay.truoc,
     'G.k nhảy sang NGƯỜI MỚI còn sống, không ôm cái xác', `${tay.truoc} → ${tay.k}`);
  ok(tay.soCam === 1 && tay.camSong === true && tay.camMoi === tay.k,
     'đúng một người mang cờ human, và đó là người vừa ra sân', tay.cam.join(',') || 'không ai');
  ok(tay.cAlive === true, 'G.c cũng trỏ vào người còn sống của đội kia');

  // ---------------------------------------------------------------- 10. CHANGE
  muc('10. Cú CHANGE của Ginyu: hàng chờ gạch tên theo HỒN, không theo thân xác');
  await ba.browser.close();
  const gn = await openMulti('relay', [['ginyu', 'chichi'], ['kono', 'tsubasa']]);
  const chg = await gn.page.evaluate(() => {
    const G = window.__G(), b = 1 / 120;
    const g = G.fighters.find(f => f.key === 'ginyu'), k = G.fighters.find(f => f.key === 'kono');
    window.__ginyuPossess(g, k);          // hồn Ginyu sang thân xác Konohamaru (đội 2)
    const doi = { gName: g.name, gSoul: g.gnSoul, kName: k.name, kSoul: k.gnSoul };
    // THÂN XÁC Ginyu (giờ do hồn Konohamaru điều khiển) gục xuống
    window.__defeat(g, k);
    let n = 0;
    while (n++ < 900 && !G.fighters.some(f => f.key === 'chichi')) window.__step(b);
    const ten = window.__vsSegments(false)
      .filter(s => !s.small || s.out || s.dim)
      .map(s => ({ txt: s.txt.trim(), out: !!s.out }));
    return { doi, ten, o0: G.relay[0][0] };
  });
  console.log('   ' + chg.ten.map(s => s.txt + (s.out ? '✕' : '')).join('  '));
  ok(chg.doi.kName === 'Captain Ginyu' && chg.doi.kSoul === 'ginyu',
     'hồn Ginyu đã sang thân xác Konohamaru', `${chg.doi.kName} (${chg.doi.kSoul})`);
  const gucRa = chg.ten.find(s => s.out);
  ok(gucRa && /KONOHAMARU/.test(gucRa.txt),
     'ô bị gạch mang tên HỒN vừa ngã (Konohamaru), không phải tên thân xác',
     gucRa ? gucRa.txt : 'không có ô nào bị gạch');
  ok(!chg.ten.some(s => s.out && /GINYU/.test(s.txt)),
     'KHÔNG gạch tên Ginyu — hồn anh vẫn đang đánh ở thân xác bên kia');
  ok(chg.ten.some(s => !s.out && /GINYU/.test(s.txt)),
     'Ginyu vẫn hiện là người đang đánh trên băng-rôn');

  // ---------------------------------------------------------------- 11. phe theo hồn
  muc('11. PHE đi theo HỒN: Ginyu vẫn đánh cho đội của anh, không quay ra đánh thuê');
  await gn.browser.close();
  const gn2 = await openMulti('relay', [['ginyu', 'chichi'], ['kono', 'tsubasa']]);
  const phe = await gn2.page.evaluate(() => {
    const G = window.__G();
    const g = G.fighters.find(f => f.key === 'ginyu');
    const doiGinyu = g.team;                       // đội Ginyu được xếp vào lúc chọn
    const k = G.fighters.find(f => f.key === 'kono' && f.team !== doiGinyu);
    window.__ginyuPossess(g, k);
    const hon = f => f.gnSoul || f.key;
    const xacGinyu = G.fighters.find(f => hon(f) === 'ginyu');   // thân xác đang chứa hồn Ginyu
    const xacKono = G.fighters.find(f => hon(f) === 'kono');
    // đồng đội cùng hàng chờ với Ginyu (ChiChi) có phải địch của anh không
    const qGinyu = G.relay[doiGinyu];
    return {
      doiGinyu, honGinyuODoi: xacGinyu.team, honKonoODoi: xacKono.team,
      than: `${xacGinyu.key} mang hồn ginyu`,
      oGinyu: qGinyu.map(e => `${e.key}→${e.f ? e.f.name : '-'}`),
      // đội hình còn lại của hàng chờ Ginyu có ai là địch của anh không
      dongDoiLaDich: qGinyu.filter(e => e.f && e.f !== xacGinyu)
                           .some(e => e.f.team !== xacGinyu.team),
      summonLech: G.fighters.some(f => f.summon && f.master && f.team !== f.master.team)
    };
  });
  ok(phe.honGinyuODoi === phe.doiGinyu,
     'hồn Ginyu vẫn ở ĐÚNG đội đã xếp anh vào, dù đang mượn thân xác địch',
     `đội ${phe.honGinyuODoi + 1} (${phe.than})`);
  ok(phe.honKonoODoi !== phe.doiGinyu,
     'hồn bị cướp xác về đánh cho đội của CHÍNH HỌ', 'đội ' + (phe.honKonoODoi + 1));
  ok(!phe.dongDoiLaDich,
     'đồng đội cùng hàng chờ KHÔNG trở thành địch của Ginyu', phe.oGinyu.join('  '));
  ok(!phe.summonLech, 'viện binh / đồng minh đổi phe theo chủ, không quay lại bắn chủ');

  const loi = errors.concat(ba.errors, gn.errors, gn2.errors);
  await gn2.browser.close();
  muc('12. Không có lỗi trang');
  ok(loi.length === 0, 'không có lỗi JS nào', loi.join(' | ') || 'sạch');

  console.log(`\n${fail ? 'HONG' : 'DAT'}  ${pass} dat, ${fail} hong`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
