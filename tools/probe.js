/* Dựng bản "có móc" của game để chạy test tự động.
   Cả game nằm trong một IIFE nên không biến nào lộ ra window; ở đây chèn thêm
   một dòng gán trước dấu đóng IIFE để test với tới được ruột game. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'index.html');

/* Những thứ test hay cần. Thêm vào đây chứ đừng sửa index.html. */
const HOOKS = `
window.__G=()=>G; window.__ac=ac; window.__RT=RT; window.__SHIKA=SHIKA;
window.__SFXBUF=SFXBUF; window.__sfx=n=>sfx(n); window.__SFXE=SFX_EVENTS;
window.__SFXMAX=SFX_MAXLEN; window.__SFXGROUPS=SFX_GROUPS; window.__SFXALIAS=SFX_ALIAS;
window.__Store=Store; window.__SPR=SPR; window.__SFXSRC=SFXSRC; window.__SLOT=SLOT;
window.__talk=talk; window.__CV=CV; window.__S=S; window.__HEADER=HEADER; window.__WH=()=>({W,H});
/* sfx() nuốt lỗi của synth(), mà switch thiếu case thì cũng không ném — nên muốn biết
   một ô có tiếng tự tạo dự phòng hay không thì phải soi thẳng thân hàm. */
window.__synthSrc=()=>synth.toString();
/* Thanh tốc độ trận — tiếng KHÔNG còn chạy theo nó nữa, xem mục cùng tên. */
window.__speedMul=()=>speedMul;
window.__playBuffer=playBuffer;   // __BGM đã có ở dưới
window.__CHARS=CHARS; window.__hurt=hurt; window.__shikaStabHit=shikaStabHit;
window.__gs=gs; window.__rts=rts;
window.__vector=vector; window.__drawFighter=drawFighter;
window.__setCtx=c=>{ ctx=c; };            // ctx khai bằng let chính vì để mượn thế này
window.__hurt=hurt; window.__stunFx=stunFx; window.__explode=explode;
window.__sexy=sexy; window.__shadowBind=shadowBind; window.__tryEvade=tryEvade;
window.__driveShot=driveShot; window.__eagleAwaken=eagleAwaken;
window.__basicShot=basicShot; window.__kickBall=kickBall; window.__ballHit=ballHit;
window.__twinShot=twinShot; window.__tsuPinTick=tsuPinTick;
window.__TSU={up:TSU_UP,bicOdds:BIC_ODDS,ballSpd:BALL_SPD,bicSpd:BIC_SPD,shotCd:TSU_SHOT_CD,
  bicDmg:BIC_DMG,driveDmg:DRIVE_DMG,driveKb:DRIVE_KB_DIST,twinStun:TWIN_STUN,twinVuln:TWIN_VULN,
  heal:EAGLE_HEAL,pinT:TSU_PIN_T,pinEdge:TSU_PIN_EDGE,pinNear:TSU_PIN_NEAR,
  pinMul:TSU_PIN_MUL,pinRun:TSU_PIN_RUN,burn:EAGLE_BURN};
window.__CHICHI={crit:CHICHI_CRIT,critDmg:CHICHI_CRIT_DMG,hit:CHICHI_HIT_DMG,step:CHICHI_CRIT_STEP,scold:SCOLD_CRIT};
window.__recCanvas=()=>RECV; window.__recFrame=()=>recFrame(); window.__CFR=()=>CFR;
window.__aacRaw=aacRaw; window.__aacAsc=aacAsc; window.__mAudioEntry=mAudioEntry;
window.__domainTargets=domainTargets; window.__domainShare=domainShare;
window.__SUZ=SUZ; window.__suzTune=suzTune; window.__suzCp=suzCp;
window.__ayaShield=ayaShield; window.__ayaJoin=ayaJoin; window.__ayaLeave=ayaLeave;
window.__suzForm2=suzForm2; window.__suzForm3=suzForm3; window.__suzDecide=suzDecide;
window.__suzStrike=suzStrike; window.__aimTarget=aimTarget; window.__suzThink=suzThink;
window.__SUZ_ASK=()=>SUZ_ASK;
window.__suzDecisionHit=suzDecisionHit; window.__ayaStrike=ayaStrike; window.__suzHeal=suzHeal;
window.__suzTier=suzTier; window.__SUZ_TIERS=SUZ_TIERS; window.__suzApply=suzApply;
window.__ayaGuardKick=ayaGuardKick; window.__ayaGuardKickHit=ayaGuardKickHit;
window.__SETS=SETS; window.__getCtx=()=>ctx; window.__sprite=sprite;
/* pickLine() bốc lại cho tới khi ra chỉ số KHÁC lần trước, nên test ghim cứng Math.random
   một hằng số là treo vòng lặp. Gọi cái này trước để lần bốc đầu chắc chắn ăn. */
window.__resetLines=()=>{ lastDecision=-1; lastWrong=-1; };
window.__DECISIONS=SUZ_DECISIONS; window.__WRONGS=SUZ_WRONG;
window.__DORA=DORA; window.__doraEnter=doraEnter; window.__doraEscape=doraEscape;
window.__setTheme=setTheme; window.__doraTime=doraTime; window.__drTimeBack=drTimeBack; window.__drShrink=drShrink;
window.__doraAirCannon=doraAirCannon; window.__doraSmallLight=doraSmallLight;
window.__doraCombo=doraCombo; window.__drAcOdds=drAcOdds; window.__drSlTarget=drSlTarget;
window.__drSlFire=drSlFire; window.__drConeTargets=drConeTargets;
window.__drSafeSpot=drSafeSpot; window.__drCanTime=drCanTime; window.__drStatus=drStatus; window.__statusTick=statusTick;
window.__step=step; window.__doraTick=doraTick; window.__drCopterOn=drCopterOn; window.__drTryEscape=drTryEscape; window.__drInterrupt=drInterrupt; window.__drAcHit=drAcHit;
window.__drDisorient=drDisorient;
window.__counters=counters; window.__melee=melee; window.__chichiCharge=chichiCharge;
window.__KICK={dmg:CHICHI_KICK_DMG,stun:CHICHI_KICK_STUN,cd:CHICHI_DASH_CD}; window.__konoTick=konoTick; window.__miniRasengan=miniRasengan; window.__explode=explode;
window.__kunaiShare=kunaiShare; window.__throwNow=throwNow;
window.__KONO={sdmg:SHURIKEN_DMG,odds:KUNAI_ODDS,kdmg:KUNAI_DMG,r:KUNAI_R,core:KUNAI_CORE,min:KUNAI_MIN,burn:KUNAI_BURN_DPS,burnT:KUNAI_BURN_T,mini:KONO_MINI_DMG,miniT:KONO_MINI_T,miniCd:KONO_MINI_CD,miniKb:KONO_MINI_KB,miniPad:KONO_MINI_PAD};
window.__kameHit=kameHit; window.__masenkoHit=masenkoHit; window.__summonHelp=summonHelp;
window.__KAME={dmg:KAME_DMG,stun:KAME_STUN,slowT:KAME_SLOW_T,move:KAME_SLOW_MOVE,cast:KAME_SLOW_CAST};
window.__MASENKO={dmg:MASENKO_DMG,move:MASENKO_STACK_MOVE,cast:MASENKO_STACK_CAST,max:MASENKO_STACK_MAX,t:MASENKO_STACK_T};
window.__meleeReach=meleeReach; window.__MUSIC=MUSIC; window.__doraVector=doraVector;
window.__GN=GN; window.__ginyuAura=ginyuAura; window.__ginyuState=ginyuState;
window.__ginyuChange=ginyuChange; window.__ginyuPossess=ginyuPossess;
window.__ginyuChangeMiss=ginyuChangeMiss; window.__gnChangeTarget=gnChangeTarget;
window.__ginyuBeam=ginyuBeam; window.__ginyuFlash=ginyuFlash; window.__ginyuStrike=ginyuStrike;
window.__gnChangeOdds=gnChangeOdds; window.__gnChangeFire=gnChangeFire;
window.__gnCanChange=gnCanChange; window.__gnCrowd=gnCrowd; window.__gnDmg=gnDmg;
window.__gnSoulThink=gnSoulThink; window.__gnSoulTick=gnSoulTick; window.__gnSoulCds=gnSoulCds; window.__gnCc=gnCc; window.__statusTick=statusTick;
window.__ginyuTick=ginyuTick; window.__gnAuraDraw=gnAuraDraw; window.__GN_AURA=GN_AURA; window.__gnStatus=gnStatus; window.__gnBeamHit=gnBeamHit; window.__gnFlashHit=gnFlashHit; window.__GN_PROJ=GN_PROJ_BODY; window.__knock=knock;
window.__SUP=SUP; window.__supermanEnter=supermanEnter; window.__supResolve=supResolve;
window.__supFlyOn=supFlyOn; window.__supFlyOff=supFlyOff; window.__supCombo=supCombo;
window.__supermanHeat=supermanHeat; window.__supermanFreeze=supermanFreeze;
window.__supermanMeteor=supermanMeteor; window.__supMsLand=supMsLand; window.__supMsTarget=supMsTarget;
window.__supHvOdds=supHvOdds; window.__supMsOdds=supMsOdds; window.__supQuakeShare=supQuakeShare; window.__supResist=supResist;
window.__supKbTake=supKbTake; window.__supCC=supCC; window.__supFreezeOn=supFreezeOn;
window.__supChill=supChill; window.__supIceBreak=supIceBreak; window.__supBurn=supBurn;
window.__supInterrupt=supInterrupt; window.__supermanTick=supermanTick; window.__supVector=supVector;
window.__supEyeY=f=>supEyeY(f); window.__bindTick=bindTick; window.__supStatus=supStatus;
window.__BEA=BEA; window.__beatriceEnter=beatriceEnter; window.__beatriceTick=beatriceTick;
window.__beaTarget=beaTarget; window.__beaMinya=beaMinya; window.__beaMinyaHit=beaMinyaHit;
window.__beaShamac=beaShamac; window.__beaShamacSpot=beaShamacSpot; window.__beaWeaken=beaWeaken;
window.__beaMurak=beaMurak; window.__beaCleanse=beaCleanse;
window.__beaEmtOn=beaEmtOn; window.__beaEmtBlock=beaEmtBlock; window.__beaReflect=beaReflect;
window.__beaElMinya=beaElMinya; window.__beaUltHit=beaUltHit; window.__beaErode=beaErode;
window.__beaSlowOn=beaSlowOn; window.__beaStatus=beaStatus; window.__beaVector=beaVector;
window.__beaVec=beaVec; window.__aiVec=aiVec; window.__beaEroStacks=beaEroStacks;
window.__TAN=TAN; window.__tanjiroEnter=tanjiroEnter; window.__tanjiroTick=tanjiroTick;
window.__tanMarkOpening=tanMarkOpening; window.__tanBasic=tanBasic; window.__tanWaterWheel=tanWaterWheel;
window.__tanConstantFlux=tanConstantFlux; window.__tanSunDance=tanSunDance;
window.__tanUltimate=tanUltimate; window.__tanAwaken=tanAwaken; window.__tanTarget=tanTarget;
window.__tanOpeningReady=tanOpeningReady; window.__regenFactor=regenFactor;
window.__drawTanjiroFx=drawTanjiroFx; window.__tanVector=tanVector;
window.__tanResetRhythm=tanResetRhythm;
window.__GOJO=GOJO; window.__gojoEnter=gojoEnter; window.__gojoTick=gojoTick;
window.__gojoBasic=gojoBasic; window.__gojoBlue=gojoBlue; window.__gojoRed=gojoRed;
window.__gojoPurple=gojoPurple; window.__gojoDomain=gojoDomain; window.__gojoTarget=gojoTarget;
window.__gojoInfinityBlock=gojoInfinityBlock; window.__gojoInterrupt=gojoInterrupt;
window.__gojoStatus=gojoStatus; window.__gojoVector=gojoVector; window.__drawGojoFx=drawGojoFx;
/* nạp hàng loạt ảnh / tiếng */
window.__bulkSprMatch=bulkSprMatch; window.__bulkSfxMatch=bulkSfxMatch;
window.__bulkSprites=bulkSprites; window.__bulkSfxFiles=bulkSfxFiles;
window.__bulkNames=bulkNames; window.__bulkNorm=bulkNorm;
window.__voicePack=voicePack;
window.__STAGES=STAGES; window.__setStage=k=>{ STAGE=k; }; window.__stageOf=stageOf;
window.__LANG=()=>LANG; window.__setLang=setLang; window.__t=t; window.__tr=tr;
window.__DEX=DEX; window.__dexCard=dexCard; window.__MUSIC=MUSIC; window.__BGM=BGM;
window.__PW_AXES=PW_AXES; window.__pwGrade=pwGrade; window.__pwAvg=pwAvg;
window.__radarSvg=radarSvg; window.__pwTable=pwTable; window.__DEXVIEW=()=>DEXVIEW;
window.__dexView=dexView; window.__HP=HP; window.__HP_STD=HP_STD; window.__hpSetAll=hpSetAll;
window.__bgmPick=bgmPick; window.__BGM_SLOTS=BGM_SLOTS; window.__musicStart=musicStart;
window.__STAGE=()=>STAGE; window.__stageArt=stageArt; window.__arenaFloor=arenaFloor;
window.__stageThumb=stageThumb; window.__packBuild=packBuild; window.__packLoad=packLoad;
window.__draw=draw; window.__ghostSil=ghostSil; window.__ARCADE=()=>ARCADE; window.__groundShadows=groundShadows; window.__running=()=>running;
/* ba chế độ đấu */
window.__PMODE=()=>PMODE; window.__ROSTERS=ROSTERS; window.__PICK=PICK;
window.__TMP=()=>TMP;   // đội hình đang NHÁP trong màn chọn, chưa chốt vào ROSTERS
window.__cselSteps=()=>cselSteps();  // danh sách bước của màn chọn theo chế độ đang chọn
window.__audioWake=()=>audioWake();  // ép chạy lượt cứu tiếng sau khi thoát app (iOS)
window.__ac=()=>AC;                  // AudioContext đang dùng (null nếu chưa ai bật tiếng)
window.__acOpen=()=>ac();            // mở/đánh thức context đúng đường của game
/* giải đấu */
window.__COMP=()=>COMP; window.__compNext=()=>compNextMatch(); window.__compDone=()=>compDone();
window.__compPlayNext=()=>compPlayNext(); window.__compChampion=()=>compChampion();
window.__lgOrder=()=>lgOrder(); window.__roundRobin=roundRobin; window.__compPaint=()=>compPaint();
window.__compTotal=()=>compTotal(); window.__compPlayed=()=>compPlayed();
window.__COMP_MAXT=COMP_MAXT; window.__compLive=()=>compLive;
window.__leagueNew=leagueNew; window.__lgAnim=()=>lgAnim; window.__cupAnim=()=>cupAnim;
window.__loadSaved=()=>loadSaved(); window.__COMP_SC=COMP_SC;
window.__setComp=(c,live)=>{ COMP=c; compLive=!!live; };
window.__canReflect=canReflect;
window.__floatScale=floatScale; window.__BEA_FX=()=>BEA_FX;
/* Ép trận đang đá kết thúc ngay với người thắng chỉ định — khỏi phải ngồi xem đủ mấy chục
   giây mỗi trận khi test cả một giải. */
window.__compWin=key=>{ const f=G.fighters.find(x=>!x.summon&&x.key===key); finish(f||G.k); };
window.__compResult=w=>compResult(w);
window.__buildRoster=buildRoster; window.__spawnSpots=spawnSpots; window.__newGame=newGame;
window.__foeOf=foeOf; window.__nearestFoe=nearestFoe; window.__aliveMains=aliveMains;
window.__aliveTeams=aliveTeams; window.__defeat=defeat; window.__finish=finish;
window.__teamLabel=teamLabel; window.__vsSegments=vsSegments; window.__versusBox=versusBox;
/* ---------- bản người chơi + phiêu lưu ---------- */
window.__PLAYKIND=()=>PLAYKIND; window.__setPlayKind=k=>setPlayKind(k);
window.__mode=()=>mode; window.__isPlayerDbg=f=>isPlayer(f); window.__syncHuman=()=>syncHuman(); window.__ginyuPossess=ginyuPossess; window.__isRun=()=>running; window.__autoSkill=()=>autoSkill;
window.__keys=keys;                       // bấm phím giả: __keys.j=true
window.__MOBS=MOBS; window.__MOB_KEYS=MOB_KEYS; window.__isMobKey=isMobKey;
window.__CKEYS=()=>CKEYS;
window.__ADV=()=>ADV; window.__setADV=a=>{ ADV=a; };
window.__advNew=advNew; window.__advNeed=advNeed; window.__advMaxHp=()=>advMaxHp();
window.__advStageDef=advStageDef; window.__advIsBoss=advIsBoss; window.__advRoster=advRoster;
window.__advMobHp=advMobHp; window.__advMobDmg=advMobDmg; window.__advBossHp=advBossHp; window.__advBossDmg=advBossDmg;
window.__advGain=advGain; window.__advLevel=advLevel; window.__advResult=advResult;
window.__advBuyStat=advBuyStat; window.__advBuySkill=advBuySkill; window.__advRank=advRank;
window.__advStatTick=advStatTick; window.__advSlotRate=advSlotRate; window.__advLockKeys=advLockKeys;
window.__advOn=()=>advOn(); window.__advTune=advTune; window.__advPaint=()=>advPaint();
window.__ADV_SLOTS=ADV_SLOTS; window.__ADV_ST=ADV_ST; window.__ADV_STAGES=()=>ADV_STAGES;
window.__ADV_SP=()=>ADV_SP; window.__ADV_RANKCD=()=>ADV_RANKCD; window.__ADV_HP0=()=>ADV_HP0;
window.__padName=padName; window.__padTick=()=>padTick();
window.__dupColor=dupColor; window.__teamTint=teamTint; window.__setMode=(m,r)=>{
  PMODE=m;
  if(r){ if(r.ffa)ROSTERS.ffa=r.ffa.slice(); if(r.teams)ROSTERS.teams=r.teams.map(a=>a.slice()); }
  newGame();
};
`;

/* Trả về đường dẫn file probe. Ghi ra thư mục tạm để không bẩn repo. */
function build() {
  const s = fs.readFileSync(SRC, 'utf8');
  const i = s.lastIndexOf('})();');
  if (i < 0) throw new Error('không tìm thấy dấu đóng IIFE trong index.html');
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'autobattle-')), 'probe.html');
  fs.writeFileSync(out, s.slice(0, i) + HOOKS + s.slice(i));
  return out;
}

/* Bản "có móc" của TRANG CHƠI: dựng lại play.html từ index.html rồi chèn hooks y hệt.
   Dựng lại chứ không đọc file có sẵn — như vậy test luôn soi đúng index.html hiện tại. */
function buildPlay() {
  execFileSync('python3', [path.join(ROOT, 'tools', 'mk_play.py')], { stdio: 'pipe' });
  const s = fs.readFileSync(path.join(ROOT, 'play.html'), 'utf8');
  const i = s.lastIndexOf('})();');
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'autobattle-play-')), 'play.html');
  fs.writeFileSync(out, s.slice(0, i) + HOOKS + s.slice(i));
  return out;
}

function playwright() {
  try { return require('playwright'); }
  catch (e) { return require('/opt/node22/lib/node_modules/playwright'); }
}

/* Mở một trận: chọn hai nhân vật rồi bấm vào trận và chạy.
   keyA/keyB lấy trong CHARS: kono | chichi | tsubasa | shika */
async function openGame(keyA, keyB, opt) {
  const o = opt || {};
  const { chromium } = playwright();
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 700, height: 980 } });
  await page.route('**://fonts.*/**', r => r.abort());   // khỏi chờ font mạng
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // trang chết giữa chừng thì báo cho rõ là CHẾT chứ không phải test viết sai.
  // (Đừng gom console.error vào đây: cú chặn font mạng ở trên luôn in một dòng
  //  ERR_FAILED, gom vào là mọi test đều báo hỏng oan.)
  page.on('crash', () => errors.push('TRANG SUP (renderer crash)'));
  // o.init: hàm chạy TRƯỚC trang, để bọc mấy API của trình duyệt (AudioContext…)
  if (o.init) await page.addInitScript(o.init);
  await page.goto('file://' + (o.file || build()), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.click('#mTabDuel');                      // 1v1: chế độ mặc định
  await page.click(`#listA .cTile[data-key="${keyA}"]`);
  await page.click(`#listB .cTile[data-key="${keyB}"]`);
  await page.click('#cselGo');
  if (o.play !== false) await page.click('#play');
  return { browser, page, errors };
}

/* Mở một trận nhiều người qua ĐÚNG màn chọn nhân vật, không gọi tắt vào ruột game:
   mode = 'ffa' (một mảng keys) hoặc 'team' (mảng CÁC ĐỘI, mỗi đội một mảng keys). */
async function openMulti(mode, picks, opt) {
  const o = opt || {};
  const { chromium } = playwright();
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 700, height: 980 } });
  await page.route('**://fonts.*/**', r => r.abort());
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('crash', () => errors.push('TRANG SUP (renderer crash)'));
  await page.goto('file://' + (o.file || build()), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  /* Bấm nút chế độ rồi KIỂM LẠI, bấm lại nếu chưa ăn. `loadSaved()` chạy bất đồng bộ và
     kết thúc bằng một lượt `cselRefresh()`; lượt vẽ muộn đó dựng lại cả dải nút theo
     TMP.mode đã lưu, nên cú bấm rơi trước nó bị quét sạch và cả đội hình vừa dựng thành
     một trận tay đôi (đo được: openMulti('team',…) ra đúng "kono vs chichi"). Đây là họ
     hàng của lỗi "một await trong loadSaved" ở mục 9. */
  const tab = mode === 'ffa' ? '#mTabFfa' : '#mTabTeam';
  for (let i = 0; i < 20; i++) {
    await page.click(tab);
    await page.waitForTimeout(120);
    if (await page.$eval(tab, e => e.classList.contains('on'))) break;
  }
  const sides = mode === 'ffa' ? [picks] : picks;
  /* Mấy cú bấm dưới đây đi qua `evaluate` chứ KHÔNG dùng `page.click`. Lý do: bấm một
     phát là màn chọn vẽ lại cả khung đội hình, phần tử vừa nhắm bị gỡ khỏi cây DOM ngay
     giữa lượt kiểm "visible / stable" của Playwright — nó ngồi thử lại đủ 30 giây rồi đổ,
     mỗi lần đổ một chỗ khác nhau. Đây là lối `t_comp.js` đã dùng cho #compGo. */
  const bam = sel => page.evaluate(q => { const e = document.querySelector(q);
                                          if (e) { e.click(); return true; } return false; }, sel);
  const dem = sel => page.$$eval(sel, b => b.length);
  // số đội mặc định là 2; thêm hoặc bớt cho khớp đội hình muốn dựng
  if (mode === 'team') {
    for (let i = 0; i < 6 && await dem('#multiPane .cselCol:not(.off)') > sides.length; i++)
      { await bam('#multiPane .cselCol:not(.off) .grpBtn:not(.on)'); await page.waitForTimeout(40); }
    for (let i = 0; i < 6 && await dem('#multiPane .cselCol:not(.off)') < sides.length; i++)
      { await bam('#multiPane .grpBtn.on'); await page.waitForTimeout(40); }
  }
  const groups = sides.map((keys, i) => [`#grpSlots${i}`, `#grpList${i}`, keys]);
  for (const [slots, list, keys] of groups) {
    // dọn sạch đội hình mặc định rồi mới bấm thêm đúng những người cần
    for (let i = 0; i < 12; i++) {
      if (!await dem(slots + ' .cChip button')) break;
      await bam(slots + ' .cChip button');
      await page.waitForTimeout(40);
    }
    /* Đội hình cho phép chọn TRÙNG nhân vật, mà bấm hai lần liên tiếp vào CÙNG một ô thì
       game hiểu là "chạm hai lần" và mở bảng thông số (DBL_TAP = 380ms). Nên khi khoá lặp
       lại thì phải giãn nhịp ra, đúng như người thật bấm. */
    let truoc = '', can = 0;
    for (const k of keys) {
      if (k === truoc) await page.waitForTimeout(420);
      can++;
      /* Bấm rồi CHỜ CHO TỚI KHI dải đội hình thật sự dài thêm một thẻ, chứ đừng bấm xong
         là đi tiếp: lưới nhân vật được dựng lại sau mỗi lần bấm, cú bấm rơi đúng lúc dựng
         lại thì mất trắng và đội hình thiếu người — lúc đó test đổ ở tận chỗ khác. */
      for (let i = 0; i < 12 && await dem(slots + ' .cChip button') < can; i++) {
        await bam(`${list} .cTile[data-key="${k}"]`);
        /* Nghỉ QUÁ mốc DBL_TAP (380ms) giữa hai lần thử: bấm lại nhanh hơn thế thì game
           hiểu là "chạm hai lần", mở bảng thông số #dexPop — bảng đó phủ kín trang và
           chặn mọi cú bấm sau, kể cả #cselGo. Đúng cái bẫy đã làm test đổ mỗi lần một chỗ. */
        await page.waitForTimeout(430);
      }
      truoc = k;
    }
    /* Chốt lại: đội này phải đủ đúng số người vừa yêu cầu. Thiếu là có cú bấm rơi mất
       giữa lượt vẽ lại — đổ ngay ở đây cho biết chỗ, đừng để nó đi tiếp rồi đổ ở một
       phép đo chẳng liên quan gì (đã dính: `t1[1].hp` với `a.x` undefined). */
    const co = await dem(slots + ' .cChip button');
    if (co !== keys.length)
      throw new Error(`openMulti: ${slots} dựng được ${co}/${keys.length} người`);
  }
  // lỡ có bảng thông số nào bật lên thì đóng lại: nó phủ kín trang và chặn #cselGo
  await page.evaluate(() => { const e = document.getElementById('dexPop');
                              if (e) e.classList.add('off'); });
  await page.click('#cselGo');
  if (o.play !== false) await page.click('#play');
  return { browser, page, errors };
}

module.exports = { build, buildPlay, openGame, openMulti, playwright, SRC, ROOT };
