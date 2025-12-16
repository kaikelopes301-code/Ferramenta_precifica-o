export type NumericMetrics = {
  display: number
  mean: number
  median: number
  min: number
  max: number
  n: number
  unit?: string
}

export type EquipmentSources = {
  fornecedores?: string[]
  bids?: string[]
  nLinhas: number
}

export type Equipment = {
  ranking: number
  sugeridos: string
  // Campos legacy (v3.0) - mantidos para retrocompatibilidade
  valor_unitario: number | null
  vida_util_meses: number | null
  manutencao_percent: number | null
  // Campos v4.0 - métricas agregadas
  metrics?: {
    valorUnitario?: NumericMetrics
    vidaUtilMeses?: NumericMetrics
    manutencao?: NumericMetrics
  }
  sources?: EquipmentSources
  equipmentId?: string
  title?: string
  confianca: number | null
  link_detalhes: string
  isIncorrect?: boolean
  feedback?: string
  equipamento_material_revisado?: string
  marca?: string | null
  origemDescricao?: string | null
}
