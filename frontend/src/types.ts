export interface PaymentExtra {
  account_number?: string
  original_amount?: number
  original_currency?: string
  processed_date?: string
  memo?: string
  status?: string
  identifier?: number
  type?: string
  installment_number?: number
  installment_total?: number
  category?: string
  extended_details?: {
    rawDetails?: unknown
  }
}

export interface Payment {
  payment_id: string
  date: string
  description: string
  amount: number
  currency: string
  effective_amount: number
  merchant: string | null
  display_name: string
  merchant_alias: string | null
  payment_type: string
  tags: string[]
  share_amount: number | null
  share_currency: string | null
  extra: PaymentExtra
}

export interface ScrapeResult {
  import_id: string
  payment_count: number
  imported_at: string
}

export interface PatchPaymentBody {
  tags?: string[]
  payment_type?: string
  share_amount?: number | null
  share_currency?: string | null
  merchant_alias?: string | null
}

export interface PaymentFilters {
  includeTags?: string[]
  excludeTags?: string[]
  dateFrom?: string
  dateTo?: string
  amountMin?: number
  amountMax?: number
}
