export interface User {
  userId: string
  email: string
}

export interface TagOut {
  id: string
  name: string
}

export interface MerchantBrief {
  id: string
  canonical_name: string
  alias: string | null
}

export interface MerchantOut {
  id: string
  canonical_name: string
  alias: string | null
  default_share: number | null
  default_share_amount: number | null
  tags: TagOut[]
}

export interface CollectionBrief {
  id: string
  name: string
}

export interface CollectionOut {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
}

export interface CollectionDetailOut {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  stats: {
    total_personal: number
    expense_count: number
    by_tag: { tag: string; total: number }[]
  }
}

export interface ExpenseOut {
  id: string
  date: string
  merchant: MerchantBrief
  full_amount: number
  currency: string
  share: number | null
  share_amount: number | null
  personal_amount: number
  tags: TagOut[]
  merchant_tags: TagOut[]
  collection: CollectionBrief | null
  payment_type: string
  source_identifier: string | null
  extra: Record<string, unknown> | null
  created_at: string
}

export interface PaginatedExpenses {
  items: ExpenseOut[]
  total: number
  limit: number
  offset: number
}

export interface CredentialOut {
  id: string
  provider: string
  label: string
  created_at: string
  updated_at: string
}

export interface MonthlyRoutine {
  months: { month: string; total_personal: number; expense_count: number }[]
}

export interface RoutineByTag {
  tags: { tag_id: string; tag_name: string; total_personal: number; expense_count: number }[]
}
