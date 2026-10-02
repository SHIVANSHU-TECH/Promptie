export type Template = {
  id: string
  title: string
  category: string
  description: string
  body: string
  updatedAt: number
}

export type Company = {
  id: string
  name: string
  values: Record<string, string>
  updatedAt: number
}

export type Database = {
  version: 1
  templates: Template[]
  companies: Company[]
  selectedCompanyId: string | null
  activeTemplateId: string | null
}
