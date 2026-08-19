import { z } from 'zod'

export const MAX_SUBCATEGORIES = 20
export const MAX_PROMPTS_PER_SUBCATEGORY = 200
export const MAX_PROMPTS_TOTAL = 2000

/** Mirrors backend validation in app/schemas.py CustomDatasetCreate. */
export const customDatasetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().default(''),
  subcategories: z
    .array(
      z.object({
        name: z.string().min(1, 'Subcategory name is required').max(100),
        prompts: z
          .array(z.string().min(1).max(4000))
          .min(1, 'At least one prompt required')
          .max(MAX_PROMPTS_PER_SUBCATEGORY),
      })
    )
    .min(1, 'At least one subcategory required')
    .max(MAX_SUBCATEGORIES)
    .refine(
      (subs) => subs.reduce((n, s) => n + s.prompts.length, 0) <= MAX_PROMPTS_TOTAL,
      `Too many prompts (max ${MAX_PROMPTS_TOTAL})`
    ),
})

export type CustomDatasetFormValues = z.infer<typeof customDatasetSchema>
