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
  payment_tags: string[]
  merchant_tags: string[]
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
  payment_tags?: string[]
  merchant_tags?: string[]
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
  taggedOnly?: boolean
  q?: string
}

export interface PaymentListCursor {
  date: string
  payment_id: string
}

export interface PaymentListPage {
  items: Payment[]
  next_cursor: PaymentListCursor | null
}

export interface CurrencyTotals {
  currency: string
  sum_effective: string
  sum_amount: string
}

export interface TagSummaryRow {
  tag: string
  currency: string
  sum_effective: string
  payment_count: number
}

export interface UntaggedByCurrency {
  currency: string
  payment_count: number
  sum_effective: string
}

export interface PaymentTypeSummaryRow {
  payment_type: string
  currency: string
  payment_count: number
  sum_effective: string
}

export interface MerchantSummaryRow {
  display_name: string
  currency: string
  payment_count: number
  sum_effective: string
}

export interface MonthSummaryRow {
  year: number
  month: number
  currency: string
  payment_count: number
  sum_effective: string
}

export interface PaymentSummary {
  payment_count: number
  totals_by_currency: CurrencyTotals[]
  by_tag: TagSummaryRow[]
  untagged_by_currency: UntaggedByCurrency[]
  by_payment_type: PaymentTypeSummaryRow[]
  top_merchants: MerchantSummaryRow[]
  by_month: MonthSummaryRow[]
}
