# Multiverse Battler — ghi chú cho Claude

**Tên game là `Multiverse Battler`** (người dùng đổi từ "Đấu Trường Chiba"). Tên repo vẫn
là `autobattle` — đừng đổi, đổi là gãy link Pages lẫn mọi đường dẫn cũ.

Game đối kháng tự động, vẽ bằng canvas 2D. **Toàn bộ game nằm trong một file duy nhất:
`index.html`** (HTML + CSS + JS gói trong một IIFE `(() => { ... })();`). Không có bước
build, không có dependency. Mở file bằng trình duyệt là chạy.

Vì mọi thứ nằm trong IIFE nên **không có biến nào lộ ra `window`** — muốn test tự động
thì phải tạo bản sao có gắn thêm móc (xem mục Kiểm thử).

---

## 0. Bản đồ `index.html`

File dài ~7500 dòng. Các khu ngăn nhau bằng comment `/* ---------- tên ---------- */`,
**tìm bằng cách grep chính cái tên đó** thay vì nhớ số dòng (số dòng đổi liên tục):

| Khu | Có gì |
|---|---|
| đầu file (chưa đánh dấu) | CSS, khung HTML, các `id` của nút và bảng |
| *(ngay sau `<script>`)* | canvas, `BASE_SPEED` / `RT` / `rts`, vòng lặp bước cố định |
| `sprite slots` | `SPR`, `COLORS`, `HP`, `SETS` — danh sách ô dán ảnh |
| `bảng nhân vật chơi được` | mọi hằng số cân bằng của Kono / ChiChi / Tsubasa |
| `Horikita Suzune` (khối hằng) | cả cụm `SUZ`, `SUZ_BUBBLE` |
| `Captain Ginyu` (khối hằng) | cả cụm `GN`, `GN_PROJ_BODY`, `GN_SHOUT`, `GN_CHANGE_LINE` |
| `Doraemon` (khối hằng) | cả cụm `DORA`, `DORA_HI`, `DORA_HI_LIFE` |
| `Superman` (khối hằng) | cả cụm `SUP` |
| `Shikamaru` (khối hằng) | `gs()`, cả cụm `SHIKA`, các hằng tuổi thọ hình (`GRUMBLE_LIFE`…) |
| `Beatrice` (khối hằng) | `BEA_BODY_W/H`, `BEA_R`, cả cụm `BEA` |
| *(kế đó)* | `CHARS` — `init` / `think` / `gauge` / mảng `skills` của chín nhân vật |
| *(kế đó)* | `Store` — IndexedDB, khoá `spr_*` / `sfx_*`, nạp và xoá ảnh |
| `âm thanh` | `SFX_EVENTS`, `synth()`, `SFX_FULL/MAXLEN/SEG/POS/ACTIVE`, `sfx()`, `playBuffer()` |
| `nhạc nền` | nhạc nền tự sinh, `THEMES` / `setTheme()` — đổi sang theme du hành thời gian |
| `state` | `mk()`, `mkChar()`, `foeOf()`, `buildRoster()`, `spawnSpots()`, `newGame()`, `later()`, `pop()`, `setPose()` |
| `damage` | `stunFx()`, `tryEvade()`, **`hurt()`**, `counters()`, `koFx()`, `defeat()`, `finish()` |
| `Konohamaru` / `ChiChi` / `Shikamaru` / `Ozora Tsubasa` / `Horikita Suzune` / `Captain Ginyu` / `Doraemon` / `Superman` / `Beatrice` | thân các chiêu thức |
| `AI` | `MELEE_MIN/MAX/BAND/GAP`, `orbWant()`, `aiVec()`, `dodgeVec()`, `playerVec()` |
| `step` | một hàm to — toàn bộ mô phỏng một bước 1/120 giây |
| `draw` | `vector()`, `sprite()`, `drawFighter()`, `drawGarden()`, `drawForestGrip()`, `bombAt()`, `tendril()`, phân cảnh, băng-rôn |
| `màn đấu` | `STAGES`, `stageArt()`, `arenaFloor()` — mười hai sàn đấu và ô dán ảnh nền |
| `gói phát hành` | `packBuild()` / `packLoad()` — đường đưa ảnh, tiếng sang trang chơi |
| `loop` / `ghi hình sàn đấu` / `màn chọn nhân vật` | vòng `requestAnimationFrame`, quay video (`recFrame()` dựng khung dọc 9:16), ba nút chế độ `.mTab`, dựng thẻ `.cTile` và dải đội hình `.cChip` |

---

## 1. Quy đổi thời gian — đọc kỹ trước khi sửa bất kỳ con số nào

Thanh tốc độ ghi **"Gốc 1x"**, nhưng giá trị thật là `speedMul = 0.5`. Nghĩa là:

> **1 giây trong trận = 2 giây người chơi ngồi đếm.**

```js
const BASE_SPEED = 0.5, RT = 1/BASE_SPEED;   // RT = 2
const rts = sec => String(+(sec*RT).toFixed(2));  // giây-trong-trận -> giây người chơi (chỉ để HIỂN THỊ)
const gs  = sec => sec/RT;                        // giây người chơi -> giây-trong-trận (để KHAI HẰNG SỐ)
```

Ba quy tắc bắt buộc:

1. **Hằng số thời gian trong code tính bằng giây-trong-trận.** `EXHAUST_T = 4` nghĩa là
   người chơi thấy 8 giây.
2. **Mọi chữ hiển thị cho người chơi phải bọc `rts()`.** Không bao giờ in thẳng hằng số ra
   màn hình hay ra bảng kỹ năng.
3. **Sát thương duy trì (`dots[].dps`) tính theo giây-trong-trận**, nên khi khai phải nhân
   `RT`: muốn "5 dmg mỗi giây người chơi" thì viết `5*RT`. Ngược lại lúc hiển thị thì chia
   lại: `SHIKA.bleedDps/RT`.

Nhóm hằng số của Shikamaru khai theo giây người chơi rồi bọc `gs()` cho dễ đọc
(`stabCd: gs(15)` = 15 giây người chơi = 7.5 giây trong trận). Các nhân vật cũ khai thẳng
bằng giây-trong-trận. **Đừng trộn hai lối viết trong cùng một hằng số.**

Vòng lặp chính dùng bước cố định:

```js
const raw = Math.min(.05, (now-last)/1000);
acc += raw*speedMul;
while (acc >= 1/120) { step(1/120); acc -= 1/120; }
```

---

## 2. Mười nhân vật và những con số đã chốt

**Cả chín người cùng 800 máu** — `HP_STD = 800`, người dùng chốt: *"máu setting chuẩn là 800"*.
Bảng `HP` chỉ là chỗ giữ con số của từng người để người chơi chỉnh lẻ; mọi chỗ cần một con số
mặc định thì đọc `HP_STD` chứ đừng cắm cứng (xem mục 2g). *(Đường đi: bảy người 1000 + Superman
800 → cả bảng 800.)* Bảng `CHARS` là nơi khai tất cả: mỗi nhân vật có
`init(f)`, `think(f,e,d,auto)`, `gauge(f)` và mảng `skills` (chuỗi HTML hiển thị trong
màn chọn nhân vật — nhớ cập nhật khi đổi số).

### Konohamaru (`kono`)
- Chiêu 1: **Shuriken 25 dmg** (cũ 20) hoặc **Explosive Kunai** — **30%** số lượt ném ra kunai
  (cũ 15%, `KUNAI_ODDS`). Hằng số khai ngay dưới `EXHAUST_MUL`, viết thẳng bằng **giây trong
  trận** theo đúng lối nhân vật cũ (`gs()` khai mãi dưới khối Shikamaru — viết `gs()` ở đó là
  dính TDZ).
- **Kunai nổ là một cú AoE thật**, ăn theo mức độ đứng gần tâm — `kunaiShare(d)` nội suy tuyến
  tính, `d` đo từ tâm nổ tới **mép model** (`dist − r`), cùng lối `supQuakeShare()` của Superman:

  | Quãng cách tới tâm nổ | Ăn bao nhiêu |
  |---|---|
  | trong lõi `KUNAI_CORE = 34` | **100%** — đủ 45 dmg |
  | từ lõi ra tới `KUNAI_R = 82` | **nhạt dần 100% → 40%** (`KUNAI_MIN`) |
  | quá `KUNAI_R` | **không dính một điểm nào** |

  Băng-rôn đổi chữ theo: trong lõi là `BOOM!`, ngoài rìa là `BOOM · EDGE`, và `explode()` vẽ
  thêm một vòng trắng đúng bằng lõi cho nhìn ra chỗ ăn đủ dmg.
- Ai dính vụ nổ cũng **bén lửa 5 dmg mỗi giây người chơi trong 3 giây** (`KUNAI_BURN_DPS`
  = `5*RT` vì `dots[].dps` tính theo giây trong trận, `KUNAI_BURN_T`). **Không cộng dồn** —
  quả thứ hai chỉ làm mới đồng hồ (`kunaiBurn()` xoá dot cũ có cờ `kunai` rồi mới đẩy dot mới),
  đúng lối Burning của Superman.
- **Nổ vào tường cũng lan ra**: nhánh trong vòng duyệt đạn vốn đã gọi `explode()` khi kunai
  chạm mép sàn, nên ai đứng cạnh tường vẫn ăn đủ phần của mình. Đo được: đứng sát mép, kunai
  nổ vào tường, mất đúng 45 dmg và bén lửa.

  > **Chỗ tự quyết:** phần nhạt dần chỉ ăn vào **cú nổ**, còn **lửa thì giữ nguyên** dù đứng
  > giữa hay đứng rìa — bản mô tả chỉ nói "đứng xa trúng đòn dính ít dmg hơn". Tỉ lệ ra kunai
  > cũng không nêu số mới, tôi nhân đôi 15% → **30%**. Muốn khác thì sửa `KUNAI_MIN` /
  > `KUNAI_ODDS`.

- **Mini Rasengan — cửa thoát khi bị vây cận chiến.** Bị người khác đứng dí sát (trong
  `r + MELEE_REACH + KONO_MINI_PAD`) suốt **2.5 giây người chơi** (`KONO_MINI_T`) mà **không
  gây nổi một điểm sát thương nào** thì cậu xoáy một quả nhỏ: **40 dmg** (`KONO_MINI_DMG`) và
  **hất lùi 30% chiều dài sàn** (`KONO_MINI_KB`, cũ 18% — người dùng nâng lên:
    *"Mini rasengan bay khoảng 30% sàn"*), hồi chiêu **12 giây người chơi**
  (`KONO_MINI_CD`). Dáng dùng lại **đúng dáng Rasengan** (`setPose(f,'ulti',…)`).
  - **Đếm trong `konoTick()` chứ không đếm trong `think()`**: lúc bị quây cậu hay dính choáng,
    mà `think()` không chạy khi đang choáng — đếm ở đó thì cửa thoát không bao giờ mở.
  - **Đẩy MỌI người đang đứng sát**, không riêng một người: cậu đang gỡ vòng vây chứ không
    chọn mục tiêu. *(Chỗ này tôi tự chốt từ chữ "thoát khỏi vòng quây".)*
  - `counters()` đặt `src.miniPress=0` mỗi lần cậu gây được sát thương, đúng cái cửa mà
    `drNoHit` của Doraemon dùng.
  - Kiểm bằng `node tools/t_kono.js`.
- Chiêu 2: **Kage Bunshin** 60 dmg, phân thân đuổi theo, gây **Kiệt sức** — giảm
  **25%** tốc chạy và tốc ra chiêu (`EXHAUST_MUL = .75`, `EXHAUST_T = 4`).
  Hiệu ứng nhìn: **bọt khí kiểu trúng độc** bay lên, ánh xanh lá **rất nhạt**.
  *(Người dùng đã bác bản tô xanh đậm: "nhìn lởm quá".)*
- Chiêu 3: **Sexy no Jutsu** — 30 dmg (`SEXY_DPS=15`, 4 nhịp), choáng nam
  **2.5 giây người chơi** (`SEXY_STUN=1.25`), Konohamaru tự miễn **0.75 giây người chơi**
  (`SEXY_IMMUNE=.375`). Hồi chiêu `cm(5)`, không kèm điều kiện khoảng cách nên tung khá dày.
- Rage 20: Rasengan Dash.

### ChiChi (`chichi`)
- Chiêu 1 cận chiến, chiêu 2 **Mắng** — 5 đợt sóng xung kích, phản lại shuriken / kunai /
  bóng / **vòng khí Air Cannon** / **luồng khí tím của Ginyu**.
  > **Hai loại vừa thêm, người dùng chốt riêng từng cái**: *"ChiChi có skill mắng phản được
  > air cannon nhé"*, rồi *"mắng ChiChi cản được beam Ginyu"*. Cả hai chỉ việc thêm tên type
  > (`'aircan'`, `'gbeam'`) vào tập `PHYSICAL`. Hất ngược rồi thì **chủ cũ ăn nguyên đòn của
  > chính mình** — đo được: Doraemon **85 dmg + choáng**, Ginyu **18 dmg mỗi luồng**, và đủ
  > ba luồng thì chính anh dính *Worn Out*.
  > - **Kame / Masenko vẫn KHÔNG phản được** — tia xuyên và cầu năng lượng cỡ ultimate; Drive
  >   Shot và Twin Shot vẫn mang cờ `noReflect`.
  > - Nhánh phản đòn phải **xoay luôn `p.ang`** và **xoá sạch `p.hitList`**, viết chung một
  >   lần cho mọi loại chứ đừng cắm theo từng type: mấy viên vẽ theo `p.ang` chứ không theo
  >   vận tốc, không xoay thì chúng bay lùi mà đầu đạn vẫn hướng cũ; còn `hitList` không xoá
  >   thì viên đạn vẫn nhớ là đã trúng ai rồi và **bay xuyên qua đúng người đó**.
  > - **Cú hất ngược lệch ±0.25 rad nên KHÔNG phải lần nào cũng trúng** — đó là cơ chế sẵn
  >   có, không phải lỗi. `t_chichi.js` vì vậy thử tới 10 lượt và đòi có ít nhất một lượt ăn
  >   đủ dmg (đo được: Air Cannon trúng ngay lượt 1, luồng khí tím trúng ở lượt 3), chứ đo
  >   đúng một lượt là đổ oan.
- **Flying Kick**: đồng hồ riêng `f.dashCd`, **không** nằm trong `f.cds` — cố định
  `CHICHI_DASH_CD = 5` giây-trong-trận = **10 giây người chơi**, nên hiệu ứng Kiệt sức
  không kéo dài được nó. Lúc lao: miễn khống chế, chỉ nhận 70% sát thương
  (`CHICHI_DASH_RES`). Chạm người thì **45 dmg** (`CHICHI_KICK_DMG`) + **choáng 2 giây
  người chơi** (`CHICHI_KICK_STUN`) — cũ là ăn theo cú đá chí mạng 25 dmg và không choáng.
  - `melee(c,e,forceCrit,dmg)` nhận thêm tham số `dmg` để cú lao truyền thẳng 45 vào, và
    **trả về giá trị của `hurt()`** — cái choáng gọi sau khi xét giá trị đó, đúng luật ở
    mục 6: né được thì không dính choáng ăn theo.
  - **Đo cú đá phải chạy tay từng bước bằng `__step()`**, đừng đọc qua vòng poll: trận vẫn
    chạy nên ChiChi còn đấm thường và lao lại lần nữa xen vào, đo kiểu đó ra 90~95 thay vì
    45. Test khoá `dashCd` / `cds` của cả hai người rồi mới ép `chichiCharge()`.
- **Chí mạng — đã buff, và KHÔNG có trần.** Người dùng chốt: *"Chi-Chi có crit rate cơ bản
  từ 10->30%"*, *"Chi-Chi đá có crit từ 25->30 dmg"*, *"Crit ko giới hạn"*.
  | | Cũ | Mới |
  |---|---|---|
  | chí mạng gốc của đòn tay | 10% | **30%** (`CHICHI_CRIT`) |
  | sát thương cú đá chí mạng | 25 | **30** (`CHICHI_CRIT_DMG`) |
  | nội tại cứ 5 đòn | +5% | **+5%, không trần** (`CHICHI_CRIT_STEP`) |
  - `chance(p)` chỉ là `Math.random()<p` nên tỉ lệ vượt 1 là đòn nào cũng chí mạng —
    **đừng bọc `Math.min` vào `f.critBonus` trong `counters()`**, đó chính là cái "không
    giới hạn" người dùng yêu cầu. Đo được: 200 đòn ⇒ +200%.
  - **Câu mắng có thang chí mạng RIÊNG** (`SCOLD_CRIT = .20`, 30 dmg), vẫn cộng thêm
    `critBonus` như cũ. Người dùng chỉ nêu chí mạng của đòn tay nên chỗ này giữ nguyên.
- Dưới 20% máu: gọi **Goku / Gohan**. Có phân cảnh đóng băng (`G.freeze`) + zoom camera.

**Hai chiêu viện binh — đã buff.** Hằng số khai ngay dưới `CHICHI_DASH_CD`, và vì ChiChi là
nhân vật **cũ** nên chúng viết thẳng bằng **giây trong trận** (nhân đôi ra giây người chơi) —
`gs()` khai mãi dưới khối Shikamaru, viết `gs()` ở đó là dính TDZ.

| | Cũ | Mới |
|---|---|---|
| **Kamehameha** (Goku) | 300 dmg, không hiệu ứng ăn theo | **400 dmg** (`KAME_DMG`) + **choáng 2 giây người chơi** (`KAME_STUN`) rồi **−60% tốc chạy / −30% tốc ra chiêu trong 4 giây** (`KAME_SLOW_*`) |
| **Masenko** (Gohan) | 5 đợt × 100 dmg | vẫn **100 dmg mỗi đợt**, nhưng **mỗi đợt trúng chồng thêm −10% tốc chạy / −7% tốc ra chiêu** (`MASENKO_STACK_*`), trần 5 lớp |

- **Ghì chân của Kamehameha chỉ bắt đầu SAU khi hết choáng**, xếp hàng qua `t.kameAfter` rồi
  `summonStatus()` mở ra đúng lúc `stun<=0` — cùng lối với luồng sáng của Ginyu, đừng cộng
  thẳng vào lúc trúng đòn.
- **`kameHit()` / `masenkoHit()` gọi SAU khi `hurt()` trả về true** (mục 6): né được thì không
  dính choáng lẫn ghì chân ăn theo. Tia vẫn là `kind='ult'` nên Shikamaru né được mà không
  cộng dồn tỉ lệ, còn cửa thần kỳ của Doraemon chỉ né được 30%.
- **`summonStatus(f,dt)` chạy trong `statusTick` giữa `gnStatus` và `drStatus`**: `gnStatus`
  GÁN đè hệ số nên phải nằm sau nó, còn phải nằm trước `drStatus` để cú nới hiệu ứng làm chậm
  của Take-copter đọc được phần này.
- Chồng lớp Masenko **làm mới đồng hồ chung** mỗi lần trúng (`MASENKO_STACK_T` = 4 giây người
  chơi); hết giờ là rơi sạch cả chồng chứ không rơi từng lớp.
- Cả hai đều là **hiệu ứng làm chậm** nên Emergency Door của Doraemon xoá được, và Time
  Machine cũng xoá khi anh tua ngược.

> **Chỗ tự quyết:** bản yêu cầu không nêu **thời lượng** của chồng lớp Masenko, chỉ nêu mức
> cộng dồn. Tôi lấy **4 giây người chơi**, đúng bằng quãng ghì chân của Kamehameha, và trần
> **5 lớp** đúng bằng số đợt của một lượt Masenko (đủ 5 đợt = −50% tốc chạy / −35% tốc ra
> chiêu). Muốn khác thì sửa `MASENKO_STACK_T` / `MASENKO_STACK_MAX`.

### Ozora Tsubasa (`tsubasa`)
- Chiêu 1 Basic Shot 25 (**15%** ra Overhead Kick **46** + choáng), chiêu 2 Drive Shot **90**
  + cháy 5×3 + **hất lùi 20% sàn**.
- **5 goal** (`GOAL_MAX = 5`) mở Victory Twin Shot 150 + choáng.

**Đợt buff — ba thứ cùng lên 150% một lượt.** Người dùng chốt: *"tăng tỉ lệ ra overhead
kick — tăng tốc độ bóng bay — tăng tốc độ đá bóng từ hiện tại lên 150% hiện tại"*. Câu đó
đọc là **một hệ số 150% cho cả ba**, nên chúng đi chung hằng `TSU_UP = 1.5`; sửa một chỗ là
cả ba đổi theo.

| | Cũ | Mới |
|---|---|---|
| tỉ lệ ra Overhead Kick | .10 | **.15** (`BIC_ODDS`) |
| tốc bóng thường / overhead | 305 / 345 | **457.5 / 517.5** (`BALL_SPD` / `BIC_SPD`) |
| nhịp giữa hai cú sút | `cm(1.35)` | **`cm(.9)`** (`TSU_SHOT_CD`) |
| Overhead Kick | 40 | **46** — đúng +15% (`BIC_DMG`) |
| Drive Shot | 80, lực đẩy 200 | **90** (`DRIVE_DMG`) + **hất lùi 20% sàn** (`DRIVE_KB_DIST`) |
| Twin Shot: choáng · thủng giáp | 4s · 6s người chơi | **4.5s · 9s** (`TWIN_STUN` / `TWIN_VULN`) |
| tốc chạy nền | 100 | **106** |

- **Lực đẩy của Drive Shot đi qua công thức, đừng cắm một con số lực vào.** `knock()` nhận
  `W * DRIVE_KB_DIST * 6` vì lực tắt dần theo `exp(-6t)`, nên quãng đi được đúng bằng
  `power/6` — cùng lối Air Cannon của Doraemon. Đo được **117px** trên mốc 124px (phần hụt
  là cái ngưỡng `hypot < 8` cắt đuôi lực đẩy trong `step()`, không phải lỗi).
- **Hai con số thời gian của Twin Shot khai bằng giây TRONG TRẬN** (`TWIN_STUN = 2.25`,
  `TWIN_VULN = 4.5`) như mọi hằng của nhân vật cũ, và mọi chỗ hiển thị bọc `rts()`. Người
  dùng nói "+0.5s choáng, +3s chịu thêm dmg" — **hiểu là giây NGƯỜI CHƠI**, đúng cái họ đọc
  được trên bảng kỹ năng. Đo được: 4.50s và 9.00s.
- **Wings of the Eagle hồi 6.5% máu tối đa lúc bật** (`EAGLE_HEAL`). Phần hồi phải cộng vào
  **TRƯỚC** dòng `t.eagleBurn = t.hp/EAGLE_BURN` — con số đó chia đều máu CÒN LẠI vào quãng
  cháy, hồi sau là quãng cháy vẫn tính theo máu cũ và anh **gục non**. Đo được: 72 → 124 máu,
  nhịp cháy 33/giây × 3.75s = đúng 124.
- **Bị dồn vào góc thì bứt tốc mà thoát — `tsuPinTick()`.** Người dùng: *"khi bị áp sát vào
  góc từ 2s → Tsubasa tăng mạnh tốc độ di chuyển lên để có thể thoát ra tình huống hiểm
  nghèo"*. Đứng cách mép sàn dưới `TSU_PIN_EDGE` (96px) VÀ có địch trong `TSU_PIN_NEAR`
  (250px) suốt `TSU_PIN_T` (**2 giây người chơi**) thì mở `f.tsuRun`: tốc chạy **×2.1**
  (`TSU_PIN_MUL`) trong `TSU_PIN_RUN`.
  - **Đếm trong `tsuPinTick()` chứ đừng đếm trong `think()`**: lúc bị dồn anh hay dính
    choáng, mà `think()` không chạy khi đang choáng — đúng cái bẫy của Mini Rasengan.
  - **Gọi SAU `statusTick(f,dt)`** trong `step()`: hàm đó **dựng lại `moveMul` từ đầu mỗi
    nhịp**, nhân trước là mất trắng.
  - Đo được: dồn sát mép đúng 2.00 giây người chơi thì cửa mở, hệ số ra đúng ×2.1, còn đứng
    giữa sàn thì không bao giờ kích ra.
- **Dưới 20% máu — Pre-Wings** (`PREWING_HP`): −35% sát thương nhận
  (`PREWING_RES=.65`), +50% tốc cast (`PREWING_CAST`), kháng choáng 40%
  (`PREWING_STUN=.6`). Hào quang **hiện dần dần, nhạt nhưng vẫn đủ thấy khác biệt**, kèm
  một dòng note lúc vào trạng thái.
- **Dưới 10% máu — Wings of the Eagle** (`EAGLE_HP=.10`): tốc đánh ×4, Drive Shot ×2 nữa,
  chuẩn xác ×2, kháng 70%, miễn khống chế, **cháy hết máu trong 7.5 giây người chơi**
  (`EAGLE_BURN=3.75`). Có chỉ tiêu `EAGLE_QUOTA` bắt buộc tung đủ 2 drive + 2 bicycle.
  **Drive Shot lúc này bỏ hẳn quãng vọt lên trời ngẫu nhiên**: bóng bay thẳng vào địch như
  mọi loại bóng khác (`straight:true`, `rise:0`, `homing:false`, tốc `EAGLE_DRIVE_SPD=420`),
  trượt thì nảy tường một lần rồi tan giống quả bóng thường. Kiểm bằng `node tools/t_drive.js`.

### Shikamaru (`shika`)
Toàn bộ trong hằng `SHIKA`. Những điểm người dùng chốt riêng:
- **Ngồi lười** (không phải nằm) đầu trận, tích 12 chakra/giây người chơi; bật dậy khi máu
  tụt xuống **80%** (`wakeHp:.80`) rồi chỉ còn 4/giây.
- **Trần của quãng ngồi lười là 600 chakra** (`lazyCap`). Không ai đánh thì cứ ngồi tới khi
  đủ 600 là **tự đứng dậy** đánh như bình thường. Trần này **chỉ chặn quãng ngồi**, không
  phải trần tuyệt đối: đứng dậy rồi vẫn tích tiếp 4/giây và **vượt qua 600 được**.
  *(Đường đi của con số: 1000 → 700 → 600, người dùng hạ dần cho anh vào trận sớm hơn.
  Test đọc thẳng `SHIKA.lazyCap` nên đổi con số này là đủ, đừng ghim số vào chỗ khác.)* Hai lối
  rời ghế đi chung hàm `shikaWake(f, why)` để phần dọn dẹp (câm tiếng than, xoá bong bóng,
  chờ `wakeDelay`) không bị chép thành hai bản. Thanh chakra canh theo `lazyCap`.
- Bật dậy: **cắt tiếng than thở ngay lập tức**, xoá bong bóng đang treo, rồi **chờ 1.5 giây
  người chơi** (`wakeDelay:1.5`) mới vận chiêu. Vẫn phải đi vào tầm nên đòn đầu tiên thực tế
  rơi vào khoảng 4 giây — đó là bình thường, không phải lỗi.
- **Né đòn**: gốc 10%, mỗi lần **trúng đòn thường** +2.5%, trần 70%. Né được thì **không**
  cộng dồn. Né được **mọi thứ kể cả ultimate** (Rasengan, Kamehameha, Masenko, mọi cú sút
  của Tsubasa) — nhưng ultimate **không** cộng dồn tỉ lệ. Bốn luật đi kèm:
  1. **Đang choáng thì không né được cú nào** (vẫn cộng dồn tỉ lệ, vì vẫn là đòn ăn vào người).
  2. **Né được thì không dính choáng ăn theo** — nên mọi chỗ gọi `stunFx()` phải nằm sau khi
     kiểm `hurt()` trả về true.
  3. **Ngoại lệ duy nhất: Sexy no Jutsu** — ăn cả sát thương lẫn choáng, không né được
     (sát thương đi đường `dots`, choáng gọi thẳng `stunFx`).
  4. Trừ lúc đang kết ấn **trói bóng lần bù** (`bind.guard`): lần đó không gì cắt được,
     Sexy no Jutsu cũng không.

  Kiểm bằng `node tools/t_dodge.js`.
- Chiêu 1: hai phi tiêu, mỗi cái **12 dmg + 5 dmg/giây chảy máu**, tốc đánh bằng nửa Konohamaru.
- Đâm sau lưng: 50 dmg + chảy máu + choáng 1 giây người chơi, mỗi 15 giây người chơi, bị
  cắt ngang thì hoàn 50% hồi chiêu.
- Chiêu 2 **Shadow-Neck Bind**: 45 dmg/giây trong 3 giây rồi choáng 1.5 giây. Bị choáng giữa
  chừng là đứt, lần thử lại được bảo đảm không đứt.
- Ultimate **Nara Clan Forest** (dưới 20% máu): thời lượng = chakra/100 giây người chơi. Địch
  bị kiệt sức, gây sát thương giảm 50%, ăn 35~215 dmg/giây. Xong lãnh địa: mất chiêu 2, chiêu 1
  yếu đi 30%, không tích chakra nữa (`f.weak`).

### Horikita Suzune (`suzune`)
Toàn bộ trong hằng `SUZ`, khai theo lối của Shikamaru (giây người chơi bọc `gs()`).
Nhân vật cận chiến, đi theo **ba form** — đây là cả tính cách nhân vật, đừng gộp lại:

| Form | Là ai | Có gì |
|---|---|---|
| 1 | Đã dám vung tay nhưng còn rụt rè | chỉ có chiêu 1, **10 dmg** mỗi đòn và ra chậm hơn form 2 **1.6 lần** (`SUZ.f1`, `SUZ.f1Slow`); **chưa có chiêu 2**, chưa tích điểm lớp, chưa có cửa hồi máu. Đứng thì dáng `scared` (hai tay chụm trước ngực, mắt mở to, giọt mồ hôi), trúng đòn thì dáng `block` (hai tay bắt chéo chữ X). AI nhích vào đủ tầm rồi lùi ngay |
| 2 | Dám đánh nhưng còn sai | chiêu 1 đấm/đá, chiêu 2 Decision Making |
| 3 | Tự đứng một mình | như form 2 nhưng mạnh hơn và cộng dồn theo điểm lớp. **Có hẳn bốn ô dán ảnh riêng**: `stand3` / `punch3` / `kick3` / `think3` (xem mục dưới) |

**Chuyển form 1 → 2**: máu tụt xuống **90%** (`SUZ.guardHp`) thì Ayanokouji hiện ra.
*(Từng là 85%; người dùng nâng lên 90% để anh xuất chiến sớm hơn.)*
Phân cảnh đóng băng 1.6s, anh nói *"Stand up and fight."*, rồi **đỡ đạn thay đúng 5 giây
người chơi** (`SUZ.guardT`). Trong quãng đó `hurt()` trả về **false** cho Horikita ngay từ
đầu hàm nên không chỉ mất máu mà cả choáng / cháy / chảy máu ăn theo cũng không dính.
*(Đồng hồ 5 giây chỉ chạy SAU phân cảnh — `step()` return sớm lúc `G.freeze>0`. Test phải
chờ cả hai, đây không phải lỗi.)*

Hết 5 giây anh **không lặng lẽ biến mất**: `f.ayaG` có ba pha `guard → kick → done`. Sang
pha `kick` anh lao tới trước mặt địch (`guardKickSpd`, để lại vệt bóng mờ) rồi tung **cước
chia tay 150 dmg + choáng 2 giây** (`guardKickDmg` / `guardKickStun`), đóng băng 1.1s, xong
mới poof và Horikita vào form 2. Đòn này **đứng tên Horikita** (`hurt(e,…,f,…)`) để nếu nó
kết liễu thì `finish()` trao chiến thắng cho cô. Lớp khiên chỉ vẽ ở pha `guard`.

**Cơ chế điểm lớp (class points)** — mới, dùng riêng cho nhân vật này:
- Mốc là **150** (`SUZ.cpMax`).
- Form 2: chạm 150 là **chặn ở đó** và gọi Ayanokouji ra làm đồng minh thật.
- Form 3: cứ đủ 150 thì đổi thành **một bậc cộng dồn** rồi tính lại từ 0 (trần 5 bậc).

**Chiêu 1** — áp sát rồi bốc ngẫu nhiên đấm hoặc đá, **hai dáng tách hẳn** (`punch` / `kick`).
**10 dmg + 0 điểm ở form 1**, 15 dmg + 15 điểm ở form 2, 20 dmg + 20 điểm ở form 3. Hồi chiêu
gốc `cm(.25)*2.5`, tức **chậm hơn ChiChi đúng 2.5 lần** và vẫn co giãn theo thanh tốc độ ra
chiêu; form 1 nhân thêm `f1Slow = 1.6` nữa. **Hồi chiêu phải đọc qua `suzTune(f).atkCd`**,
đừng đọc thẳng `SUZ.atkCd`. Mỗi đòn trúng có **25%** hồi **5%** máu hiện tại
(form 1: không có, form 3: 35% / 8%).

> **Form 1 không tích điểm lớp và không có cửa hồi máu** — chỗ này người dùng không nói rõ,
> tôi chốt vậy vì hai thứ đó là phần thưởng của sự tự tin, mà bản mô tả gốc chỉ nêu chúng từ
> form 2. Quan trọng hơn: cho tích điểm ở form 1 thì cô có thể chạm 150 trước khi Ayanokouji
> kịp đỡ đòn, `suzCp()` sẽ gọi `ayaJoin()` lúc cô còn chưa qua form 2 — vỡ cả mạch truyện.
> Muốn đổi thì sửa `SUZ.f1`.

> **Điểm lượn của AI form 1 phải nằm hẳn trong tầm tay** (`orbWant(f)+3` thì tiến, dưới thì
> lùi; tầm tay là `r+r+MELEE_REACH = 76`). Để mốc sát mép tầm thì phần lớn lượt hồi chiêu rơi
> đúng lúc cô vừa lùi ra, nhìn như không thèm đánh. Đo được: gặp địch cận chiến cô ra đủ 7 đòn
> trong 14 giây trong trận (đúng trần lý thuyết 14/1.8); gặp địch đánh xa thì ít hơn hẳn vì bị
> kéo giãn — đó là chuyện thường của cận chiến, ChiChi cũng vậy.
> *(Mốc cũ là hằng số `d > 50` khi tầm tay còn 68; giờ đọc qua `orbWant()` để đi chung với
> quãng cách cận chiến ở mục 2b — ghim số cứng thì cô đánh nhau với cú đẩy tách thân.)*

**Chiêu 2 — Decision Making**. Vòng đời một quyết định: đứng **bất động 1.5 giây**
(`decThink`, qua `f.decT` + `f.lock`) → chốt và phóng đi **siêu nhanh** (`decSpd = 1150`) →
**3.5 giây nữa** (`decCd`) mới nghĩ tiếp. Nên `think()` đặt
`f.cds.s2 = decThink + decCd`, đừng đặt mỗi `decCd`.

Đúng (**65%** ở form 2, **70%** ở form 3) thì câu nói biến thành **bong bóng phóng thẳng
vào mặt địch**, tích **đúng bằng lượng sát thương vừa gây**, kèm cửa hồi máu 25%/3%
(form 3: 35%/8%). Sai (35% / 30%) thì **trừ 5~60 điểm**; điểm thủng xuống âm thì cô **tự
chịu đúng phần âm đó** (không né được, không giảm nhẹ) rồi tích lại từ 0.

**Mỗi quyết định đúng còn được chấm mức độ** theo chính lượng sát thương nó gây ra — bảng
`SUZ_TIERS`, tra bằng `suzTier(f,dmg)`. Tên mức hiện ra bằng **băng-rôn chí mạng** lúc chạm
người (thay cho chữ `DECISION!` cũ), và màu của mức tô luôn viền bong bóng lẫn mũi tên lúc
nó đang bay:

| Mức | Form 2 (`f2.decLo~decHi` = 30~80) | Form 3 (40~120) |
|---|---|---|
| ACCEPTABLE DECISION | 30–40 | 40–70 |
| GOOD DECISION | 41–60 | 71–90 |
| GREAT DECISION | 61–70 | 91–110 |
| BEST DECISION | 71–80 | 111–120 |

> `SUZ_TIERS` **phải khai trước bảng `CHARS`** vì mảng `skills` đọc nó ngay lúc khai `CHARS`.
> Từng để nó dưới thân chiêu và dính TDZ: `new Function` biên dịch vẫn qua, mở game mới thấy
> màn chọn nhân vật trống trơn.

**Bong bóng lúc đứng suy nghĩ luôn là một câu duy nhất** — `SUZ_ASK`
(*"What should I do in this situation?"*), không phải dấu ba chấm. Bong bóng sống
`SUZ_THINK_LIFE = decThink + gs(.9)` chứ không chỉ bằng quãng đứng im, vì đọc hết một câu
hỏi mất lâu hơn 1.5 giây — mà tiếng thì không được sống lâu hơn hình đi kèm.

> **Nhân vật này chỉ có ĐÚNG BA ô giọng**, nhãn có gắn 🎙 trong bảng nạp tiếng:
> | Ô | Nội dung | Kiểu đọc |
> |---|---|---|
> | `suz_think` | một câu duy nhất: `SUZ_ASK` | `SFX_MAXLEN`, cắt đúng lúc bong bóng tắt |
> | `suz_decide` | 15 câu trong `SUZ_DECISIONS` | `SFX_SEG`, mỗi lần đọc tiếp một câu |
> | `suz_wrong` | 6 câu trong `SUZ_WRONG` | `SFX_SEG`, mỗi lần đọc tiếp một câu |
>
> **Sửa file tiếng thì phải sửa luôn ba chỗ trên cho khớp thứ tự.** Mấy ô còn lại
> (`suz_hit` / `suz_heal` / `suz_form2` / `suz_form3`) là tiếng động, không phải giọng,
> nên giữ nguyên.
>
> **Ba ô `suz_punch` / `suz_kick` / `suz_block` đã BỎ HẲN** (người dùng: đấm/đá thì mượn
> tiếng của ChiChi, đỡ đòn thì dùng tiếng chịu đòn thường). `suzStrike()` gọi `sfx('punch')`
> cho cả đấm lẫn đá — ChiChi chỉ có đúng một ô cận chiến — còn `ayaBlock()` gọi `sfx('hit')`.
> Ô đầu của khu Horikita trong `SFX_GROUPS` vì vậy chuyển sang `suz_think`. Đừng dựng lại ba
> ô đó.
>
> **Ayanokouji có BA ô giọng riêng**, đúng ba câu anh nói trong cả trận:
> | Ô | Câu | Trần độ dài |
> |---|---|---|
> | `aya_stand` | `AYA_STAND` — *"Stand up and fight."* (lúc bước ra chắn đòn) | `AYA_STAND_LIFE*RT` |
> | `aya_join` | `AYA_LAST` — câu lúc vào sân sát cánh lần cuối | `AYA_JOIN_LIFE*RT` |
> | `aya_bye` | `AYA_BYE` — *"This is where I take my leave."* (lúc rời sàn) | `AYA_BYE_LIFE*RT` |
>
> **Lần xuất hiện tách làm hai ô.** `aya_appear` = lần đầu (bước ra chắn đòn),
> `aya_appear2` = lần 2 (vào sân sát cánh khi đủ 150 điểm lớp). Ô lần 2 **bỏ trống thì
> mượn hẳn ô `summon`** — đúng tiếng dịch chuyển của viện binh twin shot — qua bảng
> `SFX_ALIAS`: `sfx()` thấy ô chưa nạp file mà có tên trong bảng thì đổi luôn sang ô kia,
> nên mượn cả file người dùng đã nạp cho `summon` lẫn tiếng tự tạo của nó. Vì vậy ô có
> mặt trong `SFX_ALIAS` **không cần** thêm `case` trong `synth()`; nạp file cho chính nó
> thì file đó thắng. Chỗ đọc: `ayaShield()` (lần đầu) đọc `aya_appear`, `ayaJoin()` (lần 2)
> đọc `aya_appear2` — `t_suzune.js` soi thân hai hàm này để không ai lỡ tay gộp lại.

> Ba hằng `AYA_*_LIFE` khai **trước `SFX_MAXLEN`** (cạnh `SUZ_BUBBLE`) và dùng chung cho cả
> `talk()` lẫn trần độ dài tiếng — hai chỗ không được lệch nhau. `aya_strike` / `aya_leave`
> vẫn là tiếng động như cũ.
> *(Bản trước từng chốt "không cho anh ô giọng nào"; người dùng hỏi lại "mấy ô âm thanh
> Ayanokouji xuất hiện và thoại mấy câu đó đâu" nên mở lại đủ ba ô.)*

> **Bảng nạp tiếng chia theo nhóm.** `SFX_GROUPS` gắn tiêu đề vào ô ĐẦU của mỗi khu
> (Chung · Konohamaru · ChiChi · Ozora Tsubasa · Shikamaru · Horikita Suzune · Ayanokouji);
> `buildSfx()` gặp tiêu đề thì mở một lưới `.slots` mới, y như bảng dán ảnh. Trước đó 45 ô
> xếp phẳng một mạch nên mấy ô cuối tìm không ra — đó chính là lý do người dùng tưởng
> ô của Ayanokouji chưa có. **Thứ tự trong `SFX_EVENTS` chỉ ảnh hưởng chỗ hiển thị**, mọi
> thứ khác tra theo tên khoá; mà tên khoá thì giữ nguyên đời đời.

**Ayanokouji làm đồng minh thật** (đủ 150 điểm ở form 2). Anh là fighter duy nhất mang cờ
`ally:true`; `summon:true` để `hurt()` không gọi `finish()` khi anh cạn máu, nhưng
`ally` lại cho anh **ăn được đạn** (vòng va chạm bỏ qua `f.summon&&!f.ally`).
- Máu = **65% máu hiện tại của Horikita** lúc anh bước ra (`SUZ.ayaHp`, cũ 35%).
- **Đột kích** mỗi **3.6 giây người chơi** (`SUZ.ayaCd`, cũ 4.5): 40 dmg + choáng 1.25 giây.
- Buff Horikita **+100% tốc ra chiêu** (`f.castBuff`, nhân vào nhịp trôi hồi chiêu).
- Tự dịch chuyển chắn đạn (`ayaIntercept`) và, khi địch **cận chiến** áp sát, đứng hẳn giữa
  hai người rồi **đẩy Horikita vòng ra sau lưng địch** để cô rảnh tay đánh.
- **Khiêu khích chạy suốt quãng anh còn trên sàn**, không đợi địch áp sát và không phân biệt
  địch cận chiến hay đánh xa: `ayaTick` đặt `e.tauntBy=a` mỗi nhịp, nên **mọi đòn của địch —
  chiêu thường, chiêu lớn, ultimate — đều rơi vào anh** chứ không vào Horikita. Anh rời sàn
  (`leaving>0`) hay cạn máu thì `tauntBy` được xoá và địch nhắm lại vào cô.
  *(Bản cũ chỉ bật taunt 0.6 giây lúc `mode==='tank'`, tức chỉ khi địch cận chiến vào trong
  `ayaGuardR` — người dùng bác: "chưa thu hút đối phương".)*
- **Taunt đi qua `aimTarget(f)`**, không đụng tới `foeOf()`. `foeOf` vẫn là quan hệ phe;
  `aimTarget` chỉ trả lời "đang nhắm vào ai". Mọi chỗ NHẮM (aiVec, think, cú lao, đạn dò,
  viện binh) đọc `aimTarget`, mọi chỗ tính phe vẫn đọc `foeOf`.
  **Ngoại lệ duy nhất là lãnh địa Nara**: nó là một vùng nên trói cả hai người có thanh máu
  và chia đều sát thương, đọc thẳng `domainTargets()` chứ không đọc `aimTarget` (xem mục 3).
- **Viện binh của địch không có khiêu khích riêng** nên `aimTarget` cho chúng đọc luôn
  `master.tauntBy` — nếu không, Goku / Gohan / phân thân cứ gọi ra là lách được anh và bắn
  thẳng vào Horikita. Có chặn `t.team!==f.team` để không bao giờ nhắm nhầm vào phe mình.
- **Miễn nhiễm Sexy no Jutsu** (`sexyImmune:true` lúc `mk`): khói hồng không bám dot, không
  choáng, không trừ một giọt máu nào của anh. Nhánh này nằm **trước** nhánh `f.summon` trong
  `sexy()` để anh có dòng nhật ký riêng thay vì mượn câu của Goku/Gohan.
- Dấu hiệu duy nhất của khiêu khích là **vòng sáng nhấp nháy dưới chân anh** (`drawFighter`,
  nhánh `f.ally&&f.taunt>0`). **Không dán chữ `TAUNT` / `TAUNTED` lên sàn** — người dùng đã bác.

> **Cú cước chia tay không được nện vào lớp miễn thương.** Konohamaru tự miễn thương 0.75 giây
> người chơi mỗi lần tung Sexy no Jutsu; cú cước rơi trúng quãng đó thì `hurt()` trả về false
> ngay từ đầu hàm — mất sạch 150 dmg lẫn 2 giây choáng, nhật ký còn báo nhầm thành "bị né".
> Cách xử: **không phá miễn thương của người ta**, mà giữ anh treo ngay trước mặt địch (bám
> theo địch qua `ayaGuardAim`), hết miễn thương mới tung. Có trần chờ `SUZ.guardKickWait`
> (2 giây người chơi) để chuỗi phân cảnh không bao giờ kẹt lại. Đo được: 14/14 lần cú cước
> ăn đủ 150 dmg, trước đó cứ 10 lần thì hụt 1.

**Ô dán ảnh riêng theo form.** Form 3 có `stand3` / `punch3` / `kick3` / `think3`; hai nhánh của
chiêu 2 tách theo cả form lẫn kết quả: `right2` / `wrong2` (form 2) và `right3` / `wrong3`
(form 3); trạng thái dưới 20% máu tách làm hai: `injured2` (form 1/2) và `injured3` (form 3);
dưới 20% máu mà đang **đứng suy nghĩ** thì có ô riêng nữa: `thinkHurt2` (form 2) và `thinkHurt3`
(form 3). Nhãn trong `SETS` ghi rõ form cho khỏi lẫn — ô cũ cũng đổi nhãn theo:
`idle` = "Thủ thế (form 2)", `punch`/`kick` = "(form 1/2)", `think` = "(form 2)".
`sprite()` đổi ô theo form ngay chỗ đã đổi cho form 1; thiếu ảnh thì lùi về đúng ô cùng nghĩa của
form 2 (ô tơi tả-suy nghĩ lùi về ô đứng nghĩ lành lặn). Riêng `hurt` vẫn dùng chung cho mọi form
(form 1 vẫn mượn `block`).

> **Hai ô "lùi chung" `decide` / `injured` đã BỎ.** Chúng không phải tư thế nào của cô: `decide`
> chỉ là ô lùi của `right*`/`wrong*`, `injured` chỉ là ô lùi của `injured2`/`injured3` — mà bản
> thân hai cặp kia đã lùi được về nhau, nên nạp ảnh vào ô chung chẳng thêm được gì. Người dùng
> hỏi thẳng "ô lùi chung là gì", lúc đó cả hai đang trống, nên đổi chỗ đó thành `thinkHurt2` /
> `thinkHurt3`. `decide` vẫn còn là **tư thế** (`suzDecide` return sớm khi không còn ai để nhắm)
> nhưng không còn ô dán ảnh — nhánh lùi `pk==='decide'` trong `sprite()` giữ nguyên.
>
> Kèm theo đó là một **lỗi thật đã sửa**: `sprite()` bật cờ tơi tả bằng `set.injured` (ô vừa bỏ),
> nên ai chỉ nạp `injured2`/`injured3` thì ảnh tơi tả **không bao giờ hiện**. Giờ cờ đọc
> `injArr` = `injured3||injured2` theo form, mấy nhân vật kia vẫn đọc `injured` như cũ.

Dáng vector đi kèm — tất cả đều **vẽ sau tóc**, vẽ trước thì hai lọn tóc dài che mất:
- `stand3` đứng hẳn thế thủ như võ sĩ, khuỷu ép sát sườn, nắm đấm dẫn đường ngang cằm.
- `punch3` như đấm của form 2 nhưng tay còn lại **không buông xuôi**, thủ ngay quai hàm.
- `kick3` đá **cao hơn** (góc `1.5` thay vì `1.15`), tay sau thủ cằm, tay trước chìa ra giữ đà.
- `think3` một tay ngang bụng chống lấy khuỷu, tay kia đỡ cằm — nghĩ mà vẫn đứng vững, khác hẳn
  kiểu ôm lấy mình của form 1 và kiểu buông thõng của form 2.
- `right*` chốt đúng: tay chìa thẳng đẩy câu trả lời vào mặt địch, dấu `!` vàng trên đầu.
- `wrong*` chốt trật: tay ra được nửa đường thì khựng lại rồi xuôi xuống, **dấu gạch chéo hồng**
  vẽ bằng nét chứ không phải chữ (font headless hay thiếu ký tự ✕).
- Bản form 3 của cả `right`/`wrong` giữ nguyên nắm đấm ở quai hàm; form 2 thì buông tay sau.
- `injured3` nặng hơn `injured2`: ngoài hai vệt xước và băng vai chung, form 3 có thêm vệt trên
  gò má, băng quấn hai cánh tay và gấu váy rách một góc. Góc rách tô bằng tông sẫm hơn váy chứ
  **không mượn màu nền** — nền sàn đổi màu theo phân cảnh.

> **Dáng phải đặt trong từng nhánh của `suzDecide`, không đặt một lần ở đầu hàm** — lúc vào hàm
> còn chưa bốc ra đúng hay sai. Nhánh sai mà điểm lớp thủng xuống âm thì `setPose(f,'hurt')` đè
> lên `'wrong'`, đó là cố ý: cô đang tự ăn sát thương.

Nắm đấm thủ sát quai hàm dùng chung qua hàm `thuCam()`, đoạn chi vẽ qua `tay()` — cả hai khai ở
đầu khối vẽ của Horikita. `t_suzune.js` chấm bằng cách vẽ từng dáng ra canvas phụ rồi **đếm điểm
ảnh lệch** giữa form 2 và form 3 (thủ thế 387 · đấm 197 · đá 476 · nghĩ 427 · đúng 194 · sai 200 ·
tơi tả 441), nên xoá mất một nhánh vẽ là test đổ ngay. Riêng trạng thái tơi tả còn so **lành lặn
với tơi tả trong cùng một form** để chắc là có vẽ thêm dấu vết: form 1/2 được 113 điểm, form 3 được
209 — luật là form 3 phải nặng hơn.

> **Đếm điểm ảnh phải soi cả bốn kênh RGBA.** Chỉ soi kênh alpha thì mấy vết thương vẽ đè lên thân
> người (vốn đã đục sẵn) gần như không đổi gì — đo ra đúng 3 điểm và test báo hỏng oan.

**Chuyển form 2 → 3**: anh về 0 máu thì **KHÔNG chết**. `a.alive` vẫn `true`, không có
`finish()`, không có hiệu ứng gục. Anh nói *"This is where I take my leave."* rồi **đi bộ ra
khỏi mép sàn** và mờ dần (`a.leaving` / `a.fade`). Đi hẳn rồi Horikita mới nói *"From here on
I fight for my own goal — alone."* và vào form 3.

**Form 3**: đòn tay 20 / +20 điểm, quyết định đúng **80%**, **45%** hồi **10% MÁU TỐI ĐA**,
**+12.5% miễn thương** (`f.dmgRes`, ăn trong `hurt()`) và **12% kháng hiệu ứng** (`f.ccRes`,
rút ngắn thời gian choáng trong `stunFx()`). Mỗi 150 điểm lớp tích thêm được thì **+5% tỉ lệ
quyết định đúng, +10% tỉ lệ hồi máu, +6% lượng hồi máu, +12.5% miễn thương, +12.5% kháng hiệu
ứng** — **trần 4 bậc** (`SUZ.st.max`, cũ 5). Đủ bốn bậc: quyết định 98% (trần), hồi máu 85% ×
34% máu tối đa, miễn thương 62.5%, kháng hiệu ứng 62% — vẫn dưới trần `.75` của `suzApply()`.

Form 2 cũng lên: **quyết định đúng 65% → 75%**.

> **Form 3 đo lượng hồi theo MÁU TỐI ĐA, form 2 vẫn theo máu HIỆN TẠI.** Người dùng chốt
> *"lượng máu hồi sau mỗi qđinh đúng là 10% máu tối đa"*, và họ chỉ nêu **một** mức hồi cho
> cả form (45% tỉ lệ / 10% lượng) nên đòn tay lẫn quyết định ở form 3 dùng chung con số đó.
> Ranh giới là cờ **`healMax`** do `suzTune()` trả về, và `suzHeal(f, pct, ofMax)` đọc nó —
> đừng để hai form dùng chung một cách đo. Đo được: form 3 với 800 máu tối đa hồi đúng 80,
> form 2 với 200 máu hiện tại hồi đúng 10.

> **Không dán chữ giải thích form lên sàn.** Người dùng đã bác: bỏ hẳn dòng
> `FORM n · …` dưới thanh máu, bỏ băng-rôn `FORM 2 · RESOLVE` / `FORM 3 · STANDING ALONE`,
> bỏ bảng chỉ số lúc lên bậc, bỏ đồng hồ `AYANOKOUJI GUARDS …s`, bỏ luôn mấy dòng
> `AYANOKOUJI SUPPORT` / `TAUNT` / `TAUNTED`. Đổi form thì chỉ nói bằng **hình và câu
> thoại**: dáng đứng khác, vòng sáng, chớp màn, một tiếng. Thanh phụ chỉ còn
> `Class: n/150`, đúng kiểu Rage / Crit / Goal / Chakra của mấy nhân vật kia.
> Chỗ duy nhất được phép giải thích là **mảng `skills` trong màn chọn nhân vật**.
> Nhật ký cũng kể chuyện chứ không đọc bảng chỉ số.

> **Chỗ đã tự quyết, nói rõ để sau này khỏi cãi nhau:** bản mô tả gốc ghi *"+8% miễn thương,
> +8% miễn thương"* hai lần. Hiểu là **+8% miễn thương và +8% kháng hiệu ứng** — vì form 3
> vốn có sẵn cặp 10%/10%, cộng dồn theo cặp mới cân. Trần 5 bậc để miễn thương không chạy
> tới 100%. Nếu người dùng muốn khác thì sửa `SUZ.st`.

### Captain Ginyu (`ginyu`)
Toàn bộ trong hằng `GN`, khai theo lối của Shikamaru / Horikita (giây người chơi bọc `gs()`).
Nhân vật cận chiến, **mọi chữ hiện ra trong game là tiếng Anh** — người dùng chốt riêng cho
nhân vật này; nhật ký vẫn tiếng Việt như mấy người kia.

**Màn chào sân — đừng bỏ, đây là cả tính cách nhân vật.** Bấm *Bắt đầu* thì anh **chưa có
mặt trên sàn**: `init()` gọi `ginyuEnter(f)` đẩy anh ra ngoài mép sàn (`gnEntry.ph='fly'`),
rồi `ginyuTick()` kéo anh vào đúng chỗ đứng trong **`GN.flyT = gs(1.5)`** — tức **đúng 1.5
giây thật ở thanh tốc độ gốc**, người dùng cần con số này để canh file tiếng, đừng đổi.
Đáp xuống là chạy **ba dáng `dance1/dance2/dance3` liên tục** (`GN.danceT`) và hô
`GN_SHOUT = 'GINYU FORCE!'`. Suốt cả hai pha, `ginyuTick` đặt `lock` cho **mọi đối thủ mỗi
nhịp** — họ đứng nhìn chứ chưa được đánh. Hết ba dáng thì gọi thẳng `ginyuAura(f)`.

> Quãng bay đo bằng giây TRONG TRẬN nên `step()` chỉ chạy khi trận đang chạy — đó chính là
> lý do anh không bay lúc màn hình còn đứng ở "PRESS START". Đổi thanh tốc độ thì 1.5 giây
> thật cũng đổi theo, đúng như mọi hằng số khác trong game.

**Nội tại — Ginyu's Aura.** Aura phủ kín sàn một lần rồi **nghỉ `GN.auraCd = gs(18)`**, bốc 50/50:

| Nhánh | Địch chịu | Ginyu vào thế |
|---|---|---|
| ngơ ngác (`gnDaze`, `GN.dazeT = gs(8)`) | −90% tốc chạy, −50% tốc ra chiêu | **hưng phấn** `gnState='atk'` |
| sôi máu (`gnRage`, `GN.rageT = gs(6)`) | +50% tốc chạy, +30% tốc ra chiêu | **thăm dò** `gnState='def'` — chỉ ở nhịp aura ĐẦU |

> **Cửa vào thế thăm dò chỉ mở ở NHỊP AURA ĐẦU TIÊN của trận** (`f.gnProbeDone`, bật lên
> ngay sau nhịp đầu **dù nhịp đó ra thế nào**). Nhịp đầu địch sôi máu thì anh lùi lại thăm
> dò một lượt; đi qua nhịp đầu là cửa đóng hẳn, mọi nhịp aura sau đều vào thẳng thế chiến
> đấu. Nhịp đầu mà địch ngơ ngác thì anh hưng phấn và **cả trận không còn thấy thế thăm dò
> nữa** — cửa tính theo NHỊP chứ không phải theo "lần đầu địch sôi máu".
>
> *Hai lần sai trước đó, ghi lại cho khỏi lặp:* bản đầu bốc 50/50 mỗi nhịp nên một trận
> thấy thăm dò hai ba lần; bản thứ hai chặn theo "lần đầu địch sôi máu" nên thăm dò vẫn nhảy
> ra ở nhịp thứ ba (đo được ở cặp Ginyu vs Konohamaru, giây 27.8). Người dùng bác cả hai:
> *"vẫn còn tình trạng có trạng thái phòng thủ sau lần đầu tạo hiệu ứng"*.
>
> **Luật ba người trở lên thắng cửa này**: đông người thì anh luôn thăm dò, không bị chặn.

- **Hưng phấn** (`GN.atk`, `gs(8)`): +50% dmg gây ra, **+50% dmg phải chịu — nhân sau mọi
  lớp phòng thủ**, +40% thời gian dính khống chế, +50% tốc ra chiêu, +60% tốc chạy. Bao
  quanh anh là **luồng khí tím** kiểu Dragon Ball (`gnAuraDraw`).
- **Thăm dò** (`GN.def`, `gs(10)`): −60% dmg nhận, +40% kháng hiệu ứng, đổi lại −40% dmg
  gây ra và −40% tốc ra chiêu. Vỏ khí **mỏng và tối hơn hẳn** — vẫn tím, chỉ khác độ dày.

> **Luồng khí — `gnAuraDraw()` và bảng màu `GN_AURA`.** Người dùng gửi ảnh mẫu (Goku bọc
> trong luồng khí Super Saiyan Blue) và chốt: *"chỉnh luồng khí của Ginyu thành như này
> nhưng là màu tím hết"*. Vì vậy:
>
> - **Toàn bộ tông tím, không lẫn một mảng xanh nào** — kể cả **thế thăm dò** (trước đây là
>   vỏ khí xanh `#7FE0FF`) lẫn lúc **hoảng loạn** (trước đây đỏ `#FF6B6B`). Ba thế đứng phân
>   biệt nhau bằng **độ dày và độ sáng**, không bằng màu. Mỗi thế có bốn nấc trong `GN_AURA`:
>   `out` mép ngoài sẫm · `mid` thân khí · `hot` lõi sáng · `core` tia điện.
> - **Cả cụm vẽ bằng phép CỘNG SÁNG** (`globalCompositeOperation='lighter'`). Chồng alpha
>   thường lên nền sàn tối thì ra một khối tím đục như vũng bùn — đo mắt thấy ngay; cộng sáng
>   thì mấy lớp đè nhau tự sáng dồn về lõi, đúng chất luồng khí phát sáng. Nhớ bọc trong
>   `save/restore`, composite là trạng thái của canvas.
> - **Vỏ khí là ba lớp lồng nhau** dựng bằng cùng một hàm nhiễu nhưng **lệch pha**, nên chúng
>   đan vào nhau như lửa thật chứ không nằm đồng tâm như ba cái vòng.
> - **Mép phải là RĂNG CƯA**: đỉnh **lẻ** vọt hẳn ra ngoài, đỉnh **chẵn** thụt sát vào thân
>   (`tip = i%2 ? 1 : .12`). Không có nhịp so le này thì mép chỉ gợn sóng và cả cụm đọc ra
>   một cái bọc tròn, không ra lưỡi lửa — đây là chỗ sửa đi sửa lại hai lần mới ra.
> - Gai **dài hơn hẳn ở nửa trên** (`.35 + up*1.05`) vì lửa thì bốc lên, và có thêm một lượt
>   **lưỡi lửa** mọc từ mép vỏ chếch ra ngoài rồi cong ngược lên.
> - **Tia điện** chớp giật quanh người, vị trí bốc lại theo từng **nhịp** (`Math.floor(G.t*12)`)
>   chứ không trôi mượt — nó đứng yên một chớp rồi nhảy hẳn sang chỗ khác, đúng kiểu điện
>   trong phim. Cùng mẹo với `bodySparks()`.
> - **Lõi phải nhạt** (alpha `.16`): để đậm thì khí nuốt mất thân người, mà `gnAuraDraw()`
>   vẽ TRƯỚC thân nên chỉ có cách hạ alpha chứ không cắt được.
>
> `t_ginyu.js` chấm bằng cách vẽ từng thế ra canvas phụ trên nền đen rồi lấy **màu trung bình**
> của đám điểm ảnh sáng lên: tím thì **lục thấp nhất, lam cao nhất, đỏ nằm giữa**. Đo được
> hưng phấn `R 85 · G 45 · B 128`, thăm dò `36 · 20 · 50`, hoảng loạn `45 · 25 · 59`. Kèm hai
> mục nữa: vỏ khí phải **liếm lên trên đỉnh đầu và toác rộng hơn thân**, và thế thăm dò phải
> **mỏng hơn hưng phấn ít nhất 30%** điểm ảnh.
- **Ba người có thanh máu trở lên trên sàn thì anh LUÔN chọn thế thăm dò**, dù ai dính hiệu
  ứng gì và dù đã dùng hết lần thăm dò — `gnCrowd() >= 3` (đếm bằng đúng cờ `summon && !ally`
  mà `drawBars()` dùng, nên Goku / Gohan / phân thân không tính, còn Ayanokouji thì có).

Thứ tự ưu tiên khi chọn thế đứng, viết thẳng trong `ginyuAura()`: **đông người → thăm dò**,
không thì **còn cửa và địch sôi máu → thăm dò**, còn lại đều là **hưng phấn**. Cửa đóng
(`f.gnProbeDone=true`) ngay sau nhịp aura đầu, đặt trong `ginyuAura()` chứ không đặt trong
`ginyuState()` — đặt trong `ginyuState()` thì nhịp đầu ra hưng phấn sẽ không đóng cửa và
lỗi cũ quay lại.

> **Hồi chiêu của aura KHÔNG cộng dồn với quãng đang vận thế đứng.** `ginyuTick()` `return`
> sớm suốt lúc `f.gnState` còn — đồng hồ `f.gnAura` đứng yên hẳn — rồi nạp lại đủ `auraCd`
> đúng lúc thế đứng hết. Nghĩa là nhịp thật giữa hai lần aura là **hết thế đứng rồi mới đếm
> 18 giây người chơi**, chứ không phải 18 giây tính từ lúc aura nổ.
> *(Người dùng nói "cooldown 18s… aura xong thì 20s sau mới hồi tiếp" — hai con số lệch nhau
> 2 giây. Tôi lấy **18** vì đó là con số nêu thẳng ra làm hằng số; muốn đúng 20 thì sửa
> `GN.auraCd = gs(20)`, cơ chế không phải đụng tới.)*

**Bốn chiêu:**
- **1 · Basic** — đấm hoặc đá, `GN.hitDmg = 22`, hồi chiêu `cm(GN.atkCd)` = `cm(.22)`, tức
  nhanh hơn ChiChi (`cm(.25)`) một nhịp. 25% kèm choáng `gs(.75)`.
  *(Đường đi của con số: 35 → 25 → **22**, người dùng hạ dần. Lần cuối: "nerf Ginyu 1 tí
  dmg đánh tay đi — 1 chút thôi", nên chỉ bớt 3.)*
- **2 · Ginyu's Beam** — mỗi `gs(10)` bắn **6 luồng khí tím**, mỗi luồng **18 dmg**, **15%
  choáng `gs(1.5)`** (`beamStunOdds` — không còn choáng chắc chắn như bản đầu) và **hất lùi 340** (Twin Shot của Tsubasa mới 260 — người dùng muốn đẩy xa hơn).
  Bay `560` và ra dồn dập (`beamGap .11`) — **bắn từa lưa chứ không ngắm**: độ lệch
  `beamSpreadNear + (beamSpread−beamSpreadNear)·d/beamFar` = **lệch sẵn 0.22 rad ngay lúc
  sát mặt** rồi toác tới 0.95 rad khi đứng xa. Đo được: trung bình 0.19 rad ở 60px và
  0.45 rad ở 430px. **Trúng đủ 3 luồng** thì dính *Worn Out*: −60% tốc chạy, −40% tốc ra
  chiêu, −25% dmg trong `gs(7)`. Đếm bằng `t.gnBeamHits`, đặt lại 0 ở đầu mỗi loạt.

> **Dáng ra chiêu phải SỐNG HẾT chiêu rồi mới thôi** — người dùng bác bản cũ: *"dáng lúc
> Ginyu beam hay flash là dáng đó phải tồn tại đến khi Ginyu xong dáng chứ, sao hết nhanh
> vậy?"*. Đo được bản cũ: dáng `beam` tắt ở giây **2.15** (người chơi) trong khi luồng cuối
> mãi giây **2.70** mới bắn ra — anh đứng thẳng người lại trong lúc hai luồng vẫn đang phun.
> Nguyên nhân: `setPose(f,'beam',cm(.6))` cắm cứng một con số **ngắn hơn cả loạt bắn**.
>
> - Giờ độ dài dáng tính thẳng từ nhịp bắn: `cm(.2) + (beamN−1)·cm(beamGap) + cm(beamTail)`.
>   Đổi `beamN` hay `beamGap` thì dáng tự dài theo, không phải nhớ sửa hai chỗ.
> - **Mỗi luồng tự đặt lại dáng** (`setPose(f,'beam', span−at)` trong từng `later`): ăn đòn
>   giữa loạt thì `hurt()` đè sang dáng chịu đòn một nhịp, xong phải trở về dáng bắn chứ
>   không được nằm luôn ở đó.
> - `GN.beamTail` / `GN.flashTail` là **nhịp giữ dáng SAU khi chiêu đã xong**, để anh có chỗ
>   thu tay về chứ không bật về thế đứng ngay trong cùng một khung hình. Đo lại: dáng beam
>   giữ tới giây 3.42 (thừa 0.72s sau luồng cuối), dáng flash tới 2.87 (thừa 0.52s sau khi
>   luồng sáng tắt).
> - `change` và `panic` **không dính lỗi này**: hai dáng đó tự đặt lại mỗi nhịp trong
>   `gnChangeTick()` với `poseT=0`, nên chúng sống đúng bằng trạng thái. Đừng đổi chúng sang
>   kiểu đếm ngược.
>
> `t_ginyu.js` chấm bằng cách chạy tay từng bước (hẹn giờ + `ginyuTick` + đồng hồ dáng) rồi
> so mốc dáng tắt với mốc luồng cuối / lúc luồng sáng tắt — đòi dư ít nhất 0.2 giây.
- **3 · Ginyu's Flash** — hồi chiêu `gs(17)`, đứng trụ gồng `gs(1.75)` (`gnFlash.ph='charge'`, `f.lock`), rồi
  nối **một luồng sáng tím LIỀN MẠCH** từ anh sang địch: to như Kamehameha nhưng vẽ theo lối
  dải bóng của Shikamaru (`drawGinyuFlash()`, gọi **sau** khi vẽ nhân vật, cạnh
  `drawBindShadow()`). 100 dmg, choáng `gs(3.5)`, **hết choáng mới tới** quãng −80% tốc chạy
  / −25% tốc ra chiêu trong `gs(5)` — xếp hàng qua `e.gnSlowAfter`, `gnStatus()` mở nó ra
  đúng lúc `stun<=0`.
- **4 · CHANGE!!!** — xem mục riêng bên dưới.

#### CHANGE!!! — hoán đổi thân xác

`hurt()` chặn ngay trước `finish()`: `gnCanChange(t)` đúng thì gọi `ginyuChange(t)` thay vì
cho chết. Chỉ **một lần**, và chỉ khi hồn anh **còn nằm trong thân xác của chính mình** —
thân xác Ginyu do địch điều khiển (`swapAs==='foe'`) thì chết là chết thật.

- Anh **đứng nguyên chỗ ngã xuống**, không dịch đi đâu: `gnChangeTick()` ghim lại `x/y` mỗi
  nhịp và xoá sạch vận tốc. Suốt lúc này `hurt()` trả `false` (`if(t.gnChange)`) nên không
  ai cắt ngang được.
- Tia sáng **phóng ra từ MIỆNG** (`f.y+20-f.spriteH*.86`), không phải từ tay. Dáng `change`
  vẽ miệng há to đúng chỗ đó.
- **Tỉ lệ trúng theo khoảng cách**, tách hẳn ra hàm `gnChangeOdds(d)` cho test đo được:
  gần nhất `GN.changeHi = .85` (**không bao giờ 100%**), xa nhất `GN.changeLo = .18` (nằm
  trong khoảng 15~20% người dùng yêu cầu), nội suy tuyến tính giữa `changeNear`/`changeFar`.
  Bốc trúng thì tia bám theo địch (`homing`), bốc trượt thì lệch hẳn `0.4~1.0 rad`.
- **Ba người trở lên**: `gnChangeTarget()` chọn người **máu cao nhất**; nhưng va chạm đọc
  trong vòng duyệt đạn nên **chạm ai trước thì nhập luôn vào người đó**.
> **Ba lớp chặn của nhánh va chạm tia CHANGE** — viết riêng vì tia này **không đi qua
> `hurt()`**, nên mọi lớp chặn có sẵn trong `hurt()` đều không tự động áp vào:
> 1. **`offField(f)`** — đang chui Emergency Door, còn nấp trong màn ra mắt (Anywhere Door
>    hay bóng người trên cao của Superman), đang trong phân cảnh Time Machine, hay đang mang
>    lớp miễn thương thì tia **xuyên qua chỗ trống**. Thiếu lớp này thì cướp được xác một
>    người đang không hề đứng trên sàn.
> 2. **`drTryEscape(f)`** — cửa thần kỳ của Doraemon né được **mọi đòn**, kể cả cú cướp xác.
>    Người dùng chốt riêng chỗ này.
> 3. **`p.skip`** — tia phải NHỚ là nó đã hụt ai rồi. Thiếu chỗ này thì có cảnh dở khóc dở
>    cười: anh chui cửa né được, mà `drSafeSpot()` lại đáp đúng vào đường bay, tia đi thẳng
>    tới đó **tóm lại lần hai** — lúc đó cửa đang hồi chiêu nên né kiểu gì cũng dính. Đo được
>    đúng cảnh đó: sửa xong lớp 2 mà vẫn **200/200 lần bị nhập**, phải có thêm lớp 3 mới ra
>    64.5%. Né được thì tia mất luôn khả năng dò tìm và bay tiếp qua chỗ anh vừa đứng.
>
> `t_dora.js` (trận 4, dora vs ginyu) chấm cả ba lớp: tỉ lệ né bám mốc 60%, cửa đang hồi
> chiêu thì 0/30 né được, đang ở TRONG cửa thì 30/30 thoát.

- **Chỉ nhập được vào đấu thủ chính.** Tia CHANGE **xuyên thẳng qua** đồng minh và viện
  binh (`f.summon`) chứ không bám vào họ: Ayanokouji hay Goku vốn là khách trên sàn, hết
  giờ là đi — cướp xác họ thì chẳng còn gì để cướp. Chỗ chặn nằm ở cả `gnChangeTarget()`
  lẫn nhánh va chạm lẫn `ginyuPossess()`.

**Trúng — `ginyuPossess(g,t)`.** Nguyên tắc: **hồn đổi chỗ, THÂN XÁC đứng yên.** Không đụng
tới `key`, `spriteH`, `color`, vị trí — chỉ đổi **`name`** và cờ điều khiển. Nhờ vậy ra đúng
cái người dùng muốn: **thân xác A mà chữ B trên thanh máu**, và ngược lại.

> **Luật chia bộ chiêu — đối xứng, nhớ đúng một câu: CHIÊU theo HỒN, ĐÒN TAY theo THÂN
> XÁC.** Ai vào thân xác nào cũng mang theo bộ chiêu của chính mình, còn cú đấm thì đổi
> cho nhau. Người dùng chốt: *"đối thủ Ginyu khi bị change vẫn có thể dùng skill bản thân
> — nhưng cả Ginyu và cả đối phương đều bị giảm 75% dmg + 75% hiệu ứng, và cả 2 trao đổi
> basic attack với nhau là đc — basic atk cũng giảm 75% dmg vs cả 2"*.
> *(Bản trước đối thủ kẹt trong thân xác Ginyu mất sạch bộ chiêu, chỉ còn đấm đá.)*

| | thân xác | `name` hiện ra | `swapAs` | `gnSoul` | còn dùng được gì |
|---|---|---|---|---|---|
| object cũ của Ginyu | Ginyu | tên đối thủ | `'foe'` | key của đối thủ | **bộ chiêu của chính đối thủ** (`gnSoulThink`) + **đấm đá của Ginyu** |
| object cũ của đối thủ | của họ | `Captain Ginyu` | `'ginyu'` | `'ginyu'` | **beam + flash của Ginyu** + **đòn tay mượn** của thân xác đó (`gnBorrowBasic`) |

**Một mức cắt duy nhất cho cả hai bên và cho mọi thứ họ tung ra**: `GN.swapCut = .25` sát
thương, `GN.swapCcCut = .25` thời lượng hiệu ứng — đòn tay tính luôn vào đó. Hai con số này
đi vào ba chỗ, đừng để chúng chồng lên nhau:

| Đường đi | Ăn ở đâu |
|---|---|
| chiêu do CHÍNH Ginyu viết (beam / flash / đấm đá, gọi `hurt(...,raw=true)`) | `f.gnSelfCut` qua `gnDmg(f)` |
| mọi chiêu còn lại — chiêu riêng của hồn và đòn tay mượn | `f.dmgOut` trong `hurt()`, `gnStatus()` đặt `out*(f.swapAs?GN.swapCut:1)` |
| thời lượng khống chế / debuff | `gnCc(src,dur)` bọc ngay tại chỗ gây hiệu ứng |

> **HỒI MÁU trong thân xác mượn đi đường RIÊNG — `GN.swapHeal = .30` và hàm `gnHeal(f,borrow)`.**
> Người dùng chốt riêng, đừng gộp vào `swapCut`: *"suzu ra quyết định trên thân xác ginyu là
> được hồi máu — điều này là sai"*, *"ginyu đánh thường trên thân xác suzu được hồi máu, điều
> này là ok nhưng hiệu ứng hồi máu cũng giảm đi 70%"*, *"còn dùng skill của ginyu thì k được
> hồi máu"*. Quy ra đúng một câu: **chỉ ĐÒN TAY MƯỢN mới còn hồi, và chỉ còn 30%.**
>
> | Ai | Đường | Hồi bao nhiêu |
> |---|---|---|
> | hồn Horikita trong xác Ginyu | Decision Making (chiêu riêng của HỒN) | **0** |
> | hồn Horikita trong xác Ginyu | đấm đá của Ginyu | vốn không hồi |
> | hồn Ginyu trong xác Horikita | đòn tay MƯỢN (`suzStrike`) | **30%** (`GN.swapHeal`) |
> | hồn Ginyu trong xác Horikita | beam / flash của chính anh | **0** — chiêu đó vốn không hồi |
>
> - `gnHeal(f,borrow)` trả về hệ số: không hoán đổi thì **1**, hoán đổi thì `borrow?.30:0`.
>   Viết bằng `function` chứ đừng `const` — chỗ gọi (`suzHeal` của Horikita) nằm **phía trên**
>   khối Ginyu, `const` ở dưới là dính TDZ.
> - `suzHeal(f,pct,ofMax,mul)` nhận thêm hệ số ở tham số thứ tư, bỏ trống là 1. Hai chỗ gọi:
>   `suzStrike` truyền `gnHeal(f,true)`, `suzDecisionHit` truyền `gnHeal(f,false)`.
> - **Thêm nhân vật có cửa hồi máu thì nhớ bọc `gnHeal()`** — không thì họ vào thân xác lạ là
>   hồi đủ như thường.
> - **Sát thương của quyết định thì VỐN ĐÃ bị cắt**, không phải sửa gì: `suzDecisionHit` gọi
>   `hurt()` không kèm `raw` nên ăn `src.dmgOut` = `GN.swapCut`. Đo được **80 raw ⇒ 20**. Chỗ
>   làm người ta tưởng chưa cắt là **dòng nhật ký**: nó in `p.dmg` thô. Giờ in lượng máu THẬT
>   SỰ mất (`hp trước − hp sau`) và nói thẳng là đang ở thân xác lạ.
>   - **Đo mức cắt thì phải dọn thế đứng của aura trước** (`gnState=null` rồi `statusTick`):
>     thế hưng phấn cho Ginyu ăn thêm 50% sát thương nên mốc chuẩn đo ra 120 thay vì 80 và
>     tỉ lệ ra 17% — đã dính đúng một lần khi viết test.
> - Đo được (`t_ginyu.js`, trận 3b): Horikita bình thường hồi **+20** mỗi đòn tay và **+12**
>   mỗi quyết định; sau CHANGE thì quyết định **+0**, đòn tay mượn **+6** (đúng 30%), sát
>   thương **80 → 20** và **15 → 3.75** (đúng 25%).

> **Sát thương duy trì (`dots`) chỉ bị cắt DMG, không bị cắt thời lượng.** Cháy và chảy máu
> vốn đã đi qua `dmgOut` rồi; cắt cả thời lượng nữa là nhân hai lần, còn 6.25%. `gnCc()` chỉ
> bọc mấy thứ *khống chế và debuff*: choáng, kiệt sức, Disoriented, Shrunk, Chilled, Worn
> Out, làm chậm của vùng chấn động. Toàn bộ khống chế của Superman đi qua đúng một cửa
> `supCC()` nên chỉ cần bọc ở đó.

- Máu: **cả hai thân xác cùng về 20% máu tối đa của chính nó** (`GN.changeHp`) — ngang
  nhau, bất kể trước đó ai đang bao nhiêu máu. **Phải `Math.floor`, không được `Math.round`**:
  mốc bật cờ tơi tả trong `step()` là `f.hp <= f.maxHp*.20`, mà làm tròn LÊN thì với máu
  tối đa lẻ con số rơi cao hơn mốc đúng một chút và **model tơi tả không hiện** — ví dụ 999
  máu, `round` ra 200 > 199.8 còn `floor` ra 199 thì đúng dưới mốc. Ô máu người chơi chỉnh
  được từ 100 tới 9999 nên số lẻ là chuyện thường; `t_ginyu.js` thử cả 1000 lẫn 999.
  *(Bản đầu để lệch: 15% cho thân xác Ginyu, còn thân xác cướp được thì CỘNG THÊM 20% vào
  lượng máu đang có — nên cướp đúng lúc địch còn nhiều máu là ăn đứt. Người dùng bác: "cân
  bằng Ginyu là khi change thì cả 2 thân xác có lượng máu ngang nhau (20%) chứ đừng lệch
  máu". Hai hằng `changeKeep` / `changeGain` gộp thành một `changeHp`.)*
- **Đòn tay mượn** gọi thẳng chiêu 1 gốc của thân xác đó (`gnBorrowBasic`). Thân xác **hệ
  ném / sút** (`GN_PROJ_BODY` = kono / tsubasa / shika) thì đạn vẹo đi `GN.aimOff` = **±0.45
  rad** ngay khi rời tay và **mất luôn khả năng dò tìm** (`p.noHome`). Thân xác cận chiến thì
  `GN.swapMiss` = **20%** số đòn hụt, `hurt()` in chữ `MISS`.
  > **Đừng để thành "đánh mãi không trúng".** Bản đầu là **55% hụt + lệch 1.05 rad**; cộng
  > với mức cắt 25% sát thương thì cú đấm chỉ còn ~11% sức, Ginyu đứng vung tay cả trận mà
  > chẳng ăn thua gì — người dùng bác: *"fix lỗi sao mà Ginyu vào thân xác người ta đánh
  > toàn miss vậy"*. Hạ xuống **20% / 0.45 rad**; muốn chỉnh nữa thì sửa đúng hai hằng
  > `GN.swapMiss` / `GN.aimOff`, đừng ghim số vào `ginyuPossess()`. *(Hai con số cụ thể là
  > chỗ tôi tự chốt — người dùng chỉ nói là quá nhiều, không nêu mức mới.)* `GN_PROJ_BODY` giờ **chỉ còn
  quyết định KIỂU ngắm hỏng**, không còn miễn trừ phần cắt sát thương nữa — mức cắt là một
  con số chung. Hai lớp ngắm hỏng này **chỉ áp cho Ginyu**: hồn đối thủ dùng chiêu của chính
  mình nên `g.missOdds = g.aimOff = 0`.
- **Bộ chiêu của hồn đối thủ — `gnSoulThink()` / `gnSoulTick()` / `gnSoulEquip()`.** Ba ranh
  giới, đừng nới ra:
  1. **chỉ chiêu bấm tay** (chiêu 2 / 3 / cú lao), không nội tại, không ultimate theo ngưỡng
     máu — mấy thứ đó bám vào thân xác chứ không bám vào hồn;
  2. **chiêu ăn theo thanh tiến trình cũng bỏ** (Rasengan cần 20 nộ khí, Twin Shot cần 5 bàn
     thắng): thanh phụ lúc này đọc bảng của Ginyu nên người chơi không thấy nó đầy tới đâu,
     mà máy tích thanh đó thì đã tắt;
  3. **đòn tay vẫn là đấm đá của Ginyu**.
  - `gnSoulEquip(g,t)` chép phần **tiến trình** của hồn sang thân xác mới (`GN_SOUL_CARRY`:
    form và điểm lớp của Horikita, chakra của Shikamaru, bàn thắng của Tsubasa…) rồi nạp
    một lượt hồi chiêu qua `gnSoulCds(key)`. **Đừng gọi `CHARS[key].init()`** — nó dựng lại
    từ đầu, xoá sạch tiến trình, và Doraemon / Superman còn bị đẩy ra ngoài sàn thêm một
    màn ra mắt nữa.
  - `gnSoulTick(f,dt)` chạy trong `step()` ngay sau `ginyuTick`, và **chỉ nhặt đúng phần chạy
    chiêu**: `bindTick` (dải bóng), `drAimTick` + đồng hồ vùng nón (bảo bối), `supHvTick` /
    `supFbTick` / `supMsTick` + đồng hồ vùng nón (ba chiêu Superman). **Không** nhặt chakra,
    chong chóng, cửa thần kỳ, Kryptonian Flight hay Last Son's Resolve — nội tại vẫn tắt.
  - Ba chỗ cắt ngang phải đọc **TRẠNG THÁI chứ không đọc `f.key`**, nếu không chiêu của hồn
    thành bất khả xâm phạm: `stunFx()` gọi `shikaInterrupt` khi `f.bind || dash.kind==='stab'`,
    `drOnHurt()` gác ở `t.drAim`, `supOnHurt()` gác ở `t.supHv || t.supFb`. Mấy hàm
    `drInterrupt` / `supInterrupt` thì vốn đã đọc trạng thái sẵn.
  - Mọi chỗ vẽ ăn theo (dải bóng, vùng nón, hai tia mắt, độ cao `supAir`) đều duyệt
    `G.fighters` theo **trạng thái**, nên thân xác Ginyu tự động vẽ đúng — không phải sửa gì.
- Nội tại của thân xác bị cướp **tắt hết**: vòng duyệt nội tại theo ngưỡng máu `continue`
  khi `f.swapAs`, `shikaPassive`/`suzPassive`/`eagleTick` cũng thế, và `suzCp()` trả về ngay.
  Thanh phụ đọc `CHARS['ginyu'].gauge` chứ không đọc thanh của thân xác.
  - **Mấy nội tại ĐÃ BẬT SẴN trước lúc bị cướp phải xoá CỜ, không chỉ ngừng tick.** Mấy tick
    nuôi chúng gác ở `!swapAs` nên chỉ ngừng chạy, còn `hurt()` / `tryEvade()` thì đọc thẳng
    cờ — để nguyên là thân xác cướp được vẫn miễn 70% sát thương kiểu Wings of the Eagle hay
    vẫn lách đòn kiểu Shikamaru. `ginyuPossess()` vì vậy đặt `t.eagle=false`,
    `t.prewing=false`, `t.evade=0`, và `drTryEscape()` gác thêm `t.swapAs` để cửa thần kỳ
    của thân xác Doraemon cũng tắt theo.

**Trượt — `ginyuChangeMiss(f)`.** Máu về **1**, `gnPanic=true`, chạy nhanh **2.5~3 lần**
(`GN.panicMove`, bốc một lần rồi giữ trong `f.gnPanicMul`), dáng riêng `panic` (mắt trắng
dã, hai tay giơ lên), và **mọi thứ anh tung ra chỉ còn 30%** — dmg qua `gnOut`, hiệu ứng
qua `gnCcCut`. Aura tắt hẳn từ lúc này.

**Ăn mừng trong thân xác người khác.** `drawFighter()` cuối khối vẽ thân người: `G.over` và
`f.swapAs==='ginyu'` thì vẽ đè hình Ginyu với `ctx.filter='blur(2.2px)'` và alpha nhấp nháy
theo `sin(G.t*2.1)` — nhoè hiện ra rồi nhoè tan, lặp mãi. `ctx.filter` đắt nhưng chỉ chạy
lúc trận đã xong nên không đụng tới nhịp khung hình. Chữ dưới thanh máu và băng-rôn WINNER
vốn đã đọc `f.name` nên tự ra `CAPTAIN GINYU`.

#### Bộ hệ số dùng chung — đừng nhân hai lần

Aura của Ginyu bám vào **mọi nhân vật**, nên `gnStatus(f,dt)` chạy cho **từng người mỗi
nhịp** và **dựng lại từ đầu** (đừng cộng trừ dần — hiệu ứng chồng nhau là lệch ngay):

| Trường | Ăn ở đâu |
|---|---|
| `f.moveMul` | tốc chạy trong `step()` |
| `f.castMul` | nhịp trôi hồi chiêu trong `step()` |
| `f.dmgTake` | `hurt()`, **sau** `dmgRes` — nên +50% của thế hưng phấn xuyên qua phòng thủ |
| `f.ccTake` / `f.gnCcRes` | `stunFx()` |
| `f.gnOut` | hệ số chung của trạng thái · mệt mỏi · hoảng loạn |
| `f.dmgOut` | `gnOut` × phần cắt của **chiêu mượn**, `hurt()` nhân vào khi `raw` không bật |

> **`hurt()` có thêm tham số thứ bảy `raw`.** Mấy chiêu do chính Ginyu viết ra đã tự nhân
> `gnDmg(f)` rồi nên truyền `raw=true` để `hurt()` **không** nhân `src.dmgOut` lần nữa;
> chiêu mượn của thân xác khác là hàm có sẵn, không với tay vào trong được, nên vẫn đi
> đường `dmgOut`. Thêm chiêu mới cho Ginyu thì nhớ cặp `gnDmg()` + `raw=true`, đừng quên
> một trong hai.

> **Model tơi tả phải NHÌN RA ĐƯỢC ở cỡ trong trận.** Người dùng bác: *"lúc Ginyu cả 2 về
> trạng thái 20% máu, thì tất nhiên phải là model tơi tả cho cả 2 chứ, sao tôi k thấy tơi
> tả"*. Soi ra thì **cờ `injured` vẫn bật đúng** cho cả hai thân xác — `ginyuPossess()` đưa
> cả hai về đúng 20% máu tối đa, chạm đúng mốc `f.hp<=f.maxHp*.20` trong `step()` — và dấu
> vết **vẫn được vẽ**. Hỏng ở chỗ nó quá mờ: bản cũ chỉ có **hai vệt xước con con cộng một
> mảnh rách, đo ra 113 điểm ảnh**, đứng ở cỡ trong trận thì chẳng thấy gì.
>
> *(Lúc viết test cho chỗ này thì lòi thêm một lỗi thật nữa: `ginyuPossess()` dùng
> `Math.round` nên với máu tối đa lẻ, máu sau khi hoán đổi rơi cao hơn mốc 20% đúng một
> chút và cờ tơi tả KHÔNG bật. Đã đổi sang `Math.floor` — xem mục CHANGE!!! ở trên.)*
>
> Cách sửa là đánh vào mấy mảng **lớn và dễ nhận** chứ đừng thêm nét mảnh: **giáp ngực sứt
> một góc lộ đồ bên trong**, **scouter nứt và mất một mảnh kính** (đó là mảng xanh lá sáng
> nhất trên người anh, vỡ là thấy ngay), **đệm vai gãy**, **dải cam dưới giáp rách**, cộng
> bầm tím trên đùi và má. Đo lại: **464 điểm ảnh**. `t_ginyu.js` đòi tối thiểu **300**.
>
> *Mấy nhân vật kia vẫn ở mức cũ và cũng mờ tương tự* — đo được: kono 190 · chichi 113 ·
> tsubasa 113 · shika 89 · dora 100 · superman 114. Chưa đụng vào vì người dùng mới chỉ nêu
> Ginyu; muốn làm đậm cả bảng thì nhớ **Horikita là ngoại lệ** — `t_suzune.js` ghim cứng số
> điểm ảnh của cô (form 1/2 được 113, form 3 được 209), sửa art của cô là test đổ.

**Ô dán ảnh riêng**: `fly` · `dance1/2/3` · `beam` · `flash` · `change` · `panic`, cộng
`idle/punch/kick/hurt/injured`. Thiếu ảnh thì lùi về ô gần nghĩa nhất (`flash` → `beam` →
`atk1` → `idle`). Dáng vector vẽ da tím, hai sừng, giáp trắng lực lượng Frieza, scouter
xanh — tay chân là **đoạn chi xoay quanh gốc vai/hông** (`chi()`, góc 0 là chỉ thẳng
xuống), nên đổi dáng chỉ việc đổi mấy con số góc ở đầu nhánh.

**Ô dán tiếng**: nhóm riêng `Captain Ginyu` trong `SFX_GROUPS`, mười ô —
`ginyu_fly`, 🎙`ginyu_force`, `ginyu_aura`, `ginyu_excited`, `ginyu_probe`, `ginyu_beam`,
`ginyu_flash`, 🎙`ginyu_change`, `ginyu_swap`, `ginyu_miss`. Hai ô giọng bị cắt đúng bằng
bong bóng thoại (`GN_FORCE_LIFE` / `GN_CHANGE_LIFE` trong `SFX_MAXLEN`). **Đấm đá thì mượn
thẳng `sfx('punch')` của ChiChi**, đúng lối đã chốt cho Horikita — đừng dựng ô mới.

Nút thử tay: `#testGinyuAura` (ép aura toả ngay) và `#testGinyuChange` (ép tung CHANGE).
Kiểm bằng `node tools/t_ginyu.js`.



### Doraemon (`dora`)
Toàn bộ trong hằng `DORA`, khai theo lối của Shikamaru / Horikita / Ginyu (giây người chơi
bọc `gs()`). Fighter kiểu **Control – Utility – Survival**: đòn tay nhẹ, nhưng cái túi thần
kỳ đủ để làm chậm, giữ khoảng cách, chạy thoát và lật ngược thế trận.

> **Mọi chữ hiện ra trong game của nhân vật này là tiếng Anh** — tên nhân vật, tên chiêu,
> tên trạng thái, buff, debuff, băng-rôn, dòng dưới thanh máu. Nhật ký vẫn tiếng Việt như
> mấy nhân vật kia. `t_dora.js` quét cả mảng `skills` để chắc không lẫn một chữ có dấu nào,
> và soi đủ mười ba cái tên người dùng liệt kê.

> **Model phải giữ đúng hình dáng nguyên tác**: thân tròn xanh, bụng trắng, **bàn tay tròn
> không có ngón**, mũi đỏ, chuông vàng, và cái túi thần kỳ trước bụng. Hàm `paw()` trong
> `doraVector()` vẽ bàn tay là một hình tròn — **đừng bao giờ đổi thành nắm đấm có ngón**.
> Bảo bối là **đồ vật cầm trên tay** (ống Air Cannon, đèn Small Light, chong chóng), không
> phải chiêu năng lượng kiểu Dragon Ball.

**Màn ra mắt — Anywhere Door.** Bấm *Bắt đầu* thì anh **chưa có mặt trên sàn** (`f.drHide`,
`drawFighter()` và `drawBars()` đều return sớm). Bốn pha, mốc nằm trong `DORA.doorPh`, tổng
đúng **1.5 giây người chơi** để ghép tiếng:

| Quãng | Có gì |
|---|---|
| 0 → 0.35s | cửa hồng hiện ra cùng ánh sáng nhẹ (`doorA` dâng lên) |
| 0.35 → 0.75s | cửa mở ra (`doorOpen` dâng lên) |
| 0.75 → 1.2s | Doraemon bước ra, nhìn quanh rồi giơ một tay lên |
| 1.2 → 1.5s | cửa đóng lại và biến mất |

Suốt cả 1.5 giây, `drEntryTick()` đặt `lock` cho mọi đối thủ mỗi nhịp — họ đứng chờ, không
di chuyển cũng không đánh. Trận chỉ thật sự bắt đầu khi cửa biến mất hẳn.

**Nội tại 1 — Take-copter.** Địch xa hơn **40% chiều dài sàn** (`copFar`) VÀ suốt `copIdle`
(**2 giây người chơi**) không đánh trúng ai (`f.drNoHit`, `counters()` đặt lại về 0 mỗi lần
anh gây được sát thương) thì chong chóng lên đầu: **+150% tốc chạy** (`copMove = 2.50`), hiệu
ứng làm chậm **chỉ còn 60% hiệu lực**, **+20% né đạn** (`dodgeVec` nhân thêm), tối đa **4
giây**, **hết sớm ngay khi vào đủ tầm vung tay**. Hồi chiêu 15 giây. Bay là là
(`DORA.copHover`), không bao giờ rời sàn.

> **Hai cửa vào đã nới** *(người dùng: "chong chóng tre dùng để tăng 150% tốc độ di chuyển
> và điều kiện dùng chong chóng tre bớt khắt nghiệt lại")*, rồi **siết lại một nấc** ngay sau
> đó *("quãng không đánh trúng ai lên lại 2s, khoảng cách sàn lên 40% sàn")*:
> `copFar` **55% → 35% → 40%** chiều dài sàn, `copIdle` **2.5 → 1.2 → 2 giây người chơi**,
> tốc chạy **+70% → +150%**. Hai cửa gốc chặn nhau nên cả trận anh hiếm khi bay nổi một lượt.
> **Hồi chiêu vẫn 15 giây** — người dùng chỉ nêu "điều kiện", mà hồi chiêu là chuyện khác;
> muốn xả dày hơn nữa thì sửa `DORA.copCd`.
- **Bay tới đâu nã một phát Air Cannon tới đó** — bay được `copAcAt` (0.6 giây người chơi)
  thì rút ống ra bắn, **ĐÚNG MỘT phát mỗi lượt bay** (cờ `f.copAcDone`, đặt lại trong
  `drCopterOn()`). Vừa bay vừa ôm cái ống thì phải trả giá: **chỉ còn 70% sát thương**
  (`copAcDmg` — ra 59 trên mốc 85) và **trừ thẳng 20 điểm độ chính xác** (`copAcAcc`: gần
  90%→70%, xa 50%→30%).
- Phát này **không xét và không đặt lại `f.cds.s2`**: nó là phát bắn kèm của quãng bay, còn
  cú bắn dưới đất vẫn đi theo hồi chiêu riêng. *(Tôi chốt vậy vì Take-copter đã bị chặn rất
  chặt sẵn — hồi 15 giây, lại còn đòi địch ở xa VÀ 2.5 giây không đánh trúng ai — nên phát
  kèm này không thành nguồn sát thương đều đặn. Muốn nó ăn vào hồi chiêu chung thì thêm
  `f.cds.s2=DORA.acCd` vào nhánh đó.)*
- Hai chỗ vẽ phải đi cùng nhau: `drCopterTick()` **chỉ đè dáng `copter` khi không ngắm**, còn
  `doraVector()` vẽ chong chóng theo **`f.copter`** chứ không theo dáng — thiếu một trong hai
  thì lúc ngắm giữa trời anh treo lơ lửng mà mất chong chóng.
- **Dải bóng của Shikamaru không bám được vào người đang bay**: `bindTick()` có nhánh riêng
  cắt dải bóng khi `e.copter>0`. Đây là "chướng ngại vật thấp" mà người dùng nêu.

**Nội tại 2 — Emergency Door.** Sắp ăn **một đòn bất kỳ** thì anh chui qua cửa thay vì chịu
trận — `drTryEscape()` gọi từ `hurt()` **trước cả nhánh né**, nên đòn đó coi như không trúng
và **không gây một điểm sát thương nào**. Tỉ lệ chia làm hai mức:

| Loại đòn | Tỉ lệ né | Ghi chú |
|---|---|---|
| đòn thường và chiêu lớn | **60%** (`edOdds`) | đo được 58.8% / 59.7% |
| **ultimate** | **30%** (`edOddsUlt`) | Twin Shot · Kamehameha · Masenko · Rasengan · tia CHANGE |
| sát thương duy trì (`dot`) và lãnh địa (`domain`) | **0%** | không né được lần nào |

> **Cách nhận ra ultimate: tham số `kind` mang giá trị `'ult'`.** Đúng bốn chỗ đi qua `hurt()`
> được đánh dấu — Rasengan trong `step()`, Twin Shot trong `ballHit()`, Kamehameha và Masenko
> trong vòng duyệt đạn — cộng tia CHANGE gọi `drTryEscape(f,'ult')` thẳng ở nhánh va chạm.
> **Phân thân của Konohamaru vẫn chỉ là `'big'`**, không phải ultimate.
>
> `'ult'` với `tryEvade()` của Shikamaru thì **ăn y hệt `'big'`**: né được nhưng KHÔNG cộng dồn
> tỉ lệ. Thêm loại mới mà quên chỗ đó là mấy cú ultimate bỗng nhiên đẩy tỉ lệ né của anh lên.
>
> **`dot` và `domain` không né được** — đó là phần dư của một đòn đã trúng rồi, không phải một
> cú đánh đang bay tới, cùng luật với `tryEvade()`. *(Chỗ này tôi tự chốt: bản trước cho né cả
> `dot`, nên mỗi nhịp cháy 2 dmg cũng nuốt mất một lần mở cửa — đo ra 63.5% số nhịp cháy làm
> anh chui cửa. Muốn cho né lại thì bỏ dòng chặn đầu `drTryEscape()`.)*
- Suốt `edT` anh **không thể bị tấn công** (`hurt()` return false khi `t.edT>0`) và không
  hiện trên sàn.
- Ra khỏi cửa: **xoá hiệu ứng làm chậm** (`dis`, `gnSlow`, `gnDaze`, `gnTired`, `exhaust`),
  **giữ nguyên choáng, cháy, độc và mọi debuff khác** — **kể cả Shrunk**, vì đó là một lần
  biến hình chứ không phải một lớp làm chậm. Rồi **+40% tốc chạy trong 2 giây**.
- Chỗ đáp: `drSafeSpot()` bốc 24 điểm trên vòng tròn bán kính **30% chiều dài sàn**, loại
  hết điểm nằm trong model người khác, chấm theo `khoảng cách tới địch gần nhất − 140 × số
  địch đứng trong 190px`. Nhờ phần trừ đó, **có ba người trở lên thì anh thoát khỏi chỗ đông
  địch nhất và không bao giờ nhảy sang chỗ còn đông hơn**. Điểm luôn clamp vào trong sàn.
- Hồi chiêu **6 giây** (`DORA.edCd`). *(Trước là 8; người dùng bảo "giảm thời gian cooldown
  cửa thần kì của Doraemon".)*
- **Né được cả tia CHANGE cướp xác của Ginyu.** Người dùng chốt: *"Doraemon cần phải né
  được"*. Chỗ này phải viết riêng vì **tia CHANGE không đi qua `hurt()`** — nó gọi thẳng
  `ginyuPossess()` từ vòng va chạm, mà `drTryEscape()` thì nằm trong `hurt()`. Đo bản cũ:
  **200/200 lần bị nhập, không né nổi lần nào.** Giờ nhánh `change` gọi thẳng
  `drTryEscape()`; đo lại **64.5% né được**, bám đúng mốc `edOdds = 60%`. Xem ba lớp chặn
  ở mục CHANGE!!! của Captain Ginyu.

**Chiêu 1 — Basic Attack.** Combo **ba đòn**, mỗi đòn cách nhau **0.6 giây người chơi**:
đấm 15 → đá 15 → **lao bụng / húc đầu 20**, đòn ba **đẩy lùi mạnh hơn đòn thường của Ginyu
lẫn ChiChi** (`slamKb 340`) và **choáng 0.6 giây**. Mỗi đòn **25%** để lại **Disoriented**
1.5 giây (−20% tốc chạy, −15% tốc ra chiêu). Nhịp ra đòn chậm hơn cả Ginyu (`cm(.22)`) lẫn
ChiChi (`cm(.25)`): cả combo mất 1.2 giây rồi mới `cm(.5)` hồi chiêu.
- Địch lùi ra khỏi tầm giữa chừng thì combo bỏ dở và chỉ chờ **nửa** hồi chiêu.
- **`drReach()` xoá `f.drCombo`**: rút bảo bối là bỏ dở combo tay, đừng để chạy cả hai.

**Chiêu 2 — Air Cannon.** Mỗi **8 giây**: thò tay vào túi, lắp ống vào tay, **đứng yên ngắm
0.7 giây**, rồi bắn **một VÒNG khí nén trắng xanh** có gió xoáy (`drawProj` nhánh `aircan`)
— **không phải tia năng lượng liên tục kiểu Kamehameha**.
- **85 dmg · đẩy lùi 22% chiều dài sàn · choáng 2.5 giây · cắt ngang mọi chiêu đang gồng**
  (`drInterrupt()`: dải bóng và cú đâm của Shikamaru, Ginyu Flash, và chính bảo bối của
  Doraemon). **Quãng đứng suy nghĩ của Horikita thì KHÔNG đụng vào** — máy quyết định của cô
  là một chuỗi trạng thái, cắt giữa chừng là hỏng cả mạch chứ không phải chỉ mất một chiêu.
- Lực đẩy: `knock()` nhận `W * acKbDist * 6` vì lực đẩy tắt dần theo `exp(-6t)`, nên quãng
  đi được đúng bằng `power/6`. Đo được **131px** trên mốc 136px.
- **Độ chính xác tra bảng `DORA.acAcc`** rồi nội suy tuyến tính: gần **75~90%**, trung bình
  **50~60%**, xa nhất **30~40%**. Đo được 84% / 55% / 36%.
- **Xuyên tối đa hai người** (`p.hitList`), người thứ hai chỉ chịu **60% sát thương và 60%
  thời gian choáng**.
- Bị đánh trong **0.35 giây đầu** thì chiêu đứt và **chỉ phải chờ nửa hồi chiêu**; qua mốc
  đó thì bắn rồi, không huỷ được nữa.
- Địch đang **Shrunk** thì Air Cannon **không** cộng thêm sát thương, chỉ **đẩy xa thêm 40%**
  — phần +40% đó nằm ở `f.kbTake` của Shrunk chứ không khai riêng, **đừng cộng hai lần**.

**Chiêu 3 — Small Light.** Mỗi **16 giây**: cầm hai tay, **ngắm 1 giây**, rồi **toả một VÙNG
NÓN ánh sáng vàng nhạt ngay lập tức** — đúng lối Freeze Breath của Superman nhưng **rộng
hơn**: nón `slCone = .55` rad so với `fbCone = .42`, tầm `slRange = 240` so với `fbRange = 210`.
**Không còn viên đạn nào bay đi** (`DORA.slSpd`, `p.type==='smalllight'` và `drSlHit()` đã bỏ
hẳn), nên **không né được bằng cách chạy ngang** — muốn thoát thì phải đứng ngoài nón.
*(Người dùng: "thay đổi small light là ảnh hưởng theo vùng như skill thổi băng của superman,
nhưng vùng rộng hơn xíu".)*

- Trúng tối đa **3 người** (`slMax`), xếp theo độ lệch góc; `drConeTargets()` bỏ qua viện binh
  và ai đang `offField()`.
- **Giữa nón** (lệch góc ≤ `slCore = .22`, và phải là người sát trục nhất): **35 dmg** +
  **Shrunk 7 giây người chơi**.
- **Rìa nón**: **20 dmg** (`slEdgeDmg`) + **Shrunk 4 giây** (`slEdgeT`).
- Vùng sáng sống `slT = gs(.55)` như hiệu ứng nhìn (`f.drCone`), `drawDoraLight()` vẽ **sau**
  nhân vật đúng lối `drawSupFreeze()`. Đồng hồ của nó đếm ở **đầu `doraTick()`**, trước mọi
  nhánh return sớm, nên chui cửa hay quay ngược giờ thì vùng sáng vẫn tự tàn.
- **AI phải vào trong tầm nón**: `think()` gác ở `d < slRange*.9` (cũ là `d < 520` của thời
  còn bắn tia), và `doraVec()` có nhánh riêng bước tới khi Small Light hồi xong mà địch đứng
  ngoài mốc đó — không thì anh cứ lượn ở quãng 205~270 và chẳng bao giờ bật đèn.

Trúng thì **35 dmg** + **Shrunk 7 giây**:

| | |
|---|---|
| model | còn **55%** kích thước (`f.szMul`) |
| **vòng ăn đòn** | **chỉ nhỏ đi 15%** (`shrunkHit .85` → `f.r` và `bodyRY()`) |
| tốc chạy | −55% · tốc ra chiêu −40% · sát thương gây ra −35% |
| tầm đánh thường | −20% (`f.reachMul`, mọi chỗ kiểm tầm đọc qua `meleeReach(f)`) |
| lực đẩy phải chịu | +40% (`f.kbTake`, `knock()` nhân vào) |

- **Model 55% mà hitbox chỉ 85% là CỐ Ý lệch nhau** — nhỏ hitbox theo model thì đối phương
  gần như không đánh trúng được nữa.
- **Không cộng dồn**: lượt sáng thứ hai chỉ làm mới đồng hồ, hệ số giữ nguyên. `drShrink(t,dur)`
  lấy `Math.max` chứ không gán đè — quãng rìa nón 4 giây **không được rút ngắn** quãng 7 giây
  đang chạy dở.
- Bị đánh lúc đang ngắm thì **hướng nón lệch** (`A.jolt`), chứ chiêu không đứt.
- Hết hiệu ứng thì model **phình lại từ từ trong 0.4 giây**. Nhịp bước phải nhân `1 −
  shrunkSize` vì quãng đi chỉ là 0.45 dải chứ không phải cả dải 0→1 — **từng thiếu chỗ này
  nên phình lại chỉ mất 45% thời gian đã hẹn**.
- Ba người trở lên: `drSlTarget()` chọn **người gây tổng sát thương cao nhất** (`f.dmgDealt`,
  `hurt()` cộng dồn), bằng nhau thì **máu hiện tại cao nhất**, và **bỏ qua ai đang Shrunk**.

**Chiêu 4 — Time Machine: Second Chance.** Máu về 0 thì `hurt()` chặn trước `finish()` và
gọi `doraTime()`. **Một lần mỗi trận**; dùng rồi mà mất máu tiếp là thua bình thường.
- Phân cảnh dài **2.2 giây người chơi**, bốn pha trong `DORA.tmPh`: ngã xuống + camera tiến
  lại · Time Machine hiện ra · vòng thời gian quay ngược · trở lại sân.
- `G.freeze` đóng băng cả sàn nên **đồng hồ buff, debuff và hồi chiêu của MỌI người đứng
  yên** — không ai mất thời gian hiệu ứng vì đoạn phân cảnh. Hẹn giờ của chính phân cảnh
  gắn cờ `cine` nên vẫn chạy.
- **Đổi hẳn không khí**: `G.timeWarp` vẽ nền tối, mặt đồng hồ **kim chạy ngược**, vệt thời
  gian giật lùi, và **cỗ máy bay tới đón rồi lượn đi**; `setTheme('time')` đổi luôn nhạc nền
  sang thang nguyên cung không có chủ âm, hết phân cảnh thì trả về `'main'`.
- **Đạn của chính anh bị xoá sạch** lúc mở phân cảnh, nếu không quay xong là có hai loạt
  cùng bay.
- Quay về: vị trí và máu của **3.5~10 giây người chơi trước** (`tmBackLo` / `tmBackHi`, bốc
  ngẫu nhiên, có cả số lẻ) đọc từ `f.hist` — lấy mẫu mỗi 0.12 giây, giữ **11 giây**
  (`tmHistT`). **Máu hồi lại không quá 20% máu tối đa**. Chưa đủ dữ liệu thì về **chỗ xuất
  phát với 20% máu tối đa**.
  - **`tmHistT` phải DÀI HƠN `tmBackHi`**, không thì quãng tua xa nhất không có dữ liệu và
    lần nào cũng rơi vào nhánh "về chỗ xuất phát". Đổi `tmBackHi` thì nhớ nới `tmHistT` theo.
  - **Con số vừa bốc phải HIỆN RA màn hình** *(người dùng: "quay ngược lại từ khoảng 3.5-10s
    trc lúc chết (random và hiện trên màn hình luôn)")* — ba chỗ: băng-rôn giữa màn ghi
    `TIME MACHINE: REWIND 7.4s`, `drawTimeWarp()` in **`− 7.4s` + `REWIND`** ngay dưới mặt
    đồng hồ đang chạy ngược, và lúc trở lại sân có thêm băng-rôn `REWOUND 7.4s`. Chữ tiếng
    Anh, đúng luật riêng của Doraemon.
  *(Đường đi của con số: 1~3 giây → **3.5~10 giây**.)*
- Xoá sạch debuff **trên anh**, cắt **40% phần còn lại** của mọi hồi chiêu, và **không**
  đụng tới máu / vị trí / trạng thái của bất kỳ ai khác.
- Rồi **Future Knowledge 5 giây**: −30% dmg nhận, +35% tốc chạy, +45% tốc ra chiêu, +25% độ
  chính xác của cả Air Cannon lẫn Small Light, kháng 35% làm chậm và choáng.

> **Panic Mode / Prepared Mode đã BỎ HẲN.** Bản mô tả gốc có nêu cảm giác *"hơi hoảng loạn
> khi gặp nguy hiểm, nhưng sau đó tìm được đúng bảo bối và phản công"*, và tôi từng dựng
> thành hai trạng thái thật (dưới 35% máu hoặc ăn một đòn nặng thì hoảng 2.5 giây rồi
> Prepared 6 giây). Người dùng bác: **"bỏ hết cái panic mode j đó đi, loạn quá"** — anh lùi
> ra chạy loạn giữa trận nhìn rối, cộng thêm hai dòng chữ nữa dưới thanh máu. Đã gỡ sạch:
> hằng số, hai trạng thái, nhánh AI, dòng trạng thái, thanh phụ và cả hai cái tên trong
> danh sách chữ tiếng Anh. **Đừng dựng lại.**
>
> Kéo theo đó, luật *"Time Machine không hồi lại Panic Mode"* thành vô nghĩa — không còn
> Panic Mode để mà hồi. Cùng lúc đó `drPanicOn()` biến mất nên nhánh chặn `f.fk>0` cũng đi
> theo. Ô tiếng thì lần đầu **giữ nguyên tên khoá `dora_panic`**, nhưng người dùng nhắc lại
> *"bỏ ngay panic mode của doraemon"* nên giờ **đổi hẳn tên khoá thành `dora_down`** —
> chữ "panic" không còn ở đâu trong phần Doraemon nữa. Đây là ngoại lệ duy nhất của luật
> "khoá giữ nguyên đời đời" ở mục 4: ô đó **chưa bao giờ có file người dùng nạp** (mục 11
> ghi rõ tiếng Doraemon mới chỉ có tiếng tự tạo), nên đổi tên không xoá mất gì. Chỗ duy
> nhất gọi nó vẫn là `finish()`.

> **Nội tại Fourth-Dimensional Pocket đã BỎ HẲN.** Từng có một dòng nội tại trong mảng
> `skills` (*"he reaches into the pocket on his belly before every gadget…"*), một dáng
> `pocket` (thò tay vào túi) chạy 0.25~0.3 giây trước mỗi bảo bối và trước Take-copter, một
> ô dán ảnh `pocket`, ô tiếng `dora_pocket`, thanh phụ `Pocket: n/3 ready` và dòng
> `FOURTH-DIMENSIONAL POCKET` trên băng-rôn thắng. Người dùng bác: **"bỏ cái vụ pocket
> luôn"**. Đã gỡ sạch cả sáu chỗ. **Đừng dựng lại.**
>
> Kéo theo đó:
> - `drReach()` đặt thẳng dáng `aircannon` / `smalllight`, `drAimTick()` cũng vậy — **quãng
>   ngắm vẫn nguyên** (`acAim` 0.7s / `slAim` 1s), chỉ mất pha thò tay vào túi ở đầu.
> - `drCopterOn()` đặt dáng `copter` và chỉ còn `sfx('dora_copter')`.
> - Thanh phụ đổi sang **`Gadget: n.ns` / `Gadget ready`** — đọc bảo bối nào sắp xong trước
>   (`min(cds.s2, cds.s3)`), đúng kiểu đồng hồ của mấy nhân vật kia.
> - Băng-rôn thắng trở lại cặp **`WINNER` + `DORAEMON WINS!`**.
> - `sprite()` bỏ nhánh `pk==='pocket'`, và hai nhánh lùi của `aircannon`/`smalllight` không
>   còn đọc `set.pocket`.
>
> **Cái túi vẽ trên bụng thì GIỮ NGUYÊN** — đó là hình dáng nguyên tác, không phải cơ chế.
> Chỉ bỏ nhánh vẽ lỗ đen trong túi lúc thò tay vào (`P==='pocket'`).

**AI.** `doraVec()` thay hẳn nhánh `ranged` của `aiVec()`, hai kiểu đi:
**cả hai bảo bối đang hồi** thì mới chịu áp sát đánh tay · còn lại giữ đúng `want = 205`
để rút đồ ra dùng. Thứ tự bấm chiêu trong `think()`: **Small Light trước, Air Cannon sau,
hết cả hai mới tới combo tay**; Take-copter và Emergency Door là nội tại chạy ngoài
`think()`.

**Ăn mừng / gục ngã.**
- Thắng: một cánh Anywhere Door hiện phía sau (`drawDoraDoors`), anh **ngồi ăn dorayaki**
  (dáng `win`), băng-rôn ghi **`WINNER` + `DORAEMON WINS!`** thay cho cặp WINNER + tên, chữ
  dưới thanh máu vẫn là `Doraemon`.
- Đã dùng Time Machine rồi mới thắng thì `drawDoraGhosts()` vẽ **vài bóng mờ chạy ngược về
  phía sau** rồi mới trở lại hình anh đang ăn — đúng kiểu thời gian vừa được tua lại.
- Thua: dáng `down` (ngã ngồi, hai mắt thành dấu ✕), **vài bảo bối rơi ra khỏi túi**
  (fx `gadget`). **Không máu me, không hiệu ứng chết chóc** — anh chỉ bị hạ gục và bất tỉnh.

**Ô dán ảnh riêng**: `punch` · `kick` · `slam` · `aircannon` · `smalllight` ·
`copter` · `win` · `down`, cộng `idle/hurt/injured`.
**Ô dán tiếng**: nhóm riêng `Doraemon`, mười ô, một ô 🎙 giọng (`dora_hi`) cắt đúng bằng
bong bóng thoại. **Đấm đá mượn thẳng `sfx('punch')` của ChiChi**, đúng lối đã chốt cho
Horikita và Ginyu — đừng dựng ô mới.

> **Đường đi của mấy con số cân bằng** (người dùng chỉnh dần, ghi lại cho khỏi cãi nhau):
> Air Cannon **100 → 85 dmg**, hồi chiêu **10 → 8 giây** ("giảm dmg 15% nhưng xả đạn thường
> xuyên hơn") và choáng **3 → 1.75 → 2.5 giây** (buff lại một nấc) · Small Light hồi chiêu
> **18 → 16 giây** ("xả đạn thường xuyên hơn tí") · cửa thoát hiểm hồi chiêu **8 → 6 giây**,
> và tỉ lệ né tách làm hai mức 60% / 30% · Take-copter **+70% → +150%** tốc chạy, hai cửa vào
> nới từ 55% sàn / 2.5 giây xuống 35% / 1.2 giây rồi chốt ở **40% sàn / 2 giây**.

> **`t_dora.js` đo phần cắt hồi chiêu của Time Machine bằng cách gọi thẳng `drTimeBack()`**,
> không đọc qua vòng poll nữa. Đọc qua poll thì trận đã chạy tiếp và hồi chiêu trôi thêm một
> quãng — quãng trôi đó cố định trong khi hồi chiêu thì đổi theo cân bằng, nên vừa hạ `acCd`
> xuống 8 giây là mục đó đổ oan (đo ra 0.58 trên mốc 0.60). Phép đo nào bám theo hằng số cân
> bằng thì nên gọi thẳng hàm, đừng đo theo dòng thời gian.

Nút thử tay: `#testDoraShrink` (bật hẳn vùng nón thật, không còn ép thu nhỏ suông),
`#testDoraDoor`, `#testDoraTime`.
Kiểm bằng `node tools/t_dora.js`.

### Superman (`superman`)
Toàn bộ trong hằng `SUP`, khai theo lối của Shikamaru / Horikita / Ginyu / Doraemon (giây
người chơi bọc `gs()`). Fighter kiểu **Bruiser – Vanguard – Crowd Control**: đấm nặng, đuổi
được bằng cách bay, lì đòn, và mang cả một bộ khống chế. Đổi lại **chiêu nào cũng có quãng
chuẩn bị nhìn thấy rõ** để đối phương kịp né hoặc ngắt.

> **Mọi chữ hiện ra trong game của nhân vật này là tiếng Anh** — tên nhân vật, tên chiêu, tên
> buff, tên debuff, băng-rôn, dòng dưới thanh máu. Nhật ký vẫn tiếng Việt như mấy người kia.
> `t_superman.js` quét cả mảng `skills` để chắc không lẫn một chữ có dấu nào, và soi đủ mười
> bốn cái tên người dùng liệt kê.

> **Bộ chiêu của anh cân theo đúng 800 máu** (`HP_STD`; anh là người đầu tiên có con số này,
> giờ cả bảng cùng 800). Cả bộ chiêu cân theo đúng
> con số đó — đòn mạnh nhất **132** (147 khi địch đang Frozen), tức 16.5% thanh máu. **Không
> chiêu nào được phép chạm mốc 200 trong một lần dùng**, và **không có chí mạng ngẫu nhiên**
> (nhãn `METEOR STRIKE!` truyền vào `hurt()` chỉ là băng-rôn tên chiêu, đúng lối `RASENGAN!`
> / `AIR CANNON!` — nó không nhân sát thương).

> **Sát thương chốt ở mức 75% BẢN ĐẦU.** Người dùng đi qua ba lượt: hạ xuống 70% → nhích
> thêm 5% → chốt hẳn *"lên 75%"*. Luật cuối cùng áp cho **TỪNG con số một**, không bốc tay
> từng chỗ:
>
> ```
> số mới = làm tròn(số bản đầu × 0.75)
> ```
>
> | | bản đầu | 70% | +5% | **chốt (75%)** |
> |---|---|---|---|---|
> | combo tay | 34 / 34 / 50 = 118 | 24/24/35 = 83 | 25/25/37 = 87 | **26 / 26 / 38 = 90** |
> | Heat Vision, mỗi nhịp | 22 (×4 = 88) | 15 (×4 = 60) | 16 (×4 = 64) | **17 (×4 = 68)** |
> | Burning, mỗi giây người chơi | 5 (tổng 20) | 3.5 (tổng 14) | 3.75 (tổng 15) | **3.75 (tổng 15)** |
> | Freeze Breath giữa nón | 45 | 32 | 34 | **34** |
> | Freeze Breath rìa nón | 25 | 18 | 19 | **19** |
> | Meteor Strike, cú đấm | 145 | 102 | 107 | **109** |
> | vùng chấn động | 30 | 21 | 22 | **23** |
> | Shatter Damage | 20 | 14 | 15 | **15** |
>
> Luật áp cho **từng con số**, không phải cho tổng: đòn một và đòn hai đều là 34 gốc nên mỗi
> cái tự làm tròn riêng (25.5 → 26), vì vậy combo cộng lại ra **90** chứ không phải
> làm tròn(118 × 0.75) = 89. Chỗ nào bản đầu ra số lẻ **.5** thì làm tròn **lên**, nên vài
> con số nhỉnh hơn 75% một chút — cao nhất là 77%. Đó là cái giá của việc giữ đúng một luật,
> và `t_superman.js` chấm bằng **độ lệch so với mốc 75%, không quá 0.5 đơn vị** cho mỗi con
> số: lệch hơn thế là ai đó đã bốc tay đổi số.
>
> Mấy con số **không phải sát thương giữ nguyên hết qua cả ba lượt**: lực đẩy, thời gian
> khống chế, hồi chiêu, độ chính xác, và **mốc 100 dmg làm vỡ băng** (đó là sát thương NHẬN
> VÀO từ bất kỳ ai, không phải sát thương anh gây ra).
>
> **Kéo theo một chỗ phải sửa thật:** lượt hạ xuống 70% kéo cú đấm Meteor Strike còn 102, sát
> mốc 100 làm vỡ băng — địch có lớp giảm sát thương nào là tụt xuống dưới mốc và lớp băng
> **không vỡ**. Bản mô tả nói thẳng "cú đấm làm lớp băng vỡ", nên `supMsLand()` gọi
> `supIceBreak()` hẳn ra chứ không trông chờ vào mốc 100 nữa. **Giữ nguyên cách đó** dù giờ
> đã lên lại 109.

> **Model phải giữ đúng hình tượng quen thuộc**: đồ xanh, biểu tượng chữ **S** đỏ trên nền
> vàng giữa ngực, áo choàng đỏ, giày đỏ, tóc đen kèm lọn xoăn trước trán. Chữ **S** vẽ bằng
> **nét bezier chứ không dùng font** (font headless hay thiếu ký tự). Áo choàng vẽ **đầu tiên**
> nên luôn nằm sau lưng và chỉ trải về phía sau — lúc đánh nhau nó phất theo tốc chạy, lúc bay
> hoặc lao xuống thì trải dài hẳn ra, nhưng **không bao giờ che mất thân người**.
> Không có **teleport** ở bất cứ đâu: muốn đi nhanh thì phải bay hoặc lao qua quãng đó.

**Màn xuất hiện — đừng bỏ.** Bấm *Bắt đầu* thì anh **chưa có mặt trên sàn**: `init()` gọi
`supermanEnter(f)` đẩy anh lên cao (`supAir = SUP.entH`) và bật `supHide`. Bốn pha, mốc nằm
trong `SUP.entPh`, tổng đúng **1.5 giây người chơi** để ghép tiếng:

| Quãng | Có gì |
|---|---|
| 0 → 0.4s | chỉ là một **bóng người** trên cao, áo choàng bay trong gió (`drawSupEntry()`, `supHide` bật nên `drawFighter` bỏ qua anh) |
| 0.4 → 1s | hiện rõ model, hạ độ cao bay xuống sân, để lại vệt bóng mờ |
| 1 → 1.3s | tiếp đất bằng một chân, **một vòng bụi nhỏ** |
| 1.3 → 1.5s | đứng thẳng, nắm hai tay, quay mặt về phía đối thủ |

Suốt cả 1.5 giây, `supEntryTick()` đặt `lock` cho mọi đối thủ mỗi nhịp — họ đứng chờ, không
di chuyển cũng không đánh. **Cú tiếp đất KHÔNG gây sát thương và KHÔNG choáng ai**: chỉ có
`ring()` với mấy hạt bụi, không nổ. Test đo thẳng máu và `stun` của địch trong suốt màn này.

**Chỉ số nền:** máu 800 · tốc chạy 108 (nhanh hơn trung bình cả bảng ~10%) · tốc ra đòn ở mức
trung bình · cận chiến · lì đòn và chống đẩy lùi tốt · **không hồi máu tự động**, **không chí
mạng**.

**Nội tại 1 — Man of Steel.** `supResist(f)` là cửa duy nhất tính hệ số sát thương phải chịu;
`hurt()` gọi nó thay cho nhánh `t.dmgRes` chung.
- Giảm **20%** sát thương từ đòn vật lý, vũ khí và đạn năng lượng. 100 raw ⇒ mất đúng 80.
- **`kind === 'dot'` và `kind === 'domain'` ăn đủ 100%** — đó là burn / poison / true damage /
  sát thương theo phần trăm máu, da thép không chắn được.
- **Không cộng dồn với chính nó, và trần tổng là 60%** (`steelCap`): buff giảm sát thương của
  người khác (`f.dmgRes`) được **cộng vào rồi mới chặn trần**, nên dù có buff giảm 90% thì
  anh vẫn mất 40 trên 100.
- Giảm **35%** lực đẩy (`supKbTake()`, `knock()` nhân vào), bay thì thêm 50%, gồng Resolve thì
  thêm 25% — **nhân dồn** chứ không cộng, để không bao giờ chạm mốc miễn nhiễm.
- Giảm **15%** thời gian choáng do va chạm vật lý (`stunFx`, trừ `kind === 'ice'`).
- **Đòn dưới 25 dmg không làm anh ngã người ra**: `hurt()` bỏ qua `setPose(t,'hurt')` và gần
  như không giật lùi — vẫn mất máu, vẫn chớp sáng.
- **Không miễn nhiễm hoàn toàn với bất cứ dạng khống chế nào**: choáng vẫn dính, dải bóng của
  Shikamaru vẫn trói được (trừ lúc đang bay), CHANGE của Ginyu vẫn cướp được xác anh, Time
  Machine vẫn chạy.

**Nội tại 2 — Kryptonian Flight.** Đây là **hành vi di chuyển**, không phải chiêu, và không
gây một điểm sát thương nào.
- Điều kiện: địch xa hơn **50% chiều dài sàn** VÀ suốt **2 giây người chơi** vẫn không tiếp
  cận được (`f.supStuck`; nhích vào trong tầm một nhịp là bộ đếm về 0).
- Bay tối đa **3 giây**: +75% tốc chạy, +50% kháng lực đẩy, **dải bóng của Shikamaru không
  giữ nổi** (`bindTick()` có nhánh riêng, đúng kiểu Take-copter).
- **Không đánh thường khi đang bay** (think bỏ qua combo), **Heat Vision dùng được nhưng trừ
  15% độ chính xác**, **Freeze Breath thì tuyệt đối không**, và Meteor Strike **tự hạ xuống
  trước** khi bay lên lấy đà.
- Vào đủ tầm vung tay là **hạ cánh ngay**; hồi chiêu **8 giây tính TỪ LÚC TIẾP ĐẤT**
  (`supFlyOff` mới nạp `supFlyCd`), không phải từ lúc cất cánh.
- `aiVec()` có nhánh riêng `supFlyVec()`: lúc bay thì **nhắm thẳng vào địch**, không lượn
  vòng — bay là để đuổi, không phải để chạy trốn câu giờ.

**Nội tại 3 — Last Son's Resolve.** Lần **đầu tiên** máu tụt xuống dưới **25% (200 HP)**:
- 8 giây: +30% tốc chạy, +25% tốc ra chiêu, **+10% giảm sát thương (tổng thành 30%)**,
  +25% kháng lực đẩy, và **cắt thẳng 2 giây người chơi** khỏi phần hồi chiêu còn lại của Heat
  Vision lẫn Freeze Breath. **Không tăng sát thương gây ra.**
- Hết 8 giây là **Solar Fatigue** 4 giây: −20% tốc chạy, −15% tốc ra chiêu, Man of Steel về
  lại 20%.
- **Một lần mỗi trận**: cờ `f.lsrDone` bật lên và giữ luôn, nên được người khác hồi máu lên
  trên 25% rồi tụt xuống lại cũng không gọi lần hai.

**Chiêu 1 — Basic Attack.** Combo **ba đòn**, mỗi đòn cách nhau **0.55 giây người chơi**:
đấm thẳng tay phải 26 → **xoay người** đấm tay trái 26 → uppercut 38. Tổng **90** =
11.25% thanh máu 800. Xong combo chờ **0.8 giây** mới đánh tiếp.
- Đòn ba đẩy lùi **12% chiều dài sàn** và choáng **0.55 giây** (đi qua trần khống chế).
- Mỗi đòn **10%** cắt một chiêu **đang trong giai đoạn chuẩn bị** (`supInterrupt()`) — và chỉ
  thế, **không kèm choáng** ngoài hiệu ứng của đòn ba.
- Địch bị hất ra khỏi tầm thì combo bỏ dở và chỉ chờ **nửa** hồi chiêu. **Không có teleport
  đuổi theo**: anh phải chạy hoặc bay lại chỗ họ.
- Dáng `punch` / `punch2` / `upper` tách hẳn nhau. Riêng `punch2` là cú **xoay người** nên tay
  dẫn vẽ **đè lên thân** và với dài hơn (26 thay vì 17) — không nới thì nắm đấm dừng ngay giữa
  ngực, nhìn như chưa đánh gì.
- **Đấm đá mượn thẳng `sfx('punch')` của ChiChi**, đúng lối đã chốt cho Horikita / Ginyu /
  Doraemon — đừng dựng ô mới.

**Chiêu 2 — Heat Vision.** Mỗi **8.5 giây**: đứng yên, hai mắt đỏ rực **0.65 giây**, rồi bắn
**hai tia từ ĐÚNG hai con mắt** trong **1.2 giây**.
- Chiều cao mắt đọc qua `supEyeY(f)` = 84% chiều cao model, **không phải trán, không phải
  miệng**. `drawSupHeat()` vẽ hai tia tách nhau ở gốc rồi **chụm dần vào nhau** khi bay xa.
- **4 nhịp × 17 = 68 dmg**; trúng đủ cả bốn nhịp lên **cùng một người** thì dính **Burning**
  3.75 dmg/giây trong 4 giây (**tổng tối đa 83**). Burning **không cộng dồn** — lần sau chỉ làm
  mới đồng hồ (`supBurn()` xoá dot cũ có cờ `sup` rồi mới đẩy dot mới vào).
- Đang bị chiếu: **−25% tốc chạy**, **không choáng**, **không đẩy lùi**.
- **Chỉ được chỉnh hướng trong 0.3 giây đầu** (`SUP.hvTrack`), sau đó `A.ang` **khoá cứng** —
  địch bước sang bên là tia chiếu hụt, anh không được xoay theo.
- Độ chính xác `SUP.hvAcc`: **90% gần · 70% trung bình · 55% xa nhất**, bay thì **−15%**. Bốc
  trúng/trượt **ngay lúc bắt đầu bắn**; trượt thì tia lệch hẳn 0.20~0.42 rad và ở nguyên đó.
- Bị đánh trong **0.4 giây đầu** của quãng gồng ⇒ đứt chiêu, chờ **50%** hồi chiêu. Tia đã bắn
  ra rồi thì **đòn nhẹ không cắt được**, chỉ **choáng / knockdown** mới cắt.
- Ba người trở lên: mỗi nhịp **chỉ một người** ăn đòn, và **ai đứng chắn giữa đường thì ăn
  trước** — tia **không xuyên qua** họ (`supHvHit()` chọn người gần nhất nằm trong nón).

**Chiêu 3 — Freeze Breath.** Mỗi **11.5 giây**: hít sâu **0.9 giây** rồi thổi một luồng hơi
**hình NÓN** trắng xanh kèm tinh thể băng (`drawSupFreeze()`). **Không bao giờ vẽ thành một
tia laser mảnh.**
- Trúng **giữa nón** (lệch góc ≤ `fbCore`): **34 dmg** + **Frozen 2.2 giây**, hết Frozen thì
  **Chilled 4 giây** (−50% tốc chạy, −25% tốc ra chiêu).
- **Frozen**: không đi được, không ra chiêu được (`supStatus` đặt `lock` mỗi nhịp), **nhưng
  vẫn ăn đòn bình thường**. **Ăn đủ 100 dmg là lớp băng vỡ ngay** (`supIceBreak()`): choáng
  kết thúc và đổi thành **Chilled đúng phần thời gian băng còn lại**.
- **Đã Frozen thì không đóng băng lại**: lần Freeze Breath sau chỉ gây dmg và làm mới Chilled
  (tối đa 4 giây).
- **Đứng ở rìa nón**: 19 dmg / Frozen 1 giây / Chilled 2.5 giây. Ba người trở lên thì trúng
  tối đa **ba người**, chỉ người nằm sát trục nón ăn đủ hiệu ứng (`o.chillAfter` nhớ giúp mỗi
  người nhận đúng quãng Chilled của mình).
- Bị đánh trong **0.5 giây đầu** ⇒ đứt chiêu, hồi chiêu còn **60%**. **Không dùng được khi
  đang bay.**

**Chiêu 4 — Meteor Strike.** Mỗi **17 giây**, đòn mạnh nhất.
- Lùi nhẹ, **bay lên cao 0.65 giây**, treo trên không **0.55 giây** để **khoá hướng** — tổng
  **1.2 giây** chuẩn bị, đủ rõ để địch kịp né.
- Lao xuống theo **đường thẳng**: không bẻ hướng, không bám theo ai, không teleport. Điểm rơi
  `M.tx/M.ty` chốt ở cuối pha `hold` và **không đổi nữa**, kể cả khi có ba người trên sàn.
- Trúng: **109 dmg** + knockdown **1.5 giây** + hất lùi **20% chiều dài sàn**, kèm **vùng chấn
  động** 23 dmg và −35% tốc chạy trong 2 giây ⇒ mục tiêu chính ăn **132**.
- Địch đang **Frozen**: cú đấm **luôn** làm vỡ băng (`supMsLand()` gọi thẳng `supIceBreak()`,
  không trông chờ vào mốc 100 nữa), rồi cộng thêm **15 Shatter Damage** đúng **một lần** ⇒
  **144 và không hơn**.

> **Vùng chấn động là một cú AoE THẬT, ăn theo MỨC ĐỘ đứng gần điểm rơi** — người dùng chốt
> riêng chỗ này. `supQuakeShare(d)` nội suy tuyến tính, `d` đo từ điểm rơi tới **mép model**
> (`dist − o.r`) chứ không phải tới tâm:
>
> | Quãng cách tới điểm rơi | Ăn bao nhiêu |
> |---|---|
> | trong lõi `msQuakeR = 104` | **100%** — đủ 23 dmg, làm chậm đủ 2 giây |
> | từ lõi ra tới `msQuakeFar = 196` | **nhạt dần 100% → 35%** (`msQuakeMin`) |
> | quá `msQuakeFar` | **không dính một điểm nào** |
>
> Hệ số nhân vào **cả sát thương lẫn thời gian làm chậm**; riêng **mức làm chậm giữ nguyên
> 35%** cho dễ đọc. Đo được: đứng giữa hai vòng ăn 19/22 dmg và chậm 1.72 trên 2 giây.
> Băng-rôn đổi chữ theo: trong lõi là `SHOCKWAVE`, ngoài rìa là `SHOCKWAVE · EDGE`.
> `supMsLand()` vẽ **hai vòng** lúc nổ — vòng đặc là lõi, vòng mờ ngoài là mép AoE.
>
> Chỗ này **chỉ có ý nghĩa khi trên sàn có từ ba người CÓ THANH MÁU trở lên**: đấu thủ chính
> cộng đồng minh kiểu Ayanokouji. **Viện binh thuần** (Goku / Gohan / phân thân) không có
> thanh máu nên bị loại bằng đúng cờ `summon && !ally` mà `drawBars()` dùng — cùng một luật
> với lãnh địa Nara. Cú đấm 109 thì **vẫn chỉ MỘT người ăn**, dù đứng bao nhiêu người quanh đó.
- Độ chính xác `SUP.msAcc`: **80% gần · 60% trung bình · 50% xa nhất**. Trượt thì điểm rơi
  lệch hẳn 48~88px.
- **Đánh trượt** ⇒ đập xuống đất, nằm **1.3 giây** không đánh được, và **Man of Steel tạm tụt
  từ 20% xuống 10%** (`f.supMsDown`, `supResist()` đọc).
- Bị **choáng trong 1.2 giây chuẩn bị** ⇒ huỷ chiêu, chờ **70%** hồi chiêu (`supMsCancel()`).
- **Super Armor lúc đang lao**: `supMsTick` chạy trong vòng duyệt fighter nên **không bị `stun`
  chặn** — đòn nhẹ không cắt được cú lao, nhưng **máu vẫn mất bình thường** và cái choáng đó
  vẫn nằm nguyên trên người để ăn ngay sau khi tiếp đất. Đây không phải miễn nhiễm khống chế.
- Ba người trở lên: `supMsTarget()` chọn **người gây cho anh nhiều sát thương nhất trong 6
  giây gần nhất** (sổ `f.supLog`, `hurt()` ghi vào). Chỉ **một** người ăn 145; ai đứng trong
  vùng chấn động chỉ ăn 30 + làm chậm.

> **Hướng hất lùi của Meteor Strike phải có đường lui.** Lao trúng giữa người thì `prime.x-f.x`
> và `prime.y-f.y` gần như bằng 0, `knock()` chuẩn hoá ra vector 0 và đẩy đi **0px** — đo được
> đúng 0% thay vì 20%. Rơi vào trường hợp đó thì lấy luôn **hướng lao** (`f.ax/f.ay`) làm hướng
> đẩy.

**Trần khống chế cứng — `supCC()`.** Tổng thời gian **Frozen + stun + knockdown LIÊN TỤC do
riêng Superman gây ra** không quá **3.5 giây** (`SUP.ccCap`). Mọi chỗ Superman gây khống chế
đều phải đi qua hàm này, đừng gọi thẳng `stunFx()`.
- Phần thừa **không biến mất** mà đổi thành **làm chậm 40%** (`SUP.ccSlow`) đúng bấy nhiêu giây.
- Đúng ví dụ người dùng nêu: đóng băng 2.2 giây rồi Meteor Strike ngay sau ⇒ chỉ quật ngã thêm
  **1.3 giây**, không phải 1.5, và 0.2 giây còn lại thành làm chậm.
- "Liên tục" đo bằng `supCcT` (còn đang dính) và `supCcFree` (đã thở được bao lâu): **nghỉ đủ
  1 giây người chơi** thì `supCcAcc` về 0 và chuỗi sau lại được đủ 3.5 giây.

**AI — sáu bước, đúng thứ tự người dùng chốt** (`CHARS.superman.think`):
1. địch quá xa ⇒ **Kryptonian Flight** (nội tại, chạy ngoài `think`);
2. địch **đang chạy nhanh** ⇒ ưu tiên **Freeze Breath**;
3. địch **đang Frozen** ⇒ ưu tiên **Meteor Strike**;
4. địch **ít máu ở tầm trung** ⇒ **Heat Vision**;
5. hết chiêu ⇒ áp sát **Basic Attack**;
6. **dưới 200 HP** ⇒ đánh thận trọng hơn: chỉ bổ Meteor Strike trong `SUP.msSafe` chứ không
   tung từ khoảng cách xa nhất.

**Ăn mừng / gục ngã.**
- Thắng: dáng `win` — đứng thẳng, **chống hai tay vào hông**, rồi `supAir` dâng dần lên 32px
  nên anh **từ từ rời mặt đất**, áo choàng tung sau lưng. Băng-rôn ghi **`WINNER` +
  `SUPERMAN WINS!`**, chữ dưới thanh máu vẫn là `Superman`. **Không phá gì của sàn đấu.**
- Thắng lúc còn dưới 25% máu: `f.supWorn` bật, model có thêm **vài vệt bụi và vết xước** —
  nhưng **biểu tượng chữ "S" và áo choàng giữ nguyên**, không rách, không mất.
- Thua: dáng `ko` — chống một đầu gối xuống, **gượng dậy hai nhịp không nổi** rồi mới đổ hẳn.
  `G.loserFx` mang cờ `sup` nên quãng nghiêng người bắt đầu muộn hơn (0.62 giây) và có một
  nhịp nhún cố đứng lên. Áo choàng rũ theo người (`air` nhỏ hẳn ở hai dáng `ko`/`down`).
  **Không máu me, không hiệu ứng chết chóc.**

**Ô dán ảnh riêng**: `fly` · `land` · `punch` · `punch2` · `upper` · `heat` · `freeze` ·
`meteor` · `down` · `win` · `ko`, cộng `idle/hurt/injured`. Thiếu ảnh thì lùi về ô gần nghĩa
nhất (`meteor` → `fly` → `idle`, `freeze` → `heat` → `idle`, `ko` → `down` → `injured`).
**Ô dán tiếng**: nhóm riêng `Superman` trong `SFX_GROUPS`, mười ba ô — `sup_enter`, `sup_land`,
`sup_flight`, `sup_resolve`, `sup_fatigue`, `sup_heat`, `sup_freeze`, `sup_frozen`,
`sup_shatter`, `sup_meteor`, `sup_impact`, `sup_win`, `sup_down`. `sup_enter` bị cắt đúng bằng
màn xuất hiện (`SUP.entT*RT` trong `SFX_MAXLEN`) nên tiếng không sống lâu hơn hình.

Nút thử tay: `#testSupFly`, `#testSupResolve`, `#testSupFreeze`, `#testSupMeteor`.
Kiểm bằng `node tools/t_superman.js`.

> **Chỗ đã tự quyết, nói rõ để sau này khỏi cãi nhau:**
> - Bản mô tả nói Man of Steel không chắn được "burn, poison, true damage và damage theo phần
>   trăm máu". Trong game hai loại đó đi đúng hai đường `kind='dot'` và `kind='domain'`, nên
>   tôi lấy đúng hai cờ đó làm ranh giới. Lãnh địa Nara vì vậy ăn đủ vào anh.
> - Vùng chấn động của Meteor Strike **vẫn nổ ra khi đánh trượt** — nó là cú va chạm với mặt
>   đất chứ không phải phần đuôi của cú đấm. Ai đứng gần điểm rơi vẫn ăn 30 dmg và làm chậm,
>   nên trần 195 không đổi.
> - Trần 3.5 giây đo theo chuỗi **liên tục**, với "liên tục" = chưa thở được 1 giây người chơi
>   (`SUP.ccFree`). Muốn khắt khe hơn thì nới con số đó.

### Beatrice (`beatrice`)
Toàn bộ trong hằng `BEA`, khai theo lối của Shikamaru / Horikita / Ginyu / Doraemon /
Superman (giây người chơi bọc `gs()`). Fighter kiểu **Mage — pháp sư tầm xa thiên về khống
chế, tự bảo vệ và giữ khoảng cách**: đòn thường nhẹ hều, nhưng cô đẩy đối thủ ra xa liên
tục, tự gỡ khống chế, chặn sạch sát thương rồi hắt ngược lại.

> **Mọi chữ hiện ra trong game của nhân vật này là tiếng Anh** — tên nhân vật, tên chiêu,
> tên buff, tên debuff, băng-rôn, dòng dưới thanh máu. Nhật ký vẫn tiếng Việt như mấy người
> kia. `t_beatrice.js` quét cả mảng `skills` lẫn `DEX` để chắc không lẫn một chữ có dấu nào,
> và soi đủ mười bốn cái tên người dùng liệt kê. Âm thanh thì giọng Nhật cũng được — chỉ
> **chữ hiển thị** mới bắt buộc tiếng Anh.

> **Người dùng chốt: "Không tự ý tăng sát thương, HP hoặc giảm hồi chiêu so với các thông số
> đã cung cấp."** Mọi con số trong `BEA` là con số họ đưa, đừng cân bằng lại theo cảm tính.

**Model.** Thân NHỎ (`spriteH:104`, thấp nhất bảng), tóc vàng với **hai lọn xoắn lớn** hai
bên, váy hồng - trắng - đỏ, mặt nghiêm nghị hơi khó chịu, quyển sách phép cầm trên tay.
Ba điều bắt buộc, đừng phá:
- **Đừng biến cô thành người trưởng thành** — đầu to so với thân, chân ngắn, giữ tỉ lệ trẻ con.
- **Đừng để váy, tóc hay hiệu ứng phép che khuất toàn bộ cơ thể** — hai lọn tóc vẽ SAU thân
  nhưng TRƯỚC đầu, váy chỉ xoè tới ngang đùi.
- **Đứng yên thì KHOANH TAY**, mặt hơi quay đi với thái độ kiêu kỳ (`arms` trong `beaVector`).

### Tầm đánh đo bằng R — đọc kỹ trước khi sửa

Người dùng chốt riêng cách đo: **R = bán kính vòng tròn ngoại tiếp nhỏ nhất bao quanh phần
THÂN CHÍNH lúc đứng bình thường**, bỏ tóc bay, váy bay, quyển sách và mọi hiệu ứng phép.

```js
const BEA_BODY_W=34, BEA_BODY_H=96;
const BEA_R=Math.round(Math.hypot(BEA_BODY_W,BEA_BODY_H)/2);   // = 51
```

Vòng tròn nhỏ nhất bao được một hình chữ nhật là vòng ngoại tiếp, bán kính bằng **nửa đường
chéo** — nên R tính thẳng ra chứ không gõ tay con số. Từ đó:

| | |
|---|---|
| **Basic Attack Range** | `5 × R` = **255** |
| **Reflection Radius** (E.M.T) | `2.5 × R` = **127.5** |

> **R phải là HẰNG SỐ, tuyệt đối đừng đọc `f.r`.** Small Light của Doraemon bóp `f.r` nhỏ đi
> 15%, mà bản mô tả nói thẳng là tầm đánh KHÔNG đổi khi model bị phóng to hay thu nhỏ tạm
> thời, khi cô cúi người, bị đánh ngã, hay lúc tóc và váy chuyển động.

**Màn ra mắt — Forbidden Library.** Bấm *Bắt đầu* thì cô **chưa có mặt trên sàn**
(`f.beaHide`, `drawFighter()` và `drawBars()` đều return sớm; `offField()` cũng đọc cờ này).
Bốn pha, mốc nằm trong `BEA.doorPh`, tổng đúng **1.5 giây người chơi** để ghép tiếng:

| Quãng | Có gì |
|---|---|
| 0 → 0.4s | cánh cửa gỗ hiện ra dần |
| 0.4 → 0.8s | cửa mở, ánh sáng tím hắt ra từ bên trong |
| 0.8 → 1.2s | Beatrice bước ra, tay cầm quyển sách |
| 1.2 → 1.5s | cửa đóng lại và biến mất, cô quay về phía đối thủ |

Suốt cả 1.5 giây, `beaEntryTick()` đặt `lock` cho mọi đối thủ mỗi nhịp — họ đứng chờ, không
di chuyển cũng không đánh. Đo được: 90/91 nhịp bị khoá, địch dịch **0.00px** và **không mất
một giọt máu nào**. Cánh cửa vẽ trong `drawBeaEntry()`, **TRƯỚC** nhân vật, để cô bước ra từ
phía sau nó.

**1 · Minya** — `BEA.minyaDmg = 15`, một đòn mỗi giây người chơi (`minyaCd: gs(1)`), nhắm kẻ
địch **gần nhất trong tầm 5R**. Mũi tinh thể tím đen bay thẳng, **xuất phát từ trước bàn
tay** — không phải đấm, không phải súng, không phải tia laser hiện đại.
- **20% choáng 0.5 giây** (`minyaStunOdds` / `minyaStun`), tên hiệu ứng là **Minya Stun**.
- **Xác suất bốc RIÊNG cho từng viên, ĐÚNG LÚC nó chạm người** — `beaMinyaHit()` gọi
  `hurt()` trước, `return` ngay nếu đòn bị né hay bị chặn, rồi mới `chance()`. Bốc lúc bắn
  là sai: đòn bị né vẫn choáng.
- **Không cộng dồn thời gian**: `stunFx()` lấy `Math.max` nên viên thứ hai chỉ làm mới về
  đúng 0.5 giây. **Đừng đổi chỗ đó thành phép cộng.** Đo được: đang choáng dở 0.2s, bắn thêm
  một viên ⇒ vẫn 0.50s chứ không phải 0.70s.
- Không chí mạng, không sát thương theo phần trăm máu.
- Mục tiêu chết hoặc ra khỏi tầm **trước lúc bắn** thì bốc lại người gần nhất; **đã bắn ra
  rồi** thì viên đạn cứ bay theo cơ chế cũ, không tự đổi mục tiêu giữa đường.

**2 · Al Shamac** — mỗi `gs(5)`, ném mục tiêu ra **sát rìa tầm đánh thường**.
- `beaShamacSpot()` bốc 32 điểm trên vòng tròn bán kính `5R × 0.94` rồi **lùi dần vào trong**
  (82% → 68% → 54%) tới khi có chỗ hợp lệ: nằm hẳn trong sàn, không dính tường, không chồng
  lên model của ai. Chấm điểm ưu tiên **vòng ngoài cùng** (thắng đậm, +1000 mỗi vòng) rồi mới
  tới chỗ thoáng — "không dịch chuyển mục tiêu vào giữa nhiều model khác". Cùng lối
  `drSafeSpot()` của Doraemon, chỉ khác là ở đây càng SÁT RÌA càng tốt.
- Đo được: đứng cách 40px bị đẩy ra **247px**, đứng cách 279px bị kéo về **240px** — cả hai
  đều bám mốc 255 và **không bao giờ vượt quá**.
- Vòng đời: méo không gian `gs(.3)` → biến mất và hiện ra chỗ mới → `gs(.3)` nữa. Cả chiêu
  đúng **0.6 giây**, không dài hơn.
- **Chỉ dời `x/y`**, không đụng tới `alive`, `hp` hay `G.fighters` — mục tiêu không bao giờ
  bị coi là đã chết hay đã rời trận, nên **thanh máu và tên vẫn hiện bình thường**.
- Hiện ra: **10 dmg**, **choáng 1 giây**, và **Shamac Weakness 4 giây**.
- **Shamac Weakness ăn vào `f.dmgOut`** (trong `beaStatus`) nên nó phủ được đòn thường, chiêu,
  ultimate **và cả sát thương duy trì do mục tiêu tạo ra** — đúng bản mô tả. Nó **không đụng
  tới hồi máu hay khiên** vì `dmgOut` chỉ nhân vào đúng lúc gây sát thương. **Không cộng
  dồn**: `beaWeaken()` GÁN chứ không cộng.
- Cắt ngang mấy chiêu cần đứng đúng chỗ (`drInterrupt(e)`), nhưng **projectile đã bắn ra thì
  vẫn bay tiếp**.
- Ba người trở lên: chọn **kẻ địch gần nhất lúc bắt đầu chiêu**, chỉ **một** người bị dịch
  chuyển, không ảnh hưởng ai đứng gần chỗ xuất hiện.

**3 · Murak** — mỗi `gs(7)`, tự dùng lên bản thân, **dùng được cả khi đang bị khống chế**.
- **Chạy trong `beatriceTick()` chứ KHÔNG chạy trong `think()`**: `think()` không được gọi
  khi `f.stun>0`, mà chiêu này bắt buộc phải phá được choáng ngay lập tức. Đúng cái bẫy của
  Mini Rasengan và cú thoát góc của Tsubasa.
- **TUYỆT ĐỐI đừng gác `beatriceTick()` ở `f.lock`** — đây là một **lỗi thật đã sửa**: Frozen
  của Superman đặt `lock` mỗi nhịp trong `supStatus()`, mà `statusTick()` chạy TRƯỚC
  `beatriceTick()` trong cùng vòng duyệt, nên gác ở `lock` thì bị đóng băng là cô đứng chịu
  trận tới hết — đúng cái thứ Murak sinh ra để phá. Giờ gác ở `introOn()`: chỉ **màn ra mắt**
  của ai đó mới chặn được, vì lúc đó cả sàn đứng chờ.
- `beaCleanse()` rũ sạch: choáng, đóng băng, trói (kể cả **dải bóng Shadow-Neck Bind** — nó
  nằm trên NGƯỜI KẾT ẤN chứ không nằm trên nạn nhân, nên phải đi tìm `o.bind.e===f` rồi cắt
  từ đầu bên đó), quật ngã, hất tung (`kbx/kby`), làm chậm mọi loại, `lock`.
- **KHÔNG xoá**: cháy, độc, chảy máu, sát thương duy trì, debuff giảm sát thương, dấu, hoán
  đổi thân xác. Đừng nới danh sách ra.
- Rồi **Murak Protection 3 giây**: **miễn khống chế 100%** (`stunFx()` return false ngay) và
  **giảm 20% sát thương nhận vào**. Vẫn đi lại, vẫn đánh thường, vẫn tung chiêu khác được.
- **`beaStatus()` chạy CUỐI trong `statusTick()`** và rũ sạch lại mỗi nhịp, kèm
  `moveMul=Math.max(moveMul,1)` — miễn khống chế 100% nghĩa là gạt sạch mọi thứ làm chậm mà
  `gnStatus` / `drStatus` / `supStatus` vừa nhân vào. Nhưng phải **giữ lại quãng khoá của
  CHÍNH chiêu cô đang tung** (`const own=(f.beaShamac||f.beaUlt)?f.lock:0`), không thì Al
  Shamac và El Minya tự cắt ngang mình.
- **Giảm sát thương NHÂN chồng chứ không cộng phần trăm** — `f.dmgTake *= BEA.murakRes`, và
  `dmgTake` là lớp nhân cuối cùng trong `hurt()`. Đo được: đòn 100 raw ⇒ **80**; cộng thêm
  Shamac Weakness của chính kẻ tấn công ⇒ **64**, không phải 60 (cộng phần trăm) và không bao
  giờ gộp lại thành miễn thương 100%.

**4 · E.M.T** — mỗi `gs(7)`, kén kết giới sống `gs(2)`.
- **Chặn 100% sát thương**: `hurt()` gọi `beaEmtBlock()` và return false. Lượng thật sự nhận
  vào là **0**, kể cả sát thương duy trì. Cô **vẫn bị chọn làm mục tiêu**, đòn vẫn tính là ĐÃ
  TRÚNG kết giới, và **KHÔNG** kèm miễn khống chế — choáng vẫn dính dù dmg thì không.
- **Chỗ chặn nằm ĐÚNG một nơi trong `hurt()`**: SAU khi đã nhân hệ số sát thương của kẻ tấn
  công (`src.dmgOut`, tức Shamac Weakness tính trong đó) nhưng **TRƯỚC** mọi lớp giảm sát
  thương của chính cô. Người dùng chốt riêng chỗ này, và nó cũng là lý do phần phản lại tính
  từ con số **đã bị Shamac Weakness cắt**.
- **Phản lại 20% chỗ VỪA CHẶN** (`E.M.T Reflection`), thành sát thương vùng lên **mọi kẻ địch
  trong 2.5R**. Kẻ tấn công đứng ngoài bán kính đó thì **không dính**; người khác đứng gần thì
  vẫn dính dù không phải người vừa đánh. Đo được: chặn 50 ⇒ 10, chặn 100 ⇒ 20, chặn 200 ⇒ 40,
  đứng ngoài 2.5R ⇒ 0.
- **Vì kết giới chặn sạch nên lượng thật nhận vào là 0 — đừng lấy con số 0 đó để tính phản
  đòn.** `beaEmtBlock()` nhận `amt` trước khi vứt bỏ chính vì thế.
- **Mỗi lần dmg tính riêng**: một đòn nhiều nhịp, hay mỗi tick độc, đi qua `hurt()` riêng nên
  cũng phản riêng. Đo được: tick độc 5 dmg ⇒ phản đúng 1 dmg.
- **Đòn phản đi bằng `kind='reflect'`** và **không bao giờ được phản lại lần nữa** — hai
  Beatrice đối đầu nhau thì bên kia vẫn CHẶN được nhưng không phản, nên không có vòng lặp vô
  hạn. `reflect` cũng không cộng dồn tỉ lệ né của Shikamaru (cùng họ với `big`), không chí
  mạng, không choáng, không làm chậm.
- Hết 2 giây thì kén vỡ thành hạt sáng rồi biến mất: **không gây thêm sát thương** và
  **không để lại khiên nào**.
- Kén **di chuyển cùng cô**, không đứng lại chỗ kích hoạt (`drawBeaEmt()` đọc `f.x/f.y` mỗi
  khung hình). Mỗi lần chặn được một đòn thì mặt kén gợn sóng (`f.beaRipple`).

**5 · El Minya** — mỗi `gs(8)`, **ba mũi tinh thể TÁCH BIỆT** chứ không phải một luồng năng
lượng liền mạch.
- Mốc bắn: **0.65 / 0.90 / 1.15 giây người chơi** (`ultAim` + `ultGap`). Đo được đúng ba mốc đó.
- **50 dmg mỗi mũi**, tổng trực tiếp **150**. Mỗi mũi có collision riêng, bay thẳng, **không
  dò tìm**, và **dừng lại ở fighter ĐẦU TIÊN nó chạm** — không xuyên qua ai để đi tìm mục
  tiêu ban đầu, nên người vô tình đứng chắn đường vẫn ăn đủ dmg + Minya Slow + Mana Erosion.
- **Mỗi mũi ngắm vào chỗ mục tiêu đang đứng ĐÚNG LÚC nó rời tay**, nên mũi thứ hai và thứ ba
  né được.
- Mục tiêu gục giữa loạt ⇒ mấy mũi còn lại chuyển sang kẻ địch gần nhất còn sống; không còn
  ai hợp lệ ⇒ mũi chưa bắn bị huỷ.
- **Minya Slow** −50% tốc chạy trong 3 giây, **không cộng dồn phần trăm**: trúng cả ba mũi
  vẫn đúng −50% chứ không phải −150%. `beaSlowOn()` GÁN chứ không cộng; hệ số nhân vào
  `moveMul` trong `beaStatus()`.
- **Mana Erosion** cộng dồn tới **3 stack**, mỗi stack **2 HP mỗi giây người chơi** trong 3
  giây, **mỗi stack có đồng hồ riêng và hết hạn riêng**. Đủ ba stack là **6 HP/s**, tổng DoT
  **18**, nên trần của một lượt El Minya là **150 + 18 = 168**.
  - Sát thương đi đường `dots[]` của engine, mà `dots[].dps` tính theo **giây trong trận** —
    nên hằng số khai là `2*RT` (mục 1). Không chí mạng, không theo phần trăm máu, không kích
    hoạt cửa choáng của Minya.
  - **Số stack ĐẾM THẲNG TỪ `f.dots`** (`beaEroStacks()`), đừng nuôi một mảng song song.
    Có tới năm chỗ trong game xoá sạch `dots` một lượt — phân cảnh gọi Goku / Gohan, CHANGE
    của Ginyu, Time Machine của Doraemon, Ayanokouji rời sàn — mà mảng song song thì không
    ai xoá theo. Lệch nhau là hiện sai số stack rồi **từ chối cộng stack mới** vì tưởng đã
    đủ trần. Đếm từ `dots` thì mỗi stack tự có `left` riêng và tự hết hạn riêng trong
    `step()`, đúng luật "mỗi stack có thời gian tồn tại riêng" mà không phải nuôi thêm
    đồng hồ nào.
  - Quá trần thì **làm mới stack cũ nhất** chứ không đẩy thêm cái thứ tư. Đo được: bắn mũi
    thứ tư vẫn đúng 3 stack.
- Dáng ra chiêu **sống hết chiêu** (`setPose` đặt lại mỗi nhịp trong `beaUltTick`), đúng luật
  đã chốt cho Ginyu Beam.
- Choáng trong `gs(.4)` đầu ⇒ huỷ, chờ 50% hồi chiêu (`drInterrupt` chỉ cắt khi `fired===0`);
  bắn mũi đầu rồi thì mấy mũi sau vẫn ra.

**Thứ tự tự dùng chiêu — Murak → E.M.T → Al Shamac → El Minya → Minya.** Không phải xếp hàng
đợi gì cả: `beatriceTick()` (Murak, E.M.T) chạy trong vòng duyệt fighter, còn `think()` (Al
Shamac, El Minya, Minya) chạy ở vòng SAU đó trong cùng một nhịp `step()`. Thứ tự tự đúng.
Mọi chiêu **tự bung ngay khi hồi chiêu xong**, không giữ lại chờ thời cơ. Đòn thường tạm dừng
trong lúc chạy animation chiêu nhưng **hồi chiêu `s1` vẫn trôi** (vòng trừ `f.cds` chạy cho
mọi người mỗi nhịp) — không bao giờ reset.

**AI — `beaVec()`** thay hẳn nhánh `ranged` của `aiVec()`. Ngoài `5R` thì tiến vào cho tới khi
bắn được; trong tầm thì giữ `BEA.want = 4.2R = 214` và đánh xa. **Bị áp sát thì cô KHÔNG tự
chạy trốn** — người dùng chốt: Al Shamac mới là thứ đẩy đối phương ra. **Không cho bay lượn
quanh sàn để né đòn**: quãng bay nhẹ của Murak chỉ là hiệu ứng nhìn (`f.beaLift`, đi chung
đường độ cao với Take-copter và `supAir`), và cô **không bao giờ tự dịch chuyển bản thân**.

> **Đo hành vi AI phải dùng đối thủ ĐỨNG YÊN.** Đo với ChiChi đang lao vào thì trung vị
> khoảng cách ra 77px — đó là hành vi của ChiChi chứ không phải của cô, và bản mô tả nói rõ
> cô không được tự chạy trốn. `t_beatrice.js` vì vậy ghim chân đối thủ ở 440px rồi mới đo.

### Đợt NERF — đọc trước khi đụng vào bất kỳ con số nào của cô

Bản đầu **quá mạnh, gần như không ai hạ nổi**. Người dùng báo: *"hiện tại beatrice quá mạnh,
cần giảm sức mạnh gấp"* và *"test k ai win đc"*. Đo bằng `tools/t_bea_balance.js` (16 trận,
hai lượt mỗi đối thủ): **thắng 15/16 = 94%**, trung bình còn **46% máu** lúc thắng — riêng
Shikamaru và Doraemon thì cô kết trận với **85% / 86% máu**, tức cả bộ chiêu của họ gần như
không chạm được vào người.

**Ba thứ chồng lên nhau mới ra chuyện đó, và cả ba đều phải cắt:**

| Vấn đề | Bản đầu |
|---|---|
| E.M.T chặn 100% sát thương | **28.6%** trận đấu cô không ăn một điểm nào (2s mỗi 7s) |
| Murak miễn khống chế | **42.9%** — cộng lại **~71%** thời gian cô có lớp bảo vệ nào đó |
| Sát thương duy trì | **38 DPS** ⇒ hạ 800 máu trong **21 giây** |
| Al Shamac mỗi 5s | cận chiến mất **36%** mỗi chu kỳ chỉ để đi bộ lại vào tầm |

> **Chỗ chí mạng là hai chiêu phòng thủ TỰ BUNG đúng nhịp hồi chiêu** (luật "mọi skill phải
> tự dùng ngay khi hồi chiêu xong"). Nghĩa là quãng miễn thương đó **được bảo đảm, không bao
> giờ lỡ nhịp** — khác hẳn một chiêu phòng thủ do người chơi bấm tay. Vì vậy cắt **thời lượng
> và nới hồi chiêu** ăn thua hơn hẳn cắt mỗi con số sát thương.

> **ĐƯỜNG CONG RẤT DỐC — ghi lại cho khỏi mò lại từ đầu.** Ba lượt đo thật:
>
> | | DPS duy trì | Uptime bảo vệ | **Tỉ lệ thắng** |
> |---|---|---|---|
> | bản đầu | 38 | 71% | **94%** |
> | cắt quá tay | 17 | 21% | **13%** |
> | nới lại | 27 | 36% | **81%** |
> | **chốt** | **21** | **27%** | **38%** |
>
> Hai bài học:
> 1. **Cắt cả sát thương LẪN quãng miễn thương cùng lúc thì hai thứ NHÂN vào nhau**, không
>    phải cộng — lượt đầu rơi thẳng từ "không ai hạ nổi" sang "không hạ nổi ai" (thua trắng
>    0–2 trước kono · chichi · tsubasa · shika · suzune · superman).
> 2. **Khoảng giữa rất hẹp**: từ 17 DPS/21% lên 27 DPS/36% là tỉ lệ thắng nhảy 13% → 81%.
>    Nới tay một nấc nhỏ là mạnh lại gần như cũ.
>
> Vì vậy: **chỉnh một nấc rồi ĐO LẠI bằng `node tools/t_bea_balance.js`**, đừng chỉnh theo
> cảm tính và đừng cắt hai mảng một lượt.

| | Bản đầu (94%) | Cắt quá tay (13%) | Nới lại (81%) | **Chốt** |
|---|---|---|---|---|
| `emtT` / `emtCd` | 2s mỗi 7s (**28.6%**) | 1.2s/16s (7.5%) | 1.5s/11s (13.6%) | **1.35s mỗi 13.5s (10%)** |
| `emtRefl` | 20% | 10% | 15% | **12%** |
| `murakT` / `murakCd` | 3s mỗi 7s (**42.9%**) | 1.8s/13s (13.8%) | 2.2s/10s (22%) | **2s mỗi 11.5s (17.4%)** |
| `murakRes` | −20% dmg nhận | −10% | −15% | **−12%** |
| `shamacDmg` / `shamacCd` | 10 dmg mỗi 5s | 8 mỗi 10s | 10 mỗi 7s | **9 mỗi 8.5s** |
| `ultDmg` / `ultCd` | 50/tia mỗi 8s (150) | 30 mỗi 13s (90) | 40 mỗi 10s (120) | **34/tia mỗi 11.5s (102)** |
| `eroDps` | 2 HP/s (ba stack 6) | 1 (ba stack 3) | 1.5 (4.5) | **1.2 HP/s (ba stack 3.6)** |
| `minyaDmg` | 15 | 9 | 12 | **10** |
| `minyaStunOdds` | 20% | 12% | 15% | **13%** |

Kết quả: sát thương duy trì **38 → ~21 DPS** (hạ 800 máu mất ~38 giây thay vì 21), quãng có
lớp bảo vệ **71% → ~27%** — đúng điểm giữa của hai mốc ĐÃ ĐO 13% và 81%. Đúng chất một pháp
sư khống chế: thắng chậm bằng cách bào mòn, chứ không phải bằng cách không ai đụng được vào mình.

**Đo lại bản chốt: thắng 6/16 = 38%**, trung bình còn 40% máu lúc thắng:

| Đối thủ | Thắng–Thua | | Đối thủ | Thắng–Thua |
|---|---|---|---|---|
| Konohamaru | 0–2 | | Horikita | 2–0 |
| ChiChi | 0–2 | | Ginyu | 2–0 |
| Tsubasa | 0–2 | | Doraemon | 2–0 |
| Shikamaru | 0–2 | | Superman | 0–2 |

Năm người hạ được cô, ba người thì chưa. **Shikamaru từ 0–2 (cô còn 85% máu) giờ thành
0–2 NGƯỢC LẠI** — đúng chỗ người dùng kêu nhất. Doraemon vẫn là đối thủ khó nhất của cô
(2–0, cô còn 70%/33% máu): anh không có đòn nào xuyên được quãng E.M.T, còn cô thì cứ ném
anh ra rìa tầm.

> **38% là hơi dưới mốc 50% lý tưởng, và đó là CỐ Ý.** Đường cong quá dốc (13% → 81% chỉ
> trong một nấc nhỏ) nên nhích lên tí nữa là rất dễ vọt lại quá mạnh. Thà để hơi yếu một
> chút còn hơn quay lại cảnh "không ai win đc". Muốn nhích lên thì **chỉ đụng vào SÁT
> THƯƠNG** (`minyaDmg` / `ultDmg`), đừng đụng vào `emtT` / `murakT` — chính hai con số đó
> mới là thứ làm cô không ai đánh trúng, và cũng là thứ chơi vào thì khó chịu nhất.

> **`shamacWeak` giữ nguyên −20%** — đó là debuff đặt lên ĐỊCH chứ không phải lớp bảo vệ của
> cô, và nó chính là phần "khống chế" trong bộ chiêu. Cắt nốt chỗ đó là mất luôn tính cách
> nhân vật. **Máu vẫn 800** như cả bảng (mục 2), đừng đụng vào.

> **Nerf thì phải KÉO BIỂU ĐỒ SỨC MẠNH XUỐNG theo**, đúng luật đã chốt cho mấy đợt buff
> trước (mục 2g): `dmg 52→38 · dur 82→62 · as 36→31 · cc 86→69 · uti 84→70 · con 80→72 ·
> cmb 34→29`, và thanh chỉ số `spd 3→2 · def 4→3`.

> **TỐC ĐÁNH và ỔN ĐỊNH là hai trục S — ĐỪNG HẠ.** Chốt cuối:
> `dmg 38 · dur 62 · mob 44 · **as 88** · rng 76 · cc 69 · uti 70 · **con 90** · cmb 29`.
>
> *Đã đi sai một lượt, ghi lại cho khỏi lặp:* tôi đọc nhầm câu *"atk speed vs consistency cao
> lắm đấy"* thành "hai cái đó chấm cao quá" rồi hạ xuống `as 20 · con 46`. Người dùng bác
> ngay: *"chỉnh lại là as với cons lên cao nữa á, sao lại hạ — 2 cái đó của beatrice là S"*.
> Ý họ là hai trục đó **vốn đã cao trong thực tế**, chấm 31/72 mới là thấp.
>
> - **`as` = 88.** Không phải nhịp bắn to, mà là nhịp bắn **KHÔNG BAO GIỜ HỤT**: Minya nổ đều
>   một mũi mỗi giây người chơi, không cần vào tầm tay, không có combo để bị bỏ dở, và
>   **không một hồi chiêu nào của cô đi qua `cm()`** (`f.cds.s1 = BEA.minyaCd`,
>   `s2 = BEA.shamacCd`, `s4 = BEA.ultCd` đều là hằng số thô). Nghĩa là mọi thứ bóp tốc thi
>   triển trong game — aura ngơ ngác của Ginyu, Disoriented của Doraemon, Chilled của
>   Superman, ghì chân của Kamehameha — **không chạm được vào cô một nhịp nào**; cả bảng
>   không ai có chỗ đó. Ngay cả lúc đang choáng, Murak và E.M.T vẫn tự bung vì chúng chạy
>   trong `beatriceTick()` chứ không chạy trong `think()`.
> - **`con` = 90, cao nhất bảng.** Mọi chiêu **tự bung ngay khi hồi chiêu xong**, không giữ
>   lại chờ thời cơ, không phụ thuộc ngưỡng máu (khác Tsubasa / Horikita / Shikamaru), không
>   phải nuôi thanh tiến trình (khác nộ khí của Konohamaru hay bàn thắng của Tsubasa). Quãng
>   miễn thương của E.M.T và Murak vì vậy **được bảo đảm, không bao giờ lỡ nhịp** — chính chỗ
>   đó làm cô mạnh tới mức phải nerf (bảng ngay trên).
>
> **Đụng vào `minyaCd` hay đổi mấy hồi chiêu sang `cm()` thì nhớ chấm lại hai trục này.**
> `t_beatrice.js` (mục 9) đọc qua `pwGrade()` chứ không ghim con số, nên hạ xuống dưới bậc S
> là test đổ.

> **Chữ effect của Beatrice thu nhỏ THÊM một nấc — `BEA_FX = .72`.** Người dùng: *"cast skill
> thì mấy chữ effect của beatrice nhỏ lại"*. Bộ chiêu của cô có tới NĂM chiêu tự bung đúng
> nhịp hồi chiêu, mỗi chiêu lại đẩy ra **HAI dòng** — tên hiệu ứng cộng một dòng số liệu
> (`SHAMAC WEAKNESS` + `−20% DAMAGE DEALT 4s`) — nên chỉ mình cô là chữ chồng lên nhau kín
> cả sàn.
>
> - Cờ **`beaFx:true`** gắn vào từng float, `floatScale()` nhân thêm `BEA_FX` (mục 6c). Muốn
>   chỉnh nữa thì sửa đúng con số đó, đừng đi đổi `sc` của từng chỗ.
> - Băng-rôn tên chiêu (`AL SHAMAC!` / `EL MINYA!`) đi qua `hurt()` nên cờ đặt ngay tại chỗ
>   dựng nhãn `crit`, và **đọc HỒN chứ không đọc thân xác** (`(src.gnSoul||src.key)`): sau cú
>   CHANGE của Ginyu thì chiêu đi theo hồn, chữ cũng phải đi theo.
> - Kèm theo một **sàn cỡ chữ `FX_MIN = 8` px** cho mọi băng-rôn, cùng lối `bar()` tự thu nhãn
>   cho vừa lòng thanh: mấy dòng phụ vốn đã nhỏ sẵn (`sc` .58~.62) mà nhân thêm một nấc nữa thì
>   rơi xuống 6.9px và mờ tịt. **Kẹp trong `floatScale()` chứ đừng kẹp ở chỗ vẽ** — `k` còn
>   dùng cho cả bề dày viền, tách ra là chữ nhỏ mà viền vẫn dày, nhìn bết thành một cục.
> - Đo được: `SHAMAC WEAKNESS` 13.0 → **9.4px**, `AL SHAMAC!` 12.1 → **8.7px**, mấy dòng phụ
>   9.3 → **8.0px** (chạm sàn). Chữ của tám người kia **không đổi một pixel nào** — đo trong
>   một trận thật: 12 dòng của cô được gắn cờ, còn `BOOM!` / `RASENGAN!` / `MASENKO ×3` thì không.

> **Đo lại sau mỗi lần chỉnh bằng `node tools/t_bea_balance.js`** chứ đừng chỉnh theo cảm
> tính. Nó chạy Beatrice với cả tám đối thủ và in ra tỉ lệ thắng kèm **máu còn lại lúc
> thắng** — con số thứ hai mới nói lên trận đó sát nút hay một chiều.

**Ăn mừng / gục ngã.**
- Thắng: đóng quyển sách, **khoanh hai tay**, quay nhẹ mặt sang một bên với vẻ kiêu kỳ. Cánh
  cửa Forbidden Library hiện phía sau (`drawBeaWin()`), cô nhìn lại sàn đấu rồi bước vào.
  Băng-rôn ghi **`WINNER` + `BEATRICE WINS!`**, chữ dưới thanh máu vẫn là `Beatrice`.
  **Đừng cho cô cười tươi hay ăn mừng năng động** — giữ đúng tính cách lạnh lùng, kiêu kỳ.
- Thua: dáng `down` — quyển sách rơi khỏi tay và nằm dưới đất, cô lùi lại, quỳ xuống rồi ngã
  sang một bên. Mấy hạt ma thuật tím quanh người nhạt dần rồi tắt. **Không máu me, không hiệu
  ứng tử vong.**

**Ô dán ảnh riêng**: `minya` · `shamac` · `murak` · `emt` · `elminya` · `win` · `down`, cộng
`idle/hurt/injured`. Thiếu ảnh thì lùi về ô gần nghĩa nhất (`minya` ↔ `elminya`, `murak` ↔
`emt`, `shamac` → `minya`).
**Ô dán tiếng**: nhóm riêng `Beatrice` trong `SFX_GROUPS`, mười ô — `bea_door`, `bea_book`,
`bea_minya`, `bea_shamac`, `bea_warp`, `bea_murak`, `bea_emt`, `bea_reflect`, `bea_elminya`,
`bea_down`. Mỗi ô có `case` riêng trong `synth()`, đúng luật ở mục 4. **Trúng đòn thì mượn
thẳng `sfx('hit')`**, đúng lối đã chốt cho Horikita / Ginyu / Doraemon / Superman — đừng dựng
ô mới.

Nút thử tay: `#testBeaShamac`, `#testBeaMurak`, `#testBeaEmt`, `#testBeaUlt`.
Kiểm bằng `node tools/t_beatrice.js`.

> **Chỗ đã tự quyết, nói rõ để sau này khỏi cãi nhau:**
> - **R = 51** suy ra từ hộp thân **34×96** ở tư thế đứng. Bản mô tả nói cách ĐO chứ không nêu
>   con số, nên hộp thân là chỗ tôi tự chốt (bỏ tóc, váy, sách, hiệu ứng đúng như họ dặn).
>   Muốn đổi tầm đánh thì sửa `BEA_BODY_W` / `BEA_BODY_H`, đừng ghim số 255 vào chỗ khác.
> - **Hằng số thời gian hiểu là giây NGƯỜI CHƠI** rồi bọc `gs()`, đúng lối mọi nhân vật mới —
>   đó là con số người chơi đọc được trên bảng kỹ năng.
> - **E.M.T cũng tự dùng ngay khi hồi chiêu xong dù đang bị choáng** (nó nằm trong
>   `beatriceTick` cạnh Murak). Bản mô tả không nói nó phá được khống chế, nhưng có nói mọi
>   chiêu phải tự bung ngay khi hồi xong và hai chiêu tự dùng lên bản thân không cần địch
>   trong tầm — dựng một lớp kén thì không cần cử động. Muốn khắt khe hơn thì dời nhánh
>   `cds.s5` sang `think()`.
> - **`BEA.want = 4.2R`** là quãng cô muốn giữ khi mục tiêu đã ở trong tầm; bản mô tả chỉ nói
>   "dừng lại và tấn công từ xa" chứ không nêu con số.
> - **Hai câu trong bản mô tả đá nhau về Mana Erosion và phản đòn.** Một chỗ nói *"Damage
>   theo thời gian của Mana Erosion không kích hoạt phản damage"*, chỗ khác lại nói thẳng
>   *"Nếu một hiệu ứng poison gây 5 damage mỗi giây, mỗi tick bị chặn sẽ phản lại 1 damage"*.
>   Tôi lấy **câu cụ thể về E.M.T**: mỗi nhịp sát thương duy trì bị kết giới chặn đều được
>   phản lại riêng. Câu kia hiểu là Mana Erosion không tự nó kích hoạt mấy hiệu ứng ăn theo
>   "on hit" của người mang nó — mà trong game này thì vốn không có hiệu ứng nào như vậy.
> - **Bản mô tả nói ultimate bị huỷ khi "knockdown, silence hoặc bị đánh bại"** cắt ngang sau
>   mũi đầu. Engine này không có knockdown hay silence tách riêng khỏi `stun` — cú quật ngã
>   của Meteor Strike cũng đi qua `stunFx` như mọi cú choáng khác. Nên tôi lấy đúng cái luật
>   nêu rõ ràng: **choáng trong `ultBreak` giây đầu thì huỷ, bắn được mũi đầu rồi thì loạt
>   bắn cứ chạy tiếp**. `beatriceTick()` nằm trong vòng duyệt fighter nên nó không bị `stun`
>   chặn, đúng như bản mô tả muốn.

> **Đo bước chân của cô phải TÁCH HAI CHẶNG.** Gộp chung một cửa sổ ngắn là đo nhầm cả quãng
> đang chạy tới: đặt địch ở 440px rồi đo ngay 9 giây đầu thì đỉnh ra 291px trên tầm 255, mà
> lúc đó cô vẫn đang đi vào. Đo đúng thì phải chờ cô tới nơi rồi mới lấy mẫu — `t_beatrice.js`
> đo chặng ĐI VÀO trước (mất bao nhiêu nhịp để kéo mục tiêu vào trong 5R), rồi mới đo chặng
> ĐỨNG ĐÁNH: ổn định thì cô giữ **185~215px**, không bao giờ vượt 255.

> **Vector của `beaVec()` được CHUẨN HOÁ trong `step()`** rồi mới nhân tốc chạy, nên mấy con
> số trong đó chỉ là TRỌNG SỐ bỏ phiếu — hướng của TỔNG mới quyết định đi đâu. Vì vậy lúc
> sắp trôi ra khỏi tầm thì lực kéo vào phải ÁP ĐẢO (3.4) và đám nhiễu phải tắt bớt (×0.25):
> để lực kéo 1.15 ngang ngửa tổng nhiễu 1.15 là cô trôi hẳn ra ngoài tầm rồi đứng đó không
> bắn được ai.

### Satoru Gojo

Gojo là `Mage · Controller · Mid-range – Space Control – Burst`. Mọi con số nằm trong
`GOJO`; thời gian người chơi đi qua `gs()`. Không khai HP trong `GOJO`: `mkChar()` luôn đọc
`HP.gojo`, mặc định bằng `HP_STD`, để màn chọn có thể chỉnh Maximum HP như các đấu thủ khác.

- `Infinity` là một pool dùng chung đúng 2 charge. Mỗi direct hit tiêu một charge và khiến
  `hurt()` trả `false`, nên phần stun/slow/knockback theo sau cũng không được gắn. DoT,
  ground damage, true damage, sure-hit Domain, Body Swap, Time Manipulation và explicit
  bypass không đi qua lớp chặn này. Sau hit gần nhất chờ 3 giây, rồi mỗi 5.5 giây hồi một.
- `Six Eyes` dùng `gojoTarget()` để chỉ chọn đấu thủ thật gần nhất; summons, clone và
  afterimage không bao giờ thành mục tiêu. Blue/Red/Purple truyền accuracy multiplier vào
  `hurt()`, không biến nó thành auto-dodge, hồi máu hay giảm cooldown.
- `Limitless Combat` là basic 16/16/24 ở nhịp 0.75 giây. Mỗi hit trúng gây 0.25 giây hit stun;
  hit thứ ba còn kéo nhẹ mục tiêu, nhưng basic không hồi Infinity.
- `Blue` chốt một điểm không gian, sau 0.55 giây kéo tối đa 2 địch; main 50, secondary 26,
  stun 0.6 giây. Cả cast chỉ hồi đúng một charge nếu có ít nhất một hit thật sự trúng.
- `Red` và `Purple` bay thẳng theo góc đã chốt, không homing. Red dừng ở người đầu tiên.
  Purple tiêu sạch charge ngay lúc bắt đầu, khoá hồi tự nhiên 4 giây, xuyên tối đa hai
  fighter (135 / 81) và bỏ qua 30% damage reduction.
- `Unlimited Void` gây đúng 0 damage. Chỉ người trong bán kính lúc Domain hình thành nhận
  `Information Overload` 2.5 giây; sau đó `Overwhelmed` 4 giây (−50% move, −40% attack/cast).
- AI ưu tiên Domain → Purple → Red → Blue → basic, nhưng di chuyển bằng waypoint, strafe
  và jitter trong dải mid-range. Hết Infinity không làm AI chạy trốn hoặc giữ Blue lại.
- `gojoVector()` giữ tóc trắng, blindfold và đồng phục đen nguyên vẹn cả lúc thấp máu.
  Blindfold chỉ kéo xuống trong Unlimited Void rồi trở lại; defeat không máu me.
- Toàn bộ tên, role, skill, buff/debuff, gauge, banner và log riêng của Gojo là tiếng Anh.

Kiểm riêng bằng `node tools/t_gojo.js`.

### Tanjiro Kamado

Tanjiro là `Swordsman · Melee – Pursuit – Finisher`. Mọi con số nằm trong `TAN`; thời gian
được viết theo giây người chơi qua `gs()`. HP mặc định là `HP.tanjiro = HP_STD`, còn
`mkChar()` mới chụp giá trị hiện hành vào `hp/maxHp`. **Không đặt một con số Maximum HP
riêng trong `TAN`, `CHARS.tanjiro` hay logic Demon Slayer Mark.**

- Màn vào sân đúng 1.5 giây: 0–0.5 chạy vào, 0.5–1 rút Black Nichirin Sword, 1–1.5 hạ
  trọng tâm. `introOn()` và `tanjiroTick()` giữ cả sàn đứng chờ, không ai gây damage.
- `Opening Thread`: 8 giây một lần, đánh dấu địch gần nhất 3 giây. `hurt()` chỉ tiêu thụ
  sau mọi cửa invulnerability/E.M.T; cú kiếm đầu trúng nhận +15 và chỉ xuyên 20% phần
  giảm damage. Multi-hit cũng chỉ ăn đúng một lần. Sợi trắng chỉ là lớp vẽ nối kiếm–địch.
- Basic là 22/22/36 = 80, nhịp 0.8 giây; hit ba là Water Surface Slash, hất nhẹ và hit
  stun 0.55 giây. Water Wheel 75/9 giây là cú lao thẳng có chỉnh hướng rất nhẹ, hất 0.85
  giây; trượt thì khựng 0.5 giây. Constant Flux là 18/22/26/30/34 = 130, cooldown 14 giây; bị cắt thì
  không bù hit, hit cuối stun 1.1 giây. Dragon Sun Halo là 3×35 = 105, cooldown 13 giây,
  hit cuối stun 0.9 giây và được đổi mỗi hit sang người đứng gần đường chạy. Ultimate giữ
  damage 210, cooldown 28 giây và hit cuối knockdown 1.4 giây.
- Di chuyển thường của AI đi qua đúng nhánh melee chung trong `aiVec()` như ChiChi: lúc
  áp sát, lúc lượn quanh cự ly đánh, lúc đi theo waypoint/jitter ngẫu nhiên. Tanjiro không
  có vector di chuyển riêng. Water Wheel chỉ được cân nhắc khi còn xa và sau một nhịp chờ
  riêng ngẫu nhiên 3.5–6 giây, ngoài cooldown 9 giây. Trong tầm tay, 72% quyết định mới
  bắt đầu bằng basic; một khi đã chém hit đầu thì AI buộc hoàn thành đủ combo ba hit trước
  khi xét Breathing Form. Constant Flux chỉ mở ở gần, Dragon Sun Halo ở tầm gần-vừa. Hết
  một form hoặc đủ ba basic thì `tanResetRhythm()` tạo khoảng nghỉ quyết định 0.55–1.05 giây.
- Demon Slayer Mark nổ **lần đầu khi `hp < maxHp * .40`**, animation 0.8 giây, không hồi
  HP: +25% chạy, +25% nhịp basic, +25% hồi chiêu, 25% kháng hiệu ứng và 20% kháng lực
  đẩy. Sau đó mới mở `Sun Breathing: Thirteenth Form`. Khi Mark đang bật, mỗi 3 đòn kiếm
  **không phải Ultimate** trúng đích kích hoạt `Hinokami Rhythm`: thêm 18 damage và bớt
  0.75 giây khỏi cooldown còn lại của Water Wheel / Constant Flux / Dragon Sun Halo.
  Ultimate không tích nhịp này để chuỗi 12 hit không tự snowball.
- Ultimate tập trung 0.6 giây, chạy tổng 3.5 giây, 12 hit có tổng đúng 210, mục tiêu ra
  khỏi tầm thì hit trượt; không teleport. Đang tung chiêu chỉ giảm 50% damage và có 70%
  kháng hiệu ứng, không bất tử. Hit cuối knockdown 1.4 giây.
- Xong Ultimate, lưỡi kiếm đỏ 6 giây. Đòn kiếm chỉ dán `Regeneration Suppression` −60%
  hồi HP trong 5 giây (làm mới, không stack), tuyệt đối không cộng damage.
- `drawTanjiroFx()` chỉ vẽ vệt nước/đỏ-cam nối với đường kiếm, Mark heat và afterimage.
  Nó không đẩy gì vào `G.proj`, không chọn mục tiêu và không gây damage: rồng nước/rồng mặt
  trời không phải vật thể tự chiến đấu, Sun Breathing không để lại burn.
- Khi Ginyu đổi xác, active forms 2/3 có thể đi theo hồn như roster cũ; Opening Thread,
  Mark, Ultimate theo ngưỡng HP và Bright Red suppression đều tắt vì là nội tại thân xác.

Toàn bộ tên, role, skill, buff/debuff, gauge, banner và log riêng của Tanjiro là tiếng Anh ở
cả hai nhánh `vi/en`. Vector fallback giữ tóc đỏ sẫm, scar/Mark bên trái trán, Hanafuda,
đồng phục, haori caro xanh-đen và kiếm đen; không có Nezuko hay dạng Demon Tanjiro. Kiểm bằng
`node tools/t_tanjiro.js`.

---

## 2c. Ba chế độ đấu — 1v1, hỗn chiến, đánh theo đội

Chọn ở **đầu màn chọn nhân vật** (`.mTab`, ba nút `#mTabDuel` / `#mTabFfa` / `#mTabTeam`).
Biến trạng thái là `PMODE` (`'duel' | 'ffa' | 'team'`) cộng `ROSTERS` (`{ffa, t0, t1}`),
lưu lại chung khoá `cfg_picks` với hai ô A/B cũ. `G.mode` chụp lại `PMODE` lúc `newGame()`.

| Chế độ | Bao nhiêu người | Chia phe thế nào | Thắng khi nào |
|---|---|---|---|
| `duel` | đúng 2 | phe 0 và phe 1 | đối thủ về 0 máu |
| `ffa` | `FFA_MIN`–`FFA_MAX` = **3–6** | **mỗi người MỘT phe riêng** (`team` = số thứ tự) | chỉ còn **một người** đứng |
| `team` | **`TEAM_MIN_N`–`TEAM_MAX_N` = 2–4 ĐỘI**, mỗi đội `TEAM_MIN`–`TEAM_MAX` = **1–3** người, cả sàn không quá `TEAM_TOTAL` = **8** | mỗi đội một phe (0, 1, 2, 3) | chỉ còn **một đội** còn người |

> **Số ĐỘI cũng tuỳ chọn, không cắm cứng hai đội** (người dùng: *"theo team là tuỳ chọn
> team"*). `ROSTERS.teams` là **mảng các đội**, mỗi đội là một mảng khoá nhân vật; màn chọn
> có nút **+ Thêm đội** / **✕ Bỏ đội**. Vì hỗn chiến vốn đã chạy N phe nên ruột game không
> phải sửa gì thêm — `aliveTeams()`, `foeOf()`, `finish()` đều đã đếm theo số phe thật.
> *(Bản đầu chốt cứng hai đội `ROSTERS.t0` / `t1`; `loadSaved()` vẫn đọc được hai khoá cũ đó
> để ai đã lưu đội hình từ bản trước thì mở lại vẫn còn.)*

**Nhận ra ai cùng phe với ai.** Bốn đội trên sàn mà mỗi người vẫn giữ màu riêng của họ thì
nhìn không đoán ra được, nên dấu hiệu phe phải nằm **ngoài** người:
- `TEAM_TINT` / `teamTint(t)` cho mỗi đội một màu nhận dạng (xanh · đỏ · lục · vàng).
- **Viền thanh máu tô theo màu đội** — `bar()` nhận thêm tham số `edge`; đây là dấu hiệu
  đọc được chắc chắn nhất ở cỡ trong trận.
- Một vòng dưới chân theo màu đội trong `drawFighter()`. Vòng này hay bị **chính dòng tên
  đè lên** (dòng tên nằm ở `f.y+26`, ngay trên thanh máu), nên nó chỉ là dấu hiệu phụ —
  đừng bỏ viền thanh máu mà chỉ giữ mỗi cái vòng.
- **Vẫn không dán chữ nào lên sàn**, đúng luật đã chốt ở mục Horikita.

> **`duel` phải dựng ra ĐÚNG cùng một đội hình như bản cũ** — hai người, hai đầu sàn,
> `G.k`/`G.c` như cũ. Mọi test hiện có đi qua đường này, và `openGame()` trong `probe.js`
> bấm `#mTabDuel` trước khi chọn nhân vật để chắc chắn không dính đội hình lưu lại từ lần trước.

**Hỗn chiến cho mỗi người một phe riêng** chứ không dựng thêm khái niệm mới: mọi vòng
duyệt AoE trong game vốn đã lọc bằng `o.team===f.team`, nên chỉ cần đánh số phe khác nhau
là ai cũng đánh được ai mà không phải sửa một chiêu nào. Đánh đội thì ngược lại — vẫn hai
phe như cũ nên đồng đội tự động không đánh trúng nhau.

**Ai là đối thủ — `foeOf()` viết lại.** Không còn cắm cứng `G.k`/`G.c` nữa:
- `foeOk(f,o)` chỉ nhận **đấu thủ chính** (`!o.summon`) khác phe, còn sống, còn trong
  `G.fighters`. Đồng minh (Ayanokouji) và viện binh **không bao giờ** là "đối thủ theo phe"
  — họ chỉ bị nhắm vào qua khiêu khích, đúng ranh giới `foeOf` / `aimTarget` ở mục 2.
- Đối thủ **bám dính** trong `f.foe` chứ không tính lại mỗi khung hình; `step()` bốc lại
  người **gần nhất** sau mỗi **3~6 giây trong trận** (`f.foeT`). Không có chỗ bám dính này
  thì hai người đứng ngang nhau làm AI giật qua giật lại.
- Không còn ai sống thì trả về **người cuối cùng đã nhắm** — đúng như bản 1v1 cũ trả về xác
  đối thủ, nên mấy chỗ đọc thuộc tính của đối thủ sau khi trận xong không nổ.
- `defeat()` xoá `o.foe` của mọi người đang nhắm vào người vừa gục, để lượt sau bốc lại.

**`hurt()` không gọi thẳng `finish()` nữa mà gọi `defeat(t,src)`.** Ba hàm tách bạch:

| Hàm | Làm gì |
|---|---|
| `koFx(f)` | dáng ngã + hiệu ứng riêng của từng nhân vật (bảo bối rơi ra của Doraemon, dáng `ko` của Superman) rồi đẩy vào `G.kos` |
| `defeat(t,src)` | hạ một người: dọn `dash`/`bind`/`domain`, xoá `foe`/`tauntBy` trỏ vào họ, tiễn viện binh của họ, rồi **đếm phe còn sống**. Còn từ hai phe thì trận chạy tiếp; còn một phe thì gọi `finish()` |
| `finish(w)` | trận xong: băng-rôn, camera, dọn sàn |

- **`G.loserFx` (một người) đổi thành `G.kos` (MẢNG)** — hỗn chiến thì mấy người ngã ở mấy
  thời điểm khác nhau. Vòng đếm nhịp của nó dời **ra ngoài** khối `if(G.over)` trong `step()`,
  không thì người ngã giữa trận đứng chết trong tư thế dở dang.
- **Người cuối cùng ngã thì gọi `koFx` SAU `finish`**, vì `finish()` dọn sạch `G.fx`/`G.floats`.
  *(Bản cũ gọi ngược nên mấy bảo bối rơi ra của Doraemon và vòng sáng bị xoá ngay trong cùng
  một khung hình — lỗi thật, đã sửa luôn.)*

**Trùng nhân vật.** Đội hình cho phép chọn cùng một người nhiều lần. `mkChar(key,team,x,y,dup)`
nhận thêm số thứ tự bản sao: tên nối `DUP_SUFFIX` (`''`, `' II'`, `' III'`…), màu qua
`dupColor()` — bản đầu giữ màu người dùng chọn, bản thứ hai dùng đúng `C.alt` (**y hệt lối
"đấu gương" cũ**, nên 1v1 chọn trùng nhân vật vẫn ra đúng như trước), từ bản thứ ba trở đi
xoay tông màu `alt` thêm 57° mỗi bản (`hueShift`). `f.dup` giữ lại trên fighter để
`applyColors()` dựng lại màu mà không làm mất tông riêng của từng bản sao.

**Chỗ đứng lúc vào trận — `spawnSpots()`.** 1v1 giữ nguyên hai đầu sàn; **đúng hai đội** thì
hai hàng đối mặt nhau (đội 0 ở trên, đội 1 ở dưới) y như bản trước; **ba đội trở lên** thì
mỗi đội một góc trên vòng tròn, đồng đội dàn theo phương **tiếp tuyến** nên đứng túm lại
thành một cụm — đo được: quãng xa nhất trong cùng một đội vẫn nhỏ hơn quãng gần nhất sang
đội khác. Hỗn chiến thì đứng đều trên vòng tròn, bán kính `min(198, 118+n*24)`. Mọi điểm
đều clamp vào trong sàn.

**Chỗ khác phải đi theo:**
- `step()` không còn `const k=G.k,c=G.c` với năm vòng `for(const f of [k,c])`. Giờ là một
  mảng `MAIN=G.fighters.filter(f=>!f.summon)` chụp ở đầu nhịp — **chụp ra mảng riêng** vì
  mấy vòng bên dưới có thể đẩy thêm viện binh vào `G.fighters` giữa chừng.
- Vòng đi lại đọc `aimTarget(f)||foeOf(f)` thay cho `f===k?c:k`.
- `versusBox()` dựng băng-rôn qua `vsSegments()`: 1v1 là `A  VS  B`, đánh đội gom tên đồng
  đội bằng ` + `, hỗn chiến liệt kê hết bằng ` · `. Cả dải chữ **tự thu cỡ cho vừa bề ngang
  sàn** theo ba nấc: tên đầy đủ cỡ gốc → tên đầy đủ thu tới 0.62 → **đổi sang tên rút gọn**
  (`CHARS[key].short`, giữ hậu tố bản sao) rồi mới thu tiếp. Chỉ thu cỡ chữ thôi là không đủ:
  tám cái tên dài ở trận bốn đội vẫn làm hộp thò hẳn ra ngoài hai mép sàn — đo được đúng
  cảnh đó. **Ai đã bị hạ thì
  tên xám lại (`VS_OUT`), mờ đi và bị gạch ngang**, dải màu dưới đáy khung cũng nhạt theo:
  nhìn băng-rôn là biết còn mấy người trên sàn, khỏi phải đếm thanh máu giữa một đám sáu người.
- `winnerBanner()` ở chế độ đội ghi **`WINNING TEAM` + tên cả đội**, cũng tự thu cỡ chữ.
- Hai ô máu / hai ô màu trên thanh công cụ đọc qua `slotKeys()`: 1v1 là A/B, hỗn chiến là
  hai người đầu đội hình, đánh đội là người đầu của mỗi đội. Con số vẫn nằm trong
  `HP[key]` / `COLORS[key]` tra theo **nhân vật**, nên chỉnh một người là mọi bản sao của
  nhân vật đó cùng đổi — đúng như bản 1v1.
- `G.k`/`G.c` **vẫn còn**: người đầu của phe đầu và người đầu của phe khác nó. Chế độ điều
  khiển tay (`p1`/`p2`), camera phân cảnh (`G.freezeAt||G.c`) và hai ô chỉnh tay đều đọc qua
  hai cái này.

> **Mấy cơ chế "ba người trở lên" có sẵn tự bật.** Ginyu luôn chọn thế thăm dò khi
> `gnCrowd()>=3`; lãnh địa Nara trói mọi đối thủ có thanh máu và **chia đều** sát thương;
> `drSlTarget()` / `supMsTarget()` / `gnChangeTarget()` đã biết chọn người trong đám đông.
> Chúng viết ra từ trước cho trường hợp có Ayanokouji trên sàn, giờ chạy thật ở hỗn chiến —
> đừng viết lại.

Kiểm bằng `node tools/t_modes.js`.

## 2c-bis. Hai chế độ GIẢI ĐẤU — league và tournament

Người dùng: *"league là các nhân vật vào cùng 1 bxh — mỗi người đánh với các nhân vật tuần
tự, như các giải league bóng đá thế giới bình thường"*, và *"tournament thì chia bracket…
cứ đánh loại trực tiếp đến khi chung kết và tranh 3-4"*, kèm *"xoay bracket có 2 option là
random và tự xếp"* và *"giao diện cần rất dễ nhìn, đừng bị rối"*.

**Cả hai chỉ là một CHUỖI TRẬN 1v1.** Mỗi trận vẫn dựng qua `PICK.a` / `PICK.b` rồi
`newGame()` y hệt đấu tay đôi — engine không phải sửa một dòng nào. Thứ duy nhất thêm vào
là cái sổ `COMP` và màn bảng xếp hạng / sơ đồ nhánh xen giữa hai trận.

| | `league` | `cup` |
|---|---|---|
| bao nhiêu người | `LG_MIN`–`LG_MAX` = **3 → CẢ BẢNG NHÂN VẬT** | **đúng 4 hoặc 8** (`CUP_SIZES`) |
| lịch | vòng tròn, `roundRobin()` kiểu *circle method*; **một lượt hoặc lượt đi lượt về** | nhánh loại trực tiếp `cupNew()` |
| số trận | `n(n−1)/2` × số lượt | `n−1` + **1 trận tranh hạng ba** |
| thắng được gì | **3 điểm** (`LG_WIN`), không có hoà | đi tiếp một vòng |
| xếp hạng | điểm → hiệu số → tổng sát thương gây ra → tên | vô địch = người thắng chung kết |

- **`LG_MAX` ĐỌC THẲNG `CKEYS.length`, đừng cắm cứng một con số.** Người dùng: *"chỉnh chế
  độ league cho tối đa nhiều ng chơi nha, chứ có mỗi 8 ng thì league quá kém, sau này có
  nhiều nhân vật hơn thì k thể chỉ có 8 ng đâu"*. Giải vòng tròn **không có bản sao** (dàn
  đấu thủ bấm là bật/tắt), nên trần người chơi CHÍNH LÀ số nhân vật đang có — con số 8 cũ
  còn thấp hơn cả bảng chín người hiện tại, tức **không xếp nổi cả bảng vào một giải**.
  Đọc qua `CKEYS` thì mỗi nhân vật mới tự nới trần lên một nấc, khỏi phải nhớ sửa tay.
  - Ruột giải **không phải sửa gì**: `roundRobin()` vốn đã lo phần lẻ người bằng một suất
    trống, dòng "Vòng 9/17" tự đúng theo `COMP.nr`, và số trận vẫn là `n(n−1)/2` × số lượt.
    Đo được: cả bảng chín người ⇒ **36 trận / 9 vòng** một lượt, **72 trận / 18 vòng** lượt
    đi lượt về, không cặp nào gặp lại.
  - `t_comp.js` đọc **số ô trong lưới** chứ không ghim con số 9, nên thêm nhân vật là mục đó
    tự đúng theo. Lịch vòng tròn cũng kiểm thêm mốc 9 và 12 người.
  - Kéo theo: khối **"kết quả đã đá" phải CẮT BỚT** — `compPaint()` dựng lại cả khối sau MỖI
    trận, mà cả bảng đá lượt về đã là 72 trận và bảng sẽ còn dài ra theo số nhân vật. Chỉ giữ
    `RS_MAX = 40` trận gần nhất rồi ghi một dòng `compMore` đếm phần còn lại; bảng điểm phía
    trên vốn đã là chỗ tra kết quả chung cuộc.
- **Không có trận HOÀ.** Game đối kháng thì luôn có người gục; chỗ duy nhất có thể hoà là
  hết giờ, mà chỗ đó đã xử bằng "ai còn nhiều % máu hơn thì thắng". Vì vậy bảng chỉ có
  `P · W · L · Hiệu số · Điểm`, đừng thêm cột D cho rối.
- **Hiệu số = MÁU NGƯỜI THẮNG TRỪ MÁU NGƯỜI THUA.** Một trận cho ra **đúng một con số**:
  cộng cho người thắng, trừ đúng bấy nhiêu của người thua (`T[wk].gf += con; T[lk].ga += con`).
  - Thua vì **cạn máu** thì vế kia là 0, nên con số ra **đúng bằng máu người thắng** — y hệt
    bản trước, đúng câu người dùng chốt lúc đầu: *"winner có 32 máu thì +32, còn loser −32"*.
  - Chỉ **TRẬN HẾT GIỜ** mới khác, và đó chính là chỗ họ bác: ảnh gửi kèm có dòng
    `Horikita vs Ginyu · 800–744` — một trận sát nút — mà bảng ghi **+800 / −800**, đọc ra
    như một trận một chiều. Giờ chỉ tính phần chênh **56**.
  - `con = Math.max(0, máuThắng − máuThua)` — kẹp ở 0 phòng trận hết giờ xử theo **phần
    trăm** máu mà hai người có máu tối đa lệch nhau (ô máu chỉnh được từ 100 tới 9999).
  - Dòng *kết quả đã đá* in **máu còn lại của CẢ HAI bên** (`0–137`): thua vì cạn máu nên vế
    kia là 0, chỉ trận hết giờ mới có hai số cùng dương.
  - **Bản 1 lấy SÁT THƯƠNG, bản 2 lấy máu người thắng, bản 3 lấy phần CHÊNH** — `COMP_SC = 3`
    đánh dấu lối tính, ghi
    thẳng vào `COMP.sc`. `loadSaved()` thấy `sc` cũ thì **xoá cột hiệu số về 0** (giữ nguyên
    điểm, thắng, thua): giải lưu dở tính bằng sát thương mà cộng tiếp bằng máu là trộn hai
    đơn vị, bảng đọc ra vô nghĩa. `COMP_SC` **khai ngay trên `loadSaved()`**, không khai
    chung với `COMP_MAXT` mãi dưới khối giải đấu — hàm đó chạy rất sớm, để dưới là đúng cái
    bẫy TDZ ở mục 9.
  - Đo được (`t_comp`): ghim máu người thắng 137 còn đối thủ về 0 ⇒ hiệu số **+137 / −137**,
    dòng kết quả ra `0–137`; ghim trận hết giờ **800–744** ⇒ hiệu số chỉ **+56 / −56** mà dòng
    kết quả vẫn in đủ `800–744`; giải lưu theo lối cũ ⇒ hiệu số về **0/0** mà vẫn còn
    **3 điểm / 1 trận thắng**.
  - Cột `HIỆU SỐ` có `title` (`lgDiffTip`, song ngữ) nói đúng luật đó — hỏi "tính kiểu gì" thì
    rê chuột vào là ra, không phải thêm dòng chữ nào lên bảng.

  > **`f.dmgDealt` vẫn phải đúng dù bảng không còn đọc nó**: `drSlTarget()` của Doraemon và
  > `supMsTarget()` của Superman chọn mục tiêu theo nó. Hai luật đã sửa lúc còn dùng nó làm
  > hiệu số, **giữ nguyên**: viện binh ghi công cho CHỦ (`src.summon ? src.master : src` —
  > trước đó Kamehameha 400 dmg không ghi cho ai cả, đo được 0, sau sửa 400), và chỉ cộng
  > phần máu THẬT SỰ mất (`min(amt, t.hp)` — đấm 400 vào người còn 30 máu ghi 30, không phải
  > 400). Phân thân của Konohamaru chưa bao giờ dính, nó là viên đạn mang `owner: k`.
- **Trần thời gian `COMP_MAXT` = 90 giây trong trận (180 giây người chơi).** Hai người cùng
  có cửa hồi máu thì về lý thuyết đánh nhau mãi không xong; giải mà kẹt một trận là kẹt cả
  giải. `compTick()` gọi ở đầu `step()`, hết giờ thì ai còn nhiều **phần trăm** máu hơn thì
  thắng. Khai bằng số thẳng chứ **đừng gọi `gs()`** — hàm đó khai mãi dưới khối Shikamaru.
- **Lượt đi lượt về là TUỲ CHỌN, mặc định MỘT LƯỢT** (`LGLEGS`, hàng `#lgLegs`). Người dùng
  hỏi lại: *"đánh vòng tròn này chưa có lượt đi lượt về đúng không? chỉ có mới đánh 1 turn
  thôi mà đúng k"* — đúng, và giờ có thêm lựa chọn.
  - `leagueNew(keys, legs)`: lượt về đá lại **đúng bấy nhiêu vòng nữa nhưng ĐẢO SÂN** — ai
    đứng bên A lượt đi thì lượt về đứng bên B (`keys[pair[L%2]]`). Số vòng nhân đôi theo nên
    dòng "Vòng 9/14" tự đúng, không phải sửa chỗ nào khác.
  - Nhãn vòng đi qua `lgLabel(m)` và ghi thêm **Lượt đi / Lượt về** khi `legs===2`: chỉ nhìn
    số vòng thì không đoán ra vòng 9/14 là lượt nào.
  - Hàng chọn **in sẵn số trận và số vòng** (`legsHint`): 8 người đá lượt về là **56 trận**,
    phải cho người chơi biết trước mình đang chọn cái gì.
- **Dàn đấu thủ bấm là BẬT/TẮT, không có bản sao** (`modeGroups()` gắn cờ `toggle`): bảng xếp
  hạng mà có hai Konohamaru thì đọc không ra ai với ai.
- **`tmpReady()` chặn riêng cho `cup`**: 5 người vẫn nằm trong khoảng 4~8 nên vòng kiểm
  chung không bắt được, phải hỏi thẳng `CUP_SIZES.indexOf(n)>=0`.
- **Xếp nhánh hai lối** (`CUPSEED`, hàng `#cupSeed`): `random` bấm là xáo lại ngay cho thấy
  liền; `manual` thì **thứ tự trong dàn CHÍNH LÀ thứ tự nhánh** — chip đánh số, bấm hai
  người là tráo chỗ cho nhau (`swapAt`).
- **Trận tranh hạng ba đánh TRƯỚC chung kết**, đúng lối World Cup. `cupFill()` đẩy người
  thắng lên vòng sau và lấy hai người thua bán kết xuống trận đó.
- **Thắng thua tính theo HỒN, không theo THÂN XÁC** (`compSoul(f)` = `f.gnSoul || f.key`).
  Sau cú CHANGE của Ginyu, object mang `key:'ginyu'` có thể đang do hồn Superman điều khiển;
  người dùng bác đúng chỗ này: *"Superman trong xác Ginyu win, nhưng vẫn tính Ginyu win là
  sai"*. Thanh máu và băng-rôn WINNER vốn đã đọc `f.name` nên chúng ra đúng sẵn — **chỉ mỗi
  sổ giải đấu đọc `f.key`**. `compResult()` vì vậy tra cả `A`/`B` lẫn người thắng qua
  `compSoul()`, nên máu còn lại cũng lấy đúng thân xác mà hồn đó đang ngồi. Đo được: thân xác
  Ginyu đứng cuối trận với 210 máu ⇒ Superman **+3 điểm / +210 hiệu số**, Ginyu **−210**.
- `finish()` gọi `compResult(win)` **ngay tại chỗ** — ra khỏi hàm đó là mấy con số
  `dmgDealt` không đọc lại được nữa. Xong thì hẹn **2.6 giây** rồi mới bật bảng lên, bật
  ngay thì che mất pha KO.
- **Dải nút `#arcOver` phải nhường chỗ khi có giải** (`compOn()`): bấm "Đánh lại" giữa giải
  là đá lại đúng trận vừa xong, vô nghĩa.
- **Giải đá dở được lưu** ở khoá `cfg_comp`; bấm PRESS START mà còn giải chưa xong thì vào
  thẳng bảng xếp hạng chứ không bắt chọn lại dàn đấu thủ. Khoá đó đọc bằng `.then()` chứ
  **đừng `await`** — thêm một nhịp IndexedDB vào giữa `loadSaved()` là dính đúng lỗi ở mục 9.
- **Bảng xếp hạng có hiệu ứng sau mỗi trận** — người dùng: *"làm hiệu ứng khi 1 người thắng
  trận rồi movement thay đổi vị trí và điểm số trên bxh cho nó hay"*. `compResult()` chụp
  bảng **TRƯỚC** khi cộng điểm vào `lgAnim` (thứ hạng cũ + con số cũ + cặp vừa đá), rồi
  `lgTableHtml()` vẽ ra kèm `data-old` / `data-a` / `data-b` và `lgPlay()` chạy:
  - **hàng trượt theo lối FLIP**: bảng đã vẽ ở thứ hạng MỚI, dịch ngược từng hàng về chỗ CŨ,
    **ép trình duyệt tính lại bố cục** (`void box.offsetHeight`) rồi mới thả cho trượt về.
    Thiếu dòng ép đó thì hai lần gán bị gộp làm một và hàng đứng im.
  - **số đếm dần lên** trong 0.7 giây (P · W · L · hiệu số · điểm), hiệu số giữ dấu `+`.
  - **mũi tên ▲▼ chỉ ai vừa vượt ai**, và hai người vừa đá được tô sáng 1.6 giây.
  - `lgAnim` / `cupAnim` dùng **đúng một lần** rồi xoá — `compPaint()` còn được gọi lại khi
    đổi ngôn ngữ, không xoá là hiệu ứng chạy lại vô duyên.
  - Sơ đồ nhánh thì trận vừa có kết quả nháy một cái (`.brM.fresh`).
  - **`compOpen()` phải BỎ LỚP `off` TRƯỚC rồi mới `compPaint()`**: `lgPlay()` đo `offsetTop`
    của từng hàng, mà đo bố cục bên trong khối `display:none` thì mọi thứ trả về 0 và không
    hàng nào trượt được một pixel. Đã dính đúng một lần — đo ra 0px, sửa xong ra 105px.
- **Giao diện chỉ có ĐÚNG BA khối xếp dọc**: *trận kế tiếp* to nhất ở trên, *bảng điểm hoặc
  sơ đồ nhánh* ở giữa, *kết quả đã đá* ở dưới. Không thêm gì nữa — người dùng đã dặn "đừng
  bị rối". Sơ đồ nhánh **cuộn ngang** khi màn hẹp chứ đừng ép chữ bé lại.

`duelLike(m)` gộp `duel | league | cup`: `buildRoster()` và `spawnSpots()` đọc qua nó để mỗi
trận của giải vẫn là hai người đứng hai đầu sàn y như đấu tay đôi.

Kiểm bằng `node tools/t_comp.js`.

## 2d. Mười hai màn đấu và sàn đấu đã tân trang

Người dùng: *"thiết kế như game street fighter… có screen chọn màn với chọn nhân vật luôn"*
và *"tân trang sàn đấu luôn"*. Hai thứ đó nằm chung một chỗ.

**Bảng `STAGES`** (khai **TRƯỚC `SETS`** — `SETS` đọc nó ngay lúc khai, để dưới là dính TDZ):

| key | Tên hiện ra | Có gì trong hình |
|---|---|---|
| `dojo` | DOJO | vách giấy shoji, xà gỗ, biểu ngữ đỏ, sàn ván |
| `street` | NIGHT STREET | dãy nhà tối, cửa sổ sáng đèn, bảng neon hắt xuống mặt đường |
| `stadium` | STADIUM | khán đài lốm đốm, hai giàn đèn, sân cỏ có vạch kẻ và vòng tròn giữa sân |
| `forest` | FOREST | thân cây, tán lá, sương là là mặt đất |
| `space` | DEEP SPACE | sao, tinh vân, hành tinh, sàn kim loại kẻ ô |
| `roof` | SUNSET ROOF | trời hoàng hôn, chân trời nhà cao tầng, mái ngói chạy về phía xa |
| `volcano` | VOLCANO | vách núi đen, quầng lửa sau đỉnh, tàn lửa bay lên, khe nham thạch trên sàn |
| `temple` | SKY TEMPLE | biển mây, mái ngói đỏ trên bốn cột vàng, sàn đá lát |
| `snow` | FROZEN PEAK | dãy núi chóp tuyết, tuyết rơi, luống tuyết bị gió thổi |
| `desert` | DESERT RUINS | mặt trời trắng, cồn cát chồng lớp, cột đá đổ nát, vân cát gợn |
| `cavern` | CRYSTAL CAVE | nhũ đá rủ từ trần, tinh thể tím-lam phát sáng cả trên lẫn dưới |
| `sakura` | SAKURA GARDEN | trăng, năm cây anh đào, cánh hoa bay và rụng phủ nền |

> **Sáu màn sau thêm cùng một lượt với màn chọn chế độ** *(người dùng: "thêm thêm khoảng
> 6 background nữa cho thành 12 background")*. Mỗi màn mới chỉ cần **ba chỗ**: một dòng
> trong `STAGES`, một nhánh trong `stageArt()`, xong. Ô dán ảnh nền tự có vì nhóm `stages`
> trong `SETS` đọc thẳng `STAGES`, bảng nhạc nền (`BGM_SLOTS`) cũng vậy — **đừng đi thêm
> tay vào hai chỗ đó**. `t_stage.js` đếm số màn và đòi **mỗi màn một tông màu trung bình
> riêng**, nên màu mới phải khác hẳn sáu màu cũ; `t_ui.js` đọc số ô nhạc qua
> `2 + STAGES.length` chứ không ghim con số.
>
> **Nhánh cuối của `stageArt()` là `else` trần (sakura), không phải `else if`** — thêm màn
> nữa thì chèn `else if` vào TRƯỚC nó, đừng thêm sau.

> **Màn rừng KHÔNG mang tên nhà Nara.** Người dùng chốt: *"bỏ chữ khu rừng nara mà thay
> thành rừng bthg trong khi chọn sàn"* — đây là một sàn đấu bình thường, ai đánh cũng được,
> không phải lãnh địa của Shikamaru. Tên hiện ra là `FOREST` / `Rừng rậm`. **Khoá vẫn là
> `forest`** (khoá giữ nguyên đời đời — đổi là mất ảnh nền người dùng đã dán), và **tuyệt
> chiêu `Nara Clan Forest` của Shikamaru thì giữ nguyên tên**: đó là tên chiêu, không phải
> tên màn.

- **Mỗi màn CÒN CÓ một ô dán ảnh nền**: nhóm `stages` nằm trong `SETS` như một "nhân vật",
  nên nó đi chung cả bảng dán ảnh, nút ✕ xoá từng ô, nạp hàng loạt lẫn gói phát hành —
  **đừng dựng đường riêng**. Dán ảnh vào ô nào thì `arenaFloor()` vẽ ảnh đó thay hình vector.
- **Thẻ chọn màn là ảnh VẼ THẬT**: `stageThumb(key)` mượn `ctx` (khai bằng `let` chính vì
  vậy), vẽ nguyên sàn ra canvas phụ rồi thu nhỏ. Nhờ vậy dán ảnh nền là thẻ đổi theo —
  `setFrames()` / `clearFrames()` gọi `stageThumbClear(pk)` để xoá cache.
- **Nhiễu phải CỐ ĐỊNH theo chỉ số** (`sr(i)`, băm từ `Math.sin`): sao, ô cửa sổ, khán giả
  mà bốc bằng `Math.random()` thì mỗi khung hình chúng nhảy chỗ, nhìn như nhiễu TV. Đừng
  dùng phép chia dư (`(i*37)%W`) thay cho nhiễu — nó ra **vân chéo moiré**, đo mắt thấy ngay
  ở khán đài sân vận động.
- Màn đang chọn nằm trong biến `STAGE`, lưu chung khoá `cfg_picks`.

**Tân trang sàn** — ba thứ, nằm trong `arenaFrame()` / `groundShadows()`:
1. **Khung kiểu thùng máy arcade**: viền đen dày, một nét sáng **theo tông màu của màn**
   (`st.fog`), bốn ngoặc góc.
2. **Lớp tối dồn ra rìa** (`vignette()`): dựng **một lần** rồi giữ lại — gradient phủ kín
   màn mà tạo lại mỗi khung hình thì nặng (mục 7).
3. **Bóng đổ dưới chân** (`groundShadows()`): vẽ thành một lượt RIÊNG trước khi vẽ người,
   để bóng người này không đè lên thân người kia. Bay cao thì bóng nhạt đi.

> **Lớp tối phải vẽ SAU thế giới nhưng TRƯỚC đám chữ nổi.** Để nó trong `arenaFrame()`
> (chạy sau lượt vẽ float đầu) thì số sát thương, băng-rôn và bong bóng thoại bị dim theo —
> đo được: nền trắng của bong bóng tụt từ ~58% xuống 44% và `t_bubble.js` đổ. Nó vẽ ở **hệ
> toạ độ màn hình** (`setTransform` trước khi tô) để vệt tối đứng yên lúc camera zoom.

Kiểm bằng `node tools/t_stage.js`.

## 2e. Hai trang: XƯỞNG và TRANG CHƠI

Người dùng: *"kiểu chia ra 2 web — 1 web tôi ở background add model, âm thanh, còn 1 web
tôi để mọi người chơi"*.

| Trang | File | Có gì |
|---|---|---|
| xưởng | `index.html` | đủ bảng dán ảnh / tiếng, nạp hàng loạt, nút thử chiêu, ghi hình, xuất gói |
| chơi | `play.html` | màn tiêu đề → chọn nhân vật → chọn màn → đánh. Không có bảng dán, nhưng **có nút quay video 9:16** (xem mục 7b) |

**`play.html` DỰNG RA từ `index.html`, đừng sửa tay** — `python3 tools/mk_play.py`. Script
chỉ làm hai việc: cắt mấy khối `<!--STUDIO-->…<!--/STUDIO-->` và chèn `window.ARCADE=1`.
`t_play.js` dựng lại rồi **so từng byte**, nên sửa tay là test đổ ngay.

- **Vỏ arcade nằm sẵn trong `index.html`** (`#arcTitle`, `#arcOver`, lưới `#stageList`) và
  tự tắt khi không có `window.ARCADE` — một chỗ để sửa giao diện, không phải hai.
- **Chỉ TRANG CHƠI mới chia màn chọn thành nhiều BƯỚC.** Xưởng giữ nguyên một trang
  (`dataset.page='all'`) vì **mọi test hiện có bấm `#cselGo` một phát là vào trận** — đổi chỗ
  này là đổ cả bộ. Các bước lấy từ `cselSteps()`:

  | Chế độ | Các bước |
  |---|---|
  | đấu tay đôi | **`mode`** → `p1` → `p2` → `stage` |
  | hỗn chiến | **`mode`** → `chars` (một khung đội hình) → `stage` |
  | **giải vòng tròn · giải loại trực tiếp** | **`mode`** → `chars` — **KHÔNG có bước `stage`** |
  | **đánh đội** | **`mode`** → **`t0` → `t1` → … → `stage`** — mỗi đội một bước |

  > **HAI CHẾ ĐỘ GIẢI KHÔNG hỏi sàn ở màn chọn nhân vật.** Người dùng: *"có việc lặp lại
  > chọn background 2 lần ở chế độ league và tournament — 2 chế độ này chỉ chọn background
  > ở lần 2 thôi chứ lần đầu là không được"*. Khai mạc giải xong là vào thẳng bảng xếp
  > hạng, rồi **mỗi trận** mới hỏi sàn qua `stagePickOpen()` — hỏi thêm một lần ở màn chọn
  > là bắt người chơi chọn hai lần liền mà lần đầu chẳng dùng vào đâu (sàn của cả giải bị
  > sàn của từng trận ghi đè ngay). Kéo theo: nút cuối của hai chế độ này là **"Khai mạc
  > giải"** chứ không phải "Tiếp ▸ Chọn màn", và test chỉ bấm `#cselGo` **MỘT lần** (trước
  > đây hai lần).

  > **BƯỚC ĐẦU TIÊN LÀ CHỌN CHẾ ĐỘ** — người dùng: *"vào game ấn phát là chọn trc chế độ
  > chơi, xong rồi mới vào phần chọn nhân vật"*. Dải năm nút `.cselModes` vốn chen trên
  > đầu màn chọn nhân vật; giờ nó có hẳn một bước riêng và **biến mất hẳn ở mấy bước sau**
  > (`data-step="pick0"` cũng giấu nó đi). Đổi chế độ thì bấm **Quay lại**.
  > - `data-step` giờ có **bốn** giá trị: `mode` · `pick0` · `pick` · `stage`. Bước chọn
  >   ĐẦU TIÊN (`pick0`) giờ ở **chỉ số 1** chứ không phải 0 — `cselPaint()` đọc `i<=1`.
  > - Trên màn đó `.cselModes` thành **lưới thẻ đứng cao gần hết màn**: `grid-auto-rows:1fr`,
  >   `margin:auto 0` canh cả khối vào giữa, trần `430px` để màn cao không kéo thẻ dài ngoằng.
  >   Mỗi nút mang `data-ico` (biểu tượng to, vẽ bằng `::after` + `order:-1`) và `--mc`
  >   (màu riêng của chế độ, dùng cho vạt sáng hắt lên từ đáy và quầng quanh biểu tượng).
  > - **Emoji đã TÁCH khỏi chuỗi nhãn** (`mDuel` không còn `⚔` ở đầu) và chuyển sang
  >   `data-ico` — để nó ở cả hai chỗ là ra hai cái emoji cùng một nghĩa, một to một bé.
  > - **Thẻ đang chọn phải khai LẠI nền vàng trong chính khối `[data-step="mode"]`**: luật
  >   nền của khối đó đặc hiệu hơn `.mTab.on`, không khai lại là thẻ đang chọn thành đen sì.
  >   Đã dính đúng một lần. Cùng họ: **đừng dùng `background-blend-mode:multiply`** cho vạt
  >   màu — trộn nhân vào nền tím vốn đã tối thì cả tấm thẻ đen kịt.
  > - `stepReady()` cho bước `mode` **luôn đúng**: chế độ nào cũng có sẵn một đội hình mặc định.
  > - Mọi cửa vào màn chọn đều đã đọc `cselSteps()[0]` nên tự ra bước `mode`, **đừng ghim
  >   `'p1'` vào chỗ nào**. Kéo theo: test nào bấm `#arcStart` hay `#pick` rồi làm việc ngay
  >   với lưới nhân vật thì phải chèn **một cú `#cselGo`** (đã sửa `t_play` · `t_comp` · `t_dex`).

  > **Đánh đội đi TỪNG ĐỘI MỘT**, đúng quy trình của 1v1 — người dùng chốt: *"chọn đội 1
  > trước đội 2 sau — quy trình như 1v1 chứ"*. Số bước ăn theo `TMP.teams.length`, nên đổi
  > số đội là danh sách bước tự dài ngắn theo, `cselFix()` lo kéo bước về cho hợp lệ.
  > - **Số đội chọn ở hàng `#teamNum`** (`TEAMS 2 3 4`), chỉ hiện ở bước đội ĐẦU TIÊN.
  >   Hai nút `+ Thêm đội` / `✕ Bỏ đội` trong đầu mỗi khung **chỉ còn ở XƯỞNG** —
  >   `probe.js` (`openMulti`) bấm đúng hai nút đó để dựng đội hình cho test, đừng bỏ.
  > - `stepReady()` khác `tmpReady()`: nó chỉ hỏi **bước hiện tại** đã đủ chưa. Đòi cả đội 2
  >   phải đủ người ngay từ bước đội 1 thì không bao giờ bấm Tiếp được.
  > - `cselPaint()` giấu mọi khung đội trừ đúng đội đang chọn; dải `#pickRow` từ đội thứ hai
  >   trở đi hiện `TEAM 1 vs TEAM 2 …` kèm mặt nhân vật, y hệt dải của 1v1.
  > - CSS đọc `data-step` (`pick0` · `pick` · `stage`) thay vì liệt kê `t0`/`t1`/`t2`/`t3`
  >   ra từng cái. Dòng liệt kê `.cselVs` ở góc phải **ẩn hẳn ở trang chơi** — nó nhắc lại
  >   đúng cái dải chip phía trên.

  Người dùng bác lối để hai cột cạnh nhau: *"màn chọn p1 xong r chọn p2 sau, để chung nhìn
  rối"*. CSS giấu `#colB` ở bước `p1` và `#colA` ở bước `p2`, nên **mỗi bước chỉ có MỘT lưới
  nhân vật và MỘT thẻ hồ sơ** — gọn hẳn trong một màn hình.
  - `cselFix()` kéo bước về cho hợp lệ khi đổi chế độ giữa chừng (`p1` không có trong danh
    sách bước của hỗn chiến).
  - Dải **`#pickRow`** hiện từ bước `p2` trở đi: mặt + tên của cả hai bên kèm chữ `VS`, nên
    lúc chọn P2 vẫn thấy P1 vừa chốt.
  - **Dòng phụ phải vẽ trong `cselPaint()` chứ không chỉ trong `cselRefresh()`** — bấm "Tiếp"
    chỉ gọi `cselPaint()`, nên để trong `cselRefresh()` thì chữ đứng nguyên ở bước cũ (đã
    dính: sang bước P2 mà vẫn ghi "Chọn nhân vật cho Người chơi 1"). Cả hai đọc chung
    `cselSubText()`.

- **Mặt nhân vật lấy từ chính ảnh đã dán** (`avaSrc()` → ô `idle`, Horikita thì `scared`,
  rồi `stand3`). Chưa dán thì vẫn là emoji, không bao giờ để trống. Ảnh **tới sau** (gói phát
  hành nạp bằng `fetch`) nên `packLoad()` gọi `avaRefresh()` quét lại mấy thẻ đã dựng — thiếu
  chỗ này thì mở trang xong thẻ vẫn là emoji cho tới lần dựng lại kế tiếp.
- **Thẻ hồ sơ chia hai cột** (`.dexGrid`): trái là giới thiệu + bộ chiêu, phải là biểu đồ.
  Chỉ bật ở bước `p1`/`p2` của trang chơi khi màn rộng hơn 820px; cột hẹp (xưởng, điện thoại)
  thì lưới tự xếp dọc như cũ.
- `el(id)` **trả về Ô GIẢ** (`NUL`) khi không tìm thấy: trang chơi bị cắt hàng chục id mà
  engine thì gán thẳng `el('hpK').value` / `el('play').textContent` ở khắp nơi. Vì vậy
  **chỗ nào cần biết ô có thật hay không thì phải hỏi thẳng `document.getElementById`** —
  `if(el('x'))` lúc nào cũng đúng. Đã dính đúng một lần ở `groupBox()`: khung đội hình
  không bao giờ được dựng, cả chế độ hỗn chiến lẫn đánh đội trắng trơn.
- `buildSlots()` và `buildSfx()` return sớm khi không có bảng, **nhưng vẫn phải gọi
  `loadSaved()` / `sfxRestore()`** — không thì trang chơi mất sạch ảnh, tiếng và gói.

**Gói phát hành `assets/pack/pack.json`** — đường duy nhất đưa ảnh/tiếng sang trang chơi:

- Xưởng: nút **📦 Xuất gói lên web chơi** (`packBuild()`) gói cả `SPR` lẫn `SFXSRC` thành
  một JSON; chép vào `assets/pack/pack.json` rồi commit.
- Trang chơi: `packLoad()` `fetch` gói đó lúc mở. **Ô nào đã có nội dung thì gói không đè.**
- **Thứ tự nạp**: trang chơi lấy **gói TRƯỚC** rồi mới tới kho của máy (kho đằng nào cũng
  trống mà đọc hơn 80 khoá IndexedDB thì chậm); xưởng thì ngược lại — file bạn tự nạp thắng.
- **Mọi cú `fetch` vào `assets` phải đi qua `fetchAsset()`, đừng gọi thẳng `fetch`.** Thư mục
  `assets` nằm ở **gốc site**; trang chơi cũng ở gốc nên `'assets/…'` đúng, nhưng **trang xưởng
  trên Pages nằm trong `/studio/`** — đường dẫn tương đối lúc đó thành `/studio/assets/…` và ăn
  **404 im lặng**. Hậu quả đo được: người dùng dán ảnh, xuất gói, commit `pack.json` lên repo,
  mở trang xưởng vẫn thấy model vector và **không có một dòng lỗi nào**. `fetchAsset()` thử lần
  lượt `''` → `'../'` → `'../../'` rồi **nhớ mức nào ăn**, các file sau đi thẳng mức đó (bộ giọng
  mẫu nạp chín file nên không được dò lại từ đầu mỗi lần). `t_play.js` dựng hẳn bản giống Pages
  (trang chơi ở gốc, xưởng trong `/studio/`, `assets` ở gốc) rồi kiểm cả hai trang.
- **Trang chơi có MÀN CHỜ đứng TRƯỚC màn tiêu đề** (`#arcBoot`, z-index 72 nên đè lên
  `#arcTitle`). Người dùng chốt: *"làm màn loading cái ảnh và tiếng trước màn vào game đi,
  chứ để thẳng vậy rồi bảo người chơi chờ thì không được"*. `sfxRestore()` gọi
  `bootShow()` → `await packLoad()` → `bootHide()`, nên **nút PRESS START chỉ bấm được khi
  ảnh và tiếng đã về đủ**. Đo ở 8 Mbps: màn chờ đứng 28.7 giây rồi mới cho vào, lúc đó đã có
  đủ 89 ảnh · 46 tiếng.
  - **Thanh tiến độ chia hai pha**, `packProg(pha,lam,tong)`: `'tai'` (tải file) chiếm
    **0→70%**, `'mo'` (mở gói) chiếm **70→100%** — đo được 25 giây tải và 3 giây mở nên chia
    vậy thì thanh chạy đều mắt.
  - **Đếm TRƯỚC tổng số việc rồi mới chạy** (`tong` trong `packLoad`). Cộng dồn kiểu "xong
    bao nhiêu biết bấy nhiêu" thì thanh nhảy cóc, nhìn như treo.
  - **KHÔNG có cửa vào sớm. Nút `#bootSkip` *Vào luôn, khỏi chờ* đã BỎ HẲN** — người dùng
    bác: *"đừng có vụ vào luôn khỏi chờ — load hết rồi mới cho vào hiểu không"*. Vào sớm là
    thấy model vector rồi lại tưởng game hỏng, đúng cái lỗi mà màn chờ sinh ra để chữa.
    **Đừng dựng lại nút đó.** Ba thứ thay chỗ nó, để "không có cửa vào sớm" không biến
    thành "nhốt người chơi":
    1. `bootLoad()` lặp cho tới khi `packLoad()` trả `ok:true` rồi mới `bootHide()`.
    2. **`packLoad()` trả thêm cờ `ok`, và cờ đó phân biệt hai kiểu hỏng.** `fetchAsset`
       trả null ⇒ site **không hề có gói** (chạy `file://`, hoặc chưa ai xuất gói) ⇒
       `ok:true`, cho vào luôn — chẳng có gì để chờ, bắt bấm ở đây là nhốt thật. Có phản
       hồi rồi mà đọc/parse hỏng ⇒ cú tải **đứt giữa chừng** ⇒ `ok:false`, hiện khối
       `#bootFail` với nút `#bootRetry` *Thử tải lại*. Nút đó **tải lại**, không phải vào sớm.
    3. **`packRead()` có đồng hồ chết máy `PACK_STALL` = 25 giây**, đo theo **từng lượt
       đọc** chứ không đặt trần cho cả cú tải: quá 25 giây mà không về thêm một byte nào
       thì huỷ reader và ném lỗi xuống nhánh `ok:false`. Không có nó thì một cú fetch treo
       là đứng mãi trong màn chờ — mạng chậm mà vẫn chảy thì vẫn để nó chảy tiếp.
    Đo được (`t_play.js` mục 6, dựng server tự cắt ngang thân file): tải đứt ⇒ hiện nút tải
    lại, **0 ảnh nạp được và màn chờ vẫn đứng nguyên**; bấm tải lại ⇒ về đủ ảnh rồi mới tắt
    màn chờ; site không có `pack.json` ⇒ vào thẳng, không bắt bấm gì.
  - Màn chờ **chỉ có ở trang chơi** (`window.ARCADE`). Xưởng thì file mình tự nạp phải
    thắng nên gói chạy sau, không chặn gì cả.
  - **Phần nhìn**: nền lưới trôi + quầng sáng thở (`#arcBoot::before/::after`), con số phần
    trăm to, vệt sáng quét qua thanh, và **câu chạy vòng** `BOOT_TIPS` (song ngữ, đổi mỗi
    4.2 giây) kể cho người chơi biết trong game có gì. Chờ mấy chục giây mà chỉ có mỗi cái
    thanh thì chán.
  - **Mọi chuyển động ở đây dùng `background-position` / `opacity`, KHÔNG dùng `transform`**
    — Playwright coi phần tử đang biến đổi là "chưa đứng yên" và không bấm được nút nằm
    trong đó (mục 9). Nút `#bootRetry` nằm ngay trong màn này.
  - **`#arcTitle` dùng CHUNG nền với `#arcBoot`** (cùng cặp `::before`/`::after`), nên hết
    màn chờ sang màn tiêu đề là liền mạch chứ không giật sang một nền khác. Hai lớp phủ đó
    **bắt buộc có `pointer-events:none`** — thiếu thì nút `PRESS START` nằm dưới không bấm
    được, kể cả người lẫn Playwright.
- **MÀN VS TRƯỚC TRẬN** (`#arcVs`, `vsShow()` / `vsGo()`). Người dùng gửi ảnh màn chọn của
  Street Fighter II và chốt: *"icon nhân vật rồi VS rõ ràng rồi mới vào"*, rồi nói thêm:
  *"đừng để nó là icon — để nó là full body với nhiều effect trông như một battle thật"*.
  Nên mỗi bên là một **KHUNG DỌC vẽ trọn cả người** (`object-fit: contain`, canh **đáy** cho
  hai bên đứng cùng một mặt sàn), **không** phải ô vuông cắt cúp lấy cái đầu.
  - Hiệu ứng đi kèm: **quầng sáng** theo màu nhân vật, **vệt tốc độ** chạy phía sau, **vũng
    sáng dưới chân**, **burst** sau chữ VS, và một **chớp màn** lúc mở. Bên phải lật ngược
    (`scaleX(-1)`) cho hai bên **quay mặt vào nhau**.
  - Nền ăn theo **tông màu của màn đấu** (`--vsFog` đặt từ `stageOf(STAGE).fog`) — nhìn ra
    ngay mình sắp đánh ở đâu.
  - Đông người (đánh đội / hỗn chiến) thì thu nhỏ khung qua biến `--k`, đừng để tràn màn.
  - Chớp màn phải **thay hẳn nút `.vsFlash`** mỗi lần mở (`replaceWith(cloneNode)`):
    animation chỉ chạy một lần cho mỗi lần phần tử vào cây DOM.
  - **Cờ `vsOn` chặn thẳng `step()`** nên trận đứng yên hẳn — kể cả mấy màn ra mắt (Ginyu bay
    vào, Anywhere Door, Superman đáp xuống), vì chúng đo bằng giây TRONG TRẬN. Đo được: `G.t`
    đứng nguyên ở 0 suốt màn VS rồi mới chạy.
  - **Khai `let vsOn` ngay cạnh `let G, running`**, không khai chung với `vsShow()` mãi cuối
    file: `step()` đọc nó mà `step()` nằm phía trên — để dưới là đúng cái bẫy TDZ ở mục 9.
  - **Chạm là vào ngay; không chạm thì tự vào sau `VS_HOLD` = 2.4 giây THẬT.** Có cái tự vào
    đó nên bộ test cũ không phải bấm thêm nút nào, chỉ chờ lâu hơn một nhịp.
  - Gọi trong **`arcFight()`** — một cửa duy nhất cho cả ba đường vào trận (`#cselGo`,
    `#arcAgain`, `#compGo`). Thêm đường vào trận mới thì gọi `arcFight()`, đừng gọi tay.
  - Chỉ có ở **TRANG CHƠI** (`ARCADE`): xưởng vào thẳng như cũ vì mọi test hiện có bấm
    `#cselGo` một phát là vào trận.
  - Mấy chuyển động **lặp mãi** chỉ đổi `opacity` / `background-position`, **không dùng
    `transform`** (mục 9). Cú bay vào lúc mở màn có dùng `transform` nhưng nó **chạy một lần
    rồi dừng**, và nó nằm trong `.vsSide` chứ không phải chính `#arcVs` — cái mà test bấm vào.
  - **`#cselGo` KHÔNG được gọi `arcFight()` khi vừa khai mạc giải.** `startPicked()` cho
    `league`/`cup` mở thẳng bảng xếp hạng rồi `return`, nhưng nhánh arcade phía sau vẫn gọi
    `arcFight()` — tức bật nhạc, cho trận chạy ngầm sau lưng cái bảng, và (từ khi có màn VS)
    chớp ra **cặp đấu của trận TRƯỚC** còn sót trong `G.fighters`. Người dùng quay được đúng
    cảnh đó: bấm "Khai mạc giải" mà hiện ra `Captain Ginyu vs ChiChi` trong khi trận đầu của
    giải là `ChiChi vs Konohamaru`. Gác bằng `if(!compOn()) arcFight();`.
- **MỖI TRẬN MỘT SÀN — `#arcStage` / `stagePickOpen()`.** Người dùng: *"mỗi trận log vào
  có thể trc hết là chọn stadium, giả sử như league match thì mỗi trận vào là đc chọn 1
  background chứ k phải là chọn 1 background cho cả league"*. Vì vậy màn hỏi sàn chen vào
  **TRƯỚC `arcFight()`** ở đúng **hai cửa**: nút ▶ trong bảng xếp hạng (`#compGo`) và nút
  *Đánh lại* (`#arcAgain`). Trận **đầu tiên** thì không hỏi — bước `stage` của màn chọn
  nhân vật vừa hỏi xong rồi.
  - `stagePickOpen(cb)` giữ lại hàm cần chạy trong `stagePickCb` rồi mở lớp phủ; bấm
    **⚔ VÀO TRẬN!** (`#arcStageGo`) thì đóng lớp phủ và gọi `cb()`. `!ARCADE` thì gọi
    thẳng `cb()` — **xưởng không bao giờ thấy màn này**, mọi test cũ không đổi một nhịp nào.
  - Chốt sàn xong **gán luôn `COMP.stage=STAGE`**, nên `compPlayNext()` (vốn kéo `STAGE` về
    `COMP.stage`) không lôi ngược về sàn của trận trước. Không phải sửa `compPlayNext()`.
  - `#compGo` phải **`compBoardClose()` TRƯỚC** khi mở màn hỏi sàn, không thì lúc chọn xong
    bảng xếp hạng loé ra đúng một khung hình. Và hỏi `compNextMatch()` trước để giải đã
    xong thì không mở màn hỏi sàn suông.
  - Lớp phủ đặt **z-index 67**, trên `.arcOver` (65), cộng `body:has(#arcStage:not(.off))
    .arcOver{display:none}` — thiếu chỗ đó thì dải *Đánh lại / Đổi nhân vật* nằm chình ình
    giữa màn hỏi sàn.
  - Dùng lại vỏ `.csel` + `.sTiles` + `stageThumb()` của màn chọn nhân vật, **đừng dựng
    kiểu lớp phủ thứ hai**. Khoá chữ là **`stageEach`**, KHÔNG phải `stagePick` — `stagePick`
    đã có từ trước (dòng phụ `Chọn màn đấu · DOJO` dưới bước `stage`) và trùng tên là nó in
    nguyên chuỗi `SELECT <span>STAGE</span>` ra màn hình. Đã dính đúng một lần.
- **GIỮ MÀN WINNER RỒI MỚI HIỆN DẢI NÚT.** Người dùng chốt: *"lúc thắng rồi thì hold lại để
  hiện winner, xong sau đó cho người chơi nút tự chuyển"*. `#arcOver` chỉ bật khi
  **`G.endT >= 2`** — đúng lúc `G.announced` mở ra băng-rôn và pháo giấy. Trước đó nút nhảy ra
  ngay trong khung hình người ta vừa gục.
- **Giữa giải, dải nút đổi thành đúng MỘT nút đi tiếp** (`#arcComp` → `compOpen()`): "Đánh
  lại / Đổi nhân vật" bị giấu vì bấm Đánh lại giữa giải là đá lại đúng trận vừa xong. Và
  `compResult()` **không tự mở bảng xếp hạng nữa** ở trang chơi — người chơi tự bấm, rồi bấm
  tiếp ▶ trong bảng cho trận sau. Xưởng không có dải nút arcade nên vẫn tự mở như cũ sau 2.6
  giây; nhánh đó đọc **`window.ARCADE`** chứ không đọc hằng `ARCADE` (hằng khai mãi cuối file).
  `t_comp.js` vì vậy có hai hàm con `boQuaVs()` / `sangBang()` đi qua đúng hai chỗ này.
- **Dòng đếm MB phải hiện ở HAI chỗ**: `#arcLoad` trong màn tiêu đề, và `#loadChip` **đè lên
  sàn đấu**. Dòng trong màn tiêu đề biến mất ngay khi bấm PRESS START, mà gói thì còn tải cả
  chục giây nữa — người chơi vào trận thấy model vector và tưởng mất ảnh. Đo được trên mạng
  giả lập **8 Mbps** (mức bình thường của điện thoại): bấm PRESS START rồi chọn xong hai nhân
  vật thì **0/89 ảnh** đã về, nên cả hai người đều là model vector. Chờ đủ ~25 giây thì đủ 89
  ảnh và model đổi sang ảnh dán. **Đây không phải lỗi, chỉ là gói quá nặng** — người dùng đã
  báo nhầm thành "k có model" đúng một lần.
  - `packNote(msg, xong)`: `xong=true` là dòng tổng kết ⇒ màn tiêu đề giữ lại, còn chip trên
    sàn **tự tắt sau 4 giây** (nó nằm đè lên chỗ đánh nhau).
  - Chip **không được dùng `transform`** để canh giữa — Playwright coi phần tử đang biến đổi
    là "chưa đứng yên" (mục 9). Canh bằng `left/right` + `text-align:center`.
- **Gói nặng thì phải ĐẾM MB ra màn hình.** `pack.json` gói ảnh base64 nên vài chục MB là
  bình thường (bản người dùng đang dùng: **24 MB, 89 ảnh, 46 tiếng**), trên mạng chậm nó tới sau
  khi trang đã mở — không nói gì thì người chơi tưởng game hỏng và nhắn "sao mất ảnh". Màn tiêu
  đề vì vậy có dòng `#arcLoad`, đi qua ba chặng: *Đang tải ảnh và tiếng… 4.0 / 23.7 MB* (đọc
  dòng byte bằng `packRead()` + `content-length`) → *Đang mở gói…* → *Đã nạp 89 ảnh · 46 tiếng*.
  Trình duyệt nào không cho đọc dòng byte thì lùi về `r.json()` như cũ.
- **Đã bỏ `cache:'no-store'` khi tải gói** — cờ đó CẤM trình duyệt giữ lại, tức mở trang lần nào
  cũng kéo lại nguyên mấy chục MB. Bỏ đi thì trình duyệt được phép cache, và Pages có ETag nên
  gói mới vẫn về đúng. **Nhưng đừng hứa là nhanh hơn**: đo thật thì Chrome *không* cất một mục
  24 MB vào disk cache (mỗi mục có trần cỡ), nên lần hai vẫn tải lại — 4.1s cả hai lần trên
  localhost. Muốn nhanh thật thì phải **chẻ gói ra nhiều file nhỏ** (mỗi nhân vật một file),
  chưa làm.
- **`const PACK_URL` phải khai TRƯỚC `sfxRestore()`.** Để nó ở dưới thì lúc `sfxRestore()`
  chạy (rất sớm), `PACK_URL` còn trong TDZ, `packLoad()` ném lỗi **ngay trong `try{}` và bị
  nuốt mất** — trang chơi im lặng không nạp gói, không một dòng lỗi nào. Mất một lượt dò mới ra.
- Gói là JSON chứa ảnh base64 nên **nặng hơn ảnh gốc ~33%**; GitHub chặn file trên 100 MB.
  Muốn bỏ hẳn bước commit thì làm backend — hướng dẫn nằm trong `README.md`.

**Đưa lên mạng**: `.github/workflows/pages.yml` dựng `site/` (trang chơi ở gốc, trang xưởng
ở `/studio/`, kèm `assets/`) rồi đẩy lên GitHub Pages. Bước `configure-pages` mang
**`enablement: true`** để tự bật Pages qua API — thiếu nó thì lần chạy đầu chết ngay tại đó
với `Get Pages site failed … Error: Not Found`, vì repo chưa bật Pages nên không có site nào
để hỏi (đã dính đúng một lần). Pages **không có mật khẩu**: `/studio/` chỉ được giấu đường dẫn.

Kiểm bằng `node tools/t_play.js`.

## 2f. Hai ngôn ngữ, hồ sơ nhân vật, nhạc nền tự chỉnh

Ba yêu cầu đi cùng một lượt: *"chỉnh cho có ít nhất 2 ngôn ngữ Anh - Việt tùy chọn"*,
*"các nhân vật sẽ xem được thông số và mô tả skill nhìn cho đẹp mắt vào"*, và *"bỏ luôn
nhạc nền hoặc đưa setup nhạc nền t tự chỉnh"*.

### Ngôn ngữ — `LANG` / `t()` / `tr()`

- **Mặc định là TIẾNG ANH** (`let LANG='en'`). Người dùng chốt: *"có tiếng anh vs tiếng việt
  nhưng cứ ưu tiên tiếng anh"*. Ai đã bấm đổi thì khoá `cfg_lang` trong kho thắng.
  `t_ui.js` soi đúng chỗ này, đổi mặc định là test đổ.
- `t('khoá')` cho chữ TĨNH (bảng `L.vi` / `L.en`), `tr({vi,en})` cho chữ nằm trong DỮ LIỆU
  (mô tả chiêu, phụ đề màn, tiểu sử), `tf('khoá',{n:…})` cho câu có chỗ điền số.
- **Chữ tĩnh trong HTML gắn `data-i18n="khoá"`**, `applyLang()` quét một lượt là đổi hết.
  Đừng đi gán tay từng `el(...).textContent` — sót là chắc chắn.
- **TÊN RIÊNG giữ nguyên ở cả hai ngôn ngữ**: tên nhân vật, tên chiêu (`Meteor Strike`),
  tên màn (`DEEP SPACE`). Dịch mấy cái đó là mất chất arcade và lệch với tên ô dán tiếng.
- **Nút đổi ngôn ngữ phải có mặt ở CẢ BA chỗ**: thanh công cụ, trong màn chọn nhân vật, và
  trên màn tiêu đề của trang chơi — dùng chung thuộc tính `data-lang-toggle`. Lúc màn chọn
  đang mở nó phủ kín thanh công cụ, chỉ để nút ở đó thì bấm không tới (đã dính).
- Chỉ **XƯỞNG** mới giữ nguyên tiếng Việt (bảng dán ảnh, dán tiếng, ô nhạc, nút thử) — đó là
  đồ nghề của chủ game. Mọi thứ NGƯỜI CHƠI thấy đều song ngữ.
- **Nhật ký trận đấu vẫn chỉ có tiếng Việt** — 216 chỗ gọi `say()`, chưa dịch, ghi ở mục 11.

### Hồ sơ nhân vật — `DEX`

`DEX[key]` là lớp **hiển thị**: `role` · `bio` · `st{pow,spd,rng,def}` (thang 1–5) ·
`skills[{tag,name,vi,en}]`. `dexCard(key)` dựng thẻ: mặt nhân vật, máu, bốn thanh chỉ số,
thẻ chiêu, rồi `<details>` "xem chi tiết số liệu" mở ra **mảng `CHARS[].skills` cũ**.

> **Thanh "Độ khó" (`st.tech`) đã BỎ HẲN.** Người dùng: *"bỏ cái phần độ khó đi"*. Bốn
> thanh còn lại là sát thương · tốc độ · tầm đánh · chống chịu; `t_ui.js` soi luôn để chắc
> `st.tech` không mọc lại. Muốn biết một nhân vật khó chơi tới đâu thì đã có trục
> **Consistency** trong biểu đồ sức mạnh (mục 2g) — đừng dựng lại thanh cũ.

- Hai thứ **khác việc nhau, đừng gộp**: `DEX` để hiểu nhân vật trong ba giây, `skills` để
  soi từng con số — và `t_dora.js` / `t_superman.js` quét đúng mảng `skills` đó.
- **Số trong DEX đọc từ chính hằng số cân bằng** (`${KUNAI_DMG}`, `${SUP.msDmg}`…), không gõ
  tay, nên chỉnh cân bằng là hồ sơ đổi theo — đừng chép số vào.
- `tag` chỉ nhận `'1' '2' '3' 'P' 'U'`. Ô nhãn rộng 26px nên `dexTag()` **viết tắt** nội tại
  / tuyệt chiêu (NT · ULT), chữ đầy đủ nằm ở tooltip — để nguyên "TUYỆT CHIÊU" thì nó xuống
  ba dòng và tràn ra khỏi ô.

### Nhạc nền — mặc định TẮT, nhạc là của bạn

- `MUSIC.on = false` và `MUSIC.synth = false` ngay từ đầu: mở game lên là im lặng.
- `BGM_SLOTS` = **`2 + STAGES.length` ô** (hiện là 14): `bgm_menu` · `bgm_battle` (dùng
  chung khi màn chưa có nhạc riêng) · một ô cho MỖI màn. Nó đọc thẳng `STAGES` nên **thêm
  sàn đấu là bảng tự dài ra một ô** — đừng gõ tay. Nạp file ở bảng **🎵 Nhạc nền của bạn**
  trong xưởng, lưu vào kho theo đúng tên ô.
- Nhạc chạy bằng thẻ `<audio loop>`, **không** đi qua `decodeAudioData` — file nhạc dài,
  giải mã cả bài ra buffer là ngốn bộ nhớ mà chẳng để làm gì.
- **Mọi chỗ bật nhạc gọi `musicStart()`**, đừng gọi thẳng `startMusic()` nữa. Ba nấc:

  | Tình huống | Chạy gì |
  |---|---|
  | có file cho màn này (hoặc ô chung) | **file đó** |
  | không có file cho màn NÀY nhưng có file ở ô khác | theo ô **🎹 Nhạc tự tạo** của xưởng |
  | **không có file nào cả** (`!bgmAny()`) | **nhạc tự tạo**, kèm một dòng nhật ký nói vì sao |

  > **Bật nhạc mà im lặng là vô lý** — người chơi vừa tự tay bấm bật. Nấc cuối trước đây rơi
  > thẳng vào `stopMusic()`: gói phát hành chưa có ô nhạc nào (`pack.bgm` rỗng) nên bấm bật
  > nhạc xong chẳng nghe gì, cũng chẳng có dòng nào giải thích — người dùng nhắn "và có âm
  > thanh" (ý là không có). Dòng `musicNone` chỉ nói **một lần** mỗi lượt mở trang
  > (`musicSaidEmpty`), đừng để nó lặp mỗi lần đổi màn.
- Ô bật nhạc và thanh âm lượng nhạc nằm ở **thanh công cụ chính**, không nằm trong bảng
  tiếng: cả bảng tiếng bị cắt khỏi `play.html`, để trong đó thì người chơi không tắt bật được.
- Gói phát hành mang theo cả nhạc (`pack.bgm`) — nhớ là nhạc nặng, xem cảnh báo dung lượng ở
  mục 2e.

> **Đừng lồng cặp mốc `<!--STUDIO-->` vào trong một cặp khác.** `mk_play.py` cắt bằng regex
> non-greedy nên cặp lồng bên trong làm khối ngoài **đóng sớm**, và cả bảng tiếng lọt sang
> trang chơi — lúc đó `buildSfx()` chạy tiếp rồi ném `null.addEventListener`, trang chơi
> trắng luôn màn tiêu đề. Đã dính đúng một lần khi thêm bảng ô nhạc.

Kiểm bằng `node tools/t_ui.js`.

## 2g. Biểu đồ sức mạnh, hai lối xem skill, và máu chỉnh thoải mái

Người dùng gửi ảnh một biểu đồ mạng nhện (vòng nét đứt, bậc chữ cái S→E) và chốt ba việc đi
chung một lượt: *"lúc ấn chọn nhân vật có thêm nút (xem skill đơn giản - xem skill chi tiết)"*,
*"thiết kế thêm biểu đồ dạng như ảnh tôi gửi thể hiện sức mạnh các nhân vật"*, và *"lượng máu
khi ở trang cho mng chơi thay đổi thoải mái - máu setting chuẩn là 800"*.

### Chín tiêu chí — `PW_AXES` + `DEX[key].pw`

`PW_AXES` khai chín trục theo đúng thứ tự người dùng liệt kê; mỗi trục có **nhãn ngắn** (`s`,
dùng quanh biểu đồ), **tên đầy đủ** (`n`, dùng trong bảng chấm điểm) và **một câu mô tả** (`d`),
tất cả đều song ngữ:

| Trục | Đo cái gì |
|---|---|
| Damage | tổng khả năng gây sát thương, burst + DPS |
| Durability | máu, giáp, giảm sát thương, khiên, hồi phục |
| Mobility | tốc chạy, dash, dịch chuyển, áp sát / thoát thân |
| Attack Speed | tần suất ra đòn và tốc thi triển chiêu |
| Range | đánh nhau ở khoảng cách xa và an toàn |
| Crowd Control | choáng, làm chậm, hất lùi, trói, câm lặng |
| Utility | buff, debuff, hồi máu, triệu hồi, phản đòn |
| Consistency | phát huy đều tay tới đâu, ít phụ thuộc điều kiện / may rủi |
| Comeback Potential | thấp máu thì biến hình / buff / ultimate mạnh tới đâu |

> **Buff cân bằng thì phải kéo biểu đồ lên theo.** Người dùng dặn thẳng: *"chỉnh xong hết
> rồi thì nhớ chỉnh scale, biểu đồ dmg của các nhân vật này lên nhé — tăng dmg đồ thì cứ kéo
> biểu đồ lên tí cho nó phù hợp"*. Đợt buff ChiChi / Tsubasa / Horikita vừa rồi kéo theo:
>
> | | Cũ | Mới | Vì sao |
> |---|---|---|---|
> | ChiChi | dmg 78 · as 82 · con 70 | **dmg 90 · as 84 · con 78** | chí mạng gốc gấp ba và không trần nên vừa nặng đòn vừa đều tay hơn hẳn |
> | Tsubasa | dmg 72 · dur 40 · mob 50 · as 62 · rng 84 · cc 44 · con 52 · cmb 96 | **dmg 84 · dur 44 · mob 66 · as 80 · rng 88 · cc 62 · con 60 · cmb 98** | mọi cú sút nặng thêm, nhịp sút và tốc bóng lên 150%, thêm hất lùi 20% sàn, thêm cửa thoát khi bị dồn góc, và Wings of the Eagle hồi máu |
> | Horikita | dmg 54 · dur 70 · uti 78 · con 48 · cmb 88 | **dmg 62 · dur 84 · uti 88 · con 60 · cmb 96** | form 3 hồi theo máu tối đa, miễn thương và kháng hiệu ứng dày hơn hẳn |
>
> `t_dex.js` chỉ kiểm khung (đủ chín trục, nằm trong 0–100, không ai copy số của ai) nên
> **đổi cân bằng xong nhớ chấm lại tay** — không có phép đo tự động nào bắt được chỗ này.

- Điểm nằm trong `DEX[key].pw`, **thang 0–100**, và đây là **bảng chấm tay** chứ không phải
  phép đo tự động từ hằng số cân bằng — khác hẳn phần số liệu của `DEX[].skills` (mục 2f) vốn
  bắt buộc đọc từ hằng số. Lý do: một con số như "sát thương" phải gộp burst, DPS và cả tần
  suất bắn trúng, không hằng số đơn lẻ nào nói lên được. **Sửa cân bằng nhiều thì nhớ chấm
  lại tay**, `t_dex.js` chỉ kiểm khung (đủ chín trục, nằm trong 0–100, không ai copy số của ai)
  chứ không kiểm gu.
- `pwGrade(v)` quy ra **sáu bậc E · D · C · B · A · S**, mỗi bậc rộng `100/6` — đúng bằng sáu
  vòng của biểu đồ, nên chạm vòng ngoài cùng là S. `pwAvg(key)` là điểm trung bình, hiện ở
  góc phải dòng tiêu đề biểu đồ.

### `radarSvg()` — vẽ bằng SVG, không phải canvas

Thẻ hồ sơ là HTML nên SVG nhúng thẳng vào chuỗi được, tự co theo bề ngang cột và không vỡ nét.
Mấy chỗ dễ sai:

- **`RADAR_PAD` phải chừa chỗ cho cả DÒNG CHỮ nhãn**, không chỉ cho điểm neo: nhãn hai bên canh
  mép (`text-anchor` start/end) nên chữ chạy tiếp ra ngoài điểm neo. Để hẹp là chữ đầu bị cắt
  cụt — đã dính đúng một lần, `Ổn định 44` chỉ còn `định 44`. `t_dex.js` đo hẳn
  `getBoundingClientRect()` của từng nhãn so với khung SVG.
- Trục đầu tiên ở **12 giờ** (góc `-90°`) rồi quay theo chiều kim đồng hồ, đúng lối ảnh mẫu.
- Bậc chữ cái ghi dọc **trục 12 giờ**, sáu cái cho sáu vòng.
- Vùng tô lấy **màu của chính nhân vật** (`C.color`) với `fill-opacity .30`, nên hai cột trái
  phải của màn chọn 1v1 nhìn ra ngay ai mạnh mảng nào.

### Hai lối xem — `DEXVIEW` + `dexView()`

Cặp nút `.vTab` (`#vSimple` / `#vFull`) nằm ngay dưới dòng phụ của màn chọn:

| | Có gì |
|---|---|
| `simple` | mặt nhân vật · ô máu · một câu giới thiệu · **biểu đồ** · bộ chiêu viết gọn |
| `full` | thêm bốn thanh chỉ số 1–5 · **bảng chấm điểm thang 100** (tên, mô tả, thanh, điểm, bậc) · toàn bộ số liệu thô của mảng `CHARS[].skills` |

- **Biểu đồ có mặt ở CẢ HAI lối xem** — yêu cầu riêng của người dùng, đừng gỡ khỏi lối đơn giản.
- **Chạm HAI LẦN vào ô nhân vật thì bật bảng thông số** (`#dexPop`) — người dùng: *"double
  tap vào icon nhân vật để hiện bảng thông số nhân vật (2 nút xem skill sơ lược/chi tiết)"*.
  Cặp nút xem skill nằm ngay trong bảng, **dùng chung `DEXVIEW`** với cặp ngoài màn chọn nên
  đổi bên nào bên kia theo.
  - **Bắt bằng NHỊP BẤM (`tapTwice`), đừng dùng sự kiện `dblclick`**: trên điện thoại cú chạm
    đôi hay bị trình duyệt nuốt mất để phóng to trang nên `dblclick` không bắn ra. Ô `.cTile`
    vì vậy cũng mang `touch-action:manipulation` để chặn cú phóng to đó. Mốc `DBL_TAP = 380ms`;
    ăn rồi thì đặt lại đồng hồ, ba cú bấm liên tiếp không thành hai lần mở.
  - **Cú bấm đầu vẫn CHỌN nhân vật như cũ** — chạm hai lần chỉ là mở thêm bảng, không thay
    chức năng cũ.
  - **Ở hỗn chiến / đánh đội thì chạm vào ô là THÊM MỘT BẢN SAO**, nên `tile()` đo nhịp
    TRƯỚC rồi mới gọi `onClick(e, hai)`; nhánh đội hình `return` ngay khi `hai` bật, không
    thì chạm hai lần vừa nhét hai người vào đội vừa mở bảng. Kéo theo: `openMulti()` trong
    `probe.js` phải **giãn nhịp 420ms khi khoá lặp lại** — đội hình cho chọn trùng nhân vật,
    mà bấm liên tiếp vào cùng một ô thì game hiểu là chạm hai lần và bảng bật lên chặn mất
    mấy cú bấm sau (đã dính, `t_modes` treo 30 giây rồi đổ).
  - Bảng nằm **NGOÀI `#charSelect`** với `z-index:68` (trên `.csel` = 60, dưới `.arc` = 70);
    để trong màn chọn thì nó bị chính màn chọn phủ mất. Đóng bằng ✕, bấm ra nền, hoặc Esc.
  - `paintDex()` vẽ lại cả `#dexPopBody` chứ không chỉ hai ô `detailA` / `detailB`.
  - **Đếm `.vTab` thì phải bám `.cselOpts .vTab`** — cả trang giờ có bốn nút, hai trong bảng.
  - Trong `tile()` đừng đặt tên biến nút là `t`: `t` là hàm dịch, đặt trùng là che mất nó.
- Đổi lối xem thì gọi `paintDex()` chứ **đừng gọi `cselRefresh()`**: hàm kia dựng lại cả lưới
  chọn nhân vật, trang cuộn nhảy về đầu.
- Lựa chọn lưu ở khoá `cfg_dexview`.

### Máu — `HP_STD` và ba đường chỉnh

`HP_STD = 800`, `HP_MIN = 100`, `HP_MAX = 9999`. Trang chơi bị cắt hết thanh công cụ xưởng nên
**màn chọn nhân vật là cửa duy nhất của người chơi**, vì vậy có đủ ba đường, tất cả đi qua
`hpSet()` / `hpSetAll()` → `hpSave()`:

| Đường | Ở đâu |
|---|---|
| ô máu trong từng thẻ hồ sơ (`.dexHpIn`) | chỉnh riêng một nhân vật |
| ô **Máu mọi nhân vật** (`#hpAll`) | ghi đè cả bảng |
| nút **Chuẩn 800** (`#hpStd`) | kéo cả bảng về `HP_STD` |

- Ô trong thẻ do `dexCard()` dựng lại liên tục ⇒ bắt sự kiện **theo uỷ quyền** ở `document`,
  và **không vẽ lại thẻ ngay lúc gõ**, không thì con trỏ nhảy khỏi ô sau mỗi phím.
- Hai ô máu cũ trên thanh công cụ xưởng (`#hpK` / `#hpC`) giữ nguyên, vẫn đi qua `onHp()`.

Kiểm bằng `node tools/t_dex.js`.

## 2h. Tiếng của giao diện, và luật vàng khi đánh bóng CSS

Người dùng: *"Thêm âm thanh cho sôi động, hiệu ứng web làm nhìn chuyên nghiệp và bắt mắt hơn"*.

### Chín ô tiếng của GIAO DIỆN — nhóm `Giao diện`

Đây là **tiếng của cái vỏ arcade, không phải của trận đấu**, nên chúng nằm thành một nhóm
riêng cuối `SFX_EVENTS`, tiêu đề gắn vào ô đầu (`ui_start:'Giao diện'` trong `SFX_GROUPS`):

| Ô | Kêu lúc nào |
|---|---|
| `ui_start` | bấm PRESS START |
| `ui_pick` | chọn một nhân vật (`tile()`) |
| `ui_tap` | bấm ô màn đấu / nút chế độ / nút lối xem skill |
| `ui_next` | `#cselGo` sang bước kế tiếp |
| `ui_back` | `#cselBack` |
| `ui_vs` | `vsShow()` — màn VS hiện ra |
| `ui_go` | `vsGo()` — từ màn VS lao vào trận |
| `ui_board` | `compOpen()` — mở bảng xếp hạng |
| `ui_rank` | `lgPlay()`, **chỉ khi có hàng đổi chỗ thật** (cờ `doiCho`) |

- **Ô nào cũng có `case` riêng trong `synth()`**, đúng luật ở mục 4 — rơi vào nhánh `default`
  thì ô nào cũng kêu giống ô nào. `t_ui.js` soi đủ chín `case`.
- **Tiếng bấm nút phải GỌN và NHẸ**: cả chín ô đều dưới `.2` âm lượng và dưới nửa giây, trừ
  `ui_vs` / `ui_go` vốn là một cú nhấn mạnh. Người chơi bấm cả chục lần trong một lượt chọn
  nhân vật — để dài hay để to là nghe nhức đầu ngay.
- Đấm đá vẫn mượn `sfx('punch')` như cũ; **đừng dựng thêm ô cho mấy nút khác**.

### Luật vàng khi thêm hiệu ứng CSS: ĐỪNG cho nút nhấp nháy mãi

Mọi chuyển động **lặp mãi** ở khu giao diện chỉ được đổi `opacity` / `box-shadow` /
`background-position` / `filter`. Ngoài luật cũ "đừng đụng `transform`" (mục 9) còn một
luật nữa, đắt hơn:

> **Nút mà test phải bấm thì đừng gắn `animation … infinite` lên nó.**

Đo được: gắn một vệt sáng `animation 3.6s infinite` vào `button.primary::after` thì
`page.click('#arcAgain')` treo đủ 30 giây rồi đổ — lúc đó luồng chính đang giải mã 89 ảnh
của gói phát hành, thêm một lượt tính lại kiểu dáng mỗi khung hình là cú bấm không bao giờ
xong. Cùng họ với lỗi "250ms gán lại `style.display`" ở mục 9. Cách làm đúng:

- **nút vàng**: vệt sáng chạy qua mặt nút **khi rê chuột**, bằng `transition:background-position`
  — chạy một lượt rồi đứng yên;
- **ô nhân vật đang chọn**: quầng vàng **đậm hơn, đứng yên**, không nhấp nháy;
- một lượt `animation … 1` (chạy đúng một lần) thì không sao — `.lgTab tr.just` và `.brM.fresh`
  vẫn giữ nguyên.

### Đã đánh bóng những gì

- Ô nhân vật có **quầng sáng theo màu nhân vật** phía sau (`.cTile::before`, `--c` do `tile()`
  gắn vào từ `C.color`) và viền phát sáng quanh ô ảnh (`.cAva`); ô đang chọn thì quầng vàng đậm hẳn.
- Ô màn đấu: ảnh sáng lên lúc rê chuột, ô đang chọn viền vàng dày gấp đôi và tên tô vàng.
- Bảng xếp hạng: **ba hạng đầu tô ba màu** (vàng · bạc · đồng) ở cột số thứ tự, mũi tên
  ▲▼ tô xanh/đỏ, và hai người vừa đá sáng lên một nhịp rồi tắt.
- Dòng phụ dưới logo có một gạch vàng mảnh.

> **Logo KHÔNG tô bằng gradient quét ngang.** Đã thử và bỏ hẳn: chữ phải trong suốt cho
> `background-clip:text` ăn, mà cái bóng khối 3D của logo (`text-shadow:0 6px 0`) thì vẽ
> theo Ô CHỮ chứ không theo phần đã tô, nên **lòi hết ra giữa mặt chữ thành sọc vằn**. Đổi
> sang `drop-shadow` thì hết sọc nhưng nền gradient chạy ra ngoài khung và **mất luôn mấy
> chữ cuối** — chụp màn hình ra đúng mỗi chữ `M`. Logo vốn đã có quầng sáng thở của
> `#arcTitle::after`. **Đừng dựng lại.**

Kiểm bằng `node tools/t_ui.js` (ba mục cuối: đủ chín ô, đủ chín `case`, và bấm thật vào màn
chọn thì **có tiếng phát ra** — đếm ngay ở tầng WebAudio bằng cách bọc
`AudioContext.prototype.createOscillator`, vì `sfx()` nằm trong IIFE nên không bọc từ ngoài được).

## 2i. Hệ thiết kế — lớp token và mấy luật bố cục

Người dùng: *"Cần giao diện chuyên nghiệp hơn nữa — gọn gàng thì đã có nhưng giao diện cần
phải chuẩn hơn và tân tiến hơn"*. "Chuẩn" ở đây là **nhất quán** (một thang bo góc, một
chiều cao ô điều khiển, một bộ bóng đổ), "tân tiến" là **nền mờ nhoè, bóng mềm, ô điều
khiển tự vẽ thay cho đồ mặc định của trình duyệt**.

### Lớp token — sửa một biến, cả trang đổi theo

Khối `:root` ở đầu `<style>` giờ có thêm bốn nhóm. **Đừng gõ mã màu, bo góc hay bóng đổ
thẳng vào từng khối nữa** — đọc qua biến, không thì mỗi chỗ một con số lẻ và cả trang lại
lệch như cũ.

| Nhóm | Biến | Dùng ở đâu |
|---|---|---|
| bậc nền | `--s1` khung lớn · `--s2` ô nổi trong khung · `--s3` ô điều khiển | thẻ, ô nhân vật, nút |
| viền / lòng ô | `--line` thường · `--line2` sáng hơn (lúc rê chuột) · `--ink2` lòng ô nhập | mọi khung |
| bo góc | `--r1` 9px · `--r2` 12px · `--r3` 16px · `--rp` viên thuốc | **chỉ có bốn nấc này** |
| bóng đổ | `--e1` ô nhỏ · `--e2` khung · `--e3` lớp phủ toàn màn | thẻ, sàn đấu, hộp bật lên |
| khác | `--ctl` 34px chiều cao ô điều khiển · `--ease` nhịp chuyển | thanh công cụ |

Mấy tên cũ (`--ink` / `--panel` / `--gold` …) **giữ nguyên** vì đã rải khắp file.

### Chiều cao `--ctl` CHỈ áp cho ô trên thanh điều khiển

```css
.bar>button,.bar>select,.bar>label.chk,.cselBar>button,.arcOver>button{height:var(--ctl)}
```

**Đừng nhét `height` vào luật `button` chung.** Ô nhân vật (`.cTile`), ô màn đấu (`.sTile`)
và nút chế độ (`.mTab`) đều là `<button>` — ghim cứng chiều cao là chúng **bẹp dí xuống
34px, mất cả ảnh lẫn dòng tên**. Đã dính đúng một lần, chụp màn hình ra đúng một hàng ô
rỗng cao ba chục pixel.

### Ô điều khiển tự vẽ

- **`<select>` bỏ hẳn `appearance`** rồi tự vẽ mũi tên bằng một `data:` SVG trong
  `background-image`. Để nguyên đồ mặc định thì giữa hàng nút bo góc lòi ra một cái hộp
  vuông xám của hệ điều hành — đó là thứ làm cả thanh công cụ đọc ra một trang cấu hình.
  Nhớ đặt cả `select option{background:…}`, không thì danh sách xổ ra là nền trắng.
- **`label.chk` là một viên thuốc** ngang hàng với nút, không còn là chữ trần thả giữa
  hàng. Thanh trượt và ô đánh dấu cũng tự vẽ (`accent-color` + track/thumb).
- **Thanh cuộn** tô cùng tông với trang (`scrollbar-color` + `::-webkit-scrollbar`) —
  thanh cuộn trắng của trình duyệt nằm giữa nền tím đậm là chỗ lộ ra "đây là một trang
  web" rõ nhất.
- **Vành sáng bàn phím** dùng `:focus-visible` nên bấm chuột thì không hiện.

### Lưới đấu thủ là FLEX, không phải GRID

`.cTiles` chuyển sang `display:flex;flex-wrap:wrap;justify-content:center`. Lý do: chín đấu
thủ trên một lưới tám cột thì **người thứ chín đứng trơ một mình ở mép trái hàng dưới**,
nhìn như lỗi bố cục — mà grid thì không có cách nào canh giữa hàng cuối. Flex thì hàng dở
dang tự nằm giữa, và **thêm nhân vật mới bao nhiêu người cũng không phải sửa số cột**.

> Vì vậy mấy chỗ chỉnh lưới ở trang chơi giờ chỉnh **`flex-basis` / `max-width` của một ô**,
> không chỉnh `grid-template-columns` nữa. Còn sót một luật `grid-template-columns` nào trỏ
> vào `.cTiles` thì nó là luật chết, xoá đi.

### Mấy chỗ đã sửa cụ thể

| Chỗ | Trước | Sau |
|---|---|---|
| sàn đấu | canvas kẹp ở 520px trong khung 680px ⇒ **thừa hơn 130px nền trống** hai bên | canvas trải tới 600px, padding khung còn 8px |
| thanh công cụ trang chơi | mười ô thả trần giữa trang, xuống ba hàng lệch nhau | gom vào **một khối bảng điều khiển** (`body.arcade .bar`) có nền, viền, tự bó `width:fit-content`, và một vạch ngăn trước nút Bắt đầu |
| lớp phủ (`.csel` / `.dexPop`) | chỉ tối đi 88%, phía sau vẫn đọc lờ mờ | thêm `backdrop-filter:blur(14~16px)` |
| ô chọn màn | ảnh ở trên, một hộp chữ riêng dán dưới | **tên đè lên ảnh** sau lớp phủ tối dần (`.sCap`), ảnh cao 96→124px |
| bảng thông số bật lên | một cột, biểu đồ nở giữa khoảng trống mênh mông | **hai cột** từ 760px trở lên |
| bước chọn MÀN | vẫn treo hàng "xem skill / máu mọi nhân vật" | giấu `.cselOpts` đi, bước cuối chỉ còn một việc |
| gạch dưới dòng phụ màn tiêu đề | `bottom:-7px` nên **đè lên chân chữ**, nhìn như gạch nhầm hai chữ giữa | hạ xuống -13px, rộng 180px |
| nhật ký | viền đứt nét, dòng nào cũng như dòng nào | chấm đầu dòng theo màu phe, mép trên nhạt dần cho biết còn cuộn được |

### Ngôn ngữ hình — GÓC VÁT, chữ HUD, ba màu

Lượt đầu của mục này mới chỉ dọn cho *nhất quán*; người dùng xem rồi bác thẳng: *"nhìn ch
khác gì, nâng cấp nó đẹp và chuẩn và visual phải thật bắt mắt như các game hiện nay"*. Dọn
dẹp thôi thì vẫn ra một trang web sạch sẽ, không ra một cái game. Ba thứ dưới đây mới là
thứ đổi được chất:

**1 · Vát góc — `--cut`.** Mọi khối lớn đều **cắt một hoặc hai góc** bằng `clip-path`:
khung chọn nhân vật, khung sàn đấu, bảng điều khiển, thẻ đấu thủ, ô màn đấu, thẻ hồ sơ,
khung *trận kế tiếp*, ô sơ đồ nhánh, nút vàng, nút chế độ. Hình chữ nhật bo tròn đọc ra
"trang web"; hình vát góc đọc ra "HUD".

> **Góc vát CẮT MẤT bóng đổ ngoài.** `clip-path` xén cả `box-shadow` ra ngoài, nên mọi
> viền và quầng sáng của khối đã vát phải vẽ bằng **`inset`** (`box-shadow:inset 0 0 0 1px …`
> thay cho `border`). Đây là chỗ dễ quên nhất: đặt `border` rồi vát góc thì viền biến mất
> một nửa. Ô đang chọn cũng vậy — quầng vàng của `.cTile.on` và `.sTile.on` đều là `inset`.

**2 · Hai mặt chữ, chia việc rõ ràng.**

| Font | Biến | Dùng cho |
|---|---|---|
| **Chakra Petch** 700 nghiêng | `--fd` | logo, tiêu đề màn, tên nhân vật, tên chiêu, tên màn đấu, chữ VS, nút vàng, tên trong bảng xếp hạng |
| Be Vietnam Pro | *(mặc định)* | thân bài, mô tả, nhật ký |
| Space Mono | — | nhãn micro chữ hoa (ENGLISH ONLY — font này thiếu chữ Việt có dấu) |

Chakra Petch là mặt chữ vuông kiểu HUD và **có đủ bộ chữ tiếng Việt** (đã kiểm: Google Fonts
trả về subset `vietnamese`), nên nhãn có dấu vẫn đúng. Nó cũng **hẹp hơn** Be Vietnam Pro nên
thay vào là chữ co lại chứ không tràn. Chuỗi lùi là `"Chakra Petch","Be Vietnam Pro",…` —
máy test chặn font mạng nên ảnh chụp ra font lùi, vẫn đọc tốt.

**3 · Bóng LỆCH MÀU thay cho gradient trên chữ.** Logo, tiêu đề trang, tiêu đề màn chọn và
chữ VS đều có ba lớp `text-shadow`: **lam lệch trái, hồng lệch phải, đen khối bên dưới**.
Đó là mẹo "lệch màu ống kính" của mấy màn hình game đối kháng — cho ra cảm giác đèn neon mà
**không** phải tô gradient lên chữ. Lối gradient đã thử và **bỏ hẳn** (mục 2h): bóng khối
`text-shadow` vẽ theo ô chữ nên lòi ra giữa mặt chữ thành sọc vằn.

**4 · Bảng màu ba màu, không hơn**: vàng arcade (`--gold`) + **lam điện `--cyan`** + **hồng
nóng `--mag`**. Cặp lam-hồng chạy thành một dải sáng ở mép trên mọi khung lớn, hắt vào hai
góc dưới của màn tiêu đề, và làm hai lớp bóng lệch màu. **Đừng thêm màu thứ tư** — mỗi nhân
vật đã có màu riêng rồi, thêm nữa là loạn.

**5 · Màu nhân vật ăn vào thẻ.** `tile()` gắn `--c` từ `C.color`; thẻ đấu thủ dùng nó cho
**mảng sáng hắt lên từ đáy** (`color-mix`), quầng sau ô mặt, viền ô mặt và vạt màu dưới chân
thẻ. Nhờ vậy chín thẻ đọc ra chín người khác nhau ngay cả khi ảnh còn là emoji. Thẻ hồ sơ
thì `dexCard()` tự dựng một dải `.dexEdge` mang màu đó — đặt trong hàm chứ không đặt biến
lên hộp ngoài, vì `.cDetail` được nhiều chỗ đổ nội dung vào.

**6 · Chế độ đang chọn ĐẢO MÀU.** `.mTab.on` là nền vàng đặc chữ đen, không phải "viền sáng
hơn một chút". Nhìn một cái là biết đang ở chế độ nào.

**7 · Nền và hạt nhiễu.** Nền trang là ba quầng lệch nhau (tím đỉnh · lam trái · hồng phải)
trên một lớp sọc quét, `background-attachment:fixed`. Trên đó là `body::after` phủ một lớp
**hạt nhiễu** alpha `.035` (SVG `feTurbulence` nhúng thẳng): rất nhạt nhưng đủ để mấy mảng
gradient lớn không bị **kẻ sọc** do màn hình 8-bit làm tròn màu — đó là thứ làm nền trông rẻ
tiền. **`pointer-events:none` là bắt buộc** (z-index 9999, phủ kín màn), thiếu là cả trang
không bấm được.

### BỎ HẲN BỐ CỤC "TRANG WEB" — đây mới là chỗ đổi được chất

Sau đợt vát góc người dùng vẫn bác: *"nhìn tổng thể vẫn như là normal, ko đẹp, cần phải
khác đi"*. Đúng, và bài học ghi lại cho khỏi lặp:

> **Đổi màu, đổi font, vát góc — đó là đổi LỚP SƠN. Cái làm người ta đọc ra "một trang
> web" là BỐ CỤC: một cột hẹp canh giữa, mấy cái thẻ xếp chồng, và một hộp thoại nổi giữa
> màn.** Giữ nguyên bộ xương đó thì sơn kiểu gì cũng vẫn ra trang web.

Hai chỗ phải đổi bộ xương, **chỉ ở TRANG CHƠI** (xưởng còn cả chục bảng dán ảnh nên vẫn
một cột, và mọi test cũ đi qua đường đó):

**1 · Màn chọn là MỘT MÀN HÌNH, không phải một hộp thoại.** `body.arcade .cselBox` bỏ hết
`max-width` / bo góc / viền / bóng đổ, kéo lên `width:100%;height:100%`, nền riêng ba quầng
sáng, và canh nội dung bằng `padding: … max(16px, calc((100% - 1080px)/2))` thay cho
`max-width` — nhờ vậy **nền tràn hết màn** mà chữ vẫn nằm trong một cột 1080px. Dải sáng
lam-vàng-hồng chạy suốt mép trên. Tiêu đề nhảy lên `clamp(24px,6vw,44px)`. Bảng thông số
bật lên (`#dexPop`) theo đúng lối đó.

**2 · Trang trong trận là HAI CỘT từ 1040px trở lên.** `body.arcade .wrap` thành `grid`:

```
hàng 1   header  (bắc hết hai cột — logo trái, thẻ cặp đấu phải)
hàng 2   .bar    (bắc hết hai cột — dải HUD chạy suốt)
hàng 3   .stage  ┊  thẻ nhật ký   ← hàng CO GIÃN (1fr)
hàng 4   (span)  ┊  bảng phím
```

- Nhận thẻ nhật ký bằng **`.card:has(#log)`**, đừng đếm `nth-of-type` — thêm bớt một khối
  là lệch hết.
- **Hàng 3 phải là `1fr`.** Để cả hai hàng `auto` thì phần dư của khối sàn (nó bắc qua hai
  hàng) bị chia đều ra và hở một khoảng trống lơ lửng giữa hai thẻ bên phải — đo được hụt
  ~80px. Cho hàng 3 co giãn thì nhật ký kéo cao bằng đúng sàn đấu, bảng phím tụt sát đáy,
  dải bên không còn chỗ trống nào.
- **`.stage` phải `width:fit-content` và canh giữa.** Canvas kẹp ở 600px mà khung trải hết
  cột thì hai bên thừa cả trăm pixel nền trống — đúng cái lỗi "thừa nền" đã sửa ở mục trên,
  chỉ là lần này nằm bên trong khung.
- Nhật ký ở dải bên đổi sang lối **bảng tin trận đấu**: chữ 12px, mép trên và mép dưới đều
  nhạt dần.
- Khung sàn có thêm **bốn ngoặc góc** vẽ bằng tám mảng gradient trên một `::after` duy nhất
  (`pointer-events:none` vì nó phủ lên canvas).

**3 · Thẻ đấu thủ to hẳn ở màn rộng.** Từ 960px: `flex-basis:178px`, ô mặt 70px, tên 15px ⇒
**năm ô một hàng, chín người thành 5 + 4**. Để ô nhỏ thì tám ô lọt một hàng và người thứ
chín lại đứng trơ một mình — đúng cái lỗi bố cục đã sửa ở khổ hẹp, chỉ là nó quay lại ở khổ
rộng. **Đổi cỡ ô thì nhớ đếm lại xem một hàng được mấy ô.**

**4 · Ô chọn màn cao theo chiều cao MÀN HÌNH** (`clamp(124px,26vh,250px)`): màn chọn giờ
chiếm cả màn, để ảnh cao cố định thì sáu ô tụm trên đỉnh và bỏ trống hai phần ba phía dưới.

### Lớp hoàn thiện 2026 — graphite, kính tối và điểm nhấn tiết chế

Sau khi người dùng chốt số liệu và power chart, giao diện được đưa về một hệ thị giác ít
ồn hơn. Khối override cuối `<style>` là lớp đang có hiệu lực và **cố ý thay thế** một số
thử nghiệm neon/vát góc ở trên:

- nền graphite/navy và kính tối thay cho các mảng tím đặc; cyan dùng cho trạng thái/thông
  tin, gold chỉ dành cho hành động chính và lựa chọn;
- bỏ `clip-path` trên card và nút, dùng bo góc 10/14/20px, viền mảnh và bóng mềm để vùng
  bấm rõ, không mất góc chạm trên mobile;
- header, toolbar, sàn đấu và nhật ký vẫn giữ bộ xương hai cột, nhưng giảm glow, tăng khoảng
  thở và phân cấp chữ;
- màn chọn mode/nhân vật/stage giữ toàn màn hình; card dùng màu riêng của fighter làm vạch
  nhận diện thay vì phủ cả card;
- bảng chi tiết chuyển thành sheet giữa màn hình có chiều rộng tối đa 980px; **không đổi dữ
  liệu, công thức hay hình học của power chart**;
- HUD canvas dùng track tối, chữ trắng và viền mảnh; banner VS cùng ngôn ngữ với vỏ ngoài;
- breakpoint 920/560px và `prefers-reduced-motion` là một phần của hệ, không được bỏ khi
  thêm hiệu ứng mới.

Nếu chỉnh tiếp, ưu tiên sửa token trong khối override cuối rồi kiểm cả `index.html` và bản
dựng `play.html`; đừng khôi phục nền tím dày, glow phủ toàn chữ hoặc góc vát diện rộng.

### Luật cũ vẫn nguyên giá trị

Mọi thứ ở mục 2h **không đổi**: chuyển động lặp mãi chỉ được đổi `opacity` / `box-shadow` /
`background-position` / `filter`, và **nút mà test phải bấm thì đừng gắn
`animation … infinite`**. Cả đợt này chỉ có **hai** animation lặp, cả hai đều hợp luật:
`titleSweep` (vệt chéo sau logo, chỉ đổi `background-position`) và `arcPulse` trên
`#arcStart` — cái này đã có từ trước và giờ đổi sang **bóng TRONG**, vì góc vát cắt mất
bóng ngoài nên quầng cũ không còn thấy gì.

> **`clip-path` KHÔNG phải `transform`.** Nó không làm phần tử "chưa đứng yên" nên Playwright
> vẫn bấm được — 55/55 trận của `t_reg` cùng cả bộ test click-nặng (`t_dex` chạm hai lần vào
> ô nhân vật, `t_modes` dựng đội hình, `t_comp` bấm qua cả giải) đều chạy sạch sau khi vát
> góc. Nhưng nó **có** ăn vào phép dò điểm chạm: bấm vào đúng cái góc đã cắt thì rơi xuống
> phần tử phía dưới. Test bấm vào TÂM nên không dính; đừng vát sâu tới mức nuốt mất chữ.

Kiểm bằng `node tools/t_ui.js`, `node tools/t_dex.js`, `node tools/t_play.js`,
`node tools/t_stage.js` — bốn bộ này soi đúng mấy màn vừa sửa.

## 2b. Khoảng cách khi cận chiến — đừng dán vào nhau

Người dùng bác bản cũ: hai người cận chiến đứng chồng hẳn lên nhau, nhìn chỉ thấy một
hình. Nguyên nhân: AI cận chiến chỉ tiến khi `d > 52` (đúng bằng `r+r`), nên hai người
đều dí tới sát rồi đứng lì đó, mà **không có gì cản hai thân người xuyên qua nhau**.

Ba thứ khai ở đầu khu `AI`, sửa số thì sửa ở đây:

| Hằng | Là gì |
|---|---|
| `MELEE_MIN` / `MELEE_MAX` = 58 / 64 | quãng cách AI cận chiến muốn giữ; mỗi người bốc lại một con số trong khoảng này sau mỗi 1.1~2.4 giây (`f.orbR` / `f.orbT`) |
| `MELEE_BAND` = 4 | vùng chết quanh con số đó: xa hơn thì tiến, gần hơn thì **giãn ra**, còn ở giữa thì lượn vòng |
| `MELEE_GAP` = 6 | quãng hở tối thiểu giữa hai thân người, dùng cho cú đẩy tách thân trong `step()` |

- **Cú đẩy tách thân** nằm trong `step()`, ngay trước vòng xử lý `G.waves`: duyệt mọi cặp
  trong `G.fighters`, chồng nhau thì đẩy hai người ra cho đủ `a.r+b.r+MELEE_GAP` = 58px.
  Miễn cho ai **đang lao** (`dash`) — không thì cú lao không bao giờ tới nơi — và cho ai
  đang rời sàn. **Viện binh thuần** (`summon && !ally`: Goku / Gohan / phân thân) đứng yên
  tại chỗ nên chỉ người kia dịch ra.
- **Tầm tay nới theo**: `MELEE_REACH = 24` (cũ 16), tức `r+r+24 = 76`. `SUZ.atkRange` phải
  bằng đúng con số đó. Không nới thì nhịp ra đòn tụt hẳn một phần tư — đo được 62 → 48 đòn
  trong 15 giây trong trận; nới rồi thì về đúng 60 → 60.
- **Bước chân ngẫu nhiên**: mỗi người có thêm một hướng nhiễu `f.jx/f.jy` bốc lại sau mỗi
  0.45~1.1 giây, cộng vào vector đi của cả cận chiến lẫn đánh xa. Cùng với `f.strafe` sẵn có
  thì hai người lượn quanh nhau chứ không đứng chết một chỗ.

Đo được (trung vị khoảng cách giữa hai người, 25 giây trong trận):

| Cặp | Cũ | Mới |
|---|---|---|
| ChiChi vs ChiChi | 38.6 · 69% thời gian dưới 52px | 58.1 · **0%** dưới 52px |
| ChiChi vs Horikita | 51.2 · 63% dưới 52px | 58.8 · **0%** dưới 52px |
| Konohamaru vs ChiChi | 64.2 · 36% dưới 52px | 75.2 · **0%** dưới 52px |

Con số dưới 52 còn sót lại chỉ xuất hiện lúc ai đó **đang lao** (Flying Kick, cú phóng của
Decision Making) — đó là phần được miễn, không phải lỗi.

## 3. Lãnh địa Nara — người dùng muốn gì và không muốn gì

- **KHÔNG vẽ tay cả khung cảnh lãnh địa.** Người dùng chỉ cần một **ô để dán ảnh nền**
  (`SPR.garden`), cộng thêm ô dán **con nai** (`SPR.nara`) đứng cạnh Shikamaru.
- Cái cần đầu tư là **hiệu ứng bom nổ và trói bóng cho thật chi tiết** (`bombAt()`,
  `tendril()`, `drawForestGrip()`).
- **Dải bóng trong lãnh địa chỉ là hiệu ứng nhìn** — không thật sự khoá chuyển động của
  đối phương. (Chỉ chiêu 2 Shadow-Neck Bind mới trói thật.)
- Tên hiển thị: **Nara Clan Forest**.
- Có nút `#testForest` để xem thử lãnh địa mà không cần đánh tới 20% máu.
- Thứ tự vẽ: `drawForestGrip()` phải gọi **sau** khi vẽ nhân vật, nếu không khói bom sẽ
  che mất dải bóng.
- **Lãnh địa trói mọi đối thủ CÓ THANH MÁU** — đấu thủ chính và đồng minh (Ayanokouji).
  Khu rừng là một *vùng*, không phải đòn đơn, nên **khiêu khích không kéo nó về một người**:
  `domainTick()` duyệt `domainTargets(k)`, ai bị trói cũng dính đủ `exhaust` và `outCut`.
- **Viện binh thuần triệu hồi thì không trói được.** Goku / Gohan / phân thân **không có thanh
  máu** — bóng chẳng bám vào đâu. Cờ nhận diện là `summon && !ally`, đúng cái cờ `drawBars()`
  dùng để quyết định có vẽ thanh máu hay không. *(Người dùng: "dạng thuần summon k có thanh máu
  như goku với gohan, phân thân thì trói sao đc".)*
- **Sát thương CHIA ĐỀU cho những người đang bị trói**, không phải mỗi người một lượt riêng:
  một nhịp bốc **một** lượt `rnd(domainLo, domainHi)` rồi nhân `domainShare(n) = 1/n` — một
  người ăn trọn, hai người mỗi người một nửa, ba người mỗi người một phần ba. Trói thêm người
  **không** làm khu rừng mạnh lên, chỉ làm nó dàn mỏng ra.
  `drawForestGrip()` gọi `forestGripOn(k,e)` cho từng người để dải bóng bám đúng ai đang
  bị trói. Hết giờ thì trả `outCut` của cả danh sách về 0.
  *(Đường đi của yêu cầu: lúc đầu cho lãnh địa dí theo `aimTarget()` → bác, "trói cả 2" →
  làm thành giảm dần theo bậc → bác tiếp, chốt là **chia đều** và **chỉ trói ai có thanh máu**.)*

---

## 4. Ô dán ảnh và ô dán tiếng

- Ảnh: `SPR[key][pose]` là mảng `<img>`; danh sách tư thế khai trong `SETS`.
- Tiếng: `SFX_EVENTS` là mảng `[tên, nhãn tiếng Việt]`; chưa nạp file thì dùng tiếng tự tạo
  trong `switch` của `synth()` — **thêm ô mới thì phải thêm cả `case` dự phòng**.
- Lưu trữ: `Store` (kho của Claude nếu có, không thì IndexedDB), khoá `spr_<key>` và `sfx_<tên>`.
- **Xoá riêng một ô**: mỗi ô có nút `✕` ở góc trên bên phải (class `.slotdel`), chỉ hiện khi ô
  đã có nội dung. Bấm là xoá đúng ô đó — cả trong bộ nhớ lẫn trong kho — rồi bật nút *Hoàn tác*
  (`#sprUndo` / `#sfxUndo`). Ba điều bắt buộc khi đụng vào chỗ này:
  1. **Nút `✕` phải nằm NGOÀI thẻ `<label>`** (là anh em của nó trong `.slotwrap`). Để trong
     label thì cú bấm bị label nuốt và mở luôn hộp chọn file.
  2. Cờ `.set` gắn ở **cả `.slot` lẫn `.slotwrap`** — CSS hiện nút đọc `.slotwrap.set`. Bên
     bảng tiếng mọi chỗ bật/tắt đi qua `sfxSet(nm,on)`, bên bảng ảnh qua
     `setFrames()` / `clearFrames()`; đừng sửa class hay chữ `✓` bằng tay ở chỗ khác.
  3. Xoá xong phải `inp.value=''`, không thì chọn lại **đúng cái file vừa xoá** sẽ không bắn
     sự kiện `change` — nhìn như nút nạp bị hỏng.
  Thùng rác chỉ giữ **lần xoá gần nhất** (`SPR_TRASH` / `SFX_TRASH`), mất khi tải lại trang.
  Nút xoá cả bộ ảnh giờ cũng hỏi lại và hoàn tác được, giống bên bảng tiếng.

### Nạp hàng loạt theo tên file — khỏi bấm từng ô

Người dùng bác lối bấm tay: *"cứ tự add tốn thời gian quá"* — hơn 120 ô ảnh và hơn 70 ô
tiếng, mỗi ô một cú bấm. Cả hai bảng vì vậy có thêm **nạp hàng loạt**: chọn cả một thư mục
(hoặc kéo thả cả thư mục vào bảng) rồi game **tự đoán file nào thuộc ô nào theo TÊN FILE**.

| Nút / vùng | Làm gì |
|---|---|
| ⚡ Nạp cả thư mục ảnh / tiếng | `<input webkitdirectory>` — quét hết file bên trong |
| ⚡ Nạp nhiều ảnh / tiếng | chọn một nắm file rời |
| vùng `.drop` và cả `#slotArea` / `#sfxArea` | kéo thả; thả thư mục thì đi qua `webkitGetAsEntry()` để lấy hết file con |
| 📋 Tải danh sách tên file | xuất `ten-file-anh.txt` / `ten-file-tieng.txt` liệt kê **đúng tên mong đợi của từng ô** kèm nhãn tiếng Việt — đưa cho ai vẽ ảnh / thu tiếng là họ đặt tên đúng ngay từ đầu |

Cách đoán (`bulkSprMatch()` / `bulkSfxMatch()`), ba luật, đừng nới ra:
1. **Chỉ ĐOÁN rồi gọi lại đúng `setFrames()` / `decodeInto()`** như lúc bấm tay — không có
   đường nạp thứ hai, nên sửa cách lưu ở trên là chỗ này đi theo.
2. **Tra theo TÊN KHOÁ** (`SETS[].poses[][0]`, `SFX_EVENTS[][0]`), đúng luật "khoá giữ
   nguyên đời đời" ngay dưới. Nhãn tiếng Việt và bảng `BULK_CHAR` / `BULK_POSE` chỉ là alias
   phụ — `bulkNorm()` bỏ dấu nên `Phi tiêu.PNG` vẫn vào ô `atk1`.
3. **Khớp theo TỪ trước** (`kono idle`), không ra mới khớp dính liền (`konoidle`), và
   **alias DÀI HƠN thắng** — nếu không thì `punch` nuốt mất `punch2`, `shika_stab` nuốt mất
   `shika_stab_hit`.

- **Tên thư mục thắng tên file** (+200 điểm): `suzune/idle.png` là của Horikita kể cả khi
  trong tên file có chữ của người khác.
- **Số ở đuôi sau dấu ngăn là SỐ KHUNG**, gom vào cùng một ô và xếp theo thứ tự:
  `kono_idle_1.png` + `kono_idle_2.png` ⇒ một ô `idle` hai khung. Số **dính liền chữ** thì
  là tên ô chứ không phải số khung (`punch2`, `dance1`) — đó là lý do regex đòi `(^|\s)`
  trước con số.
- **Đoán không ra thì in tên file ra màn hình** (`#sprBulkNote` / `#sfxBulkNote`), không im
  lặng bỏ qua: người dùng đổi tên rồi thả lại là xong.
- Đừng cho Shikamaru mượn alias `nara` — đó là khoá của ô con nai.

Kiểm bằng `node tools/t_bulk.js`.

### Bộ giọng máy dựng sẵn — `assets/voice` + `tools/mk_voice.py`

Chín ô 🎙 không còn phải chờ người dùng tự thu: `python3 tools/mk_voice.py` đọc thẳng lời
thoại **lấy từ `index.html`** (`SUZ_ASK`, `SUZ_DECISIONS`, `SUZ_WRONG`, `AYA_STAND`,
`AYA_LAST`, `AYA_BYE`, `GN_SHOUT`, `GN_CHANGE_LINE`, `DORA_HI`) rồi ghi ra
`assets/voice/*.wav` + `manifest.json`.

```bash
sudo apt-get install -y espeak-ng mbrola mbrola-us1 mbrola-us2 mbrola-en1
```

**Giọng lấy từ MBROLA**, không phải giọng tổng hợp thuần của espeak — đó là giọng ghép từ
mẫu người thật thu sẵn nên nghe ra người hơn hẳn. Bốn nhân vật bốn giọng khác nhau:

| Ai | Giọng | Cao độ |
|---|---|---|
| Horikita | `mb-us1` (nữ) | giữ nguyên |
| Ayanokouji | `mb-us2` (nam) | ×0.96, trầm và phẳng |
| Ginyu | `mb-en1` (nam Anh) | ×0.86, kéo trầm cho ra phản diện |
| Doraemon | `mb-us1` | ×1.22, kéo cao cho ra mèo máy |

- **Cao độ chỉnh bằng `shift()` chứ không bằng cờ `-p`**: giọng MBROLA có timbre cố định nên
  `-p` gần như không ăn thua (đo bằng số lần đổi dấu: 253 với `p=50`, 244 với `p=90`).
  `shift()` đổi bước đọc mẫu nên kéo hẳn cao độ, và `fit()` đo lại thời lượng SAU khi shift
  vì phép đó co giãn cả độ dài.
- **`mb-us3` thiếu diphone** — câu `AYA_LAST` ra 4 cảnh báo `unknown`, mà MBROLA thiếu thì
  **thay bằng im lặng chứ không báo lỗi**, tức nuốt mất âm mà vẫn chạy tiếp. Vì vậy script
  đếm số cảnh báo và in ra dòng cuối; thấy khác 0 thì đổi giọng. Hiện tại: **0**.
- Máy chưa cài MBROLA thì tự lùi về giọng espeak (`VOICES[...][1]`) — vẫn chạy, chỉ nghe máy móc.
- **Sửa câu thoại trong `index.html` thì chạy lại script**, đừng chép tay câu sang script.
- **Hai ô đọc nối tiếp chia ĐÚNG từng đoạn `SUZ_BUBBLE*RT` = 3.8 giây**: game nhảy tới đoạn
  thứ n bằng phép nhân, nên câu ngắn phải chèn im lặng cho đủ đoạn, và thứ tự câu phải y hệt
  thứ tự trong mảng (mục 4, luật về tiếng số 2).
- **Câu dài quá khung thì đọc NHANH hơn chứ không cắt** (`fit()` tăng dần tốc đọc) — luật
  "tiếng không được sống lâu hơn hình đi kèm". Đo được: `aya_join` 4.7s trên khung 5.0s,
  `ginyu_change` 3.8s trên 5.2s, `suz_think` 2.3s trên 2.4s.
- File 16000 Hz mono 16-bit (đúng tần số của MBROLA), cả bộ ~3.1 MB.

### Thảy thẳng file tiếng vào repo — `tools/mk_manifest.py`

Người dùng hỏi *"h xuất file voice thảy qua repo?"*. Được, và **không riêng chín ô giọng**:
`voicePack()` nạp **mọi ô có tên trong `manifest.json`**, nên `assets/voice` là chỗ để sẵn
tiếng cho cả 82 ô. Ba bước:

```bash
cp tieng-cua-ban/*.mp3 assets/voice/     # đặt tên ĐÚNG TÊN Ô: punch.mp3, ginyu_force.mp3…
python3 tools/mk_manifest.py             # quét thư mục rồi ghi lại manifest.json
git add assets/voice && git commit       # commit cả file tiếng lẫn manifest
```

- **Phải chạy `mk_manifest.py`**: trang web mở qua http **không liệt kê được thư mục**, nó
  chỉ đọc được đúng cái danh sách trong `manifest.json`. Thảy file vào mà quên chạy script
  thì game không thấy gì cả.
- Script **đọc tên ô thẳng từ `SFX_EVENTS` trong `index.html`**, khớp theo tên khoá (bỏ dấu,
  hạ chữ thường, mọi ký tự lạ thành `_` — nên `Suz Think.MP3` vẫn vào ô `suz_think`). Tên
  không khớp ô nào thì **in ra màn hình**, không im lặng bỏ qua. Danh sách tên đúng lấy ở nút
  📋 *Tải danh sách tên file* trong xưởng.
- Nhận `.wav .mp3 .m4a .aac .ogg .opus .flac .webm`.
- **Giữ lại phần mô tả cũ** (`lines` / `seg` / `sec` của giọng máy) khi tên file không đổi, và
  `mk_voice.py` **gọi lại script này ở bước cuối** — nếu không, dựng lại giọng máy là xoá sạch
  danh sách file người dùng tự thảy vào. Đổi thư mục để test bằng `VOICE_DIR` hoặc tham số
  dòng lệnh.
- **So với gói phát hành**: gói là JSON base64 nên đổi một tiếng phải viết lại cả file mấy
  chục MB; thảy file rời vào `assets/voice` thì git chỉ ghi đúng file đó. Ô đã có trong gói thì
  gói thắng (gói nạp trước), nên **đừng để một ô ở cả hai chỗ** — chọn một đường.

**`voicePack()` trong game tự nạp bộ này**, gọi ở cuối lượt khôi phục của `buildSfx()` nên
**ô nào người dùng đã tự nạp thì bỏ qua, không bao giờ đè lên**. Nó đi bằng `fetch` nên:

| Mở trang kiểu gì | Ra sao |
|---|---|
| `http://` (ví dụ `python3 -m http.server`) | tự nạp cả chín ô lúc mở trang |
| `file://` | trình duyệt chặn fetch — kéo thẳng thư mục `assets/voice` thả vào bảng tiếng, hoặc bấm 🎙 **Nạp bộ giọng mẫu** để hiện đúng câu nhắc đó |

Kiểm bằng `node tools/t_voice.js`.

> **Khoá phải giữ nguyên đời đời.** Đổi tên khoá là xoá sạch ảnh và tiếng người dùng đã nạp.
> Đổi tên một ô thì chỉ đổi **nhãn**, giữ nguyên tên khoá.

### Luật về tiếng (người dùng nhắc nhiều lần)

1. **Tiếng không được sống lâu hơn hình đi kèm.** Bảng `SFX_MAXLEN` cắt độ dài theo tuổi thọ
   của hình: `GRUMBLE_LIFE`, `CALL_BANNER_LIFE`, `SUMMON_CHARGE`, `SCOLD_BUBBLE`.
   *(Vì vậy các hằng tuổi thọ này phải khai **trước** `SFX_MAXLEN` — từng dính lỗi TDZ ở đây.)*
2. **File dài đọc nối tiếp rồi lặp vòng**, không lặp lại câu đầu: `SFX_SEG` là độ dài mỗi đoạn
   (có thể là hàm), `SFX_POS` là con trỏ đọc. Áp dụng cho tiếng than thở của Shikamaru và
   tiếng mắng của ChiChi. **Riêng tiếng gọi Goku/Gohan giữ nguyên**, không cắt đoạn.
3. **Chỉ phát khi có bong bóng chat**, không phát nền suốt lúc ngồi lười.
4. `stopSfx(name)` cắt tiếng đang phát qua `SFX_ACTIVE`. Dùng khi Shikamaru bật dậy.
5. `sfx()` có chặn trùng 45 ms — test gọi liên tiếp thì phải giãn ≥70 ms.
6. Cặp tiếng "lúc tung" / "lúc trúng" là mẫu chuẩn: `shika_stab` + `shika_stab_hit`,
   `shika_bind` + `shika_grab`. Tiếng "trúng" đặt **sau** nhánh né, địch né được thì im.
7. **Tiếng KHÔNG chạy theo thanh tốc độ** — xem mục ngay dưới.

### Thoát app rồi vào lại vẫn phải còn tiếng (iPhone) — `audioWake()`

Người dùng: *"fix lỗi thoát ra khoảng 1 tg là vào lại game mất tiếng (trên iphone)"*.
iOS Safari treo `AudioContext` khi trang chạy nền, và nó hỏng theo **ba** kiểu khác nhau —
chữa một kiểu là chưa đủ:

| Kiểu hỏng | Dấu hiệu | Cách cứu |
|---|---|---|
| bị treo | `state` = `'suspended'` **hoặc `'interrupted'`** | `resume()` |
| chết bên trong | `state` vẫn báo `'running'` mà **`currentTime` đứng yên** | **dựng context mới** |
| bị đóng hẳn | `state` = `'closed'` | **dựng context mới** |

- **`'interrupted'` là trạng thái RIÊNG của WebKit** (cuộc gọi, Siri, chuyển app). Nhánh cũ
  trong `ac()` chỉ hỏi `'suspended'` nên bỏ sót đúng cái hay gặp nhất trên iPhone.
- **`resume()` ngoài cử chỉ người dùng hay bị từ chối**, nên đừng chỉ thử một lần lúc trang
  hiện ra. Bốn cửa gọi `audioWake()`: `visibilitychange` (lúc hiện lại) · `pageshow` (quay
  về từ bfcache) · `focus` · và **`pointerdown` / `touchend` ở pha bắt** — cú chạm mới là
  chỗ iOS chắc chắn cho `resume()` chạy.
- **Kiểu hỏng thứ hai phải đo HAI MỐC cách nhau một nhịp thật** (`acWatch`, 400ms): đọc
  `currentTime` một lần thì không phân biệt được với context vừa mở.
- **`audioRebuild()` phải dọn NHẠC TỰ SINH trước.** `startMusic()` gác ở
  `if(MUSIC.gain) return`, mà mấy node đó thuộc context vừa chết — không xoá
  `MUSIC.gain/oscs/lfo/filter` là nhạc im hẳn và **không cách nào dựng lại**. Đây chính là
  nửa "mất tiếng" mà chỉ sửa `resume()` sẽ không chữa được.
- `ac()` cũng tự bỏ context `'closed'` rồi dựng cái mới — mọi đường vào đều lành, không
  phải nhớ gọi `audioWake()` trước.
- **TUYỆT ĐỐI đừng dựng lại context trong lúc đang ghi hình**: `recDest()` và bộ mã hoá
  tiếng bám vào đúng cái context đó. `audioWake()` `return` sớm khi `REC || CFR`, và cái
  hẹn giờ 400ms cũng kiểm lại lần nữa lúc nó nổ (quãng đó người chơi có thể vừa bấm ghi).
- **Đừng gọi `musicStart()` vô điều kiện trong `audioWake()`** — hàm này chạy ở MỌI cú
  chạm, gọi mỗi lần là mỗi lần một lượt dò ô nhạc. Chỉ đá khi nhạc đang thật sự đứng
  (`BGM.el.paused`, hoặc chưa có node nhạc tự sinh nào).
- `SFXBUF` giữ nguyên: `AudioBuffer` không bám vào context nào cả, context mới phát lại
  được. Nhưng `SFX_ACTIVE` thì phải xoá sạch — nó trỏ vào node của context đã chết.

Kiểm bằng `node tools/t_ui.js` (bốn mục cuối): ép `suspend()` rồi gọi `audioWake()` ⇒ chạy
lại và bấm nút có tiếng; ép `suspend()` rồi **chỉ bấm một cú bất kỳ** ⇒ cũng tỉnh; ép
`close()` ⇒ dựng lại context mới và vẫn kêu; và nhạc tự sinh sống lại sau khi context chết.

### Tiếng KHÔNG chạy theo thanh tốc độ — đã BỎ HẲN, đừng dựng lại

Từng có một bản cho tiếng chạy theo thanh tốc độ (người dùng: *"âm thanh khi chúng ta chọn
x1.5 hay x2 thì âm thanh cũng phải nhanh x1.5 x2… để âm thanh k bị lạc quẻ"*): một cửa duy
nhất `sfxRate()` trả về `speedMul/BASE_SPEED`, file thu sẵn đọc bằng `playbackRate = R`,
tiếng tự tạo thì rút ngắn `dur` / `delay` đi `R` lần.

**Người dùng bác:** *"âm thanh khi chuyển sang 2x quá bóp méo, chỉnh lại bthg đi"*. Đúng —
đọc buffer gấp đôi là **tua băng**: cao giọng lên hẳn, tiếng nói méo và tiếng động thì chói;
tiếng tự tạo rút ngắn còn nửa quãng thì cụt lủn. Đã gỡ sạch:

| Đường tiếng | Giờ ra sao |
|---|---|
| **file thu sẵn** (`playBuffer`) | `playbackRate` để nguyên **1** ở cả bốn mốc tốc độ |
| **tiếng tự tạo** (`tone()` / `noise()`, cả ô `cheer` tự dựng buffer) | `dur` / `delay` đúng con số khai, không chia cho gì cả |
| **nhạc nền** — file lẫn nhạc tự sinh | vốn đã đứng ngoài từ trước (`bgmRate()` bỏ từ lâu) |

- **Không còn hàm `sfxRate()`**, không còn `bgmRate()`, và cả `index.html` không được có
  lại chữ nào như vậy — `t_speed.js` soi thẳng bằng regex. Hook `__sfxRate` trong
  `probe.js` cũng gỡ theo, chỉ còn `__speedMul`.
- Trong `playBuffer()` giờ chỉ còn **một đơn vị thời gian**: `off` / `len` / `dur` cùng
  `SFX_MAXLEN` / `SFX_SEG` vừa là giây của file vừa là giây thật, vì buffer đọc ở tốc độ 1.
  Đừng dựng lại kiểu chia `R` cho mấy mốc âm lượng — đó chính là chỗ trộn hai đơn vị.
- **Cái giá phải trả, biết trước chứ không phải lỗi:** ở 2x bong bóng thoại sống nửa quãng
  thời gian thật, nên câu thoại dài có thể ngân lâu hơn cái bong bóng đi kèm (luật số 1 ở
  trên). Người dùng chọn thà vậy còn hơn nghe tiếng méo. Muốn chữa thì **cắt ngắn theo
  `stopSfx()` lúc bong bóng tắt**, đừng đụng lại vào `playbackRate`.

Đo được (`t_speed.js`): tiếng tự tạo `rasengan` ngân **0.58s ở cả 0.7x · 1x · 1.5x · 2x**;
ô có trần `kame` giữ nguyên 5.00 giây nội dung và **5.00 giây phát thật** ở mọi mốc; file
thu sẵn ra `playbackRate` đúng 1 ở cả bốn mốc; nhạc nền vẫn giữ nhịp gốc như trước.

---

## 5. Phân cảnh, ưu tiên model

`G.freeze` đóng băng trận đấu (hàm `step()` return sớm), camera zoom vào. Hẹn giờ gắn cờ
`cine` vẫn chạy trong lúc đóng băng (`later(t, fn, cine)`).

> **Model phân cảnh được ưu tiên cao nhất.** Cụ thể: dáng ChiChi chấn thương lúc gọi viện
> binh không được để Flying Kick đè lên. Nếu trùng nhau thì **hoãn cú đá lại sau phân cảnh**,
> miễn sao không chồng model.

---

## 6. Sát thương và né đòn

```js
tryEvade(t, kind)   // kind: 'dot' và 'domain' không né được; 'big' né được nhưng không cộng dồn
hurt(t, amt, src, crit, kind, tint)   // TRẢ VỀ true nếu đòn thật sự trúng
```

**`hurt()` bắt buộc `return true` ở cuối.** Từng thiếu dòng này và mọi đòn đánh đều bị đọc
nhầm thành né, âm thầm mất hết choáng/cháy/chảy máu ăn theo.

Mọi hiệu ứng ăn theo phải kiểm tra giá trị trả về:

```js
const landed = hurt(e, dmg, k, 'SHADOW STAB!', 'big');
if (!landed) { say('...né được...','s'); return; }
bleedOn(e, k);
```

---

## 6b. Thứ tự vẽ chữ nổi — bong bóng thoại luôn nằm trên

Mọi chữ nổi (số sát thương, băng-rôn tên chiêu, bong bóng thoại) đều nằm chung mảng
`G.floats` và trước đây vẽ đúng theo thứ tự trong mảng, nên thứ nào **đẩy vào sau thì đè
lên trên**. Hệ quả: tung chiêu ngay lúc đang nói là băng-rôn `RASENGAN!` / `DECISION!` phủ
kín câu thoại. **Người dùng chốt: lời thoại được ưu tiên, hiệu ứng chiêu chạy phía dưới.**

- `chatFloat(f)` = `f.banner && f.bubble && !f.gold` — đúng khung trắng bo góc có đuôi nhọn
  do `talk()` / tiếng than Shikamaru / câu mắng ChiChi tạo ra. Băng-rôn tên chiêu cũng là
  bong bóng nhưng **viền vàng** (`gold:true`), nên **cờ `gold` chính là ranh giới** giữa
  "lời nói" và "hiệu ứng chiêu". Đặt bong bóng thoại mới thì đừng gắn `gold`.
- Thân vẽ một dòng chữ tách thành hàm riêng `drawFloat(f)` để gọi được nhiều lượt.
- `draw()` vẽ **hai lượt**: trong vùng cắt của sàn vẽ mọi float **không phải** thoại; xong
  hết `arenaFrame()` / `drawFlashback()` / `drawCallBanner()` mới mở lại đúng vùng cắt +
  `camApply()` để vẽ đám bong bóng thoại. Nhờ lượt cuối này bong bóng nằm trên **cả băng-rôn
  giữa màn** (NARA CLAN FOREST, TWIN SHOT!!, AYANOKOUJI…) vốn vẽ ở hệ toạ độ màn hình.
- **Lúc hồi tưởng (`G.flashback`) thì bong bóng vẫn vẽ ở lượt đầu**, không đẩy lên trên:
  phân cảnh đó phủ kín màn, chữ đè lên nhìn rối.
- Bong bóng thoại chỉ được vẽ **một lượt duy nhất** — vẽ hai lượt thì viền đen và nền trắng
  chồng lên nhau, nhìn đậm hẳn lên.

Kiểm bằng `node tools/t_bubble.js`: đặt câu thoại và băng-rôn tên chiêu chồng đúng lên nhau
rồi **đếm điểm ảnh** giữa chỗ chồng — nền trắng phải chiếm >50%, viền vàng phải là 0%. Bản
cũ đo ra 35% vàng và test đổ đúng 5 mục.

## 6c. Cỡ chữ hiệu ứng — nhỏ lại, trừ chiêu focus

Người dùng bác bản cũ: tên chiêu và tên hiệu ứng nổi lềnh khềnh khắp sàn, "nhìn rối mắt
quá". `drawFloat()` vì vậy nhân thêm một hệ số qua `floatScale(f)`:

| Loại | Hệ số | Ví dụ |
|---|---|---|
| có cờ `focus:true` | **1** (giữ nguyên cỡ to) | `RASENGAN!`, `PRE-WINGS OF THE EAGLE` |
| băng-rôn cỡ đầy đủ (`big`, hoặc không có `sc`) | `NAME_FULL = .62` | `FLYING KICK!`, `SHADOW STAB!`, `CRITICAL HIT!`, `EXHAUSTED …` |
| dòng phụ vốn đã nhỏ sẵn (`sc` < 1, không `big`) | `NAME_SMALL = .74` | `DODGE`, `BLOCKED`, `GOAL 3/5` |

> **Đã hạ hai lần.** Lần đầu `.74 / .85`, người dùng xem rồi bảo *"giảm cỡ chữ hiệu ứng
> thêm nữa"* nên hạ tiếp xuống **`.62 / .74`** (nhỏ thêm chừng 15%). Muốn hạ nữa thì sửa
> đúng hai hằng này, đừng đụng vào cỡ gốc 27/21 px — cỡ gốc còn dùng cho phép đo khối chữ.

> **Riêng Beatrice có thêm một nấc nữa — `BEA_FX = .72`, bật bằng cờ `beaFx:true`.** Bộ chiêu
> của cô có năm chiêu tự bung đúng nhịp hồi chiêu, mỗi chiêu đẩy ra HAI dòng, nên chữ chồng
> kín sàn (xem mục Beatrice). Kèm theo là **sàn cỡ chữ `FX_MIN = 8` px** cho mọi băng-rôn,
> kẹp **trong `floatScale()`** chứ không kẹp ở chỗ vẽ: `k` còn dùng cho bề dày viền, tách ra
> là chữ nhỏ mà viền vẫn dày.

- Hệ số ăn vào **cả bề dày viền** (`lineWidth`), không thì chữ nhỏ mà viền vẫn dày, nhìn
  bết lại thành một cục.
- **Số sát thương không đụng tới** (34 px cho `big`, 22 px cho dòng thường) — chỗ đó người
  dùng chưa bao giờ chê.
- **Bong bóng thoại có hạ, nhưng chỉ một nấc nhẹ** (người dùng: *"cỡ chữ bubble chat cũng
  giảm 1 tí luôn"*): `CHAT_BIG` 23→**21** px, `CHAT_SM` 16→**14** px. Chữ nói mà nhỏ quá thì
  đọc không kịp, nên đừng hạ sâu như tên chiêu.

> **Cỡ bong bóng gom vào `CHAT_BIG` / `CHAT_SM`.** Mấy con số này (cỡ chữ, chiều cao dòng,
> chiều cao khung, đệm ngang) dùng ở **HAI chỗ** trong `drawFloat()`: lượt **đo khối chữ** để
> kéo bong bóng vào trong sàn, và lượt **vẽ thật**. Trước đây chúng chép tay ở cả hai nơi —
> sửa một chỗ quên chỗ kia là khung lệch hẳn khỏi chữ. Giờ đọc qua `chatBox(f)` và
> `chatFontOf(f)`, muốn đổi cỡ thì sửa đúng một chỗ.
- **Băng-rôn giữa màn** (`G.callBanner`: NARA CLAN FOREST, TWIN SHOT!!, WINGS OF THE EAGLE,
  GOKU!!, AYANOKOUJI…) đi đường riêng `drawCallBanner()`, **không** qua `floatScale()` —
  đó vốn là mấy cú focus nên phải to.
- Vì vậy chỉ có đúng hai chỗ cần cờ `focus:true`: `RASENGAN!` và `PRE-WINGS OF THE EAGLE` —
  hai cú không có băng-rôn giữa màn đi kèm. Thêm chiêu focus mới thì gắn cờ, đừng nống
  `NAME_FULL` lên.

---

## 7. Vẽ và tốc độ khung hình

Máy chạy test không có GPU, nên:
- `ctx.filter` tính theo **từng lệnh vẽ**, đặt rồi phải trả về `'none'`.
- Blit ảnh full màn hình với `imageSmoothingQuality='high'` **rất đắt**. Từng thử cache khung
  cảnh lãnh địa ra canvas phụ, fps **tụt** 43 → 27. Đã bỏ. Đừng thử lại hướng đó.
- Gradient phủ toàn màn hình cũng nặng — dùng dè.

### `ctx.filter` bọc quanh `vector()` là chỗ chết người — đừng lặp lại

Luật "trả `filter` về `'none'`" ở trên **chưa đủ**. Bộ lọc canvas dựng hẳn một **mặt vẽ phụ
cho TỪNG lệnh vẽ**, nên cái quyết định giá không phải là bật/tắt mà là **có bao nhiêu lệnh
vẽ nằm trong quãng bật**:

| Bọc quanh cái gì | Bao nhiêu lệnh chịu lọc | Giá |
|---|---|---|
| một `drawImage` (một tấm ảnh) | 1 | chấp nhận được |
| một lượt `vector()` | **hơn ba chục** `fill`/`stroke` | **không xài được** |

Đo thật, một lượt `draw()` trên máy không GPU: **không vệt 10.9ms · 4 vệt 1503ms · 8 vệt
2977ms** — tức **371ms MỘT vệt bóng mờ**. Đó chính là lý do người dùng báo *"superman thi
triển skill hay chào sân trên web bằng laptop bị lag"*: anh nhả vệt mỗi 0.05~0.07 giây ở cả
ba chỗ (chào sân · Kryptonian Flight · Meteor Strike), mỗi vệt sống 0.3 giây nên lúc nào
cũng có 4~6 vệt trên sàn.

Hai chỗ trong game đã học đúng bài này từ trước, **đọc chúng làm mẫu**: `drawFighter()` gác
lớp ám màu bằng `if(bodyTint&&img)` với ghi chú *"chỉ lọc màu khi vẽ bằng ảnh"*, còn
`ghostCanvas()` nướng sẵn hình vector ra canvas phụ vì lớp nhoè của flashback cũng đắt y
như vậy. Nhánh vẽ vệt bóng mờ thì lọt lưới cả hai.

**Cách làm đúng khi cần một hiệu ứng màu phủ lên cả người: nướng sẵn ra canvas phụ rồi
blit lại** — `ghostSil()`. Ba điều bắt buộc:
1. **Đổi màu bằng `globalCompositeOperation`, đừng bằng `filter`.** Bóng trắng của vệt =
   vẽ người ra ô phụ rồi `'source-in'` + tô trắng: **một** lệnh thay cho mấy chục lệnh lọc.
   Đo được ra **đúng từng điểm ảnh** như `brightness(0) invert(1)` cũ, cả 12 cặp dáng.
2. **Cắt sát mép phần vẽ được** (`ghostBounds()`, quét kênh alpha một lần lúc nướng). Ô nướng
   phải để rộng 240×260 vì không biết trước áo choàng với tóc vươn tới đâu, nhưng blit lại
   nguyên ô rỗng thì mỗi vệt phải trộn hơn sáu vạn điểm ảnh trong suốt: **6.85ms**. Cắt còn
   69×69 thì xuống **0.59ms**. Cắt hay không chênh nhau **hơn 10 lần**, đừng bỏ bước này.
3. **Ghim `G.t=0` lúc nướng.** `vector()` lắc tay chân và tà áo theo `G.t`, mà bóng chỉ nướng
   một lần — không ghim thì dáng đông cứng ở đúng nhịp lắc ngẫu nhiên lúc vệt đầu tiên rơi
   ra, mỗi lần mở game một khác. Ghim rồi thì lần chạy nào cũng như lần nào.

Kết quả đo lại (nhịp khung hình thật, không bọc lệnh vẽ nào):

| | Trước | Sau |
|---|---|---|
| chào sân | **11.0 fps** | **59.6 fps** |
| đánh thường | **1.1 fps** | **60.0 fps** |
| Meteor Strike | 27.3 fps | 54.4 fps |
| Freeze Breath | **0.7 fps** | 56.1 fps |
| Kryptonian Flight | 42.1 fps | 55.3 fps |
| Last Son's Resolve | 32.5 fps | 38.9 fps |

Hai cột đo bằng **cùng một phép**, đừng trộn: con số ở trên lấy từ nhịp rAF thật, KHÔNG bọc
lệnh vẽ nào. Bản bọc từng lệnh vẽ để đếm số lệnh có lọc thì đọc ra cao hơn một nhịp (ví dụ
Kryptonian Flight ra 52 thay vì 42) — dùng nó để **đếm** thì được, để **so fps** thì không.
Số lệnh vẽ có lọc trong 2.5 giây: **19562 → 0**.

`Resolve` vẫn 38.9 fps là chuyện khác, **không phải phần này**: một lượt `draw()` nền trên
máy không GPU đã tốn 11.4ms, quầng nắng của Resolve đội thêm 3.3ms là vượt ngân sách 16.7ms
nên rơi xuống nhịp 30 fps. Mấy chỗ khác của Superman chỉ đội thêm 0.4~0.7ms. Máy có GPU thì
lượt vẽ nền rẻ hơn hẳn nên chỗ này không lộ ra.

Vệt bóng mờ dùng chung nên **ChiChi, Ayanokouji, Rasengan Dash và quãng bay của Ginyu cùng
được vạ** — chỉ là Superman xài dày nhất nên lộ ra ở anh trước.

`node tools/t_perf.js` canh chỗ này: đo phần đội thêm so với chính lượt vẽ nền của máy đó
(máy test không GPU nên con số tuyệt đối vô nghĩa) và soi thẳng nguồn để chắc không ai đặt
lại `ctx.filter` vào nhánh vệt. Đã thử ngược trên bản hỏng: ra **394ms mỗi vệt, nặng gấp
266 lần** và test đổ đúng 4 mục.

---

## 7b. Ghi hình — khung dọc 9:16, nhịp khung cố định (CFR)

Nút `#rec` quay canvas sàn đấu; ô chọn `#rec916` quyết định khung video:
**1080p (1080×1920, mặc định)**, **720p (720×1280)**, hoặc khung nguyên bản. Một canvas phụ
`RECV` đúng cỡ đó, mỗi khung `recFrame()` blit canvas sàn đấu vào giữa.

> **Khung dọc chỉ có hai thứ: nền đen và nguyên canvas sàn đấu đặt giữa** — trong canvas đã
> sẵn băng-rôn tên cặp đấu có màu. **Đừng vẽ thêm chữ gì lên video.** Người dùng đã bác lần
> lượt: dải nhật ký tiếng Việt phía dưới, dòng đồng hồ và chữ AUTOBATTLE phía trên, rồi cả
> dòng tên cặp đấu tự vẽ — "chỉ cần tên màu của cặp đấu vs arena như trước giờ thôi".

### Nút quay của TRANG CHƠI — `#arcRec`

Người dùng: *"Thêm nút quay màn hình 9:16 1080p như bên link dev đi, link game ch có"*.
Nút `#rec` cùng ô chọn khung `#rec916` nằm trong khối `<!--STUDIO-->` nên bị cắt khỏi
`play.html` — trang chơi không có đường nào để quay. Vì vậy có thêm **một nút thứ hai
`#arcRec` nằm NGOÀI mốc `<!--STUDIO-->`**, ngay cạnh *Đánh lại* trên thanh công cụ.

- **Không dựng đường ghi hình thứ hai**: nút gọi thẳng `toggleRec()` như bên xưởng. Trang
  chơi không có ô `#rec916` nên `recWantTall()` rơi về **mặc định 1080** — đúng khung
  9:16 · 1080p người dùng cần, khỏi thêm ô chọn cho rối.
- **Giấu ở xưởng bằng CSS** (`body:not(.arcade) #arcRec`): xưởng đã có `#rec` kèm ô chọn
  khung, hai nút cùng một việc đứng cạnh nhau là rối. `t_play.js` soi `id="rec"` để chắc
  trang chơi không còn nút xưởng — `id="arcRec"` không chứa chuỗi đó nên không đụng nhau.
- **`recLabel(txt, st)` đổi nhãn CẢ HAI nút một lúc**: `#rec` lấy thẳng `txt` (tiếng Việt),
  còn `#arcRec` song ngữ nên tra qua `t('recGo')` / `tf('recStop',{t})` / `t('recWait')`.
  Tham số `st` là **số giây** khi đang quay · `'busy'` lúc dựng file · bỏ trống là đứng chờ.
- Lúc đang quay nút chỉ **đổi màu** (`#arcRec.on`), **đừng cho nhấp nháy** — nút mà nhúc
  nhích thì Playwright không bấm được (mục 9).
- Nút nằm trên thanh công cụ nên mọi lớp phủ toàn màn (`#arcBoot` · `#arcTitle` · `#arcVs`
  z-index 66~72, `#charSelect` 60) tự che nó đi; không phải viết thêm nhánh bật/tắt nào.

Đo được ở trang chơi: bấm nút ⇒ nhãn `⏺ Record 9:16 · 1080p` → `⏹ Stop (0:02)`, bấm lần
nữa ra file **MP4 1080×1920, nhịp khung cố định 60 fps**, kèm tiếng.

### Vì sao không dùng MediaRecorder nữa

`MediaRecorder` gắn mốc thời gian theo **lúc khung tới**, nên file xuất ra là **VFR** —
khung nào vẽ chậm là giãn ra, phần mềm dựng phim hay lệch tiếng. Đường ghi chính vì vậy tự
làm:

1. `cfrPump()` chạy mỗi lượt vẽ, bù cho đủ số khung lẽ ra đã trôi qua. Khung thứ n **luôn**
   mang mốc `n/60` giây; máy khựng thì khung trước được mã hoá lại chứ mốc không xê dịch.
   Bù tối đa 8 khung mỗi lượt, quá thì dời `t0` chứ không dồn cục.
2. `VideoEncoder` (WebCodecs) mã hoá: thử `avc1` trước (Chrome thường có → H.264), không
   thì `vp09`. Khoá hình mỗi 2 giây.
3. `mp4Build()` tự dựng file MP4: `ftyp + mdat + moov`, mỗi track gom vào **một chunk** nên
   `stsc`/`stco` chỉ có một dòng. Track hình timescale `60*1000`, mỗi mẫu **1000 nhịp** ⇒
   bảng `stts` đúng **một dòng** = CFR thật.
   - Track PCM (`sowt`) khai `stsz` **cỡ mẫu cố định** (`ch*2`) và `stts` một dòng
     `[số mẫu, 1]` với timescale = tần số, nếu không bảng sẽ phình ra 44100 dòng mỗi giây.
     Có PCM thì `ftyp` thêm brand `qt  `.
4. Tiếng: **đầu thu PCM cắm thẳng vào đồ thị âm thanh** (`cfrAudioTap`) → `AudioEncoder`
   (`mp4a.40.2`, không thì `opus`) → track thứ hai (`esds` cho AAC, `dOps` cho Opus).
   - **Đừng quay lại `MediaStreamTrackProcessor`.** API đó chỉ có trên Chrome desktop; trên
     Safari/Firefox thì không, và video quay ra chỉ có mỗi track hình — người dùng gửi đúng
     một file như vậy (`avc1` một track, CFR chuẩn, không có tiếng).
   - Thứ tự thử: `AudioWorklet` (chạy trên luồng âm thanh, không rơi mẫu), không được thì
     `ScriptProcessor` (đệm 16384 cho đỡ rơi). Nạp worklet bằng **`data:` URL** — blob URL bị
     chặn khi mở game bằng `file://` (`AbortError`).
   - Đầu thu phải nối vào một `GainNode` gain 0 rồi ra `destination`, không thì đồ thị không
     được kéo.
   - Mốc thời gian của mẫu tiếng tính theo **số mẫu đã đi qua** (`st.apos`), không theo đồng
     hồ máy, nên tiếng không trôi.
   - Cấu hình bộ mã hoá theo đúng **tần số của `AudioContext`**, đừng lấy
     `track.getSettings()`: thông số track có khi lệch với dữ liệu thật, `encode()` ném lỗi
     và mất sạch tiếng.
   - AAC phải khai `aac:{format:'aac'}` cho ra AudioSpecificConfig. Vẫn chuẩn bị sẵn hai
     đường bù: `aacRaw()` lột 7~9 byte ADTS nếu bộ mã hoá trả khung bọc ADTS, `aacAsc()` tự
     dựng ASC nếu không có `description`.
   - **Đừng nuốt lỗi ở đường tiếng.** Mọi nhánh hỏng đều phải `say()` ra nhật ký, và dòng
     "Đã lưu video" nói rõ tiếng bằng codec gì / bao nhiêu mẫu, hay KHÔNG có tiếng.
   - Vòng đọc PCM hay **bị bỏ đói** lúc mã hoá hình, nên lúc dừng phải **chờ tiếng đuổi kịp
     độ dài hình** (tối đa 2.5s) rồi mới `cancel()`, không thì cụt tiếng đoạn cuối.
   - Tiếng vào trễ vài chục ms so với hình, nên track tiếng có `edts/elst` chèn một đoạn
     trống đúng bằng khoảng trễ đó.
   - Máy không có bộ mã hoá AAC thì lui về Opus-trong-MP4 và **báo cho người dùng biết**:
     Chrome/VLC nghe được nhưng vài phần mềm dựng phim thì không.
   - **Hộp mô tả codec (`esds`/`dOps`) phải nằm TRONG sample entry.** Từng dựng nó ra rồi quên
     gắn vào: Chromium vẫn giải mã Opus như thường nên test cũ báo đạt, còn Chrome giải mã AAC
     thì im tiếng hoàn toàn. `t_rec.js` giờ soi thẳng byte của `mp4a` (esds, objType 0x40,
     streamType 0x15, ASC) vì máy test không có AAC để chạy thật.

Không có WebCodecs (Firefox, Safari cũ) thì lui về `MediaRecorder` — vẫn ghi được nhưng là
VFR, và nhật ký nói rõ điều đó.

> **Thứ tự ưu tiên: CFR + AAC/Opus → CFR + PCM thô → VFR có tiếng.** Đừng bao giờ để ra file câm. Sau 1.2 giây mà chưa có mẫu PCM nào vào bộ mã hoá
> (`st.apos === 0`), `cfrNoAudio()` huỷ đường CFR và ghi lại từ đầu bằng `MediaRecorder` —
> bộ ghi đó lấy tiếng qua `MediaStream` nên chạy ở mọi trình duyệt. Xét theo `st.apos` chứ
> đừng xét `st.a`: máy yếu thì đầu ra bộ mã hoá về trễ, PCM vẫn chảy, đó không phải là câm.
> `t_rec.js` chặn lần lượt `AudioEncoder`, `AudioData`, mọi codec tiếng, rồi cả
> `AudioWorklet` + `ScriptProcessor` — cả bốn trường hợp file ra vẫn phải giải mã được tiếng.

### Safari

Người dùng quay bằng **Safari**. Safari có `VideoEncoder` (ra `avc1`) nhưng **không có
`MediaStreamTrackProcessor`**, và tuỳ đời máy có thể không có `AudioEncoder`/`AudioData` —
hai file họ gửi đều chỉ có mỗi track hình. Vì vậy:

- Thiếu `AudioEncoder`/`AudioData`, hoặc bộ mã hoá không nhả mẫu ⇒ **ghép tiếng PCM thô**
  (`sowt`) thay vì bỏ CFR. Người dùng cần CFR để up TikTok nên đây là ưu tiên; đổi lại file
  nặng thêm ~10 MB mỗi phút.
- Có PCM thì **xuất hẳn file QuickTime `.mov`** (major brand `qt  `) và sample entry `sowt`
  phải là **version 1** (kèm `samplesPerPacket`/`bytesPerPacket`/`bytesPerFrame`/
  `bytesPerSample`). Nhét `sowt` version 0 vào MP4 brand `isom` thì Safari **im tiếng** dù
  dữ liệu tiếng nằm đủ trong file — người dùng đã gửi đúng một file như vậy. TikTok nhận
  `.mov` bình thường.
- **Luôn gom PCM song song từ giây đầu**; 1.5 giây sau mới chốt: bộ mã hoá có nhả mẫu thì bỏ
  bản PCM, không thì dùng nó (đủ tiếng từ đầu trận, không hụt mấy giây đầu).
- **Số kênh của `AudioData` phải đúng bằng lúc `configure()`.** Mọi nguồn tiếng trong game
  đều mono nên đầu thu hay trả 1 kênh; cấu hình 2 kênh mà đưa 1 kênh thì `encode()` ném
  "Input audio buffer is incompatible with codec parameters" và mất sạch tiếng.
- `ScriptProcessor` **bỏ hẳn lượt gọi** khi luồng chính bận mã hoá hình (file người dùng gửi:
  tiếng 4.7s / hình 8.7s). Đo theo `e.playbackTime` để biết hụt bao nhiêu rồi **chèn im lặng
  bù** — tiếng mới không ngắn hơn hình và không trôi dần.
- Chỉ khi **không tạo nổi đầu thu PCM** (không có cả AudioWorklet lẫn ScriptProcessor) mới
  nhường cho `MediaRecorder` — VFR nhưng có tiếng.
- `cfrAudioOpen()` thử `isConfigSupported` trước, không được thì **liều `configure()` luôn**:
  Safari có lúc báo false nhưng vẫn cấu hình được.
- Bộ ghi thường gộp hình + tiếng bằng `new MediaStream([...])`, **đừng `addTrack` vào luồng
  canvas** — Safari không chịu. Danh sách mime có thêm `video/mp4` trần.
- Safari hay chặn cú bấm tải tự động, nên `recSave()` in thêm một đường dẫn bấm tay vào nhật
  ký và giữ object URL 5 phút.

Lúc bắt đầu ghi, nhật ký in một dòng chẩn đoán: `VideoEncoder <codec> · AudioEncoder <codec>
· đầu thu <AudioWorklet|ScriptProcessor>` — hỏi người dùng dòng này là biết ngay khâu nào hỏng.

Đo trên máy test không có GPU (fps trong lúc đang ghi): **1080p 55.9 · 720p 60.1 · khung
nguyên bản 59.5** (không ghi: 60.2). Đường WebCodecs còn nhẹ hơn `MediaRecorder` trước đây
(1080p chỉ được 37~45 fps). Hai chỗ vẫn phải giữ cho nhẹ:

1. **`imageSmoothingQuality='low'` cho `RECX`.** Để `'medium'`/`'high'` thì cú thu nhỏ sàn
   đấu mỗi khung kéo fps xuống còn nửa.
2. **Nền đen chỉ tô một lần** (`recPainted`): cú blit sàn đấu không đè lên hai dải đen nên
   chúng vẫn còn từ khung trước.

Vẽ theo hệ toạ độ thiết kế **1080×1920** (`RECD`) rồi `setTransform` thu về bề ngang đang chọn,
nên đổi độ phân giải không phải tính lại toạ độ. `recCanvas(wide)` dựng lại canvas khi đổi cỡ
(gán `.width` là reset luôn transform lẫn `imageSmoothing*`, nhớ đặt lại và tô nền lại).

## 8. Kiểm thử

Bộ test nằm trong `tools/`, chạy bằng Node, không cần cài gì thêm:

```bash
node tools/t_reg.js     # 55 cặp đấu, chạy theo đợt, bắt lỗi trang, xem cơ chế lớn có nổ không
node tools/t_perf.js    # nhịp vẽ: một vệt bóng mờ không được tốn quá 8ms, tám vệt không được
                        # làm lượt vẽ nặng gấp ba, bóng nướng sẵn phải cắt sát mép, và nhánh
                        # vẽ vệt tuyệt đối không đặt lại ctx.filter (xem mục 7)
node tools/t_modes.js   # ba chế độ đấu: 1v1 vẫn y như cũ (hai người, đúng hai đầu sàn),
                        # hỗn chiến (mỗi người một phe, hạ một người thì trận còn chạy,
                        # người cuối cùng thắng, băng-rôn gạch tên người đã bị hạ,
                        # trùng nhân vật thì đổi tên và đổi màu),
                        # đánh đội 2 đội (đồng đội không là đối thủ của nhau, hạ hết đội
                        # kia thì đội còn người thắng, chủ gục thì đồng minh rời sàn theo),
                        # đánh đội 3 đội (đồng đội đứng túm một cụm, quét sạch một đội mà
                        # còn hai đội thì trận vẫn chạy) và 4 đội (trần 4 đội / 8 người),
                        # và một trận hỗn chiến 6 người chạy thật
node tools/t_comp.js    # hai chế độ giải đấu: lịch vòng tròn (3/4/5/8/9/12 người, ai cũng gặp ai
                        # đúng một lượt), xếp được CẢ BẢNG nhân vật vào một giải (trần đọc
                        # số ô trong lưới chứ không ghim số, dòng phụ và hàng thể thức đếm
                        # đúng theo), khối kết quả đã đá bị cắt còn 40 trận gần nhất,
                        # GIẢI KHÔNG có bước chọn màn (chỉ hỏi sàn ở từng trận, không
                        # hỏi hai lần), bảng xếp hạng cộng điểm và xếp thứ tự đúng, dàn đấu
                        # thủ bấm là bật/tắt chứ không có bản sao, MỖI TRẬN của giải được
                        # chọn một sàn riêng trước khi vào, sơ đồ nhánh 8 người đủ ba
                        # vòng + trận tranh hạng ba, 5 người thì khoá nút vào giải, xếp nhánh
                        # bốc thăm / tự xếp (bấm hai người là tráo chỗ), hiệu số = MÁU CÒN
                        # LẠI của người thắng (+137 / −137, dòng kết quả in 0–137) và giải
                        # lưu theo lối tính cũ thì cột hiệu số về 0 mà giữ nguyên điểm,
                        # trận HẾT GIỜ 800-744 thì hiệu số chỉ tính phần chênh 56,
                        # lượt đi lượt về
                        # (mặc định một lượt, bật lên thì nhân đôi số trận và ĐẢO SÂN),
                        # hiệu ứng bảng sau mỗi trận (hàng trượt thật, số đếm dần, mũi tên
                        # đổi hạng, và ảnh chụp chỉ dùng một lần), mỗi trận của giải cũng mở
                        # màn VS trước và thắng xong thì DỪNG ở màn WINNER chờ người chơi bấm
                        # nút đi tiếp chứ không tự nhảy sang bảng,
                        # và cả hai giải chạy từ trận đầu tới lúc có nhà vô địch
node tools/t_wake.js    # Shikamaru bật dậy: câm tiếng, xoá bong bóng, chờ đủ giây, và trần chakra (lazyCap)
node tools/t_dodge.js   # sáu luật né đòn của Shikamaru (choáng, choáng ăn theo, Sexy, lần bù)
node tools/t_kono.js    # Konohamaru: phi tiêu 25 dmg, 30% ra kunai nổ, vụ nổ là AoE nhạt dần
                        # 100%->40% rồi tắt hẳn + bén lửa 5 dmg/s trong 3s (nổ vào tường cũng
                        # lan ra), và Mini Rasengan gỡ vây 40 dmg + hất 30% sàn, hồi chiêu 12s
node tools/t_buff.js    # đợt tăng sức mạnh ChiChi / Tsubasa / Horikita, đo THẬT trong game:
                        # ChiChi chí mạng gốc 30% ăn đúng 30 dmg và cộng dồn KHÔNG có trần;
                        # Tsubasa tỉ lệ overhead kick + tốc bóng + nhịp sút cùng lên 150%,
                        # Drive Shot 90 dmg hất lùi 20% sàn, overhead kick 46, Twin Shot
                        # choáng 4.5s + thủng giáp 9s, Wings of the Eagle hồi 6.5% máu tối
                        # đa TRƯỚC khi chốt nhịp cháy, và cửa thoát khi bị dồn sát mép sàn
                        # (2s người chơi ⇒ tốc chạy ×2.1, giữa sàn thì không kích);
                        # Horikita quyết định đúng 75%/80%, form 3 hồi 10% MÁU TỐI ĐA
                        # (form 2 vẫn theo máu hiện tại), bốn bậc cộng dồn ra 62.5% miễn
                        # thương / 62% kháng hiệu ứng, Ayanokouji lần 2 có 65% máu
node tools/t_chichi.js  # ChiChi: Flying Kick 45 dmg + choáng 2s, và viện binh — Kamehameha
                        # 400 dmg + choáng 2s rồi ghì chân 4s (hết choáng mới tới),
                        # Masenko 100 dmg mỗi đợt + chồng lớp −10%/−7%, và chiêu Mắng hất
                        # ngược cả vòng khí Air Cannon lẫn luồng khí tím của Ginyu (chủ cũ ăn
                        # đúng 85 / 18 dmg của chính mình, đầu đạn xoay theo hướng bay mới)
node tools/t_drive.js   # Drive Shot: thường thì vọt lên trời, trong Eagle thì bay thẳng vào địch
node tools/t_rec.js     # ghi hình: MP4 đúng CFR (stts một dòng), tiếng giải mã ra thật, đường lui,
                        # và TRANG CHƠI bấm #arcRec cũng ra đúng khung dọc 1080×1920
node tools/t_slots.js   # nút ✕ xoá riêng một ô ảnh / một ô tiếng, và nút Hoàn tác
node tools/t_ui.js      # đổi tên game, hai ngôn ngữ (MẶC ĐỊNH TIẾNG ANH, nút đổi ở cả ba chỗ,
                        # chữ và mô tả chiêu đổi theo, nhớ lại lựa chọn), hồ sơ chín nhân vật
                        # đủ song ngữ + thẻ chiêu vẽ ra thật, nhạc nền mặc định tắt và chạy
                        # theo ô nhạc tự nạp; và CHÍN Ô TIẾNG GIAO DIỆN: đủ ô, đủ case
                        # trong synth(), bấm chọn nhân vật / ô màn / nút chế độ đều có tiếng;
                        # và THOÁT APP RỒI VÀO LẠI VẪN CÒN TIẾNG (iPhone): ép suspend() thì
                        # audioWake() cứu được, một cú chạm bất kỳ cũng đánh thức, ép
                        # close() thì dựng context mới và nhạc tự sinh cũng sống lại
node tools/t_dex.js     # chạm hai lần vào ô nhân vật thì bật bảng thông số (đúng người vừa chạm,
                        # hai nút xem skill nằm trong bảng và đi chung lựa chọn với cặp ngoài,
                        # một cú bấm thì chỉ chọn, X / Esc đóng được, hai cú cách xa nhau
                        # không tính), biểu đồ sức mạnh chín trục (đủ chín nhân vật, thang 0-100, sáu bậc chữ cái,
                        # nhãn không tràn khỏi khung), hai lối xem skill (đơn giản không kèm bảng
                        # chấm điểm, chi tiết thì có đủ chín dòng — biểu đồ có ở CẢ HAI), máu chuẩn
                        # 800 và ba đường chỉnh máu chạy được ngay trên trang chơi, màn rừng đã bỏ
                        # chữ Nara mà tuyệt chiêu của Shikamaru thì vẫn giữ
node tools/t_stage.js   # mười hai màn đấu: mỗi màn một tông màu riêng, dán ảnh nền thì ảnh thắng
                        # hình vector, thẻ chọn màn có ảnh vẽ thật, màn đã chọn được lưu,
                        # và sàn có bóng đổ dưới chân
node tools/t_play.js    # hai trang: play.html đúng bằng bản dựng từ index.html, đã cắt sạch
                        # bảng xưởng, luồng arcade từng bước (tiêu đề → CHẾ ĐỘ → P1 → P2 →
                        # màn → đánh, màn chế độ có đủ năm thẻ và chưa hiện lưới nhân vật,
                        # sang bước sau thì dải chế độ biến mất; bấm Đánh lại thì hỏi CHỌN
                        # SÀN trước và sàn vừa chọn ăn vào trận mới,
                        # mỗi bước chỉ hiện một cột, dải "đã chọn" giữ P1 lại, Quay lại về
                        # đúng bước trước), ĐÁNH ĐỘI cũng từng đội một (t0 → t1 → màn, mỗi
                        # bước một khung, hàng chọn số đội chỉ có ở bước đầu, đổi sang 3 đội
                        # thì danh sách bước dài thêm),
                        # MÀN VS trước trận (hai mặt + chữ VS + tên màn, trận đứng yên tới
                        # khi chạm), hết trận thì GIỮ màn WINNER rồi mới hiện dải nút,
                        # gói phát hành được nạp, và xưởng vẫn vào
                        # trận bằng MỘT cú bấm #cselGo; MÀN CHỜ không còn nút "vào luôn khỏi
                        # chờ" — tải đứt thì hiện nút tải lại và vẫn đứng trong màn chờ, bấm
                        # tải lại thì về đủ ảnh mới cho vào, site không có pack thì vào thẳng
node tools/t_bulk.js    # nạp hàng loạt: bảng đoán tên file (thư mục thắng tên file, alias dài
                        # thắng alias ngắn, số đuôi là số khung), nạp thật qua ô chọn file,
                        # file đoán không ra được báo tên, danh sách tên file đủ mọi ô
node tools/t_voice.js   # bộ giọng máy: file khớp lời thoại trong index.html, hai ô đọc nối tiếp
                        # chia đúng từng đoạn 3.8s, mở bằng http thì tự nạp, ô người dùng đã tự
                        # nạp thì không bị đè, và đường "thảy file thẳng vào repo": mk_manifest
                        # đoán đúng tên ô, file sai tên thì báo ra, ô tiếng thường (không phải
                        # ô giọng) tha vào assets/voice cũng nạp được
node tools/t_bubble.js  # bong bóng thoại nằm trên băng-rôn tên chiêu và băng-rôn giữa màn
node tools/t_speed.js   # tiếng KHÔNG chạy theo thanh tốc độ: kéo tới 2x thì tiếng tự tạo
                        # vẫn ngân y nguyên, file thu sẵn vẫn playbackRate 1 (chỗ làm méo
                        # tiếng), ô có trần độ dài phát y hệt nhau ở mọi mốc, trong nguồn
                        # không còn chữ sfxRate/bgmRate, và NHẠC NỀN vẫn giữ nhịp gốc
node tools/t_suzune.js  # ba form của Horikita: quãng đỡ 4s, điểm lớp, Ayanokouji vào rồi rời sàn,
                        # khiêu khích kéo địch ở mọi khoảng cách, anh miễn nhiễm Sexy no Jutsu,
                        # ba ô giọng của anh + hai ô xuất hiện + bảng tiếng chia nhóm,
                        # lãnh địa Nara trói ai có thanh máu và chia đều dmg (trận thứ hai: shika vs suzune),
                        # cước chia tay không nện vào miễn thương, bốn ô dáng riêng của form 3
node tools/t_ginyu.js   # Captain Ginyu: bay vào sân đúng 1.5s và địch bị khoá, hai nhánh aura,
                        # hai thế đứng nhân đúng hệ số, 6 luồng khí + mốc mệt mỏi, flash gồng
                        # rồi mới bắn và ghì chân sau khi hết choáng, CHANGE bắn từ miệng,
                        # đứng nguyên chỗ ngã, đổi hồn giữ nguyên thân xác (thân A chữ B),
                        # sau CHANGE thì chiêu theo hồn / đòn tay theo thân xác và cả hai
                        # bên cùng một mức cắt 25% dmg + 25% hiệu ứng (hồn đối thủ tung
                        # được cả chiêu 2 lẫn chiêu 3 của chính mình, phân thân bay ra thật
                        # từ thân xác Ginyu, đấm đá Ginyu ăn đúng 5.5 dmg trên mốc 22),
                        # HỒI MÁU trong thân xác mượn: chiêu riêng của hồn thì KHÔNG hồi,
                        # đòn tay mượn vẫn hồi nhưng chỉ còn 30%, và dmg của cả hai đều
                        # còn 25%,
                        # bắn trượt thì 1 máu + hoảng loạn, luật ba người thì luôn thăm dò,
                        # và thắng thua tính theo HỒN: thân xác Ginyu thắng thì giải ghi
                        # điểm cho Superman, kèm mức ngắm hỏng 20% / 0.45 rad
node tools/t_dora.js    # Doraemon: Anywhere Door đúng 1.5s bốn pha và địch chỉ đứng chờ,
                        # cửa thần kỳ né được cả tia CHANGE cướp xác của Ginyu (trận 4),
                        # combo 15/15/20 cách nhau 0.6s, Air Cannon (ba dải chính xác, đẩy
                        # 22% sàn, xuyên hai người, đứt trong 0.35s đầu), Small Light (vùng nón
                        # rộng hơn Freeze Breath, giữa nón 35 / rìa nón 20, model 55% mà
                        # hitbox 85%, không cộng dồn, phình lại đúng 0.4s), Emergency
                        # Door (miễn thương, chỉ xoá slow, đáp trong sàn), Take-copter
                        # (+150% tốc chạy, hai cửa vào chốt ở 40% sàn / 2 giây),
                        # Time Machine (2.2s, tua ngược 3.5~10s và in con số ra màn hình,
                        # trần hồi máu 20%, cắt 40% hồi chiêu), và chữ
                        # hiển thị đều bằng tiếng Anh
node tools/t_superman.js # Superman: màn xuất hiện 1.5s bốn pha (bóng người trên cao, tiếp đất
                        # không gây dmg), Man of Steel (100 raw -> 80, burn ăn đủ, trần 60%,
                        # đòn dưới 25 không làm ngã, choáng −15%, lực đẩy −35%),
                        # combo 26/26/38 cách nhau 0.55s, Heat Vision (4×17 + Burning = 83,
                        # khoá hướng sau 0.3s, đứt trong 0.4s đầu), Freeze Breath (Frozen 2.2s,
                        # Chilled 4s, vỡ băng ở 100 dmg, không thổi khi đang bay),
                        # Meteor Strike (chuẩn bị 1.2s, 109+23=132, 147 khi địch Frozen,
                        # vùng chấn động là AoE nhạt dần 100%->35% rồi tắt hẳn,
                        # trượt thì nằm 1.3s và Man of Steel còn 10%), trần khống chế cứng
                        # 3.5s, Kryptonian Flight, từng con số dmg = làm tròn(gốc × 0.75),
                        # và chữ hiển thị đều bằng tiếng Anh
node tools/t_beatrice.js # Beatrice: cửa Forbidden Library đúng 1.5s và địch chỉ đứng chờ,
                        # tầm đánh 5 × R suy từ hộp thân 34×96 (R = 51 ⇒ 255, phản đòn 127.5),
                        # Minya 15 dmg + choáng 20% × 0.5s KHÔNG cộng dồn, Al Shamac ném địch
                        # ra sát rìa 5R (quá gần thì đẩy ra, quá xa thì kéo về, không bao giờ
                        # vượt tầm, không chồng lên model nào) + Shamac Weakness −20% dmg,
                        # Murak tự bung DÙ ĐANG BỊ CHOÁNG và phá luôn cả đóng băng lẫn dải
                        # bóng của Shikamaru nhưng không xoá dot, E.M.T chặn 0 dmg và phản
                        # đúng 20% trong 2.5R (đứng ngoài thì không dính, đòn phản không phản
                        # lại lần nữa), El Minya ba mũi ở 0.65/0.90/1.15s + Minya Slow không
                        # cộng dồn + Mana Erosion trần 3 stack = 6 HP/s, hai lớp giảm sát
                        # thương NHÂN chồng (80 rồi 64 chứ không phải 60), chữ hiển thị
                        # đều bằng tiếng Anh, TỐC ĐÁNH và ỔN ĐỊNH đều là bậc S (đọc qua
                        # pwGrade chứ không ghim số), và chữ effect lúc cast skill thu nhỏ
                        # theo BEA_FX mà vẫn không rơi xuống dưới sàn 8px — cờ beaFx bám
                        # đúng float của cô, không lây sang nhân vật khác
node tools/t_tanjiro.js # Tanjiro: HP đọc từ HP_STD, màn vào sân 1.5s, Opening Thread không
                        # xuyên invulnerability/barrier và chỉ cộng một lần, combo 80,
                        # Water Wheel 75, Constant Flux 130, Dragon Sun Halo 105 không burn,
                        # Mark đọc runtime maxHp và không hồi máu, Ultimate đúng 210, giảm
                        # damage/kháng hiệu ứng nhưng không bất tử, Bright Red chỉ giảm hồi HP;
                        # AI dùng vector melee chung như ChiChi, Water Wheel chờ nhịp riêng
                        # và chỉ tiếp cận khi ở xa; power chart khớp nhịp chiến đấu mới
```

> **`t_buff.js` có một mục CHẬP CHỜN sẵn từ trước, không phải lỗi của ai mới đụng vào.**
> Mục *"Drive Shot hất lùi khoảng 20% sàn (~124px)"* đo bằng cách bám cú dịch xa nhất
> **trong lúc trận vẫn chạy**, lấy mẫu mỗi 10ms — mà Konohamaru thì vẫn đang đi lại, nên con
> số nhảy theo chỗ anh đứng và theo việc lượt lấy mẫu có rơi trúng đỉnh hay không. Đo trên
> `origin/main` (chưa có Beatrice) ra **165px** một lần rồi **đạt** lần sau; đo trên nhánh
> Beatrice ra **91px** một lần rồi **đạt** lần sau — cùng một mục, cùng kiểu chập chờn, ở cả
> hai bên. Thấy nó đỏ thì **chạy lại một lượt** trước khi đi tìm nguyên nhân trong code.
>
> Cùng họ với chuyện này: máy test không có GPU nên chạy nhiều bộ test SONG SONG là mấy phép
> đo theo dòng thời gian lệch hẳn, và `t_suzune.js` có thể chạy quá `timeout`. Chạy từng bộ
> một khi cần con số chính xác.

> **`t_reg.js` giờ chạy toàn bộ cặp đấu của 11 nhân vật**, theo đợt 5 trang một lượt. Máy test yếu thì mỗi trận trôi
> chậm hẳn và nhiều trận báo "còn đánh" thay vì "kết thúc" — đó là chuyện bình thường,
> mục cần xem là dòng cuối `DAT 55/55 tran sach loi`. Muốn soi kỹ một cặp thì chạy riêng.

Tất cả trả mã thoát 0 khi đạt. **Chạy `t_reg.js` trước mỗi lần commit đụng tới cân bằng
hoặc tới `step()`.**

`tools/probe.js` là phần dùng chung: nó đọc `index.html`, chèn một dòng gán vào ngay trước
dấu đóng IIFE rồi ghi ra file tạm, nhờ vậy test với tới được `G`, `SHIKA`, `hurt()`… mà
**không phải sửa `index.html`**. Cần thêm móc thì sửa hằng `HOOKS` trong file đó.
`openGame(keyA, keyB)` lo hết phần chọn nhân vật và bấm vào trận.

Vài điều đã học khi viết test:

- **Đo bằng thời gian trong trận (`G.t`), đừng đo bằng đồng hồ thật.** Chạy headless thì mỗi
  giây thật chỉ trôi ~0.26 giây trong trận — từng đo nhầm Flying Kick thành 20 giây trong khi
  thật sự là 5.
- Đánh tự nhiên hiếm khi kịp tụt xuống máu thấp, mà mấy cơ chế dễ vỡ nhất lại nằm hết ở đó.
  `t_reg.js` vì vậy **ép máu xuống hai chặng** (18% rồi 8%) để gọi Pre-Wings, Wings of the
  Eagle, viện binh và lãnh địa ra. *(Chiêu trói bóng có thể không kịp xuất hiện khi lãnh địa
  mở trước — không phải lỗi.)*
- `sfx()` chặn trùng 45 ms, gọi liên tiếp trong test thì phải giãn ≥70 ms.
- Chặn font mạng (`page.route('**://fonts.*/**', r => r.abort())`) cho khỏi treo.
- Kiểm cú pháp nhanh bằng `new Function(<phần trong thẻ script>)` — nhưng **nó chỉ biên dịch,
  không bắt được lỗi TDZ**, phải chạy thật trong trình duyệt mới thấy.
- Playwright có sẵn ở `/opt/node22/lib/node_modules/playwright`, Chromium ở `/opt/pw-browsers`.
  **Đừng chạy `playwright install`.**

Nút test bấm tay có sẵn trong game: `#testEagle`, `#testForest`, `#testTwin`, `#testGoku`,
`#testGohan`, `#testSuz2` (ép Ayanokouji đỡ đòn → form 2), `#testSuzAya` (nạp đủ 150 điểm
lớp để anh vào sân), `#testSuz3` (ép anh rời sàn → form 3), `#testSupFly`, `#testSupResolve`,
`#testSupFreeze`, `#testSupMeteor`.

## 9. Lỗi đã sửa — đừng làm lại

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| Superman chào sân và thi triển chiêu thì lag trên laptop | vệt bóng mờ vẽ bằng `ctx.filter='brightness(0) invert(1)'` bọc quanh cả một lượt `vector()` — bộ lọc dựng mặt vẽ phụ cho TỪNG lệnh, mà vector có hơn ba chục lệnh; đo được **371ms MỘT vệt**, mà anh nhả vệt mỗi 0.05~0.07 giây ở cả ba chỗ nên lúc nào cũng có 4~6 vệt (chào sân tụt còn **11 fps**, Freeze Breath còn **0.7 fps**) | nướng sẵn bóng trắng ra canvas phụ bằng `'source-in'` rồi cắt sát mép và blit lại (`ghostSil()`): **0.59ms mỗi vệt**, chào sân về **59.6 fps**, ra đúng từng điểm ảnh như cũ. Xem mục 7 |
| Video quay ra không có tiếng | `mAudioEntry()` dựng `esds`/`dOps` rồi quên gắn vào sample entry | gắn `cfg` vào cuối `mBox(type,…)`, và test soi byte thay vì chỉ đếm track |
| Video chỉ có track hình, không có track tiếng | thu PCM bằng `MediaStreamTrackProcessor` — Safari/Firefox không có API này | thu thẳng từ đồ thị âm thanh: `AudioWorklet`, không được thì `ScriptProcessor` |
| Gohan bắn vào chính ChiChi | `summonHelp` cắm cứng `team:1` | `team:c.team` + `master:c`, `foeOf` đi qua `master` |
| Mọi đòn đều thành "né" | `hurt()` thiếu `return true` | thêm lại, và kiểm giá trị trả về ở mọi nơi gọi |
| `GRUMBLE_LIFE is not defined` | khai sau chỗ `SFX_MAXLEN` dùng nó | dời hằng số lên trên |
| Shikamaru ngồi bị bẹt | mẹo `sy*.68` vốn dành cho ảnh đứng | chỉ áp dụng khi **không** có ảnh `lazy` do người dùng nạp |
| fps tụt khi cache khung cảnh | blit full màn hình đắt hơn vẽ vector | bỏ cache |
| Dải bóng bị khói bom che | vẽ chung với nền | tách ra `drawForestGrip()`, gọi sau nhân vật |
| Dáng thủ chéo tay của Horikita nhìn không ra | vẽ tay trước tóc, hai lọn tóc dài che mất | vẽ hai tay **sau** đầu và tóc, ở cuối khối vector |
| Câu thoại dài tràn ra ngoài sàn | bong bóng thoại chỉ vẽ được một dòng | `wrapTxt()` + nhánh bong bóng nhận `\n` nhiều dòng; dùng qua `talk()` |
| Ayanokouji đứng chồng lên Horikita | chỗ đứng chỉ cách 48px, mà hình rộng ~40px | giãn ra 66px và giãn luôn đội hình lúc chắn cận chiến |
| Chữ thò ra ngoài khung sàn | mọi float vẽ đúng tại `f.x/f.y`, không ai đo bề ngang chữ | đo khối chữ trước rồi kéo vào **khung đang nhìn thấy** (`W/z × H/z` quanh tâm camera), không phải cả sàn — lúc phân cảnh zoom, chỗ nằm trong sàn vẫn có thể nằm ngoài màn hình. Dòng trạng thái dưới thanh máu cũng canh theo bề ngang của chính nó |
| Mũi tên bong bóng quyết định tụt vào trong khung | lấy `min(bw/2,bh/2)` làm mép | tính giao điểm của tia với hình chữ nhật |
| Cú cước chia tay đo ra 160 thay vì 150 | test cộng dồn mọi lượng máu địch mất, mà Horikita vẫn đấm 10 dmg ở form 1 | đo **cú sụt lớn nhất trong một nhịp**, đừng cộng dồn |
| Test treo cứng, không lỗi không thoát | `pickLine()` bốc lại tới khi ra chỉ số **khác lần trước**, mà test ghim `Math.random` một hằng số nên vòng `do…while` không bao giờ ra | gọi `window.__resetLines()` (móc trong `probe.js`) trước mỗi lần ghim `Math.random` rồi mới gọi `suzDecide` — lần bốc đầu chắc chắn ăn, `pen` cũng thành số cố định để đo |
| Cước chia tay của Ayanokouji thỉnh thoảng không gây dmg | rơi trúng 0.75 giây tự miễn thương của Sexy no Jutsu, `hurt()` trả false ngay từ đầu hàm | treo cú lao lại trước mặt địch cho tới khi hết miễn thương (`SUZ.guardKickWait` làm trần chờ), và sửa dòng nhật ký báo nhầm thành "bị né" |
| Ảnh tơi tả của Horikita không hiện | `sprite()` bật cờ `inj` bằng `set.injured` — ô lùi chung, còn ô thật là `injured2`/`injured3` | cờ đọc `injArr` chọn theo form; bỏ luôn hai ô lùi chung khỏi bảng |
| Model bị thu nhỏ phình lại quá nhanh | nhịp bước tính bằng `dt/growT` — đó là phần của cả dải 0→1, trong khi quãng đi thật chỉ là `1 − shrunkSize` = 0.45 dải | nhân thêm đúng quãng đó: `span*dt/growT`; đo lại ra đúng 0.4 giây người chơi |
| Hệ số nhân cộng dồn khi gọi lẻ `drStatus()` | `gnStatus()` GÁN còn `drStatus()` NHÂN CHỒNG, nên gọi `drStatus()` một mình là nhân dồn qua từng nhịp | gộp thành một cửa duy nhất `statusTick(f,dt)`; test cũng phải gọi qua đó |
| `t_bubble.js` đổ oan ở nhánh "đảo thứ tự" | mốc `trang > .5` nằm đúng chỗ phép đo dao động 49~51% tuỳ lần bốc vị trí — đổ chừng hai trên ba lần, và đổ y hệt trên `origin/main` | hạ mốc xuống `.45`; bằng chứng thật rằng bong bóng nằm trên vẫn là dòng "viền vàng 0%" ngay dưới, còn lúc bị đè thì nền trắng tụt hẳn dưới 40% |
| Model tơi tả của Ginyu nhìn không ra | dấu vết chỉ là hai vệt xước mảnh, đo ra 113 điểm ảnh | đánh vào mảng lớn: giáp sứt, scouter vỡ, đệm vai gãy, bầm tím — lên 464 điểm ảnh, test đòi tối thiểu 300 |
| CHANGE xong mà không hiện model tơi tả khi máu tối đa là số lẻ | `ginyuPossess()` dùng `Math.round(maxHp*.20)`, làm tròn LÊN thì vượt mốc `hp <= maxHp*.20` | đổi sang `Math.floor`; test thử cả máu chẵn 1000 lẫn máu lẻ 999 |
| `t_ginyu.js` đo choáng Ginyu Flash ra 1.68 trên mốc 1.75 | đọc `e.stun` qua vòng poll 15ms, máy bận thì lượt đọc rơi trễ cả chục khung | gọi thẳng `gnFlashHit()` rồi đọc ngay, bỏ hẳn phép đo theo thời gian ở chỗ đó |
| Meteor Strike hất lùi 0px khi lao trúng giữa người | hướng đẩy tính bằng `prime.x-f.x`, mà lao trúng thì hai chỗ đứng trùng nhau nên ra vector 0 | rơi vào trường hợp đó thì lấy luôn hướng lao (`f.ax/f.ay`) làm hướng đẩy |
| Khuôn mặt Superman chìm nghỉm trong tóc | vạt tóc `fillRect` phủ xuống tận hàng mắt | kéo vạt tóc lên cao hơn và hạ hàng mắt xuống một nhịp |
| Cú xoay người đấm tay trái nhìn như chưa đánh | tay xa chỉ dài 17 nên nắm đấm dừng ngay giữa ngực | riêng dáng `punch2` nới tay dẫn lên 26 và vẽ **đè lên thân** |
| Hỗn chiến và đánh đội trắng trơn, không có ô chọn nhân vật nào | `el()` đổi sang trả **ô giả** cho trang chơi, nên `let box=el('grpBox'+i); if(box) return box;` lúc nào cũng đúng và khung đội không bao giờ được dựng | chỗ nào cần biết ô CÓ THẬT hay không thì hỏi thẳng `document.getElementById` |
| Trang chơi im lặng không nạp gói phát hành | `const PACK_URL` khai sau `sfxRestore()`, mà hàm đó chạy rất sớm ⇒ TDZ, lỗi ném ra **ngay trong `try{}`** của `packLoad()` và bị nuốt | dời cả khối gói lên trước `sfxRestore()` |
| Bong bóng thoại nhạt hẳn đi, `t_bubble` đổ | lớp tối của sàn vẽ trong `arenaFrame()`, tức SAU lượt vẽ chữ nổi đầu tiên | vẽ lớp tối sau thế giới nhưng **trước** đám float, ở hệ toạ độ màn hình |
| Test bấm `#arcStart` treo đúng 30 giây | nhịp nháy của nút dùng `transform:scale`, Playwright coi là "chưa đứng yên" nên không bao giờ bấm | nhịp nháy chỉ đổi `box-shadow`, đừng đụng `transform` |
| Khán đài sân vận động ra vân chéo | chỗ ngồi bốc bằng phép chia dư `(i*37)%W` | bốc bằng hàm nhiễu cố định `sr(i)` |
| Trang chơi trắng màn tiêu đề, `null.addEventListener` trong `buildSfx` | thêm bảng ô nhạc kèm một cặp mốc `<!--STUDIO-->` **lồng trong** cặp của cả thẻ; `mk_play.py` cắt theo cặp gần nhất nên khối ngoài đóng sớm | đừng lồng mốc; bảng nào đã nằm trong thẻ xưởng thì thôi |
| Bấm nút đổi ngôn ngữ không được | nút chỉ nằm ở thanh công cụ, mà màn chọn nhân vật phủ kín trang | gắn `data-lang-toggle` cho cả nút trong màn chọn lẫn nút trên màn tiêu đề |
| Đội hình hỗn chiến / đánh đội trắng trơn giữa chừng, `t_modes` đổ ở chỗ khác nhau mỗi lần | thêm một `await Store.get(...)` vào `loadSaved()` đẩy lượt `cselRefresh()` ở cuối hàm lùi lại một nhịp IndexedDB — rơi đúng vào lúc người dùng vừa bấm đổi chế độ, lượt vẽ muộn quét sạch khung đội hình vừa mở | đọc khoá phụ bằng `.then()` chứ đừng `await`; mọi thứ cần đọc trước `cselRefresh()` thì gom vào đúng chỗ cũ, đừng nối thêm |
| Nhãn biểu đồ mạng nhện bị cắt cụt chữ đầu (`Ổn định` còn `định`) | `RADAR_PAD` chỉ chừa chỗ cho ĐIỂM NEO, mà nhãn hai bên canh mép nên chữ chạy tiếp ra ngoài | nới chỗ chừa; test đo `getBoundingClientRect()` của từng nhãn so với khung SVG |
| Vào trận trên điện thoại thấy model vector, tưởng mất ảnh | gói 24 MB còn đang tải; dòng đếm MB chỉ nằm trong màn tiêu đề nên bấm PRESS START là mất, không còn gì nói cho người chơi biết là phải chờ | thêm `#loadChip` đè lên sàn đấu, `packNote()` bắn ra cả hai chỗ; đo ở 8 Mbps thì lúc vào trận có 0/89 ảnh, đủ 89 ảnh sau ~25 giây |
| Dán ảnh, xuất gói, commit `pack.json` lên repo mà trang XƯỞNG vẫn hiện model vector | `packLoad()` / `voicePack()` gọi thẳng `fetch('assets/…')`, mà trang xưởng trên Pages nằm trong `/studio/` ⇒ đường dẫn thành `/studio/assets/…` và **404 im lặng** (`try{}` nuốt lỗi) | mọi cú fetch vào assets đi qua `fetchAsset()`: thử `''` → `'../'` → `'../../'` rồi nhớ mức ăn. Test dựng hẳn bản giống Pages rồi kiểm cả hai trang |
| Thả `sup_resolve.mp3` vào `assets/voice` thì `mk_manifest.py` báo "không đoán ra tên ô" | `slot_keys()` bắt cả tên khoá lẫn nhãn bằng mẫu `\['(\w+)','([^']*)'`, mà nhãn của ô đó có dấu nháy đơn (`"Last Son's Resolve bùng lên"`) nên viết bằng nháy kép và cả dòng bị bỏ sót — 82 ô đọc ra thay vì 83 | chỉ bắt **tên khoá** (`\['(\w+)'`), đừng đòi luôn cái nhãn phía sau |
| Trận đấu gương (kono vs kono) treo ở màn chọn, `t_reg` đổ | `tapTwice()` tính theo TÊN NHÂN VẬT, mà đấu gương thì bấm kono ở lưới trái rồi kono ở lưới phải là hai cú liên tiếp cùng tên ⇒ hiểu nhầm thành chạm hai lần, bảng thông số bật lên chặn mất nút Vào trận | mốc gồm **cả lưới lẫn tên** (`parentNode.id + '/' + key`). Đừng lấy chính phần tử làm mốc: mỗi cú bấm ở lưới đội hình dựng lại cả lưới |
| Trận hết giờ 800–744 mà bảng giải ghi +800 / −800 | hiệu số lấy NGUYÊN máu người thắng, không trừ máu kẻ thua — thua vì cạn máu thì đúng, nhưng trận hết giờ thì hai bên cùng dương và một trận sát nút đọc ra như một chiều | `con = máuThắng − máuThua` (kẹp ở 0), `COMP_SC` lên 3 để giải lưu dở theo lối cũ xoá cột hiệu số về 0 |
| Hồn Horikita ngồi trong xác Ginyu ra quyết định vẫn được hồi máu | `suzHeal()` không biết gì về cú CHANGE, mà `swapAs` chỉ cắt sát thương (`dmgOut`) chứ không đụng tới cửa hồi | thêm `gnHeal(f,borrow)`: chiêu riêng của hồn ⇒ 0, đòn tay mượn ⇒ `GN.swapHeal` = 30%, không hoán đổi ⇒ 1 |
| Hiệu số của giải hụt mất mấy trăm điểm | dòng cộng dồn `dmgDealt` trong `hurt()` gác ở `!src.summon`, nên Kamehameha / Masenko do object Goku-Gohan bắn ra **không ghi cho ai cả** — trận ChiChi vs Doraemon ra `369–851` trong khi Doraemon kết trận với 32 máu | ghi công cho `src.master` khi `src` là viện binh, và chỉ cộng phần máu THẬT SỰ mất (`min(amt, t.hp)`) để đòn thừa lúc kết liễu không tính. Đo lại: Kamehameha 400 dmg 0 → **400**, đấm 400 vào người còn 30 máu 400 → **30** |
| Hiệu ứng trượt hàng của bảng xếp hạng không chạy, đo ra 0px | `compOpen()` gọi `compPaint()` TRƯỚC khi bỏ lớp `off`, nên `lgPlay()` đo `offsetTop` bên trong một khối `display:none` — mọi hàng cùng ra 0 nên độ lệch cũng bằng 0 | hiện bảng ra trước rồi mới vẽ; đo lại hàng trượt xa nhất 105px |
| Giải đấu ghi sai người thắng sau cú CHANGE | `compResult()` đọc `f.key`, tức đọc THÂN XÁC — Superman thắng trong xác Ginyu thì điểm về tay Ginyu | tra qua `compSoul(f)` = `f.gnSoul || f.key`. Băng-rôn và thanh máu vốn đã đọc `f.name` nên chúng đúng sẵn, chỉ sổ giải đấu sai |
| Ginyu vào thân xác người khác đánh mãi không trúng | 55% hụt đòn + lệch 1.05 rad, cộng thêm mức cắt 25% sát thương ⇒ cú đấm chỉ còn ~11% sức | hạ xuống `GN.swapMiss = .20` và `GN.aimOff = .45`; đừng ghim số vào `ginyuPossess()` |
| Vòng khí Air Cannon bị hất ngược mà bay lùi với miệng vòng hướng cũ, rồi xuyên qua chính Doraemon | nhánh phản đòn chỉ đổi `p.vx/p.vy`, mà vòng khí vẽ theo `p.ang` và vẫn giữ `p.hitList` cũ | xoay luôn `p.ang` và `p.hitList.length = 0` ngay tại chỗ phản, viết chung cho MỌI loại đạn chứ đừng cắm theo từng type |
| Phép đo "đầu đạn xoay theo hướng bay mới" đổ chừng một nửa số lần | so góc bằng phép trừ thẳng, mà `p.ang` cộng thêm nhiễu nên vọt qua π trong khi `atan2` luôn trả về trong (−π, π] — lệch nguyên 2π mà thật ra vẫn một hướng | so góc theo VÒNG: `d = |x−y| % 2π`, quá π thì lấy `2π − d` |
| Phép đo "ăn nguyên đòn của chính mình" lúc ra 85, lúc ra 45, lúc ra 0 | 45 là cú Flying Kick của ChiChi xen vào, 0 là cú hất ngược lệch ±0.25 rad nên bắn trượt thật | dọn sạch sóng âm + khoá ChiChi rồi mới đo, và **thử tới 10 lượt** đòi có ít nhất một lượt trúng đủ dmg |
| Bấm "Khai mạc giải" thì chớp ra màn VS của cặp đấu TRƯỚC, kèm nhạc và tiếng trận cũ chạy sau lưng bảng xếp hạng | `#cselGo` gọi `arcFight()` vô điều kiện, kể cả khi `startPicked()` vừa mở giải và `return` sớm — `arcFight()` bật nhạc, đặt `running=true` và gọi `vsShow()` với `G.fighters` còn sót của trận trước | gác `if(!compOn()) arcFight();` |
| `page.click` treo 30 giây rồi đổ, mỗi lần một chỗ khác nhau | thêm `animation … infinite` lên `button.primary::after`, mà lúc đó luồng chính đang giải mã 89 ảnh của gói — mỗi khung hình lại một lượt tính kiểu dáng nữa | hiệu ứng nút đổi sang `transition` chạy lúc rê chuột; `.cTile.on` bỏ nhịp nhấp nháy, để quầng vàng đứng yên |
| Logo màn tiêu đề ra **sọc vằn**, rồi sau khi "sửa" thì **mất hết chữ, còn mỗi `M`** | tô chữ bằng gradient `background-clip:text`: bóng khối `text-shadow` vẽ theo ô chữ nên lòi ra giữa mặt chữ; đổi sang `drop-shadow` + `no-repeat` thì nền gradient chạy hẳn ra ngoài khung | bỏ hẳn lối tô đó, trả logo về màu đặc (mục 2h) |
| `openMulti('team',…)` thỉnh thoảng dựng ra một trận **tay đôi** `kono vs chichi` | `loadSaved()` chạy bất đồng bộ và kết thúc bằng một lượt `cselRefresh()`; lượt vẽ muộn đó dựng lại dải nút theo `TMP.mode` đã lưu, quét sạch cú bấm `#mTabTeam` vừa rồi | bấm nút chế độ rồi **kiểm lại `.on`, bấm lại tới khi ăn**; test đổ mỗi lần một chỗ chính vì thiếu chỗ này |
| `openMulti` đổ ở tận `t1[1].hp` / `a.x` undefined | cú bấm ô nhân vật rơi đúng lúc lưới được vẽ lại nên mất trắng, đội hình thiếu người mà mãi sau mới lộ | bấm rồi **chờ dải đội hình dài thêm một thẻ** mới đi tiếp, và chốt lại số người ở cuối mỗi đội; lần thử lại phải **nghỉ quá 380ms** (`DBL_TAP`), không thì game hiểu là chạm hai lần và mở `#dexPop` — bảng đó phủ kín trang, chặn luôn `#cselGo` |
| Tiếng méo hẳn ở mốc 2x | file thu sẵn đọc bằng `playbackRate = speedMul/BASE_SPEED` — gấp đôi tốc độ là tua băng, cao giọng lên hẳn; tiếng tự tạo thì rút ngắn `dur` nên cụt và chói | bỏ hẳn lối cho tiếng chạy theo thanh tốc độ: `playbackRate` luôn là 1, `dur`/`delay` đúng con số khai, gỡ luôn hàm `sfxRate()` |
| Chế độ league / tournament bắt chọn background HAI LẦN liền | `cselSteps()` vẫn cho hai chế độ này bước `stage`, mà từ khi có màn hỏi sàn TỪNG TRẬN thì trận đầu lại hỏi thêm lần nữa — lần chọn ở màn chọn nhân vật bị ghi đè ngay, chọn xong chẳng để làm gì | bỏ bước `stage` khỏi `league`/`cup`: khai mạc giải xong vào thẳng bảng xếp hạng, sàn hỏi riêng cho mỗi trận |
| iPhone: thoát app một lúc rồi vào lại là MẤT TIẾNG | ba thứ cùng lúc — `ac()` chỉ resume khi `state==='suspended'` nên bỏ sót `'interrupted'` của WebKit; context có khi chết hẳn mà `state` vẫn báo `'running'`; và `startMusic()` gác ở `if(MUSIC.gain) return` với node của context đã chết nên nhạc không bao giờ dựng lại | `audioWake()` gọi từ `visibilitychange` / `pageshow` / `focus` / **mọi cú chạm**, resume cả `'interrupted'`, dò `currentTime` đứng yên thì `audioRebuild()`, và `audioRebuild()` dọn sạch `MUSIC.gain/oscs/lfo/filter` trước khi dựng lại |
| Chữ trong thanh phụ thò ra ngoài thanh | `bar()` vẽ nhãn ở cỡ 15px cố định, không ai đo | `bar()` tự thu cỡ chữ cho vừa lòng thanh (sàn 9px) và truyền thêm `maxWidth` làm chặn cuối. Đây là lỗi chung của mọi nhân vật chứ không riêng Horikita: `Chakra: 1025` cũng tràn |

---

## 10. Quy trình git

- Nhánh sửa nhịp AI Tanjiro: `fix/tanjiro-combat-ai`.
- `git push -u origin <nhánh>`; lỗi mạng thì thử lại 4 lần, giãn 2s/4s/8s/16s.
- Người dùng thường merge rất nhanh rồi hỏi luôn "pr?" / "merge đâu" — làm xong một việc thì
  **mở PR ngay**. Nếu PR trước đã merge thì mở PR mới, đừng chồng lên nhánh đã merge.
- Commit message và mô tả PR viết **tiếng Việt**, nói rõ đo được gì.
- **Không ghi tên model** vào commit, PR, hay comment trong code.

---

## 11. Còn treo

- Người dùng có lần nói tiếng bật dậy là ở **75% máu**, nhưng bản mô tả gốc và code đang để
  **80%** (`SHIKA.wakeHp = .80`). Đã hỏi hai lần chưa có câu trả lời — hiện giữ 80%.
- Bộ ảnh thẻ nhân vật (dựng bằng script trong thư mục nháp, chụp bằng Playwright,
  `deviceScaleFactor: 2`, font **Liberation Sans** — DejaVu Sans Mono thiếu chữ tiếng Việt có dấu)
  đang cũ: chưa có Shikamaru lẫn Horikita, và chưa cập nhật vài con số của Tsubasa/ChiChi.
- Ô tiếng của Doraemon mới chỉ có tiếng tự tạo trong `synth()`; ô giọng `dora_hi` giờ đã có
  **giọng MBROLA dựng sẵn** trong `assets/voice`, vẫn chờ người dùng thu file thật đè lên (giọng Nhật cũng được — chỉ **chữ hiển thị** mới bắt buộc tiếng
  Anh). Quãng ra mắt cố tình để đúng **1.5 giây thật ở thanh tốc độ gốc** để canh tiếng.
- Ô tiếng của Captain Ginyu mới chỉ có tiếng tự tạo trong `synth()`; hai ô giọng
  (`ginyu_force`, `ginyu_change`) đã có **giọng máy dựng sẵn**, vẫn chờ file thu thật. Quãng bay vào sân cố tình
  để đúng **1.5 giây thật ở thanh tốc độ gốc** để người dùng canh tiếng — đổi thanh tốc độ
  thì con số đó đổi theo, đây không phải lỗi.
- **Đã hạ sát thương hai vòng theo yêu cầu**: hưng phấn +75%→+50% dmg (khống chế +30%→+40%),
  beam 35→25→**18** dmg và hồi chiêu `gs(8)`→`gs(10)` (đổi lại choáng thành 15% × `gs(1.5)`),
  đòn tay 35→**25**, flash `gs(14)`→`gs(17)`, aura `gs(12)`→`gs(18)` và không cộng dồn với
  thế đứng. **Flash vẫn 100 dmg** — người dùng chưa nêu số mới cho chỗ đó nên tôi không tự
  đặt; muốn hạ tiếp thì sửa `GN.flashDmg`.
- **Phần sau CHANGE gộp làm một mức**: bốn hằng `swapSelf` / `swapSelfCc` / `swapBody` /
  `swapHost` (35/30/40/50%) gộp thành `GN.swapCut` = `GN.swapCcCut` = **25%**, áp cho cả hai
  bên và cho mọi thứ họ tung ra, đòn tay tính luôn. Đổi lại, **hồn đối thủ giữ được bộ chiêu
  của chính mình** thay vì chỉ còn đấm đá. Đây là chỗ tự quyết duy nhất còn lại: người dùng
  không nêu **những chiêu nào** đi theo hồn, tôi chốt là **chiêu bấm tay thôi** — nội tại,
  ultimate theo ngưỡng máu và chiêu ăn theo thanh tiến trình (Rasengan, Twin Shot) đều bỏ,
  vì chúng bám vào thân xác chứ không bám vào hồn. Muốn mở thêm thì sửa `gnSoulThink()` và
  nhớ mở kèm nhánh tương ứng trong `gnSoulTick()`.
- Mười ba ô tiếng của Superman cũng mới chỉ có tiếng tự tạo trong `synth()` — nhân vật này
  **không có ô giọng nào** vì bản mô tả không nêu câu thoại nào cho anh. Quãng xuất hiện cố ý
  để đúng **1.5 giây thật ở thanh tốc độ gốc** để người dùng canh tiếng; đổi thanh tốc độ thì
  con số đó đổi theo, đây không phải lỗi.
- Ô tiếng của Horikita/Ayanokouji mới chỉ có tiếng tự tạo trong `synth()`; sáu ô giọng của hai
  người (kể cả hai ô đọc nối tiếp `suz_decide` / `suz_wrong`) đã có **giọng máy dựng sẵn** đúng
  thứ tự `SUZ_DECISIONS` / `SUZ_WRONG`, vẫn chờ file thu thật đè lên.


### Conan Edogawa contract

- All Conan-facing game text is English; Japanese character audio may be supplied later.
- Never hard-code Conan's Maximum HP inside `CONAN`; use the shared `HP.conan` value.
- Clues are per enemy and cap at eight. A landed basic Deduction always adds exactly one Clue. Auxiliary Clues from an observed enemy active skill, a landed Wristwatch, and at most one Skateboard miss-read per enemy/ride count toward the same total.
- Eight total Clues = Case Solved. Case Solved is consumed by Decisive Evidence / One Truth Prevails: 38 damage + 1.5s stun, and it uses evidence rather than a football.
- The only football attack is Soccer Ball Shot through the Power-Enhancing Kick Shoes: 85 damage, 15s cooldown, 3s stun, about 35% arena knockback.
- Conan's sustained damage and attack speed are intentionally low: Deduction is 6 damage every 1.6s; Wristwatch is 2 damage; Skateboard collision is 18 damage.
- No low-HP awakening, comeback buff, healing, resurrection, Shinichi transformation, firearm or lethal weapon.
- Skateboard is not invulnerability. Slow/root cannot pin its own movement, but stun/knockdown still can.
