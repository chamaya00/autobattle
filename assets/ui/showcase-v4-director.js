/*
 * Multiverse Battler — Showcase V4 visual director.
 * Adds a real per-fighter scene graph to the existing showcase FX layer.
 * The fighter art itself remains a single intact image.
 */
(() => {
  const PROFILES = {
    dora:      ['GADGET DIMENSION', 'PORTAL ONLINE', '◉'],
    sakura:    ['CHAKRA CONTROL', 'BYAKUGŌ FLOW', '✿'],
    isagi:     ['META VISION', 'GOAL ROUTE LOCKED', '⬡'],
    kono:      ['SHINOBI ARTS', 'SEAL COMPLETE', '✦'],
    chichi:    ['MARTIAL SPIRIT', 'KI PRESSURE RISING', '◒'],
    shika:     ['SHADOW POSSESSION', 'TARGET CAPTURED', '⌁'],
    tsubasa:   ['DRIVE SHOT', 'GOAL LINE OPEN', '➤'],
    suzune:    ['COLD LOGIC', 'OUTCOME CALCULATED', '◇'],
    superman:  ['SOLAR CHARGE', 'KRYPTONIAN POWER', '◆'],
    ginyu:     ['GINYU FORCE', 'SCOUTER OVERDRIVE', '◎'],
    beatrice:  ['FORBIDDEN LIBRARY', 'MANA SCRIPT ACTIVE', '✥'],
    tanjiro:   ['TOTAL CONCENTRATION', 'WATER × HINOKAMI', '☯'],
    gojo:      ['LIMITLESS', 'BLUE + RED = PURPLE', '∞'],
    conan:     ['DEDUCTION MODE', 'ONE TRUTH REMAINS', '⌖']
  };

  const shardMarkup = Array.from({length: 12}, (_, i) =>
    '<i style="--i:' + i + ';--x:' + (8 + (i * 29) % 84) + '%;--y:' +
    (8 + (i * 47) % 78) + '%;--delay:-' + (i * .31).toFixed(2) + 's"></i>'
  ).join('');

  const orbitMarkup = Array.from({length: 6}, (_, i) =>
    '<i style="--i:' + i + ';--a:' + (i * 60) + 'deg"></i>'
  ).join('');

  function render(box) {
    if (!box) return;
    const key = box.dataset.key;
    const profile = PROFILES[key];
    const fx = box.querySelector('.pickSplashFx');
    if (!profile || !fx || fx.dataset.directorKey === key) return;

    fx.dataset.directorKey = key;
    fx.innerHTML =
      '<div class="sigDirector" aria-hidden="true">' +
        '<div class="sigAtmosphere"></div>' +
        '<div class="sigArena"></div>' +
        '<div class="sigSpeed"></div>' +
        '<div class="sigEmblem"><span>' + profile[2] + '</span></div>' +
        '<div class="sigCore"><i></i><i></i><i></i></div>' +
        '<div class="sigOrbit">' + orbitMarkup + '</div>' +
        '<div class="sigShards">' + shardMarkup + '</div>' +
        '<div class="sigSweep"></div>' +
        '<div class="sigImpact"></div>' +
        '<div class="sigHud"><b>' + profile[0] + '</b><small>' + profile[1] + '</small></div>' +
      '</div>';
  }

  function sync() {
    const box = document.getElementById('pickSplash');
    if (!box) return;
    render(box);
  }

  const start = () => {
    const box = document.getElementById('pickSplash');
    if (!box) return;
    sync();
    new MutationObserver(sync).observe(box, {
      attributes: true,
      attributeFilter: ['data-key', 'class']
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once: true});
  } else {
    start();
  }
})();
