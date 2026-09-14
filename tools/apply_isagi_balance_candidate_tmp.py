from pathlib import Path

p=Path('index.html')
s=p.read_text()

def rep(old,new,label):
    global s
    if old not in s:
        raise SystemExit(f'{label} anchor missing')
    s=s.replace(old,new,1)

rep('visionMax:100, visionStart:15, visionPerSec:30, visionLock:gs(1.5), observeRange:460,',
    'visionMax:100, visionStart:15, visionPerSec:24, visionLock:gs(1.5), observeRange:460,','Vision cap')
rep('metaT:gs(4), metaMove:1.40, metaUltWait:gs(2), metaRecalc:gs(.25),',
    'metaT:gs(3.4), metaMove:1.30, metaUltWait:gs(2.2), metaRecalc:gs(.25),','Metavision')
rep('firstDmg:34, firstT:gs(2), firstSpeed:BALL_SPD*1.05, firstVision:10, firstKb:245,',
    'firstDmg:30, firstT:gs(2), firstSpeed:BALL_SPD*1.05, firstVision:8, firstKb:220,','First Touch')
rep('blindCd:gs(6), blindT:gs(1), blindMove:2.20, blindTake:.60, blindVision:8,',
    'blindCd:gs(7), blindT:gs(1), blindMove:2.00, blindTake:.75, blindVision:6,','Blind Spot')
rep('directDmg:66, directPerfect:86, directCd:gs(7), directWind:gs(.45), directSpeed:BIC_SPD,',
    'directDmg:58, directPerfect:74, directCd:gs(8), directWind:gs(.45), directSpeed:BIC_SPD,','Direct Shot')
rep('directRange:390, directVision:12, directStagger:gs(.45), directDown:gs(.8), directKb:330,',
    'directRange:390, directVision:10, directStagger:gs(.4), directDown:gs(.65), directKb:290,','Direct utility')
rep('puzzleCd:gs(9), puzzleT:gs(.75), puzzleMove:.60, puzzleVision:30, analyzedT:gs(6), analyzedBonus:8, analyzedBonusMax:2,',
    'puzzleCd:gs(10), puzzleT:gs(.75), puzzleMove:.60, puzzleVision:22, analyzedT:gs(5), analyzedBonus:5, analyzedBonusMax:1,','Puzzle Pieces')
rep('ultRange:500, ultWind:gs(.85), ultArmor:gs(.35), ultDmg:145, ultDevour:170, ultPierce:.20,',
    'ultRange:500, ultWind:gs(.85), ultArmor:gs(.35), ultDmg:125, ultDevour:145, ultPierce:.10,','Ultimate damage')
rep('ultDown:gs(1.2), ultDevourDown:gs(1.5), ultSpeed:BIC_SPD*1.03, ultKb:560,',
    'ultDown:gs(1), ultDevourDown:gs(1.2), ultSpeed:BIC_SPD*1.03, ultKb:480,','Ultimate control')
p.write_text(s)
