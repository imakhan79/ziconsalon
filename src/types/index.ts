export type UserRole = "admin" | "manager" | "staff" | "customer"

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"

export type InvoiceStatus = "unpaid" | "partial" | "paid" | "refunded" | "void"

export type PaymentMethod =
  | "cash"
  | "card"
  | "bank_transfer"
  | "wallet"
  | "other"
  | "debit_card"
  | "credit_card"
  | "online"
  | "gift_card"
  | "store_credit"

export type InventoryTxnType =
  | "purchase"
  | "sale"
  | "adjustment"
  | "return"
  | "transfer_in"
  | "transfer_out"
  | "write_off"

export interface Branch {
  id: string
  name: string
  code: string | null
  address: string | null
  phone: string | null
  email: string | null
  timezone: string
  opening_hours: Record<string, unknown>
  is_active: boolean
  created_at: string
}

export interface Integration {
  id: string
  provider: string
  display_name: string
  category: string
  is_enabled: boolean
  config: Record<string, unknown>
  connected_at: string | null
  updated_at: string
}

export interface AuditLog {
  id: string
  actor_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown>
  created_at: string
  actor?: Profile
}

export interface CommunicationPreferences {
  email: boolean
  sms: boolean
  whatsapp: boolean
}

export interface Profile {
  id: string
  full_name: string
  phone: string | null
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  branch_id: string | null
  gender: string | null
  date_of_birth: string | null
  preferred_staff_id: string | null
  allergies: string | null
  beauty_preferences: string | null
  communication_preferences: CommunicationPreferences
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  created_at: string
}

export type EmploymentType = "full_time" | "part_time" | "contract"

export interface Staff {
  id: string
  title: string | null
  specialization: string | null
  commission_rate: number
  hired_at: string | null
  bio: string | null
  qualifications: string | null
  skills: string | null
  employment_type: EmploymentType
  annual_leave_days: number
  profile?: Profile
}

export interface StaffCompensation {
  staff_id: string
  salary: number | null
  updated_at: string
}

export interface StaffDocument {
  id: string
  staff_id: string
  name: string
  file_url: string
  uploaded_by: string | null
  created_at: string
}

export interface ServiceCategory {
  id: string
  name: string
  sort_order: number
  parent_category_id: string | null
}

export interface Service {
  id: string
  category_id: string | null
  branch_id: string | null
  name: string
  description: string | null
  duration_minutes: number
  price: number
  is_active: boolean
  gender_focus: "all" | "female" | "male"
  room: string | null
  equipment: string | null
  tax_rate: number
  commission_override: number | null
}

export type ShiftType = "morning" | "evening" | "custom" | "rotational"

export interface Shift {
  id: string
  staff_id: string
  branch_id: string | null
  shift_type: ShiftType
  start_time: string
  end_time: string
  days_of_week: number[]
}

export interface Holiday {
  id: string
  branch_id: string | null
  name: string
  date: string
}

export interface Appointment {
  id: string
  customer_id: string
  staff_id: string | null
  start_time: string
  end_time: string
  status: AppointmentStatus
  notes: string | null
  created_at: string
  customer?: Profile
  staff?: Staff & { profile?: Profile }
  items?: AppointmentItem[]
}

export interface AppointmentItem {
  id: string
  appointment_id: string
  service_id: string
  price: number
  duration_minutes: number
  service?: Service
}

export interface Product {
  id: string
  sku: string | null
  name: string
  category: string | null
  branch_id: string | null
  cost_price: number
  sell_price: number
  stock_qty: number
  reorder_level: number
  is_active: boolean
  barcode: string | null
  default_vendor_id: string | null
}

export interface Vendor {
  id: string
  branch_id: string | null
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  is_active: boolean
  created_at: string
}

export interface ProductBatch {
  id: string
  product_id: string
  batch_number: string | null
  qty: number
  expiry_date: string | null
  received_at: string
  purchase_order_id: string | null
  created_at: string
  product?: Product
}

export type PurchaseOrderStatus = "draft" | "ordered" | "partially_received" | "received" | "cancelled"

export interface PurchaseOrder {
  id: string
  po_number: string
  vendor_id: string | null
  branch_id: string | null
  status: PurchaseOrderStatus
  notes: string | null
  created_by: string | null
  created_at: string
  ordered_at: string | null
  received_at: string | null
  vendor?: Vendor
  items?: PurchaseOrderItem[]
}

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  product_id: string
  qty_ordered: number
  qty_received: number
  unit_cost: number
  product?: Product
}

export type StockTransferStatus = "pending" | "in_transit" | "completed" | "cancelled"

export interface StockTransfer {
  id: string
  transfer_number: string
  from_branch_id: string
  to_branch_id: string
  status: StockTransferStatus
  notes: string | null
  created_by: string | null
  created_at: string
  completed_at: string | null
  from_branch?: Branch
  to_branch?: Branch
  items?: StockTransferItem[]
}

export interface StockTransferItem {
  id: string
  transfer_id: string
  from_product_id: string
  to_product_id: string
  qty: number
  from_product?: Product
  to_product?: Product
}

export interface Invoice {
  id: string
  invoice_number: string
  customer_id: string | null
  walk_in_name: string | null
  branch_id: string | null
  appointment_id: string | null
  subtotal: number
  discount: number
  tax: number
  service_charge: number
  total: number
  status: InvoiceStatus
  created_at: string
  customer?: Profile
  items?: InvoiceItem[]
  payments?: Payment[]
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  service_id: string | null
  product_id: string | null
  package_id: string | null
  quantity: number
  unit_price: number
  line_total: number
}

export interface ServicePackage {
  id: string
  branch_id: string | null
  name: string
  price: number
  is_active: boolean
}

export interface ServicePackageItem {
  package_id: string
  service_id: string
  quantity: number
}

export interface GiftCard {
  id: string
  code: string
  branch_id: string | null
  initial_value: number
  balance: number
  issued_to: string | null
  issued_by: string | null
  is_active: boolean
  expires_at: string | null
  created_at: string
}

export interface GiftCardTransaction {
  id: string
  gift_card_id: string
  invoice_id: string | null
  amount: number
  type: "issue" | "redeem" | "adjustment"
  created_by: string | null
  created_at: string
}

export interface StoreCreditTransaction {
  id: string
  customer_id: string
  amount: number
  reason: string | null
  invoice_id: string | null
  refund_id: string | null
  created_by: string | null
  created_at: string
}

export type RefundType = "full" | "partial"
export type RefundMethod = "original_payment" | "store_credit" | "cash"
export type RefundStatus = "pending" | "approved" | "rejected"

export interface Refund {
  id: string
  invoice_id: string
  branch_id: string | null
  amount: number
  type: RefundType
  reason: string | null
  refund_method: RefundMethod
  status: RefundStatus
  requested_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  credit_note_number: string | null
  created_at: string
  invoice?: Invoice
  requester?: Profile
}

export type CashSessionStatus = "open" | "closed"

export interface CashSession {
  id: string
  branch_id: string
  opened_by: string | null
  opened_at: string
  opening_float: number
  closed_by: string | null
  closed_at: string | null
  counted_cash: number | null
  bank_deposit_amount: number | null
  notes: string | null
  status: CashSessionStatus
  created_at: string
}

export interface CommunicationLog {
  id: string
  invoice_id: string | null
  campaign_id: string | null
  customer_id: string | null
  channel: "email" | "whatsapp" | "sms"
  recipient: string
  status: "pending" | "sent" | "failed"
  created_by: string | null
  created_at: string
}

export interface Payment {
  id: string
  invoice_id: string
  amount: number
  tip_amount: number
  method: PaymentMethod
  reference: string | null
  paid_at: string
}

export interface Expense {
  id: string
  category: string
  description: string | null
  branch_id: string | null
  amount: number
  expense_date: string
}

export type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "overtime" | "leave"

export interface AttendanceRecord {
  id: string
  staff_id: string
  branch_id: string | null
  work_date: string
  check_in_time: string | null
  check_out_time: string | null
  status: AttendanceStatus
  created_at: string
}

export type LeaveStatus = "pending" | "approved" | "rejected"

export interface LeaveRequest {
  id: string
  staff_id: string
  branch_id: string | null
  start_date: string
  end_date: string
  reason: string | null
  status: LeaveStatus
  reviewed_by: string | null
  created_at: string
  staff?: Profile
}

export interface StaffService {
  staff_id: string
  service_id: string
}

export interface LoyaltyTransaction {
  id: string
  customer_id: string
  points: number
  type: "earn" | "redeem" | "adjustment"
  reason: string | null
  invoice_id: string | null
  created_at: string
}

export interface MembershipPlan {
  id: string
  name: string
  price: number
  duration_months: number
  discount_percent: number
  priority_booking: boolean
  benefits: string | null
  is_active: boolean
}

export type MembershipStatus = "active" | "expired" | "cancelled"

export interface CustomerMembership {
  id: string
  customer_id: string
  plan_id: string
  status: MembershipStatus
  started_at: string
  expires_at: string
  invoice_id: string | null
  plan?: MembershipPlan
}

export interface CustomerFavorite {
  id: string
  customer_id: string
  staff_id: string | null
  service_id: string | null
  created_at: string
}

export interface RewardCatalogItem {
  id: string
  name: string
  description: string | null
  points_cost: number
  is_active: boolean
}

export interface CustomerNote {
  id: string
  customer_id: string
  note: string
  created_by: string | null
  created_at: string
}

export interface Notification {
  id: string
  recipient_id: string
  type: string
  title: string
  message: string | null
  action_url: string | null
  entity_type: string | null
  entity_id: string | null
  is_read: boolean
  created_at: string
}

export interface Review {
  id: string
  customer_id: string
  appointment_id: string
  staff_id: string | null
  rating: number
  comment: string | null
  reply: string | null
  replied_by: string | null
  replied_at: string | null
  created_at: string
  customer?: Profile
  staff?: Profile
}

export interface Promotion {
  id: string
  code: string | null
  name: string
  branch_id: string | null
  discount_type: "percent" | "fixed"
  discount_value: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  usage_limit: number | null
  usage_count: number
}

export type SegmentType =
  | "all"
  | "birthday_month"
  | "anniversary_month"
  | "inactive"
  | "top_spenders"
  | "active_members"
  | "new_customers"

export interface CustomerSegment {
  id: string
  branch_id: string | null
  name: string
  type: SegmentType
  params: Record<string, unknown>
  created_by: string | null
  created_at: string
}

export type CampaignChannel = "email" | "sms" | "whatsapp"
export type CampaignStatus = "draft" | "sent" | "cancelled"

export interface Campaign {
  id: string
  branch_id: string | null
  name: string
  channel: CampaignChannel
  subject: string | null
  message: string
  segment_id: string | null
  status: CampaignStatus
  sent_at: string | null
  created_by: string | null
  created_at: string
  segment?: CustomerSegment
  recipient_count?: number
}

export interface CampaignRecipient {
  id: string
  campaign_id: string
  customer_id: string
  status: "pending" | "sent" | "failed"
  created_at: string
}

export type ReferralStatus = "active" | "completed"

export interface Referral {
  id: string
  referrer_id: string
  referral_code: string
  referred_customer_id: string | null
  reward_points: number
  status: ReferralStatus
  created_at: string
  completed_at: string | null
  referrer?: Profile
  referred_customer?: Profile
}

export interface SurveyQuestion {
  id: string
  text: string
  type: "rating" | "text"
}

export interface Survey {
  id: string
  branch_id: string | null
  title: string
  questions: SurveyQuestion[]
  is_active: boolean
  created_by: string | null
  created_at: string
  response_count?: number
}

export interface SurveyResponse {
  id: string
  survey_id: string
  customer_id: string | null
  answers: Record<string, string | number>
  created_at: string
}
