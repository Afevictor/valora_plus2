
import { createClient } from '@supabase/supabase-js';
import { 
    CompanyProfile, 
    Client, 
    Employee, 
    WorkOrder, 
    RepairJob, 
    ValuationRequest, 
    RepairStage, 
    ClaimsStage,
    Vehicle,
    Quote,
    Opportunity,
    HourCostCalculation,
    AppRole
} from '../types';

const SUPABASE_URL = 'https://igwbevwytsufppqohtsh.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_ft8tLP4X8msvjeT3jpGyeg_YoL9h03f';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const logError = (context: string, error: any) => {
    const message = error?.message || JSON.stringify(error);
    console.error(`DB Error [${context}]:`, message);
    return message;
};

// --- Secure PIN Helpers ---
export const saveUserPins = async (userId: string, pins: { Admin: string, Operator: string, Admin_Staff: string }) => {
    const { error } = await supabase.from('user_access_keys').upsert({
        user_id: userId,
        admin_hash: pins.Admin,
        operator_hash: pins.Operator,
        staff_hash: pins.Admin_Staff
    });
    if (error) throw error;
};

export const getUserPins = async (userId: string) => {
    const { data, error } = await supabase
        .from('user_access_keys')
        .select('*')
        .eq('user_id', userId)
        .single();
    if (error) return null;
    return {
        Admin: data.admin_hash,
        Operator: data.operator_hash,
        Admin_Staff: data.staff_hash
    };
};

export const verifyPinAndGetRole = async (userId: string, enteredPin: string): Promise<AppRole | null> => {
    const { data, error } = await supabase
        .from('user_access_keys')
        .select('*')
        .eq('user_id', userId)
        .single();
    if (error || !data) return null;
    if (enteredPin === data.admin_hash) return 'Admin';
    if (enteredPin === data.operator_hash) return 'Operator';
    if (enteredPin === data.staff_hash) return 'Admin_Staff';
    return null;
};

// --- Labor & Timing Persistence ---
export const saveLaborLog = async (log: {
    work_order_id: string;
    client_id: string;
    employee_id: string;
    phase: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    hourly_rate_snapshot: number;
    calculated_labor_cost: number;
}) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthenticated session.");
        
        const { error } = await supabase.from('labor_logs').insert({ 
            ...log, 
            workshop_id: user.id 
        });
        
        if (error) {
            const msg = logError('saveLaborLog', error);
            if (error.code === '23503') {
                throw new Error(`Foreign Key Error: The Work Order ID ${log.work_order_id} does not exist in the database. Please ensure the Work Order is saved to the cloud first.`);
            }
            throw new Error(msg);
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

export const getLaborLogsForOrder = async (orderId: string) => {
    try {
        const { data, error } = await supabase
            .from('labor_logs')
            .select('*')
            .eq('work_order_id', orderId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (e) {
        logError('getLaborLogs', e);
        return [];
    }
};

export const getAllWorkshopLaborLogs = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        const { data, error } = await supabase
            .from('labor_logs')
            .select('work_order_id, calculated_labor_cost')
            .eq('workshop_id', user.id);
        if (error) throw error;
        return data || [];
    } catch (e) {
        logError('getAllWorkshopLaborLogs', e);
        return [];
    }
};

// --- Files ---
export const getFilesForExpediente = async (uuid: string, humanId?: string) => {
    try {
        let query = supabase.from('workshop_files').select('*');
        if (humanId) {
            query = query.or(`expediente_id.eq.${uuid},expediente_id.eq.${humanId}`);
        } else {
            query = query.eq('expediente_id', uuid);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(f => {
            const { data: { publicUrl } } = supabase.storage.from(f.bucket).getPublicUrl(f.storage_path);
            return { ...f, publicUrl };
        });
    } catch (e) {
        logError('getFilesForExpediente', e);
        return [];
    }
};

export const uploadWorkshopFile = async (f: File, b: string, p: string) => {
    try {
        const { data, error } = await supabase.storage.from(b).upload(p, f, { cacheControl: '3600', upsert: true });
        if (error) throw error;
        return data.path;
    } catch (e) {
        logError('uploadWorkshopFile', e);
        return null;
    }
};

export const saveFileMetadata = async (m: any) => {
    try {
        const { error } = await supabase.from('workshop_files').insert(m);
        if (error) throw error;
        return true;
    } catch (e) {
        logError('saveFileMetadata', e);
        throw e;
    }
};

// --- Employees ---
export const getEmployeesFromSupabase = async (): Promise<Employee[]> => {
    try {
        const { data, error } = await supabase.from('employees').select('*');
        if (error) throw error;
        return data?.map(d => ({ ...d.raw_data, id: d.id, annualSalary: d.annual_salary || 0, es_productivo: d.es_productivo ?? false, porcentaje_productivo: d.porcentaje_productivo ?? 0, fullName: d.full_name, role: d.role })) || [];
    } catch (e) {
        logError('getEmployees', e);
        return [];
    }
};

export const saveEmployeeToSupabase = async (employee: Employee): Promise<Employee | null> => {
    try {
        const { error } = await supabase.from('employees').upsert({ id: employee.id, full_name: employee.fullName, role: employee.role, email: employee.email, annual_salary: employee.annualSalary, es_productivo: employee.es_productivo, porcentaje_productivo: employee.porcentaje_productivo, raw_data: employee });
        if (error) throw error;
        return employee;
    } catch (e) {
        logError('saveEmployee', e);
        return null;
    }
};

export const deleteEmployeeFromSupabase = async (id: string) => { 
    try { 
        const { error } = await supabase.from('employees').delete().eq('id', id); 
        if (error) throw error; 
        return { success: true }; 
    } catch (error) { 
        return { success: false, error: logError('deleteEmployee', error) }; 
    } 
};

// --- Hour Rate Storage ---
export const getActiveHourCostCalculation = async (periodo: string, workshopId: string): Promise<HourCostCalculation | null> => {
    try {
        const { data, error } = await supabase.from('hour_rate_storage').select('*').eq('periodo', periodo).eq('workshop_id', workshopId).maybeSingle();
        if (error) throw error;
        return data || null;
    } catch (e) {
        logError('getActiveHourCost', e);
        return null;
    }
};

export const saveHourCostCalculation = async (calcData: any) => {
    try {
        const { data, error } = await supabase.from('hour_rate_storage').upsert(calcData, { onConflict: 'workshop_id, periodo' }).select().single();
        if (error) throw error;
        return data;
    } catch (e: any) {
        logError('saveHourCost', e);
        throw e;
    }
};

export const getHourCostHistory = async (workshopId: string): Promise<HourCostCalculation[]> => {
    try {
        const { data, error } = await supabase.from('hour_rate_storage').select('*').eq('workshop_id', workshopId).order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (e) {
        logError('getHourCostHistory', e);
        return [];
    }
};

export const deleteHourCostCalculation = async (id: string) => {
    try {
        const { error } = await supabase.from('hour_rate_storage').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (e) {
        return { success: false, error: logError('deleteHourCost', e) };
    }
};

export const getCostCalculations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    return getHourCostHistory(user.id);
};

// --- General DMS Services ---
export const getClientsFromSupabase = async (): Promise<Client[]> => { try { const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false }); if (error) throw error; return data?.map(d => d.raw_data as Client) || []; } catch (e) { return []; } };
export const saveClientToSupabase = async (client: Client) => { try { const { error } = await supabase.from('clients').upsert({ id: client.id, raw_data: client }); if (error) throw error; return true; } catch (e) { return false; } };

export const deleteClient = async (id: string) => { 
    try { 
        const { error } = await supabase.from('clients').delete().eq('id', id); 
        if (error) throw error; 
        return { success: true }; 
    } catch (error) { 
        return { success: false, error: logError('deleteClient', error) }; 
    } 
};

export const getWorkOrdersFromSupabase = async (): Promise<RepairJob[]> => { try { const { data, error } = await supabase.from('work_orders').select('*'); if (error) throw error; return data?.map(d => d.raw_data as RepairJob) || []; } catch (e) { return []; } };
export const getWorkOrder = async (id: string): Promise<RepairJob | null> => { try { const { data, error } = await supabase.from('work_orders').select('*').eq('id', id).single(); if (error) throw error; return data ? (data.raw_data as RepairJob) : null; } catch (e) { return null; } };

export const saveWorkOrderToSupabase = async (wo: WorkOrder) => { 
    try { 
        const payload: any = { 
            id: wo.id, 
            client_id: wo.clientId, 
            expediente_id: wo.expedienteId || wo.id, 
            raw_data: wo 
        }; 
        const { error } = await supabase.from('work_orders').upsert(payload); 
        if (error) {
            logError('saveWorkOrder', error);
            return { success: false, error: error.message };
        } 
        return { success: true }; 
    } catch (error: any) { 
        return { success: false, error: error.message }; 
    } 
};

export const deleteWorkOrder = async (id: string) => { 
    try { 
        const { error } = await supabase.from('work_orders').delete().eq('id', id); 
        if (error) throw error; 
        return { success: true }; 
    } catch (e) { 
        return { success: false, error: logError('deleteWorkOrder', e) };
    } 
};

export const updateWorkOrderStatus = async (id: string, status: RepairStage) => { try { const { data: wo } = await supabase.from('work_orders').select('raw_data').eq('id', id).single(); if (!wo) return false; const updatedRaw = { ...wo.raw_data, status }; const { error } = await supabase.from('work_orders').update({ status: status, raw_data: updatedRaw }).eq('id', id); if (error) throw error; return true; } catch (e) { return false; } };
export const saveVehicle = async (vehicle: Vehicle) => { try { const { error } = await supabase.from('vehicles').upsert({ id: vehicle.id, raw_data: vehicle }); if (error) throw error; return true; } catch (e) { return false; } };
export const getVehicle = async (id: string) => { try { const { data, error } = await supabase.from('vehicles').select('*').eq('id', id).single(); if (error) throw error; return data ? (data.raw_data as Vehicle) : null; } catch (e) { return null; } };
export const getCompanyProfileFromSupabase = async (): Promise<CompanyProfile | null> => { try { const { data, error } = await supabase.from('company_profile').select('*').limit(1).maybeSingle(); if (error) throw error; if (!data) return null; return data.raw_data || null; } catch (error) { return null; } };
export const saveCompanyProfileToSupabase = async (profile: CompanyProfile) => { try { const { error } = await supabase.from('company_profile').upsert({ id: 1, raw_data: profile }); if (error) throw error; return true; } catch (error) { return false; } };
export const getValuationsFromSupabase = async (): Promise<ValuationRequest[]> => { try { const { data, error } = await supabase.from('valuations').select('*'); if (error) throw error; return data?.map(d => d.raw_data as ValuationRequest) || []; } catch (e) { return []; } };
export const saveValuationToSupabase = async (val: ValuationRequest) => { try { const { error } = await supabase.from('valuations').upsert({ id: val.id, raw_data: val }); if (error) throw error; return true; } catch (error) { return false; } };

export const deleteValuation = async (id: string) => { 
    try { 
        const { error } = await supabase.from('valuations').delete().eq('id', id); 
        if (error) throw error; 
        return { success: true }; 
    } catch (e) { 
        return { success: false, error: logError('deleteValuation', e) };
    } 
};

export const saveAnalysisRequest = async (vId: string, url: string) => { try { const { data, error } = await supabase.from('analysis_requests').insert({ valuation_id: vId, file_url: url }).select().single(); if (error) throw error; return data; } catch (e) { return null; } };
export const getAnalysisRequest = async (vId: string) => { try { const { data, error } = await supabase.from('analysis_requests').select('*').eq('valuation_id', vId).order('created_at', { ascending: false }).limit(1).single(); if (error) throw error; return data; } catch (e) { return null; } };
export const uploadChatAttachment = async (file: File) => { try { const fn = `${Date.now()}_${file.name}`; const { error } = await supabase.storage.from('attachments').upload(fn, file); if (error) throw error; const { data } = await supabase.storage.from('attachments').getPublicUrl(fn); return data.publicUrl; } catch (e) { return null; } };
export const updateValuationStage = async (id: string, s: ClaimsStage) => { try { const { data: val } = await supabase.from('valuations').select('raw_data').eq('id', id).single(); if (!val) return false; const ur = { ...val.raw_data, claimsStage: s }; const { error } = await supabase.from('valuations').update({ raw_data: ur }).eq('id', id); if (error) throw error; return true; } catch (e) { return false; } };
export const saveBitrixConfig = async (u: string) => { try { const p = await getCompanyProfileFromSupabase(); if (!p) return false; const up = { ...p, integrations: { ...p.integrations, bitrixUrl: u } }; return await saveCompanyProfileToSupabase(up); } catch (e) { return false; } };

export const getQuotes = async (): Promise<Quote[]> => { try { const { data, error } = await supabase.from('quotes').select('*'); if (error) throw error; return data?.map(d => d.raw_data as Quote) || []; } catch (e) { return []; } };
export const saveQuote = async (q: Quote) => { try { const { error } = await supabase.from('quotes').upsert({ id: q.id, raw_data: q }); if (error) throw error; return true; } catch (error) { return false; } };
export const deleteQuote = async (id: string) => { 
    try { 
        const { error } = await supabase.from('quotes').delete().eq('id', id); 
        if (error) throw error; 
        return { success: true }; 
    } catch (error) { 
        return { success: false, error: logError('deleteQuote', error) }; 
    } 
};
export const getOpportunities = async (): Promise<Opportunity[]> => { try { const { data, error } = await supabase.from('opportunities').select('*'); if (error) throw error; return data?.map(d => d.raw_data as Opportunity) || []; } catch (e) { return []; } };
export const saveOpportunity = async (o: Opportunity) => { try { const { error } = await supabase.from('opportunities').upsert({ id: o.id, raw_data: o }); if (error) throw error; return true; } catch (error) { return false; } };
export const deleteOpportunity = async (id: string) => { 
    try { 
        const { error } = await supabase.from('opportunities').delete().eq('id', id); 
        if (error) throw error; 
        return { success: true }; 
    } catch (error) { 
        return { success: false, error: logError('deleteOpportunity', error) }; 
    } 
};
export const sendMessageToValuation = async (m: any) => { try { const { error } = await supabase.from('valuation_messages').insert(m); if (error) throw error; return true; } catch (e) { return false; } };
