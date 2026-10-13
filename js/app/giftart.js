// =====================================================================
// Анимированные модели подарков (SVG). Цвета задаются переменными
// --a --b --c --d, поэтому у NFT-моделей своя раскраска.
// =====================================================================

import { FIXED, BASE_COLORS } from './giftmeta.js';

let uid = 0;

const SHAPES = {
  // 🌹 Роза — покачивается, лепестки «дышат»
  1: () => `
    <g class="ga-sway" style="transform-origin:50px 94px">
      <path d="M50 94C49 78 52 64 50 50" stroke="var(--d)" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M50 76C40 69 31 72 27 79c11 3 18 1 23-3z" fill="var(--d)"/>
      <path d="M51 66c9-7 18-5 22 2-10 3-17 2-22-2z" fill="var(--d)" opacity=".85"/>
      <g class="ga-breathe" style="transform-origin:50px 36px">
        <path d="M50 54C31 54 24 38 30 23c6 7 13 7 20-2 7 9 14 9 20 2 6 15-1 31-20 31z" fill="var(--a)"/>
        <path d="M50 49C38 49 33 38 37 29c5 5 9 5 13-1 4 6 8 6 13 1 4 9-1 20-13 20z" fill="var(--b)"/>
        <path d="M50 41c-6 0-8-6-5-10 2 2 8 2 10 0 3 4 1 10-5 10z" fill="var(--c)"/>
        <path d="M38 30c3-6 8-8 12-8" stroke="#fff" stroke-opacity=".45" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      </g>
    </g>`,

  // 🧸 Мишка — подпрыгивает и машет лапкой
  2: () => `
    <g class="ga-bob">
      <ellipse cx="50" cy="73" rx="22" ry="20" fill="var(--a)"/>
      <ellipse cx="50" cy="76" rx="13" ry="12" fill="var(--c)"/>
      <ellipse cx="33" cy="89" rx="9" ry="6" fill="var(--b)"/>
      <ellipse cx="67" cy="89" rx="9" ry="6" fill="var(--b)"/>
      <ellipse cx="30" cy="68" rx="7" ry="10" fill="var(--b)" transform="rotate(20 30 68)"/>
      <g class="ga-wave" style="transform-origin:68px 62px">
        <ellipse cx="74" cy="54" rx="7" ry="11" fill="var(--b)" transform="rotate(-30 74 54)"/>
      </g>
      <circle cx="32" cy="22" r="9" fill="var(--a)"/><circle cx="32" cy="22" r="4.5" fill="var(--c)"/>
      <circle cx="68" cy="22" r="9" fill="var(--a)"/><circle cx="68" cy="22" r="4.5" fill="var(--c)"/>
      <circle cx="50" cy="38" r="22" fill="var(--a)"/>
      <ellipse cx="50" cy="46" rx="11" ry="8.5" fill="var(--c)"/>
      <ellipse cx="50" cy="42" rx="4" ry="3" fill="var(--d)"/>
      <path d="M46 49q4 3 8 0" stroke="var(--d)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <g class="ga-blink" style="transform-origin:50px 33px">
        <circle cx="41" cy="33" r="3" fill="var(--d)"/><circle cx="59" cy="33" r="3" fill="var(--d)"/>
      </g>
      <circle cx="35" cy="42" r="3" fill="#ff8fa3" opacity=".55"/><circle cx="65" cy="42" r="3" fill="#ff8fa3" opacity=".55"/>
      <path d="M50 62l3 4-3 4-3-4z" fill="var(--b)"/>
    </g>`,

  // 💙 Сердце — бьётся
  3: (id) => `
    <defs><radialGradient id="h${id}" cx="35%" cy="30%" r="80%">
      <stop offset="0" stop-color="var(--c)"/><stop offset=".45" stop-color="var(--b)"/><stop offset="1" stop-color="var(--a)"/>
    </radialGradient></defs>
    <g class="ga-beat" style="transform-origin:50px 55px">
      <path d="M50 88C20 66 10 50 12 35c2-14 14-22 26-20 6 1 10 5 12 9 2-4 6-8 12-9 12-2 24 6 26 20 2 15-8 31-38 53z" fill="url(#h${id})"/>
      <path d="M27 28c5-4 11-4 15 0" stroke="#fff" stroke-opacity=".6" stroke-width="4" fill="none" stroke-linecap="round"/>
    </g>
    <g class="ga-twinkle"><path d="M82 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--c)"/></g>`,

  // 🎂 Торт — свеча мерцает
  4: () => `
    <rect x="18" y="58" width="64" height="26" rx="6" fill="var(--a)"/>
    <rect x="26" y="40" width="48" height="22" rx="6" fill="var(--b)"/>
    <path d="M26 46c4 5 8 5 12 0s8 5 12 0 8 5 12 0 8 5 12 0v-6H26z" fill="var(--c)"/>
    <path d="M18 64c5 6 10 6 16 0s10 6 16 0 10 6 16 0 10 6 16 0v-6H18z" fill="var(--c)"/>
    <circle cx="34" cy="74" r="2.4" fill="var(--d)"/><circle cx="50" cy="76" r="2.4" fill="var(--d)"/><circle cx="66" cy="74" r="2.4" fill="var(--d)"/>
    <rect x="12" y="83" width="76" height="5" rx="2.5" fill="#ffffff" opacity=".35"/>
    <rect x="47" y="24" width="6" height="17" rx="2" fill="var(--c)"/>
    <path d="M47 28l6-3M47 33l6-3M47 38l6-3" stroke="var(--d)" stroke-width="1.5"/>
    <g class="ga-flicker" style="transform-origin:50px 23px">
      <path d="M50 8c5 6 6 10 3 14-1 1.5-5 1.5-6 0-3-4-2-8 3-14z" fill="#ffb02e"/>
      <path d="M50 14c2.5 3 3 5 1.5 7-.8.8-2.2.8-3 0-1.5-2-1-4 1.5-7z" fill="#fff4b0"/>
    </g>
    <circle class="ga-glow" cx="50" cy="16" r="10" fill="#ffd36b" opacity=".25"/>`,

  // 🏆 Кубок — блик пробегает
  5: (id) => `
    <defs><clipPath id="t${id}"><path d="M28 14h44v18c0 14-10 24-22 24S28 46 28 32z"/></clipPath></defs>
    <path d="M28 20H16c0 14 6 20 14 21M72 20h12c0 14-6 20-14 21" stroke="var(--b)" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M28 14h44v18c0 14-10 24-22 24S28 46 28 32z" fill="var(--a)"/>
    <g clip-path="url(#t${id})"><rect class="ga-shine" x="-20" y="10" width="14" height="60" fill="#fff" opacity=".55" transform="skewX(-20)"/></g>
    <rect x="45" y="55" width="10" height="13" fill="var(--b)"/>
    <rect x="34" y="68" width="32" height="8" rx="3" fill="var(--a)"/>
    <rect x="28" y="76" width="44" height="10" rx="3" fill="var(--b)"/>
    <path d="M50 22l3 6 6.5 1-4.7 4.5 1.1 6.5L50 37l-5.9 3 1.1-6.5L40.5 29l6.5-1z" fill="var(--c)"/>
    <g class="ga-twinkle"><path d="M80 10l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill="var(--c)"/></g>`,

  // 💎 Алмаз — поворачивается и сверкает
  6: () => `
    <g class="ga-turn" style="transform-origin:50px 52px">
      <path d="M30 22h40l16 18-36 46-36-46z" fill="var(--a)"/>
      <path d="M30 22l-16 18h72L70 22z" fill="var(--c)"/>
      <path d="M30 22l10 18 10-18 10 18 10-18" fill="none" stroke="var(--b)" stroke-width="1.5" opacity=".6"/>
      <path d="M14 40l36 46 36-46" fill="none"/>
      <path d="M40 40l10 46 10-46" fill="var(--b)" opacity=".55"/>
      <path d="M14 40l36 46-10-46zM86 40L50 86l10-46z" fill="var(--b)" opacity=".3"/>
      <path d="M34 27l-6 8" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
    </g>
    <g class="ga-twinkle"><path d="M80 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff"/></g>
    <g class="ga-twinkle d2"><path d="M18 70l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#fff"/></g>`,

  // 🚀 Ракета — летит, пламя дрожит, звёзды проносятся
  7: () => `
    <g class="ga-stars"><circle cx="18" cy="20" r="1.6" fill="#fff"/><circle cx="84" cy="34" r="1.3" fill="#fff"/><circle cx="26" cy="60" r="1.2" fill="#fff"/><circle cx="78" cy="74" r="1.6" fill="#fff"/></g>
    <g class="ga-fly">
      <g class="ga-flicker" style="transform-origin:50px 76px">
        <path d="M42 76c0 10 4 16 8 20 4-4 8-10 8-20z" fill="#ff8a2a"/>
        <path d="M46 76c0 6 2 10 4 12 2-2 4-6 4-12z" fill="#ffe27a"/>
      </g>
      <path d="M36 58L24 74l14-4zM64 58l12 16-14-4z" fill="var(--b)"/>
      <path d="M50 8c14 12 18 30 14 52l-4 16H40l-4-16C32 38 36 20 50 8z" fill="var(--a)"/>
      <path d="M50 8c6 5 10 11 12 18H38c2-7 6-13 12-18z" fill="var(--b)"/>
      <circle cx="50" cy="40" r="8" fill="var(--d)"/><circle cx="50" cy="40" r="5.5" fill="var(--c)"/>
      <path d="M47 37a4 4 0 0 1 4-2" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <rect x="40" y="70" width="20" height="6" rx="2" fill="var(--d)"/>
    </g>`,

  // 🏔️ Вершина Sierra — солнце светит, облака плывут
  8: () => `
    <circle class="ga-sun" cx="68" cy="30" r="13" fill="var(--d)"/>
    <circle class="ga-glow" cx="68" cy="30" r="20" fill="var(--d)" opacity=".2"/>
    <path d="M6 86l30-50 14 20 12-16 32 46z" fill="var(--b)"/>
    <path d="M6 86l30-50 22 50z" fill="var(--a)"/>
    <path d="M36 36l-9 15 5-3 4 5 4-6 4 4z" fill="var(--c)"/>
    <path d="M62 40l-7 9 4-1 3 4 3-4 5 2z" fill="var(--c)"/>
    <g class="ga-cloud"><ellipse cx="22" cy="28" rx="11" ry="5" fill="#fff" opacity=".85"/><ellipse cx="29" cy="25" rx="7" ry="5" fill="#fff" opacity=".85"/></g>
    <g class="ga-cloud d2"><ellipse cx="82" cy="56" rx="9" ry="4" fill="#fff" opacity=".7"/></g>`,

  // 👑 Корона — покачивается, камни сверкают
  9: () => `
    <g class="ga-bob">
      <path d="M16 36l14 14 20-28 20 28 14-14-6 40H22z" fill="var(--a)"/>
      <path d="M22 70h56l-2 10H24z" fill="var(--b)"/>
      <path d="M50 22l20 28 14-14-3 20c-12-6-20-14-31-34z" fill="var(--b)" opacity=".35"/>
      <circle cx="16" cy="34" r="4.5" fill="var(--a)"/><circle cx="50" cy="20" r="5" fill="var(--a)"/><circle cx="84" cy="34" r="4.5" fill="var(--a)"/>
      <circle class="ga-gem" cx="50" cy="56" r="6" fill="var(--c)"/>
      <circle class="ga-gem d2" cx="33" cy="60" r="4" fill="var(--d)"/>
      <circle class="ga-gem d3" cx="67" cy="60" r="4" fill="var(--d)"/>
      <path d="M24 44c3-3 6-4 9-3" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".6"/>
    </g>
    <g class="ga-twinkle"><path d="M84 12l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff"/></g>
    <g class="ga-twinkle d2"><path d="M14 14l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#fff"/></g>`,

  // 🔮 Хрустальный шар — внутри кружится туман
  10: (id) => `
    <defs>
      <radialGradient id="b${id}" cx="38%" cy="32%" r="75%">
        <stop offset="0" stop-color="var(--c)"/><stop offset=".55" stop-color="var(--a)"/><stop offset="1" stop-color="var(--b)"/>
      </radialGradient>
      <clipPath id="c${id}"><circle cx="50" cy="44" r="30"/></clipPath>
    </defs>
    <path d="M28 80h44l-6-12H34z" fill="var(--d)"/>
    <rect x="22" y="80" width="56" height="8" rx="4" fill="var(--d)"/>
    <circle cx="50" cy="44" r="30" fill="url(#b${id})"/>
    <g clip-path="url(#c${id})">
      <g class="ga-spin" style="transform-origin:50px 44px">
        <path d="M30 50c8-12 22-14 30-6s20 4 24-6" stroke="#fff" stroke-opacity=".45" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M24 34c10 4 18 0 24-6s16-6 22 2" stroke="var(--c)" stroke-opacity=".6" stroke-width="4" fill="none" stroke-linecap="round"/>
      </g>
    </g>
    <ellipse cx="39" cy="30" rx="7" ry="4.5" fill="#fff" opacity=".55" transform="rotate(-30 39 30)"/>
    <g class="ga-twinkle"><path d="M56 40l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#fff"/></g>`,

  // ⭐ Звезда — покачивается и подмигивает
  11: (id) => `
    <defs><radialGradient id="s${id}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="var(--c)"/><stop offset=".5" stop-color="var(--a)"/><stop offset="1" stop-color="var(--b)"/></radialGradient></defs>
    <g class="ga-tilt" style="transform-origin:50px 54px">
      <path d="M50 16L60 40.2 86.1 42.3 66.2 59.3 72.3 84.7 50 71 27.7 84.7 33.8 59.3 13.9 42.3 40 40.2Z" fill="url(#s${id})" stroke="var(--b)" stroke-width="5" stroke-linejoin="round"/>
      <path d="M38 36l6-13" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".7"/>
      <g class="ga-blink" style="transform-origin:50px 52px"><ellipse cx="43" cy="52" rx="3" ry="4" fill="var(--d)"/><ellipse cx="57" cy="52" rx="3" ry="4" fill="var(--d)"/></g>
      <path d="M44 61q6 5 12 0" stroke="var(--d)" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <circle cx="37" cy="59" r="3" fill="#ff8fa3" opacity=".5"/><circle cx="63" cy="59" r="3" fill="#ff8fa3" opacity=".5"/>
    </g>
    <g class="ga-twinkle"><path d="M86 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--c)"/></g>
    <g class="ga-twinkle d2"><path d="M14 74l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="var(--c)"/></g>`,

  // 🌙 Луна — сонная, покачивается среди звёзд
  12: (id) => `
    <defs><radialGradient id="m${id}" cx="35%" cy="35%" r="75%"><stop offset="0" stop-color="var(--c)"/><stop offset=".55" stop-color="var(--a)"/><stop offset="1" stop-color="var(--b)"/></radialGradient></defs>
    <g class="ga-sway" style="transform-origin:50px 50px">
      <path d="M58 12a38 38 0 1 0 30 58A30 30 0 0 1 58 12z" fill="url(#m${id})"/>
      <circle cx="40" cy="38" r="4" fill="var(--b)" opacity=".35"/><circle cx="34" cy="62" r="6" fill="var(--b)" opacity=".3"/><circle cx="52" cy="76" r="3.5" fill="var(--b)" opacity=".35"/>
      <path d="M48 52q4 3 8 0" stroke="var(--d)" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M60 64q4 4 9 1" stroke="var(--d)" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    </g>
    <g class="ga-twinkle"><path d="M80 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--c)"/></g>
    <g class="ga-twinkle d2"><path d="M88 46l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="var(--c)"/></g>
    <g class="ga-twinkle d3"><circle cx="70" cy="34" r="2" fill="#fff"/></g>`,

  // 🎁 Подарок — крышка подпрыгивает
  13: () => `
    <rect x="18" y="46" width="64" height="40" rx="6" fill="var(--a)"/>
    <rect x="18" y="46" width="64" height="10" fill="var(--b)" opacity=".35"/>
    <rect x="45" y="46" width="10" height="40" fill="var(--c)"/>
    <path d="M22 50h6v34h-2a4 4 0 0 1-4-4z" fill="#fff" opacity=".18"/>
    <g class="ga-lid">
      <rect x="13" y="34" width="74" height="15" rx="5" fill="var(--b)"/>
      <rect x="44" y="34" width="12" height="15" fill="var(--c)"/>
      <path d="M50 34c-6-12-22-14-22-5 0 6 12 6 22 5z" fill="var(--c)"/>
      <path d="M50 34c6-12 22-14 22-5 0 6-12 6-22 5z" fill="var(--c)"/>
      <path d="M50 34c-4-7-13-9-14-5" stroke="var(--b)" stroke-width="2" fill="none" opacity=".4"/>
      <circle cx="50" cy="33" r="4.5" fill="var(--d)"/>
    </g>
    <g class="ga-twinkle"><path d="M84 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--c)"/></g>`,

  // 🎈 Шарик — парит на ниточке
  14: (id) => `
    <defs><radialGradient id="bl${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="var(--c)"/><stop offset=".35" stop-color="var(--a)"/><stop offset="1" stop-color="var(--b)"/></radialGradient></defs>
    <g class="ga-float">
      <path d="M50 66c4 8-6 12-1 20s-4 10 0 14" stroke="var(--d)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <ellipse cx="50" cy="36" rx="25" ry="29" fill="url(#bl${id})"/>
      <path d="M46 64h8l-4 6z" fill="var(--b)"/>
      <ellipse cx="40" cy="24" rx="5" ry="9" fill="#fff" opacity=".55" transform="rotate(25 40 24)"/>
    </g>`,

  // 🍦 Мороженое — с вишенкой и посыпкой
  15: () => `
    <g class="ga-bob">
      <path d="M32 52h36L52 94h-4z" fill="#f0b264"/>
      <path d="M36 58l22 22M44 54l18 18M34 66l14 14M64 58L42 80M58 54L38 74M66 66L52 80" stroke="#c98a3e" stroke-width="2"/>
      <path d="M28 54c-4-14 8-20 22-20s26 6 22 20c-4 4-8 2-10 6-4-4-8 0-12-2s-8 2-12-2c-4 2-6-2-10-2z" fill="var(--a)"/>
      <path d="M34 36c-2-12 7-18 16-18s18 6 16 18c-6 4-10 0-16 2s-10-2-16-2z" fill="var(--b)"/>
      <path d="M38 26c3-4 7-5 11-5" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>
      <rect x="40" y="44" width="6" height="2.4" rx="1.2" fill="var(--c)" transform="rotate(30 43 45)"/>
      <rect x="56" y="42" width="6" height="2.4" rx="1.2" fill="#fff" transform="rotate(-25 59 43)"/>
      <rect x="48" y="28" width="6" height="2.4" rx="1.2" fill="var(--c)" transform="rotate(60 51 29)"/>
      <rect x="60" y="30" width="6" height="2.4" rx="1.2" fill="#fff" transform="rotate(15 63 31)"/>
      <circle cx="50" cy="14" r="6" fill="var(--d)"/><path d="M50 8c2-4 6-6 8-5" stroke="#3f6212" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="48" cy="12" r="1.8" fill="#fff" opacity=".7"/>
    </g>`,

  // 🍭 Леденец — спираль вращается
  16: () => `
    <rect x="47" y="56" width="6" height="40" rx="3" fill="#f1f5f9"/>
    <path d="M42 62l8 6 8-6-2 8h-12z" fill="var(--d)"/>
    <g class="ga-spin" style="transform-origin:50px 36px">
      <circle cx="50" cy="36" r="27" fill="var(--a)"/>
      <path d="M50 36m0-5a5 5 0 0 1 5 5 10 10 0 0 1-10 10 15 15 0 0 1-15-15 20 20 0 0 1 20-20 25 25 0 0 1 25 25" stroke="var(--c)" stroke-width="6" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="36" r="27" fill="none" stroke="var(--b)" stroke-width="3"/>
    </g>
    <ellipse cx="38" cy="22" rx="6" ry="3.5" fill="#fff" opacity=".5" transform="rotate(-35 38 22)"/>`,

  // 🐱 Котик — моргает и машет хвостиком
  17: () => `
    <g class="ga-tail" style="transform-origin:70px 80px"><path d="M68 80c14 0 20-10 16-22" stroke="var(--a)" stroke-width="8" fill="none" stroke-linecap="round"/></g>
    <ellipse cx="50" cy="76" rx="22" ry="17" fill="var(--a)"/>
    <ellipse cx="50" cy="80" rx="11" ry="10" fill="var(--c)"/>
    <ellipse cx="38" cy="91" rx="7" ry="4.5" fill="var(--b)"/><ellipse cx="62" cy="91" rx="7" ry="4.5" fill="var(--b)"/>
    <g class="ga-bob">
      <path d="M26 30L28 6l16 14zM74 30L72 6 56 20z" fill="var(--a)"/>
      <path d="M30 24l1-12 8 7zM70 24l-1-12-8 7z" fill="#ffb4c2"/>
      <ellipse cx="50" cy="38" rx="26" ry="22" fill="var(--a)"/>
      <path d="M40 18l4 8M50 16v9M60 18l-4 8" stroke="var(--b)" stroke-width="3" stroke-linecap="round" opacity=".6"/>
      <ellipse cx="50" cy="46" rx="12" ry="8" fill="var(--c)"/>
      <g class="ga-blink" style="transform-origin:50px 36px">
        <ellipse cx="40" cy="36" rx="4" ry="5" fill="var(--d)"/><ellipse cx="60" cy="36" rx="4" ry="5" fill="var(--d)"/>
        <circle cx="41.5" cy="34" r="1.4" fill="#fff"/><circle cx="61.5" cy="34" r="1.4" fill="#fff"/>
      </g>
      <path d="M47 42h6l-3 3z" fill="#ff8fa3"/>
      <path d="M50 45q-3 4-6 2M50 45q3 4 6 2" stroke="var(--d)" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M30 44l-10-2M30 48l-10 2M70 44l10-2M70 48l10 2" stroke="var(--d)" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>
    </g>`,

  // 👻 Призрак — парит и колышется
  18: () => `
    <ellipse class="ga-shadow" cx="50" cy="94" rx="20" ry="3.5" fill="#000" opacity=".25"/>
    <g class="ga-float">
      <path d="M22 50c0-20 12-36 28-36s28 16 28 36v34c-4 0-6-6-10-6s-5 6-9 6-5-6-9-6-5 6-9 6-5-6-9-6-6 6-10 6z" fill="var(--a)"/>
      <path d="M30 34c3-8 9-12 16-13" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>
      <path d="M22 60c0 14 0 24 0 24 4 0 6-6 10-6" fill="var(--b)" opacity=".35"/>
      <g class="ga-blink" style="transform-origin:50px 46px">
        <ellipse cx="41" cy="46" rx="5" ry="7" fill="var(--d)"/><ellipse cx="59" cy="46" rx="5" ry="7" fill="var(--d)"/>
        <circle cx="43" cy="43" r="1.8" fill="#fff"/><circle cx="61" cy="43" r="1.8" fill="#fff"/>
      </g>
      <ellipse cx="50" cy="60" rx="4" ry="5" fill="var(--d)"/>
      <circle cx="33" cy="56" r="3.5" fill="var(--c)" opacity=".8"/><circle cx="67" cy="56" r="3.5" fill="var(--c)" opacity=".8"/>
    </g>
    <g class="ga-twinkle"><path d="M84 20l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--c)"/></g>`,

  // 🎃 Тыква — светится изнутри
  19: () => `
    <path d="M48 22c0-8 2-12 8-14" stroke="var(--d)" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M56 16c8-4 14 0 14 4-6 2-10 0-14-4z" fill="var(--d)"/>
    <ellipse cx="32" cy="56" rx="18" ry="30" fill="var(--b)"/>
    <ellipse cx="68" cy="56" rx="18" ry="30" fill="var(--b)"/>
    <ellipse cx="42" cy="56" rx="16" ry="32" fill="var(--a)"/>
    <ellipse cx="58" cy="56" rx="16" ry="32" fill="var(--a)"/>
    <ellipse cx="50" cy="56" rx="12" ry="32" fill="var(--a)"/>
    <path d="M34 30c-4 6-6 14-6 22" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".35" fill="none"/>
    <g class="ga-glowface">
      <path d="M34 46l8-7 4 9zM66 46l-8-7-4 9z" fill="var(--c)"/>
      <path d="M47 56l3-6 3 6z" fill="var(--c)"/>
      <path d="M30 64c8 10 32 10 40 0-4 2-6 6-8 4l-4-4-4 5-4-5-4 5-4-5-4 4c-2 2-4-2-8-4z" fill="var(--c)"/>
    </g>`,

  // ⛄ Снеговик — покачивается, падает снег
  20: () => `
    <g class="ga-snow"><circle cx="16" cy="10" r="2" fill="#fff"/><circle cx="84" cy="22" r="1.6" fill="#fff"/><circle cx="26" cy="40" r="1.4" fill="#fff"/><circle cx="80" cy="56" r="2" fill="#fff"/></g>
    <g class="ga-sway" style="transform-origin:50px 94px">
      <circle cx="50" cy="74" r="20" fill="var(--c)"/>
      <circle cx="50" cy="42" r="15" fill="var(--c)"/>
      <path d="M36 66c4-6 10-8 14-8" stroke="#cbd5e1" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="68" r="2.4" fill="var(--d)"/><circle cx="50" cy="78" r="2.4" fill="var(--d)"/>
      <path d="M36 52c8 5 20 5 28 0v6c-8 4-20 4-28 0z" fill="var(--a)"/>
      <path d="M58 56l4 18h-7l-1-16z" fill="var(--a)"/>
      <path d="M40 54v4M46 55v4M52 55v4" stroke="var(--b)" stroke-width="2.4"/>
      <circle cx="44" cy="40" r="2.2" fill="var(--d)"/><circle cx="56" cy="40" r="2.2" fill="var(--d)"/>
      <path d="M50 44l12 3-12 2z" fill="#f97316"/>
      <rect x="38" y="24" width="24" height="5" rx="2" fill="var(--d)"/>
      <rect x="42" y="8" width="16" height="18" rx="3" fill="var(--d)"/>
      <rect x="42" y="20" width="16" height="4" fill="var(--a)"/>
    </g>`,

  // 🎄 Ёлка — гирлянда мигает
  21: () => `
    <rect x="44" y="80" width="12" height="12" rx="2" fill="#7c4a1e"/>
    <path d="M50 30L22 82h56z" fill="var(--b)"/>
    <path d="M50 20L26 64h48z" fill="var(--a)"/>
    <path d="M50 12L32 46h36z" fill="var(--a)"/>
    <path d="M50 12L40 31" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".4"/>
    <path d="M32 46c10 6 26 6 36 0M28 64c12 7 32 7 44 0" stroke="var(--c)" stroke-width="1.6" fill="none" opacity=".7"/>
    <circle class="ga-gem" cx="40" cy="50" r="3.5" fill="var(--d)"/>
    <circle class="ga-gem d2" cx="60" cy="52" r="3.5" fill="var(--c)"/>
    <circle class="ga-gem d3" cx="50" cy="38" r="3" fill="var(--d)"/>
    <circle class="ga-gem d2" cx="36" cy="70" r="3.5" fill="var(--c)"/>
    <circle class="ga-gem" cx="64" cy="70" r="3.5" fill="var(--d)"/>
    <circle class="ga-gem d3" cx="50" cy="66" r="3" fill="#fff"/>
    <g class="ga-twinkle" style="transform-origin:50px 10px"><path d="M50 2l2.8 5.6 6.2.9-4.5 4.4 1.1 6.1L50 16.1l-5.6 2.9 1.1-6.1L41 8.5l6.2-.9z" fill="var(--c)"/></g>
    <path d="M50 2l2.8 5.6 6.2.9-4.5 4.4 1.1 6.1L50 16.1l-5.6 2.9 1.1-6.1L41 8.5l6.2-.9z" fill="var(--c)"/>`,

  // 🦋 Бабочка — машет крыльями
  22: () => `
    <g class="ga-float">
      <g class="ga-flap" style="transform-origin:50px 50px">
        <path d="M48 46C38 20 10 14 12 34c1 12 16 18 36 14z" fill="var(--a)"/>
        <path d="M52 46C62 20 90 14 88 34c-1 12-16 18-36 14z" fill="var(--a)"/>
        <path d="M48 52C34 54 18 64 24 76c6 10 20 4 24-18z" fill="var(--b)"/>
        <path d="M52 52C66 54 82 64 76 76c-6 10-20 4-24-18z" fill="var(--b)"/>
        <circle cx="28" cy="32" r="5" fill="var(--c)"/><circle cx="72" cy="32" r="5" fill="var(--c)"/>
        <circle cx="34" cy="66" r="3.5" fill="var(--c)"/><circle cx="66" cy="66" r="3.5" fill="var(--c)"/>
        <path d="M18 30c4-8 12-10 18-6" stroke="#fff" stroke-width="2.4" fill="none" opacity=".5" stroke-linecap="round"/>
      </g>
      <ellipse cx="50" cy="52" rx="4" ry="20" fill="var(--d)"/>
      <path d="M49 33c-3-8-8-12-12-12M51 33c3-8 8-12 12-12" stroke="var(--d)" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="37" cy="21" r="2.4" fill="var(--d)"/><circle cx="63" cy="21" r="2.4" fill="var(--d)"/>
    </g>`,

  // 🍄 Грибок — пружинит
  23: () => `
    <g class="ga-squash" style="transform-origin:50px 92px">
      <path d="M36 56h28c2 12 2 24-2 34H38c-4-10-4-22-2-34z" fill="#fde7c7"/>
      <path d="M40 60c-1 10 0 20 2 28" stroke="#e8c79a" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="44" cy="72" rx="2.4" ry="3.4" fill="var(--d)"/><ellipse cx="56" cy="72" rx="2.4" ry="3.4" fill="var(--d)"/>
      <path d="M46 80q4 3 8 0" stroke="var(--d)" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M10 56C10 32 28 14 50 14s40 18 40 42c0 4-4 6-8 6H18c-4 0-8-2-8-6z" fill="var(--a)"/>
      <path d="M10 56c0 4 4 6 8 6h64c4 0 8-2 8-6-10 4-70 4-80 0z" fill="var(--b)"/>
      <circle cx="32" cy="34" r="7" fill="var(--c)"/><circle cx="56" cy="26" r="6" fill="var(--c)"/>
      <circle cx="72" cy="44" r="5.5" fill="var(--c)"/><circle cx="46" cy="48" r="4.5" fill="var(--c)"/><circle cx="20" cy="50" r="3.5" fill="var(--c)"/>
    </g>`,

  // 🪐 Планета — вокруг летает спутник
  24: (id) => `
    <defs>
      <radialGradient id="p${id}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="var(--c)"/><stop offset=".45" stop-color="var(--a)"/><stop offset="1" stop-color="var(--b)"/></radialGradient>
      <clipPath id="pc${id}"><circle cx="50" cy="50" r="26"/></clipPath>
    </defs>
    <ellipse cx="50" cy="52" rx="44" ry="12" fill="none" stroke="var(--c)" stroke-width="5" opacity=".55" transform="rotate(-18 50 52)"/>
    <circle cx="50" cy="50" r="26" fill="url(#p${id})"/>
    <g clip-path="url(#pc${id})">
      <path d="M20 44c16 6 44 6 60-2M20 58c18 6 44 4 60-4" stroke="var(--b)" stroke-width="5" fill="none" opacity=".35"/>
    </g>
    <path d="M7 64a44 12 -18 0 0 86-28" fill="none" stroke="var(--c)" stroke-width="5" transform="rotate(0)" opacity=".9"/>
    <ellipse cx="40" cy="38" rx="7" ry="4" fill="#fff" opacity=".4" transform="rotate(-30 40 38)"/>
    <g class="ga-orbit" style="transform-origin:50px 50px"><circle cx="50" cy="10" r="5" fill="var(--d)"/><circle cx="48.5" cy="8.5" r="1.6" fill="#fff" opacity=".6"/></g>`,

  // 🧪 Зелье — пузырьки поднимаются
  25: (id) => `
    <defs><clipPath id="f${id}"><path d="M40 10h20v26c14 6 24 18 24 32 0 18-15 28-34 28S16 86 16 68c0-14 10-26 24-32z"/></clipPath></defs>
    <path d="M40 10h20v26c14 6 24 18 24 32 0 18-15 28-34 28S16 86 16 68c0-14 10-26 24-32z" fill="#ffffff" opacity=".18" stroke="#ffffff" stroke-opacity=".55" stroke-width="2.5"/>
    <g clip-path="url(#f${id})">
      <g class="ga-liquid"><path d="M0 56c10-5 20 5 30 0s20-5 30 0 20 5 30 0 20-5 30 0V100H0z" fill="var(--a)"/></g>
      <path d="M0 62c10-5 20 5 30 0s20-5 30 0 20 5 30 0V100H0z" fill="var(--b)" opacity=".45"/>
      <circle class="ga-bubble" cx="40" cy="88" r="3" fill="var(--c)"/>
      <circle class="ga-bubble d2" cx="56" cy="90" r="2.4" fill="var(--c)"/>
      <circle class="ga-bubble d3" cx="48" cy="86" r="2" fill="#fff"/>
    </g>
    <path d="M26 58c-3 6-4 12-2 18" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".55" fill="none"/>
    <rect x="37" y="4" width="26" height="10" rx="3" fill="var(--d)"/>
    <rect x="38" y="13" width="24" height="3" fill="#000" opacity=".2"/>`,
};

// Расставить цвета: модель NFT перекрашивает подарок, но «фиксированные» детали (глаза, стебель) остаются
export function paletteFor(shape, giftColors, modelColors) {
  const base = giftColors && giftColors.length === 4 ? giftColors : (BASE_COLORS[shape] || ['#4cc9ff', '#1d6bff', '#e0f7ff', '#0b3a8a']);
  if (!modelColors) return base;
  const fixed = FIXED[shape] || [];
  return base.map((c, i) => (fixed.includes(i) ? c : modelColors[i]));
}

const FX_STARS = `<g class="fx-stars"><g class="ga-twinkle"><path d="M10 20l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff"/></g><g class="ga-twinkle d2"><path d="M88 60l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff"/></g><g class="ga-twinkle d3"><path d="M78 8l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#fff"/></g></g>`;

// shape — номер модели (1–25), colors — 4 цвета, effect — glow / shine / holo / stars / frost / pixel
export function giftSvg(shape, colors, effect = null) {
  const draw = SHAPES[shape];
  if (!draw) return null;
  const pal = colors && colors.length === 4 ? colors : BASE_COLORS[shape];
  const id = 'g' + (++uid);
  const style = `--a:${pal[0]};--b:${pal[1]};--c:${pal[2]};--d:${pal[3]}`;
  const cls = 'gift-svg' + (effect ? ' fx-' + effect : '');
  const extra = effect === 'stars' || effect === 'shine' ? FX_STARS : '';
  return `<svg class="${cls}" viewBox="0 0 100 100" style="${style}" aria-hidden="true">${draw(id)}${extra}</svg>`;
}

// Маленький символ NFT (узор вокруг модели)
export function symbolSvg(path, color = 'rgba(255,255,255,.3)') {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" fill="${color}" fill-rule="evenodd"/></svg>`;
}
