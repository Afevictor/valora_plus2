
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

export type RepairType = 'Accident' | 'Maintenance' | 'MOT' | 'Mechanics' | 'Electricity' | 'Tyres' | 'BodyPaint' | 'Warranty';
export type OTStatus = 'Open' | 'Diagnosis' | 'WaitingParts' | 'InRepair' | 'Finished' | 'Invoiced' | 'Closed' | 'reception' | 'disassembly' | 'bodywork' | 'paint' | 'admin_close' | 'finished';
export type RepairStage = 'reception' | 'disassembly' | 'bodywork' | 'paint' | 'admin_close' | 'finished';
export type BusinessLine = 'Mechanics' | 'Bodywork';

export interface WorkOrderLine { id: string; type: 'Labor' | 'Part' | 'Material' | 'Subcontract'; description: string; quantity: number; unitPrice: number; discount: number; total: number; }
export interface WorkOrderTeam { advisorId?: string; workshopChiefId?: string; adminId?: string; technicianIds: string[]; }
export interface WorkOrder { id: string; receptionId?: string; clientId: string; vehicleId: string; status: OTStatus; repairType: RepairType[]; entryDate: string; description: string; priority: 'Low' | 'Medium' | 'High' | 'Urgent'; insurance?: { company: string; policyNumber: string; claimNumber: string; expertName?: string; franchise?: number; }; lines: WorkOrderLine[]; totalAmount: number; photos: string[]; team: WorkOrderTeam; requestAppraisal?: boolean; valuationId?: string; expedienteId?: string; vehicle?: string; plate?: string; currentKm?: number; insuredName?: string; }
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

export type TimePhase = 'Bodywork' | 'Preparation' | 'Paint' | 'Finished';

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

export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Closed Won';

export interface Quote {
  id: string;
  clientId: string;
  vehicleId: string;
  date: string;
  total: number;
  status: QuoteStatus;
  lines: any[];
}

export interface Opportunity {
  id: string;
  clientId: string;
  vehicleId: string;
  type: RepairType;
  description: string;
  estimatedValue: number;
  contactDate: string;
  status: 'Pending' | 'Closed Won' | 'Closed Lost';
}

export interface ValuationRequest {
  id: string;
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

export type ClaimsStage = 'draft' | 'sent_expert' | 'in_review' | 'report_issued' | 'negotiation' | 'analytics';

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
