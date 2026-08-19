import { z } from 'zod'

/** Shared validation for the application create/edit form (mirrors backend). */
export const applicationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  baseUrl: z.string().min(4, 'Base URL is required').max(500),
  apiKey: z.string().max(500).optional(),
  modelName: z.string().min(1, 'Model name is required').max(200),
})

export type ApplicationFormValues = z.infer<typeof applicationSchema>
