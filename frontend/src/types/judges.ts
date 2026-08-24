export interface JudgeModel {
  id: number
  name: string
  description: string
  baseUrl: string
  apiKeyMasked: string
  modelName: string
  options: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface JudgePayload {
  name: string
  description?: string
  base_url: string
  api_key?: string
  model_name: string
  /** Provider-specific request options, e.g. {"enable_thinking": false}. */
  options?: Record<string, unknown>
}
