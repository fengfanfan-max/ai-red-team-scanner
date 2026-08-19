export const STEP_TITLES = [
  'Select application',
  'Select algorithm',
  'Select datasets',
  'Test chat',
  'Advanced settings',
] as const

export const ALGORITHMS = [
  {
    id: 'Default Tests',
    description: 'Direct evaluation of every prompt in the selected datasets (baseline).',
  },
  {
    id: 'Default Tests + Jailbreak',
    description:
      'Baseline plus adversarial jailbreak-style prompts. (v1: same pipeline, reserved for future attack modules.)',
  },
] as const
