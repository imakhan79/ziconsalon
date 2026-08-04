export type UserRole = "admin" | "manager" | "staff" | "customer"

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"

export type InvoiceStatus = "unpaid" | "partial" | "paid" | "refunded" | "void"

export type PaymentMethod = "cash" | "card" | "bank_transfer" | "wallet" | "other"

export type InventoryTxnType = "purchase" | "sale" | "adjustment" | "return"

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

export interface Profile {
  id: string
  full_name: string
  phone: string | null
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  branch_id: string | null
  created_at: string
}

export interface Staff {
  id: string
  title: string | null
  specialization: string | null
  commission_rate: number
  hired_at: string | null
  bio: string | null
  profile?: Profile
}

export interface ServiceCategory {
  id: string
  name: string
  sort_order: number
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
}

export interface Invoice {
  id: string
  invoice_number: string
  customer_id: string
  branch_id: string | null
  appointment_id: string | null
  subtotal: number
  discount: number
  tax: number
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
  quantity: number
  unit_price: number
  line_total: number
}

export interface Payment {
  id: string
  invoice_id: string
  amount: number
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
}
