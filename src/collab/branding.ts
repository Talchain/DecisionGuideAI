/**
 * COLLAB — the product's own name, on the surfaces an outsider reaches.
 *
 * ⚠ WHY A CONSTANT RATHER THAN A LITERAL PER PAGE. The three collaboration
 * surfaces (the participant packet, the owner's panel setup, the reveal) had
 * ZERO occurrences of the product name between them — measured on `04c7c8c4`
 * with a contrast control ("panel": 22 / 63 / 4 hits in the same run, so the
 * probe was demonstrably not blind). Two of those three pages are reached by
 * people who have never seen this product and may never see another page of
 * it: an invitee opens a bare link from a chat client and lands on an
 * unbranded form asking for a number.
 *
 * A literal spelled three times is the hand-maintained mirror this estate keeps
 * paying for — the fourth surface gets it wrong, or a rename reaches two of
 * three. One constant, one spelling.
 */
export const COLLAB_PRODUCT_NAME = 'Olumi'
