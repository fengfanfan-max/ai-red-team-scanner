export interface DatasetSubcategory {
  name: string
  prompts: string[]
}

export interface BuiltinDataset {
  name: string
  description: string
  subcategories: DatasetSubcategory[]
}

export interface CustomDataset {
  id: number
  name: string
  description: string
  subcategoryCount: number
  promptCount: number
  createdAt: string
}

export interface DatasetsResponse {
  builtin: BuiltinDataset[]
  custom: CustomDataset[]
}

export interface CustomDatasetPayload {
  name: string
  description: string
  subcategories: DatasetSubcategory[]
}
