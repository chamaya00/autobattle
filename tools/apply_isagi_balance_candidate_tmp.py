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
p.write_text(s)
