export const CHECK_WORDS = {
  title: 'What to check',
  needs: 'What a result needs',
  find: 'Worth finding out first',
  examine: 'Worth examining',
  more: (n: number) => `Show ${n} more`,
  fewer: 'Show fewer',
  ask: 'Ask Olumi about this',
} as const
