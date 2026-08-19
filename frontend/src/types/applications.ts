export interface AIApplication {
  id: number
  name: string
  baseUrl: string
  apiKeyMasked: string
  modelName: string
  inputModalities: string[]
  outputModalities: string[]
  createdAt: string
  updatedAt: string
}

export interface ApplicationPayload {
  name: string
  base_url: string
  api_key?: string
  model_name: string
  input_modalities?: string[]
  output_modalities?: string[]
}

export interface TestChatResult {
  reply: string
  simulated: boolean
}
