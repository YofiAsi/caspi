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

export interface TagItem {
  id: string
  name: string
}

export interface CollectionItem {
  id: string
  name: string
  payment_count: number
  sum_effective: string
  first_payment_date: string | null
  last_payment_date: string | null
}

export interface CollectionTimeseriesRow {
  period_start: string
  sum_effective: string
  payment_count: number
}

export interface CollectionTimeseriesResponse {
  granularity: string
  rows: CollectionTimeseriesRow[]
}

export interface Payment {
  payment_id: string
  merchant_id: string
  date: string
  description: string
  amount: number
  currency: string
  effective_amount: number
  display_name: string
  merchant_alias: string | null
  payment_type: string
  payment_tags: string[]
  merchant_tags: string[]
  collection_ids: string[]
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
  payment_tags?: string[]
  merchant_tags?: string[]
  collection_ids?: string[]
  payment_type?: string
  share_amount?: number | null
  share_currency?: string | null
  merchant_alias?: string | null
}

export type PaymentListSort =
  | 'date_desc'
  | 'date_asc'
  | 'amount_desc'
  | 'amount_asc'
  | 'merchant_asc'
  | 'merchant_desc'

export interface PaymentFilters {
  includeTags?: string[]
  excludeTags?: string[]
  dateFrom?: string
  dateTo?: string
  amountMin?: number
  amountMax?: number
  taggedOnly?: boolean
  q?: string
  currency?: string
  sort?: PaymentListSort
  applyTagSlice?: boolean
  filterTagId?: string
  otherTagIds?: string[]
  includeTotals?: boolean
  collectionId?: string
  applyTagCombo?: boolean
  mergedTagIds?: string[]
  applyTagComboOther?: boolean
  tagComboExcludes?: string[][]
}

export interface PaymentListCursor {
  date: string
  payment_id: string
  effective_amount?: string
  merchant_sort_key?: string
}

export interface ListFilterTotals {
  payment_count: number
  sum_effective: string
}

export interface PaymentListPage {
  items: Payment[]
  next_cursor: PaymentListCursor | null
  filter_totals?: ListFilterTotals | null
}

export interface MonthTagSliceRow {
  other_tag_ids: string[]
  label: string
  sum_effective: string
  payment_count: number
  fraction: string
  is_other: boolean
}

export interface MonthTagSlicesResponse {
  currency: string
  month_total_effective: string
  payment_count: number
  slices: MonthTagSliceRow[]
}

export interface CurrencyTotals {
  currency: string
  sum_effective: string
  sum_amount: string
}

export interface TagSummaryRow {
  tag_id: string
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

export type AnalyticsGranularity = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'lifetime'

export interface PaymentTimeseriesRow {
  period_start: string
  sum_effective: string
  payment_count: number
}

export interface PaymentTimeseriesResponse {
  granularity: string
  rows: PaymentTimeseriesRow[]
}

// --- Splitwise integration ---

export type SplitMethod = 'equal' | 'percentage' | 'shares'

export interface SplitwiseStatus {
  connected: boolean
  source: string | null
  splitwise_user_id: number | null
  last_validated_at: string | null
  queued: number
  failed: number
}

export interface SplitwiseGroupMember {
  user_id: number
  first_name: string
  last_name: string | null
}

export interface SplitwiseGroup {
  id: number
  name: string
  members: SplitwiseGroupMember[]
}

export interface SplitwiseEqualParams {
  member_ids: number[]
}

export interface SplitwiseWeightedMember {
  user_id: number
  value: number
}

export interface SplitwiseWeightedParams {
  members: SplitwiseWeightedMember[]
}

export type SplitwiseSplitParams =
  | SplitwiseEqualParams
  | SplitwiseWeightedParams
  | Record<string, unknown>

export interface SplitwiseShareRequest {
  payment_id: string
  amount: number | string
  currency: string
  group_id: number
  split_method: SplitMethod
  split_params: SplitwiseSplitParams
  description?: string
  date?: string | null
}

export interface SplitwiseShareResponse {
  my_share_amount: string
  my_share_currency: string
  outbox_id: string
}

export interface SplitwiseUnshareResponse {
  delete_enqueued: boolean
  outbox_id: string | null
}

export interface SplitwiseRule {
  merchant_id: string
  enabled: boolean
  splitwise_group_id: number
  split_method: SplitMethod
  split_params: SplitwiseSplitParams
  currency: string
}

export interface SplitwiseRuleBody {
  enabled: boolean
  splitwise_group_id: number
  split_method: SplitMethod
  split_params: SplitwiseSplitParams
  currency: string
}

export interface SplitwiseFailedEntry {
  id: string
  payment_id: string | null
  operation: 'push' | 'delete' | string
  status: string
  attempts: number
  last_error: string | null
  next_attempt_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface SplitwiseRetryResponse {
  outbox_id: string | null
  requeued: boolean
}

export interface ToolCallFunction {
  name: string
  arguments: string
}

export interface ToolCall {
  id: string
  type: string
  function: ToolCallFunction
}

export interface ChatMessage {
  role: string
  content?: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface PendingAction {
  action_id: string
  tool_name: string
  arguments: Record<string, unknown>
  summary: string
}

export interface ChatResponse {
  status: 'message' | 'pending_action' | 'error'
  messages: ChatMessage[]
  pending_action?: PendingAction | null
  error?: string | null
}

export interface AISettings {
  configured: boolean
  source: string | null
  provider: string | null
  model: string | null
  api_base: string | null
  has_api_key: boolean
}

export interface AISettingsBody {
  provider?: string | null
  model?: string | null
  api_base?: string | null
  api_key?: string | null
  clear_api_key?: boolean
}
