/**
 * A SAMPLED chance in words, the one UI mirror of core's rule (olumi-core src/shared/format.ts `chanceHedge` + `chancePct`, read at 66f33c7e):
 * a chance that uncertain figures reach never reads as certain, so 0.995 and above is "over 99%" (never "100%"), below 0.005 is "under 1%"
 * (never "0%"), and anything between is "about N%". Used wherever the UI must word a number core sends without words (an option's chance if
 * its driving figure comes out low or high). Where core sends words, draw core's words; never a second formatter beside this one.
 */
export const sampledChanceWords = (c: number): string => (c >= 0.995 ? 'over 99%' : c < 0.005 ? 'under 1%' : `about ${Math.round(c * 100)}%`)
