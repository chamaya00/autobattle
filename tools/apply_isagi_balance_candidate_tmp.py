from pathlib import Path

p=Path('index.html')
s=p.read_text()

def rep(old,new,label):
    global s
    if old not in s:
        raise SystemExit(f'{label} anchor missing')
    s=s.replace(old,new,1)

rep('visionMax:100, visionStart:15, visionPerSec:30, visionLock:gs(1.5), observeRange:460,',
    'visionMax:100, visionStart:15, visionPerSec:27, visionLock:gs(1.5), observeRange:460,','Vision cap')
rep('metaT:gs(4), metaMove:1.40, metaUltWait:gs(2), metaRecalc:gs(.25),',
    'metaT:gs(3.7), metaMove:1.35, metaUltWait:gs(2.1), metaRecalc:gs(.25),','Metavision')
rep('firstDmg:34, firstT:gs(2), firstSpeed:BALL_SPD*1.05, firstVision:10, firstKb:245,',
    'firstDmg:32, firstT:gs(2), firstSpeed:BALL_SPD*1.05, firstVision:9, firstKb:235,','First Touch')
rep('blindCd:gs(6), blindT:gs(1), blindMove:2.20, blindTake:.60, blindVision:8,',
    'blindCd:gs(6.5), blindT:gs(1), blindMove:2.10, blindTake:.68, blindVision:7,','Blind Spot')
rep('directDmg:66, directPerfect:86, directCd:gs(7), directWind:gs(.45), directSpeed:BIC_SPD,',
    'directDmg:62, directPerfect:80, directCd:gs(7.5), directWind:gs(.45), directSpeed:BIC_SPD,','Direct Shot')
rep('directRange:390, directVision:12, directStagger:gs(.45), directDown:gs(.8), directKb:330,',
    'directRange:390, directVision:11, directStagger:gs(.425), directDown:gs(.72), directKb:310,','Direct utility')
rep('puzzleCd:gs(9), puzzleT:gs(.75), puzzleMove:.60, puzzleVision:30, analyzedT:gs(6), analyzedBonus:8, analyzedBonusMax:2,',
    'puzzleCd:gs(9.5), puzzleT:gs(.75), puzzleMove:.60, puzzleVision:26, analyzedT:gs(5.5), analyzedBonus:6, analyzedBonusMax:2,','Puzzle Pieces')
rep('ultRange:500, ultWind:gs(.85), ultArmor:gs(.35), ultDmg:145, ultDevour:170, ultPierce:.20,',
    'ultRange:500, ultWind:gs(.85), ultArmor:gs(.35), ultDmg:135, ultDevour:157, ultPierce:.15,','Ultimate damage')
rep('ultDown:gs(1.2), ultDevourDown:gs(1.5), ultSpeed:BIC_SPD*1.03, ultKb:560,',
    'ultDown:gs(1.1), ultDevourDown:gs(1.35), ultSpeed:BIC_SPD*1.03, ultKb:520,','Ultimate control')

rep('Up to ${rts(ISAGI.metaT)}s: +40% movement, tactical target selection,',
    'Up to ${rts(ISAGI.metaT)}s: +35% movement, tactical target selection,','Metavision description')
rep('a real ${rts(ISAGI.blindT)}s flank run, no teleport: +120% movement, −40% damage taken,',
    'a real ${rts(ISAGI.blindT)}s flank run, no teleport: +110% movement, −32% damage taken,','Blind description')
rep("pw:{dmg:64,dur:42,mob:88,as:54,rng:74,cc:56,uti:92,con:70,cmb:34},",
    "pw:{dmg:58,dur:40,mob:84,as:52,rng:74,cc:52,uti:86,con:64,cmb:32},",'Power chart')
rep("Vision comes from information, not time. Gain is capped at 30 per second and stops while hard-controlled.",
    "Vision comes from information, not time. Gain is capped at 27 per second and stops while hard-controlled.",'DEX passive')
rep("{tag:'2',name:'Direct Shot',vi:'66 damage. Perfect Timing improves accuracy and turns a genuine opening into 86 damage and a knockdown, but the shot can still miss.',en:'66 damage. Perfect Timing improves accuracy and turns a genuine opening into 86 damage and a knockdown, but the shot can still miss.'},",
    "{tag:'2',name:'Direct Shot',vi:'62 damage. Perfect Timing improves accuracy and turns a genuine opening into 80 damage and a shorter knockdown, but the shot can still miss.',en:'62 damage. Perfect Timing improves accuracy and turns a genuine opening into 80 damage and a shorter knockdown, but the shot can still miss.'},",'DEX Direct')
rep("{tag:'3',name:'Puzzle Pieces',vi:'Analyze for 1s, gain 30 Vision and mark the target Analyzed for 6s.',en:'Analyze for 1s, gain 30 Vision and mark the target Analyzed for 6s.'},",
    "{tag:'3',name:'Puzzle Pieces',vi:'Analyze for 0.75s, gain 26 Vision and mark the target Analyzed for 5.5s.',en:'Analyze for 0.75s, gain 26 Vision and mark the target Analyzed for 5.5s.'},",'DEX Puzzle')
rep("{tag:'U',name:'Two-Gun Volley',vi:'Metavision finisher: 145 with 20% defense penetration, or 170 as Devoured Opportunity. It is highly accurate, not guaranteed.',en:'Metavision finisher: 145 with 20% defense penetration, or 170 as Devoured Opportunity. It is highly accurate, not guaranteed.'}",
    "{tag:'U',name:'Two-Gun Volley',vi:'Metavision finisher: 135 with 15% defense penetration, or 157 as Devoured Opportunity. It is highly accurate, not guaranteed.',en:'Metavision finisher: 135 with 15% defense penetration, or 157 as Devoured Opportunity. It is highly accurate, not guaranteed.'}",'DEX Ult')
p.write_text(s)

t=Path('tools/t_isagi.js')
q=t.read_text()
for old,new,label in [
("has('visionMax:100, visionStart:15, visionPerSec:30','Vision 0-100, starts 15, cap 30/s');","has('visionMax:100, visionStart:15, visionPerSec:27','Vision 0-100, starts 15, cap 27/s');",'test vision'),
("has('firstDmg:34, firstT:gs(2)','First-Touch Shot nerf');","has('firstDmg:32, firstT:gs(2)','First-Touch Shot balance');",'test first'),
("has('blindCd:gs(6), blindT:gs(1), blindMove:2.20, blindTake:.60','Blind Spot Run');","has('blindCd:gs(6.5), blindT:gs(1), blindMove:2.10, blindTake:.68','Blind Spot Run balance');",'test blind'),
("has('directDmg:66, directPerfect:86, directCd:gs(7)','Direct / Perfect Timing nerf');","has('directDmg:62, directPerfect:80, directCd:gs(7.5)','Direct / Perfect Timing balance');",'test direct'),
("has('directCd:gs(7), directWind:gs(.45)','Direct Shot faster cast');","has('directCd:gs(7.5), directWind:gs(.45)','Direct Shot faster cast');",'test direct cast'),
("has('puzzleCd:gs(9), puzzleT:gs(.75), puzzleMove:.60, puzzleVision:30','Puzzle Pieces faster cast');","has('puzzleCd:gs(9.5), puzzleT:gs(.75), puzzleMove:.60, puzzleVision:26','Puzzle Pieces balance');",'test puzzle'),
("has('analyzedT:gs(6), analyzedBonus:8, analyzedBonusMax:2','Analyzed');","has('analyzedT:gs(5.5), analyzedBonus:6, analyzedBonusMax:2','Analyzed balance');",'test analyzed'),
("has('ultDmg:145, ultDevour:170, ultPierce:.20','Two-Gun Volley nerf');","has('ultDmg:135, ultDevour:157, ultPierce:.15','Two-Gun Volley balance');",'test ult')]:
    if old not in q: raise SystemExit(f'{label} anchor missing')
    q=q.replace(old,new,1)
t.write_text(q)
