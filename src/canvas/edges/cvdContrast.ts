/**
 * cvdContrast — colour-vision-deficiency separation for the canvas palette.
 *
 * Why this exists: E1 (#282) shipped a "CVD-aware" polarity recolour whose ΔE
 * figures were quoted in a prose comment with no tooling behind them. They
 * reproduce exactly as CIE76 in NORMAL vision — the deficiency was never
 * simulated. This module makes such claims reproducible and regression-pinned,
 * so a future palette decision can be measured rather than asserted.
 *
 * Method (the standard one, no dependencies):
 *  1. sRGB → linear RGB
 *  2. linear RGB → LMS cone response (Viénot, Brettel & Mollon 1999)
 *  3. project onto the dichromat's surviving plane (protan/deutan ONLY —
 *     the Viénot 1999 single-plane reduction is derived for the two
 *     red-green dichromacies; tritanopia needs the two-plane method of
 *     Brettel, Viénot & Mollon 1997 and is NOT simulated here, see below)
 *  4. back to linear RGB → CIEXYZ (D65) → CIELAB
 *  5. ΔE between the two simulated Labs — CIEDE2000 by default, CIE76 available
 *     because that is what the earlier figures were computed with.
 *
 * Reading the numbers: ΔE2000 under ~10 means two strokes read as more similar
 * than different to that viewer; the +/- glyph, not the hue, is then carrying
 * the meaning. That is precisely why the DS forbids colour as the only cue.
 */

/**
 * 'tritan' is accepted by the type so callers can name it, but every public
 * function THROWS for it — see the guard in simulate(). An earlier cut of
 * this file carried a single-plane "tritan" matrix and returned
 * authoritative-looking ΔE figures from it; that construction is only valid
 * for protan/deutan, so the numbers were garbage. Unsupported is the honest
 * answer until a Brettel-1997 two-plane implementation exists.
 */
export type VisionType = 'normal' | 'protan' | 'deutan' | 'tritan'

type Vec3 = [number, number, number]
type Mat3 = [Vec3, Vec3, Vec3]

/*
 * This module is palette-agnostic on purpose: it measures whatever hexes it
 * is handed. The shipped polarity VALUES live in brand.css
 * (--edge-positive/--edge-negative; rule in directionStroke.ts) and the
 * DS ratchet forbids duplicating them into production source — the pinned
 * copies live in polarityContrast.spec, which is where a value change
 * should fail first anyway.
 */

/** Exported only for the inverse-identity pin in polarityContrast.spec. */
export const RGB_TO_LMS: Mat3 = [
  [17.8824, 43.5161, 4.11935],
  [3.45565, 27.1554, 3.86714],
  [0.0299566, 0.184309, 1.46709],
]

/**
 * MUST be the matrix inverse of RGB_TO_LMS — the simulation is
 * RGB → LMS → (projection) → RGB, and any drift here biases every ΔE this
 * module reports. The first cut of this file shipped [1][0] as -0.011248
 * (a mistranscription, 9.75% off the true -0.0102485335); the round-trip
 * error that introduced was ~4.9e-2 in linear G — enough to move the
 * headline figures by ~0.5–1.3 ΔE. The inverse-identity test in
 * polarityContrast.spec pins this permanently.
 */
export const LMS_TO_RGB: Mat3 = [
  [0.080944, -0.130504, 0.116721],
  [-0.0102485335, 0.0540193266, -0.113614708],
  [-0.000365, -0.0041216, 0.693513],
]

/**
 * Each dichromat loses one cone; the surviving two reconstruct the lost
 * signal. Viénot 1999's single-plane reduction covers exactly these two
 * deficiencies. There is deliberately NO tritan row: the single-plane tritan
 * matrix that circulates alongside these is not from that paper and is not
 * methodologically valid (S-cone loss needs Brettel 1997's two half-planes).
 */
const DICHROMAT_PROJECTION: Record<'protan' | 'deutan', Mat3> = {
  protan: [[0, 2.02344, -2.52581], [0, 1, 0], [0, 0, 1]],
  deutan: [[1, 0, 0], [0.494207, 0, 1.24827], [0, 0, 1]],
}

const LINEAR_RGB_TO_XYZ: Mat3 = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041],
]

/** D65 white point. */
const WHITE: Vec3 = [0.95047, 1.0, 1.08883]

const multiply = (m: Mat3, v: Vec3): Vec3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
]

const clamp01 = (c: number) => Math.min(1, Math.max(0, c))

function hexToRgb(hex: string): Vec3 {
  const s = hex.replace('#', '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(s)) {
    throw new Error(`cvdContrast: expected a 6-digit hex colour, got "${hex}"`)
  }
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) / 255) as Vec3
}

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))

/** Linear-RGB as the given viewer's cones report it. */
function simulate(hex: string, vision: VisionType): Vec3 {
  if (vision === 'tritan') {
    throw new Error(
      'cvdContrast: tritan simulation is not supported. The Viénot/Brettel/' +
        'Mollon (1999) single-plane projection this module implements is ' +
        'derived for protanopia and deuteranopia only; tritanopia requires ' +
        'the two-plane method of Brettel, Viénot & Mollon (1997). A single-' +
        'plane "tritan" matrix produces authoritative-looking but invalid ΔE ' +
        'figures, so this module refuses rather than mislead.',
    )
  }
  const linear = hexToRgb(hex).map(srgbToLinear) as Vec3
  if (vision === 'normal') return linear
  const lms = multiply(RGB_TO_LMS, linear)
  const projected = multiply(DICHROMAT_PROJECTION[vision], lms)
  return multiply(LMS_TO_RGB, projected)
}

function linearRgbToLab(linear: Vec3): Vec3 {
  const xyz = multiply(LINEAR_RGB_TO_XYZ, linear.map(clamp01) as Vec3)
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29)
  const [fx, fy, fz] = [f(xyz[0] / WHITE[0]), f(xyz[1] / WHITE[1]), f(xyz[2] / WHITE[2])]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** CIELAB for a colour as the given viewer perceives it. */
export function toLab(hex: string, vision: VisionType = 'normal'): Vec3 {
  return linearRgbToLab(simulate(hex, vision))
}

/** CIELAB lightness (L*) — the channel dichromats lean on most. */
export function lightness(hex: string, vision: VisionType = 'normal'): number {
  return toLab(hex, vision)[0]
}

/** CIE76 ΔE: plain Euclidean distance in Lab. Superseded, but it is what the #282 figures used. */
export function deltaE76(a: string, b: string, vision: VisionType = 'normal'): number {
  const [l1, a1, b1] = toLab(a, vision)
  const [l2, a2, b2] = toLab(b, vision)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

/** CIEDE2000 ΔE: the current standard, perceptually weighted. */
export function deltaE2000(a: string, b: string, vision: VisionType = 'normal'): number {
  const [L1, a1, b1] = toLab(a, vision)
  const [L2, a2, b2] = toLab(b, vision)
  const RAD = Math.PI / 180
  const DEG = 180 / Math.PI

  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const cBar = (C1 + C2) / 2
  const cBar7 = Math.pow(cBar, 7)
  const G = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + Math.pow(25, 7))))

  const ap1 = (1 + G) * a1
  const ap2 = (1 + G) * a2
  const Cp1 = Math.hypot(ap1, b1)
  const Cp2 = Math.hypot(ap2, b2)

  const hue = (b: number, ap: number) => {
    if (b === 0 && ap === 0) return 0
    const h = Math.atan2(b, ap) * DEG
    return h < 0 ? h + 360 : h
  }
  const hp1 = hue(b1, ap1)
  const hp2 = hue(b2, ap2)

  const dLp = L2 - L1
  const dCp = Cp2 - Cp1
  let dhp = 0
  if (Cp1 * Cp2 !== 0) {
    dhp = hp2 - hp1
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp * RAD) / 2)

  const LBar = (L1 + L2) / 2
  const CBar = (Cp1 + Cp2) / 2
  let hBar = hp1 + hp2
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) hBar = hp1 + hp2 < 360 ? hBar + 360 : hBar - 360
    hBar /= 2
  }

  const T =
    1 -
    0.17 * Math.cos((hBar - 30) * RAD) +
    0.24 * Math.cos(2 * hBar * RAD) +
    0.32 * Math.cos((3 * hBar + 6) * RAD) -
    0.2 * Math.cos((4 * hBar - 63) * RAD)

  const dTheta = 30 * Math.exp(-Math.pow((hBar - 275) / 25, 2))
  const CBar7 = Math.pow(CBar, 7)
  const Rc = 2 * Math.sqrt(CBar7 / (CBar7 + Math.pow(25, 7)))
  const Sl = 1 + (0.015 * Math.pow(LBar - 50, 2)) / Math.sqrt(20 + Math.pow(LBar - 50, 2))
  const Sc = 1 + 0.045 * CBar
  const Sh = 1 + 0.015 * CBar * T
  const Rt = -Math.sin(2 * dTheta * RAD) * Rc

  return Math.sqrt(
    Math.pow(dLp / Sl, 2) +
      Math.pow(dCp / Sc, 2) +
      Math.pow(dHp / Sh, 2) +
      Rt * (dCp / Sc) * (dHp / Sh),
  )
}

/** Worst-case separation across both red-green deficiencies (the ones that hit polarity). */
export function worstCaseRedGreenSeparation(a: string, b: string): number {
  return Math.min(deltaE2000(a, b, 'protan'), deltaE2000(a, b, 'deutan'))
}
