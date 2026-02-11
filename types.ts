
// --- Core DMS Enums & Types ---

export type AppRole = 'Admin' | 'Operator' | 'Admin_Staff' | 'Client';

export type ClientType = 'Individual' | 'Company' | 'Fleet' | 'Renting' | 'Insurance';
export type PaymentMethod = 'Cash' | 'POS' | 'Transfer' | 'Financing';
export type PaymentTerms = 'Cash' | '30 Days' | '60 Days' | '90 Days';
export type ContactChannel = 'Phone' | 'WhatsApp' | 'Email' | 'SMS';
export type TariffType = 'General' | 'Insurance' | 'Fleet' | 'Preferred';

export interface Client {
  id: string;
  clientType: ClientType;
  isCompany: boolean;
  name: string;
  taxId: string;
  phone: string;
  phoneAlternative?: string;
  email: string;
  preferredChannel: ContactChannel;
  allowCommercialComms: boolean;
  language?: string;
  address: string;
  city: string;
  zip: string;
  province: string;
  country: string;
  contactPerson?: {
    name: string;
    role: string;
    directPhone: string;
    directEmail: string;
  };
  billingAddress?: string;
  paymentMethod: PaymentMethod;
  paymentTerms?: PaymentTerms;
  tariff: TariffType;
  notes?: string;
  alerts?: string[];
  workshop_id?: string;
}

// --- Normalized Role System ---

export const NORMALIZED_ROLES = [
  { id: 'General Manager', isProductive: false, defaultPercentage: 0 },
  { id: 'Workshop Manager', isProductive: true, defaultPercentage: 50 },
  { id: 'Mechanic L1', isProductive: true, defaultPercentage: 100 },
  { id: 'Mechanic L2', isProductive: true, defaultPercentage: 100 },
  { id: 'Mechanic L3', isProductive: true, defaultPercentage: 100 },
  { id: 'Mechanic L4', isProductive: true, defaultPercentage: 100 },
  { id: 'Mechanic L5', isProductive: true, defaultPercentage: 100 },
  { id: 'Mechanic L6', isProductive: true, defaultPercentage: 100 },
  { id: 'Painter L1', isProductive: true, defaultPercentage: 100 },
  { id: 'Painter L2', isProductive: true, defaultPercentage: 100 },
  { id: 'Painter L3', isProductive: true, defaultPercentage: 100 },
  { id: 'Painter L4', isProductive: true, defaultPercentage: 100 },
  { id: 'Painter L5', isProductive: true, defaultPercentage: 100 },
  { id: 'Painter L6', isProductive: true, defaultPercentage: 100 },
  { id: 'Administrative L1', isProductive: false, defaultPercentage: 0 },
  { id: 'Administrative L2', isProductive: false, defaultPercentage: 0 },
  { id: 'Administrative L3', isProductive: false, defaultPercentage: 0 },
  { id: 'Administrative L4', isProductive: false, defaultPercentage: 0 },
  { id: 'Administrative L5', isProductive: false, defaultPercentage: 0 },
  { id: 'Administrative L6', isProductive: false, defaultPercentage: 0 },
  { id: 'Service Advisor L1', isProductive: true, defaultPercentage: 10 },
  { id: 'Service Advisor L2', isProductive: true, defaultPercentage: 15 },
  { id: 'Service Advisor L3', isProductive: true, defaultPercentage: 20 },
  { id: 'Service Advisor L4', isProductive: true, defaultPercentage: 20 },
  { id: 'Service Advisor L5', isProductive: true, defaultPercentage: 20 },
  { id: 'Service Advisor L6', isProductive: true, defaultPercentage: 20 },
  { id: 'Expert / Appraiser', isProductive: false, defaultPercentage: 0 },
] as const;

export type EmployeeRole = typeof NORMALIZED_ROLES[number]['id'];

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  department: Department;
  role: EmployeeRole;
  skills: string[];
  active: boolean;
  annualSalary: number;
  es_productivo: boolean;
  porcentaje_productivo: number;
}

export interface HourCostCalculation {
  id: string;
  workshop_id: string;
  periodo: string;
  payload_input: any;
  resultado_calculo: any;
  estado: 'active' | 'invalidated';
  created_at: string;
}

export type RepairType = 'Accident' | 'Maintenance' | 'MOT' | 'Mechanics' | 'Electricity' | 'Tyres' | 'BodyPaint' | 'Warranty' | 'Upsell' | 'Marketing';

export enum WorkOrderStatus {
  INTAKE = 'intake',              // newly created
  ASSIGNED = 'assigned',          // Assigned to operators
  IN_PROGRESS = 'in_progress',    // In execution
  ON_HOLD = 'on_hold',            // Paused
  READY_TO_CLOSE = 'ready_to_close', // Ready to close
  CLOSED = 'closed',              // Closed
  CANCELLED = 'cancelled'         // Cancelled
}

export type OTStatus = 'intake' | 'assigned' | 'in_progress' | 'on_hold' | 'ready_to_close' | 'closed' | 'cancelled' | 'reception' | 'disassembly' | 'bodywork' | 'paint' | 'admin_close' | 'finished';
export type RepairStage = OTStatus;

export const ALLOWED_TRANSITIONS: Record<OTStatus, OTStatus[]> = {
  'intake': ['assigned', 'cancelled', 'disassembly'],
  'reception': ['disassembly', 'assigned', 'cancelled'],
  'assigned': ['in_progress', 'on_hold', 'cancelled'],
  'in_progress': ['on_hold', 'ready_to_close', 'disassembly', 'bodywork', 'paint'],
  'on_hold': ['in_progress', 'cancelled'],
  'ready_to_close': ['in_progress', 'closed'],
  'closed': [],
  'cancelled': [],
  'disassembly': ['bodywork', 'paint', 'ready_to_close'],
  'bodywork': ['paint', 'ready_to_close'],
  'paint': ['ready_to_close', 'admin_close'],
  'admin_close': ['closed'],
  'finished': ['closed']
};

export type BusinessLine = 'Mechanics' | 'Bodywork';

export interface WorkOrderLine { id: string; type: 'Labor' | 'Part' | 'Material' | 'Subcontract'; description: string; quantity: number; unitPrice: number; discount: number; total: number; }
export interface WorkOrderTeam { advisorId?: string; workshopChiefId?: string; adminId?: string; technicianIds: string[]; }
export interface WorkOrder {
  id: string;
  receptionId?: string;
  clientId: string;
  vehicleId: string;
  status: OTStatus;
  repairType: RepairType[];
  entryDate: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  insurance?: {
    company: string;
    policyNumber: string;
    claimNumber: string;
    expertName?: string;
    franchise?: number;
  };
  insurer_id?: string;
  claim_number?: string;
  incident_type?: string;
  incident_date?: string;
  lines: WorkOrderLine[];
  totalAmount: number;
  photos: string[];
  team: WorkOrderTeam;
  requestAppraisal?: boolean;
  valuationId?: string;
  expedienteId?: string;
  vehicle?: string;
  plate?: string;
  vin?: string;
  currentKm?: number;
  insuredName?: string;
}
export interface Insurer {
  id: string;
  workshop_id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface RepairJob {
  id: string;
  expedienteId: string;
  clientId?: string;
  vehicle: string;
  plate: string;
  insurance: any;
  status: RepairStage;
  entryDate: string;
  priority: 'High' | 'Medium' | 'Low' | 'Urgent';
  businessLine?: BusinessLine;
  insurancePayment?: number;
  insurancePaymentStatus?: string;
  hasExternalAppraisal?: boolean;
  valuationId?: string;
  description?: string;
  insuredName?: string;
  phone?: string;
  damageDescription?: string;
  timeLogs?: TimeLog[];
  invoicedHours?: number;
  totalAmount?: number;
  team?: WorkOrderTeam;
  repairType?: RepairType[];
  currentKm?: number;
  vehicleId?: string;
  vin?: string;
  requestAppraisal?: boolean;
}
export interface ChatMessage { id: string; role: 'user' | 'model'; text: string; timestamp?: string; }
export interface CalculatorStructureCosts { rent: number; office: number; maintenance: number; diesel: number; phone: number; electricity: number; water: number; waste: number; cleaning: number; training: number; courtesyCar: number; advertising: number; banking: number; loans: number; courtesyExtra: number; taxes: number; liabilityInsurance: number; carInsurance: number; machineryDepreciation: number; subcontracts: number; other: number; }
export interface AppNotification { id: string; type: 'info' | 'success' | 'alert' | 'chat'; title: string; message: string; timestamp: string; read: boolean; linkTo?: string; }

export interface CompanyProfile {
  companyName: string;
  cif: string;
  address: string;
  city: string;
  zipCode: string;
  province: string;
  email: string;
  phone: string;
  costeHora: number;
  pvpManoObra: number;
  subscriptionTier?: 'free' | 'premium';
  defaultExpertId?: string;
  defaultExpertName?: string;
  integrations?: {
    bitrixUrl?: string;
  };
}

export type Department = 'Management' | 'Administration' | 'Reception' | 'Workshop' | 'External';

export interface TimelineEvent {
  date: string;
  title: string;
  description: string;
  completed: boolean;
}

export type TimePhase = 'Bodywork' | 'Preparation' | 'Paint' | 'Finished' | 'disassembly' | 'bodywork' | 'paint';

export interface TimeLog {
  id: string;
  phase: TimePhase;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  employeeId: string;
  mechanicName: string;
}

export interface LaborLog {
  id: string;
  work_order_id: string;
  client_id?: string;
  employee_id?: string;
  phase: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  hourly_rate_snapshot?: number;
  calculated_labor_cost?: number;
  created_at?: string;
}

export interface AnalysisUsageLog {
  id: string;
  workshop_id: string;
  report_type: string;
  created_at: string;
}

export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Closed Won';

export interface Quote {
  id: string;
  number: string;
  clientId: string;
  workOrderId?: string;
  vehicleId: string;
  date: string;
  total: number;
  status: QuoteStatus;
  lines: any[];
}

export interface Opportunity {
  id: string;
  number: string;
  clientId: string;
  workOrderId?: string;
  vehicleId: string;
  type: RepairType;
  description: string;
  estimatedValue: number;
  contactDate: string;
  status: 'Pending' | 'Closed Won' | 'Closed Lost';
}

export interface ValuationRequest {
  id: string;
  workshop_id?: string;
  ticketNumber: string;
  workOrderId: string;
  assignedExpertId: string;
  costReference: string;
  requestDate: string;
  status: string;
  claimsStage: ClaimsStage;
  workshop: {
    name: string;
    cif: string;
    contact: string;
    province: string;
  };
  vehicle: { brand: string; model: string; plate: string; km: number; vin?: string };
  insuredName: string;
  claimDate: string;
  claimType: string;
  insuranceCompany: string;
  franchise: { applies: boolean; amount: number };
  opposingVehicle: { exists: boolean; plate: string; model: string };
  photos: string[];
  documents: string[];
  notes: string;
  declarationAccepted: boolean;
  chatHistory: ValuationChatMsg[];
  videoUrl?: string;
}

export type ClaimsStage = 'draft' | 'pending_admin' | 'sent_expert' | 'in_review' | 'report_issued' | 'negotiation' | 'analytics';

export interface ValuationChatMsg {
  id: string;
  sender: 'Expert' | 'Workshop' | 'System';
  text: string;
  timestamp: string;
  rawDate?: string;
  deliveryStatus?: 'sent' | 'delivered' | 'received';
  isEmail?: boolean;
  files?: string[];
}

export interface Vehicle {
  id: string;
  clientId: string;
  plate: string;
  vin: string;
  brand: string;
  model: string;
  currentKm: number;
  year: number;
  fuel: string;
  transmission: string;
  color: string;
  created_at?: string;
}

export interface Supplier {
  id: string;
  workshop_id: string;
  name: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface PurchaseDocument {
  id: string;
  workshop_id: string;
  supplier_id?: string;
  document_number?: string;
  document_date: string;
  document_type: 'invoice' | 'delivery_note';
  total_amount: number;
  status: 'imported' | 'matched' | 'pending_review';
  file_id?: string;
  created_at?: string;
}

export interface PurchaseLine {
  id: string;
  workshop_id: string;
  purchase_document_id: string;
  sku?: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  work_order_id?: string;
  work_order_part_id?: string;
  matching_status: 'pending' | 'matched' | 'no_match';
}

export interface WorkOrderStateTransition {
  id: string;
  workshop_id: string;
  work_order_id: string;
  from_state: string;
  to_state: string;
  transitioned_by: string;
  transitioned_at: string;
  reason?: string;
  metadata?: any;
}

export interface EmployeeAttendance {
  id: string;
  employee_id: string;
  workshop_id: string;
  clock_in: string;
  clock_out?: string;
  day_type: 'work' | 'vacation' | 'sick_leave' | 'personal_leave' | 'holiday';
  total_hours?: number;
  extra_hours: number;
  notes?: string;
  is_locked: boolean;
  attendance_breaks?: AttendanceBreak[];
}

export interface AttendanceBreak {
  id: string;
  attendance_id: string;
  break_start: string;
  break_end?: string;
  break_type: 'meal' | 'rest' | 'personal';
  duration_minutes?: number;
}

export interface EmployeeAbsence {
  id: string;
  employee_id: string;
  workshop_id: string;
  absence_type: 'vacation' | 'sick_leave' | 'personal_leave' | 'maternity_leave' | 'paternity_leave' | 'unpaid_leave';
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  notes?: string;
}

export interface WorkOrderTask {
  id: string;
  workshop_id: string;
  work_order_id: string;
  name: string;
  description?: string;
  category: 'mechanics' | 'electricity' | 'bodywork' | 'paint' | 'cleaning' | 'other';
  status: 'pending' | 'in_progress' | 'on_hold' | 'finished' | 'cancelled';
  estimated_hours?: number;
  actual_hours: number;
  created_at: string;
}

export interface TaskTimeLog {
  id: string;
  workshop_id: string;
  task_id: string;
  employee_id: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  status: 'in_progress' | 'paused' | 'completed';
  sync_id?: string;
}
