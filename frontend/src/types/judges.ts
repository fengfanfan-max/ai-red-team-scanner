export interface JudgeModel {
  id: number
  name: string
  description: string
  baseUrl: string
  apiKeyMasked: string
  modelName: string
  createdAt: string
  updatedAt: string
}

export interface JudgePayload {
  name: string
  description?: string
  base_url: string
  api_key?: string
  model_name: string
}
