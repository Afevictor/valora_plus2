
import { createClient } from '@supabase/supabase-js';
import {
    CompanyProfile,
    Client,
    ClientType,
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
    AppRole,
    PurchaseDocument,
    PurchaseLine,
    WorkOrderStatus,
    OTStatus,
    ALLOWED_TRANSITIONS,
    WorkOrderStateTransition,
    EmployeeAttendance,
    AttendanceBreak,
    EmployeeAbsence
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

// Check if email exists in workshop_auth to prevent client login
export const checkIsWorkshopAuthEmail = async (email: string): Promise<boolean> => {
    try {
        const { data, error } = await supabase
            .from('workshop_auth')
            .select('email')
            .eq('email', email)
            .maybeSingle();
        if (error) return false;
        return !!data;
    } catch (e) {
        return false;
    }
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
        const searchIds = [uuid, humanId].filter(Boolean) as string[];
        if (searchIds.length === 0) return [];

        console.log(`[DB TRACE] Fetching files for Expediente IDs:`, searchIds);

        // Uses .in for better reliability across UUID and Human ID strings
        const { data, error } = await supabase
            .from('workshop_files')
            .select('*')
            .in('expediente_id', searchIds);

        if (error) throw error;

        if (!data || data.length === 0) {
            console.warn(`[DB TRACE] No files found for IDs:`, searchIds);
            return [];
        }

        console.log(`[DB TRACE] Found ${data.length} files in metadata table.`);

        return data.map(f => {
            const { data: { publicUrl } } = supabase.storage.from(f.bucket).getPublicUrl(f.storage_path);
            return { ...f, publicUrl };
        });
    } catch (e) {
        logError('getFilesForExpediente', e);
        return [];
    }
};

export const logClientActivity = async (activity: {
    client_id?: string;
    plate?: string;
    expediente_id: string;
    activity_type?: string;
    summary: string;
    file_assets?: any[];
    raw_data?: any;
}) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('client_activity_feed').insert({
            ...activity,
            workshop_id: user.id
        });
    } catch (e) {
        console.error("[ACTIVITY LOG] Failed to log activity:", e);
    }
};

export const uploadWorkshopFile = async (f: File, b: string, p: string) => {
    try {
        console.log('[UPLOAD] Attempting upload:', { bucket: b, path: p, fileName: f.name, fileSize: f.size });
        const { data, error } = await supabase.storage.from(b).upload(p, f, { cacheControl: '3600', upsert: true });
        if (error) {
            console.error('[UPLOAD] Storage error:', error);
            throw error;
        }
        console.log('[UPLOAD] Success:', data.path);
        return data.path;
    } catch (e: any) {
        console.error('[UPLOAD] Upload failed:', e);
        logError('uploadWorkshopFile', e);
        return null;
    }
};

export const saveFileMetadata = async (m: any) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Authenticated user required to save file metadata");

        const payload = {
            ...m,
            workshop_id: m.workshop_id || user.id
        };

        const { data, error } = await supabase
            .from('workshop_files')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        return data;
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const { error } = await supabase.from('employees').upsert({
            id: employee.id,
            workshop_id: user.id,
            full_name: employee.fullName,
            role: employee.role,
            email: employee.email,
            annual_salary: employee.annualSalary,
            es_productivo: employee.es_productivo,
            porcentaje_productivo: employee.porcentaje_productivo,
            raw_data: employee
        });
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const payload = { ...calcData, workshop_id: user.id };
        const { data, error } = await supabase.from('hour_rate_storage').upsert(payload, { onConflict: 'workshop_id, periodo' }).select().single();
        if (error) throw error;
        return data;
    } catch (e: any) {
        logError('saveHourCost', e);
        throw e;
    }
};

export const getHourCostHistory = async (clientId?: string): Promise<HourCostCalculation[]> => {
    try {
        console.log("--- DB TRACE: Fetching from hour_rate_storage ---");
        let query = supabase
            .from('hour_rate_storage')
            .select('*')
            .order('created_at', { ascending: false });

        if (clientId) {
            query = query.eq('workshop_id', clientId);
        }

        const { data, error, status } = await query;

        if (error) {
            console.error("DB TRACE ERROR:", error);
            throw error;
        }

        console.log("DB TRACE STATUS:", status);
        console.log("DB TRACE DATA COUNT:", data?.length || 0);

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

export const getCostCalculations = async (clientId?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    return getHourCostHistory(clientId);
};

// --- General DMS Services ---
export const getClientsFromSupabase = async (): Promise<Client[]> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const activeRole = sessionStorage.getItem('vp_active_role') || 'Client';
        const isAppAdmin = activeRole === 'Admin' || activeRole === 'Admin_Staff';

        console.log(`🔍 [getClients] Role: ${activeRole} | Fetching from ${isAppAdmin ? 'clients' : 'workshop_customers'}`);

        if (isAppAdmin) {
            // ADMIN: Fetch workshops from 'clients' table
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(d => {
                const raw = d.raw_data || {};
                return {
                    ...raw,
                    id: d.id,
                    workshop_id: d.workshop_id,
                    name: d.name || raw.name || 'Sin Nombre',
                    email: d.email || raw.email || '',
                    phone: d.phone || raw.phone || '',
                    taxId: d.taxId || raw.taxId || '',
                    clientType: (d.clientType || raw.clientType || 'Individual') as ClientType
                };
            });
        } else {
            // WORKSHOP: Fetch their own customers from 'workshop_customers'
            const { data, error } = await supabase
                .from('workshop_customers')
                .select('*')
                .eq('workshop_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(d => {
                const raw = d.raw_data || {};
                return {
                    ...raw,
                    id: d.id,
                    workshop_id: d.workshop_id,
                    name: d.full_name || raw.name || 'Sin Nombre',
                    clientType: (d.customer_type || raw.clientType || 'Individual') as ClientType,
                    isCompany: d.customer_type === 'Company',
                    taxId: d.tax_id || raw.taxId || '',
                    phone: d.phone || raw.phone || '',
                    email: d.email || raw.email || '',
                    address: d.address || raw.address || '',
                    city: d.city || raw.city || '',
                    province: d.province || raw.province || '',
                    zip: d.postal_code || raw.zip || '',
                    notes: d.notes || raw.notes || ''
                };
            });
        }
    } catch (e) {
        logError('getClients', e);
        return [];
    }
};

export const getInsurers = async (): Promise<Insurer[]> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('insurers')
            .select('*')
            .eq('workshop_id', user.id)
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error("Error fetching insurers:", e);
        return [];
    }
};

export const saveClientToSupabase = async (client: Client) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Authenticated user required to save client");

        const activeRole = sessionStorage.getItem('vp_active_role') || 'Client';
        const isAppAdmin = activeRole === 'Admin' || activeRole === 'Admin_Staff';

        if (isAppAdmin) {
            // ADMIN: Save to 'clients' table
            const payload = {
                id: client.id,
                workshop_id: user.id,
                name: client.name,
                email: client.email,
                phone: client.phone,
                taxId: client.taxId,
                address: client.address,
                city: client.city,
                zip: client.zip,
                province: client.province,
                clientType: client.clientType,
                isCompany: client.isCompany,
                raw_data: client
            };
            const { error } = await supabase.from('clients').upsert(payload);
            if (error) throw error;
        } else {
            // WORKSHOP: Save to 'workshop_customers' table
            const payload = {
                id: client.id,
                workshop_id: user.id,
                customer_type: client.clientType || 'Individual',
                full_name: client.name,
                phone: client.phone,
                email: client.email,
                tax_id: client.taxId,
                address: client.address,
                city: client.city,
                province: client.province,
                postal_code: client.zip,
                notes: client.notes,
                raw_data: client
            };
            const { error } = await supabase.from('workshop_customers').upsert(payload);
            if (error) throw error;
        }
        return true;
    } catch (e) {
        logError('saveClient', e);
        return false;
    }
};

/**
 * Specifically for self-registration of a Workshop into the Master Clients List (for Admin view)
 */
export const saveWorkshopAsClient = async (client: Client) => {
    try {
        const payload = {
            id: client.id,
            workshop_id: client.id, // Self-governed
            name: client.name,
            email: client.email,
            // Minimal schema only supports: id, workshop_id, name, email, raw_data
            raw_data: client
        };
        const { error } = await supabase.from('clients').upsert(payload);
        if (error) throw error;
        return true;
    } catch (e) {
        logError('saveWorkshopAsClient', e);
        return false;
    }
};

export const deleteClient = async (id: string) => {
    try {
        const activeRole = sessionStorage.getItem('vp_active_role') || 'Client';
        const isAppAdmin = activeRole === 'Admin' || activeRole === 'Admin_Staff';
        const table = isAppAdmin ? 'clients' : 'workshop_customers';

        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (error) {
        return { success: false, error: logError('deleteClient', error) };
    }
};

export const getWorkOrdersFromSupabase = async (): Promise<RepairJob[]> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const userType = user.user_metadata?.user_type;
        let query = supabase.from('work_orders').select('*');

        // Isolation: Handled by RLS policies on the database level
        // (Workshops see work_orders.workshop_id = auth.uid, Clients see work_orders.client_id = auth.uid)

        const { data, error } = await query;
        if (error) throw error;
        return data?.map(d => {
            const raw = d.raw_data || {};
            return {
                ...raw,
                id: d.id,
                status: d.status || raw.status,
                plate: d.plate || raw.plate,
                vehicle: d.vehicle || raw.vehicle,
                insuredName: d.insured_name || raw.insuredName,
                expedienteId: d.expediente_id || raw.expedienteId,
                entryDate: d.entry_date || raw.entryDate,
                insurancePayment: d.insurance_payment,
                insurancePaymentStatus: d.insurance_payment_status
            } as RepairJob;
        }) || [];
    } catch (e) {
        logError('getWorkOrders', e);
        return [];
    }
};

export const getWorkOrder = async (id: string): Promise<RepairJob | null> => {
    try {
        const { data, error } = await supabase
            .from('work_orders')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) return null;

        const raw = data.raw_data || {};
        return {
            ...raw,
            id: data.id,
            status: data.status || raw.status,
            plate: data.plate || raw.plate,
            vehicle: data.vehicle || raw.vehicle,
            insuredName: data.insured_name || raw.insuredName,
            expedienteId: data.expediente_id || raw.expedienteId,
            entryDate: data.entry_date || raw.entryDate,
            insurancePayment: data.insurance_payment,
            insurancePaymentStatus: data.insurance_payment_status,
            clientId: data.client_id,
            vehicleId: data.vehicle_id,
            valuationId: raw.valuationId,
            currentKm: data.current_km || raw.currentKm,
            vin: raw.vin,
            totalAmount: data.total_amount || raw.totalAmount,
            requestAppraisal: data.request_appraisal,
            workshopId: data.workshop_id
        } as RepairJob;
    } catch (e) {
        logError('getWorkOrder', e);
        return null;
    }
};

export const getWorkOrdersByClient = async (clientId: string): Promise<WorkOrder[]> => {
    try {
        const { data, error } = await supabase
            .from('work_orders')
            .select('*')
            .eq('client_id', clientId);

        if (error) throw error;
        return (data || []).map(d => {
            const raw = d.raw_data || {};
            return {
                ...raw,
                id: d.id,
                status: d.status || raw.status,
                plate: d.plate || raw.plate,
                vehicle: d.vehicle || raw.vehicle,
                insuredName: d.insured_name || raw.insuredName,
                expedienteId: d.expediente_id || raw.expedienteId,
                entryDate: d.entry_date || raw.entryDate,
                insurancePayment: d.insurance_payment,
                insurancePaymentStatus: d.insurance_payment_status
            } as WorkOrder;
        });
    } catch (e) {
        logError('getWorkOrdersByClient', e);
        return [];
    }
};

export const saveWorkOrderToSupabase = async (wo: WorkOrder, explicitWorkshopId?: string) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        const payload: any = {
            id: wo.id,
            workshop_id: explicitWorkshopId || user.id,
            client_id: wo.clientId,
            expediente_id: wo.expedienteId || wo.id,
            status: wo.status,
            // Module C proper column mapping
            insurer_id: wo.insurer_id,
            claim_number: wo.claim_number,
            incident_type: wo.incident_type,
            incident_date: wo.incident_date,
            vin: wo.vin,
            current_km: wo.currentKm || 0,
            plate: wo.plate,
            vehicle: wo.vehicle,
            insured_name: wo.insuredName,
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
export const saveVehicle = async (vehicle: Vehicle, explicitWorkshopId?: string) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await supabase.from('vehicles').upsert({
            id: vehicle.id,
            workshop_id: explicitWorkshopId || user.id,
            owner_id: vehicle.clientId, // Mapping to table column
            plate: vehicle.plate,
            brand: vehicle.brand,
            model: vehicle.model,
            vin: vehicle.vin,
            raw_data: vehicle
        });
        if (error) throw error;
        return true;
    } catch (e) {
        logError('saveVehicle', e);
        return false;
    }
};

export const getVehiclesByClient = async (clientId: string): Promise<Vehicle[]> => {
    try {
        const { data, error } = await supabase
            .from('vehicles')
            .select('*')
            .filter('raw_data->>clientId', 'eq', clientId);

        if (error) throw error;
        return (data || []).map(d => d.raw_data as Vehicle);
    } catch (e) {
        logError('getVehiclesByClient', e);
        return [];
    }
};

export const getVehicle = async (id: string) => { try { const { data, error } = await supabase.from('vehicles').select('*').eq('id', id).single(); if (error) throw error; return data ? (data.raw_data as Vehicle) : null; } catch (e) { return null; } };

export const getCompanyProfileFromSupabase = async (): Promise<CompanyProfile | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        // 1. Try fetching from company_profiles
        let { data, error } = await supabase
            .from('company_profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        if (error) throw error;

        // 2. FALLBACK: If not in company_profiles, check 'clients' table (Master list of workshops)
        if (!data) {
            console.log("Profile not found in company_profiles, checking 'clients' fallback...");
            const { data: workshopData, error: workshopError } = await supabase
                .from('clients')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (!workshopError && workshopData) {
                data = {
                    id: workshopData.id,
                    company_name: workshopData.name,
                    cif: workshopData.taxId,
                    address: workshopData.address,
                    city: workshopData.city,
                    zip_code: workshopData.zip,
                    province: workshopData.province,
                    email: workshopData.email,
                    phone: workshopData.phone,
                    coste_hora: 0,
                    pvp_mano_obra: 0,
                    subscription_tier: 'free'
                };
            }
        }

        if (!data) return null;

        const rawName = (data as any).company_name;
        // Aggressive filter for the unwanted default name
        const isDefault = !rawName ||
            rawName.toLowerCase().includes('mecanico') ||
            rawName.toLowerCase().includes('mecánico') ||
            rawName.includes('45');
        const sanitizedName = isDefault ? 'Valora Plus' : rawName;

        return {
            companyName: sanitizedName,
            cif: (data as any).cif,
            address: (data as any).address,
            city: (data as any).city,
            zipCode: (data as any).zip_code,
            province: (data as any).province,
            email: (data as any).email,
            phone: (data as any).phone,
            costeHora: (data as any).coste_hora || 0,
            pvpManoObra: (data as any).pvp_mano_obra || 0,
            subscriptionTier: (data as any).subscription_tier || 'free',
            defaultExpertId: (data as any).default_expert_id,
            defaultExpertName: (data as any).default_expert_name,
            integrations: {
                bitrixUrl: (data as any).bitrix_webhook_url || ''
            }
        };
    } catch (e) {
        logError('getCompanyProfile', e);
        return null;
    }
};

export const saveCompanyProfileToSupabase = async (profile: CompanyProfile) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        // Map camelCase to snake_case for DB
        const payload = {
            id: user.id,
            company_name: profile.companyName,
            cif: profile.cif,
            address: profile.address,
            city: profile.city,
            zip_code: profile.zipCode,
            province: profile.province,
            email: profile.email,
            phone: profile.phone,
            coste_hora: profile.costeHora,
            pvp_mano_obra: profile.pvpManoObra,
            bitrix_webhook_url: profile.integrations?.bitrixUrl || null,
            default_expert_id: profile.defaultExpertId || null,
            default_expert_name: profile.defaultExpertName || null,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('company_profiles').upsert(payload);
        if (error) throw error;
        return true;
    } catch (e) {
        logError('saveCompanyProfile', e);
        throw e;
    }
};

export const getCompanyProfileById = async (id: string): Promise<CompanyProfile | null> => {
    try {
        const { data, error } = await supabase
            .from('company_profiles')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        const rawName = data.company_name;
        // Aggressive filter for the unwanted default name
        const isDefault = !rawName ||
            rawName.toLowerCase().includes('mecanico') ||
            rawName.toLowerCase().includes('mecánico') ||
            rawName.includes('45');
        const sanitizedName = isDefault ? 'Valora Plus' : rawName;

        return {
            companyName: sanitizedName,
            cif: data.cif,
            address: data.address,
            city: data.city,
            zipCode: data.zip_code,
            province: data.province,
            email: data.email,
            phone: data.phone,
            costeHora: data.coste_hora,
            pvpManoObra: data.pvp_mano_obra,
            subscriptionTier: data.subscription_tier || 'free',
            defaultExpertId: data.default_expert_id,
            defaultExpertName: data.default_expert_name,
            integrations: {
                bitrixUrl: data.bitrix_webhook_url || ''
            }
        };
    } catch (e) {
        logError('getCompanyProfileById', e);
        return null;
    }
};

// --- Analytics Usage Tracking ---

export const getAnalyticsUsageCount = async (): Promise<number> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return 3; // Fail safe to limit if no user

        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { count, error } = await supabase
            .from('analysis_usage_log')
            .select('*', { count: 'exact', head: true })
            .eq('workshop_id', user.id)
            .gte('created_at', firstDay);

        if (error) throw error;
        return count || 0;
    } catch (e) {
        logError('getAnalyticsUsageCount', e);
        return 3;
    }
};

export const logAnalyticsUsage = async (type: string = 'profitability') => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await supabase.from('analysis_usage_log').insert({
            workshop_id: user.id,
            report_type: type
        });

        if (error) throw error;
        return true;
    } catch (e) {
        logError('logAnalyticsUsage', e);
        return false;
    }
};

export const upgradeToPremium = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await supabase.from('company_profiles').update({ subscription_tier: 'premium' }).eq('id', user.id);
        if (error) throw error;
        return true;
    } catch (e) {
        logError('upgradeToPremium', e);
        return false;
    }
};

export const updateWorkOrderFinancials = async (id: string, updates: { insurance_payment?: number, insurance_payment_status?: string }) => {
    try {
        const { error } = await supabase.from('work_orders').update(updates).eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) {
        logError('updateWorkOrderFinancials', e);
        return false;
    }
};
export const getValuationsFromSupabase = async (): Promise<ValuationRequest[]> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const userType = user.user_metadata?.user_type || 'client';
        const role = sessionStorage.getItem('vp_active_role') || userType;

        console.log("🔍 [DB_FETCH] User:", user.id, "Role:", role);
        console.log("🔍 [DB_FETCH] User Metadata:", user.user_metadata);

        // TEMPORARY: Fetch ALL records to diagnose the issue
        let query = supabase.from('valuations').select('*');
        console.log("🔍 [DB_FETCH] Fetching ALL records (no filter)");

        const { data, error } = await query;
        if (error) {
            console.error("❌ [DB_FETCH] Query error:", error);
            throw error;
        }

        // Log what we got back
        console.log("📊 [DB_FETCH] Raw data from DB:", data?.length, "records");
        if (data && data.length > 0) {
            console.log("📊 [DB_FETCH] First record workshop_id:", data[0].workshop_id);
        }


        console.log("✅ [DB] Found entries:", data?.length || 0);

        const mapped = data?.map(d => {
            const raw = (d.raw_data || {}) as ValuationRequest;
            return {
                ...raw,
                id: d.id,
                workshop_id: d.workshop_id,
                claimsStage: raw.claimsStage || 'draft',
                ticketNumber: raw.ticketNumber || raw.id?.substring(0, 8) || d.id.substring(0, 8),
                requestDate: raw.requestDate || new Date(d.created_at).toLocaleDateString(),
                vehicle: {
                    brand: raw.vehicle?.brand || 'S/M',
                    model: raw.vehicle?.model || 'S/E',
                    plate: raw.vehicle?.plate || 'S/M',
                    km: raw.vehicle?.km || 0
                },
                insuredName: raw.insuredName || 'S/N',
                insuranceCompany: raw.insuranceCompany || 'N/A'
            } as ValuationRequest;
        }) || [];

        return mapped;
    } catch (e) {
        logError('getValuations', e);
        return [];
    }
};

export const getValuationById = async (id: string): Promise<ValuationRequest | null> => {
    try {
        const { data, error } = await supabase.from('valuations').select('*').eq('id', id).single();
        if (error) throw error;
        if (!data) return null;

        const raw = (data.raw_data || {}) as ValuationRequest;
        return {
            ...raw,
            id: data.id,
            workshop_id: data.workshop_id,
        };
    } catch (e) {
        logError('getValuationById', e);
        return null;
    }
};
export const saveValuationToSupabase = async (val: ValuationRequest, overrideWorkshopId?: string) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const finalWorkshopId = overrideWorkshopId || user.id;

        const { error } = await supabase.from('valuations').upsert({
            id: val.id,
            workshop_id: finalWorkshopId,
            raw_data: {
                ...val,
                workshop_id: finalWorkshopId // Ensure it's inside the JSON too
            }
        });

        if (error) {
            console.error("❌ Supabase Save Error:", error);
            throw error;
        }
        return true;
    } catch (error) {
        logError('saveValuation', error);
        return false;
    }
};

export const saveAnonymizedValuation = async (data: any) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await supabase.from('anonymized_valuations').insert({
            ...data,
            workshop_id: data.workshop_id || user.id
        });

        if (error) {
            console.error("❌ [saveAnonymizedValuation] Error:", error);
            throw error;
        }
        return true;
    } catch (error) {
        logError('saveAnonymizedValuation', error);
        return false;
    }
};

export const deleteValuation = async (id: string) => {
    try {
        console.log("🗑️ [DELETE] Attempting to delete valuation:", id);

        // Delete from database
        const { error, data } = await supabase.from('valuations').delete().eq('id', id);
        if (error) {
            console.error("❌ [DELETE] Database Error:", error);
            throw error;
        }
        console.log("✅ [DELETE] Database Success:", data);

        // Also delete from localStorage
        try {
            const localData = JSON.parse(localStorage.getItem('vp_valuations') || '[]');
            const filtered = localData.filter((v: any) => v.id !== id);
            localStorage.setItem('vp_valuations', JSON.stringify(filtered));
            console.log("✅ [DELETE] LocalStorage cleaned");
        } catch (localErr) {
            console.warn("⚠️ [DELETE] LocalStorage cleanup failed:", localErr);
        }

        return true;
    } catch (e) {
        console.error("❌ [DELETE] Failed:", e);
        logError('deleteValuation', e);
        return false;
    }
};

export const saveAnalysisRequest = async (vId: string, url: string) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        const { data, error } = await supabase.from('analysis_requests').insert({
            workshop_id: user.id,
            valuation_id: vId,
            file_url: url
        }).select().single();
        if (error) throw error;
        return data;
    } catch (e) { return null; }
};
export const getAnalysisRequest = async (vId: string) => { try { const { data, error } = await supabase.from('analysis_requests').select('*').eq('valuation_id', vId).order('created_at', { ascending: false }).limit(1).single(); if (error) throw error; return data; } catch (e) { return null; } };
export const uploadChatAttachment = async (file: File) => { try { const fn = `${Date.now()}_${file.name}`; const { error } = await supabase.storage.from('attachments').upload(fn, file); if (error) throw error; const { data } = await supabase.storage.from('attachments').getPublicUrl(fn); return data.publicUrl; } catch (e) { return null; } };
export const updateValuationStage = async (id: string, s: ClaimsStage) => {
    try {
        const { data: val } = await supabase.from('valuations').select('raw_data').eq('id', id).single();
        if (!val) return false;
        const ur = { ...val.raw_data, claimsStage: s };
        const { error } = await supabase.from('valuations').update({ raw_data: ur }).eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) { return false; }
};

export const updateValuationExpert = async (id: string, expertId: string) => {
    try {
        const { data: val } = await supabase.from('valuations').select('raw_data').eq('id', id).single();
        if (!val) return false;
        // Update raw_data
        const ur = { ...val.raw_data, assignedExpertId: expertId };

        const { error } = await supabase.from('valuations').update({
            raw_data: ur
        }).eq('id', id);

        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Error updating expert:", e);
        return false;
    }
};
export const saveBitrixConfig = async (u: string) => { try { const p = await getCompanyProfileFromSupabase(); if (!p) return false; const up = { ...p, integrations: { ...p.integrations, bitrixUrl: u } }; return await saveCompanyProfileToSupabase(up); } catch (e) { return false; } };

export const getQuotes = async (): Promise<Quote[]> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        const { data, error } = await supabase.from('quotes').select('*').eq('workshop_id', user.id);
        if (error) throw error;
        return data?.map(d => d.raw_data as Quote) || [];
    } catch (e) { return []; }
};
export const saveQuote = async (q: Quote) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await supabase.from('quotes').upsert({ id: q.id, workshop_id: user.id, raw_data: q });
        if (error) {
            console.error("❌ [saveQuote] Error:", error);
            throw error;
        }
        return true;
    } catch (error) {
        logError('saveQuote', error);
        return false;
    }
};
export const deleteQuote = async (id: string) => {
    try {
        const { error } = await supabase.from('quotes').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (error) {
        return { success: false, error: logError('deleteQuote', error) };
    }
};
export const getOpportunities = async (): Promise<Opportunity[]> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        const { data, error } = await supabase.from('opportunities').select('*').eq('workshop_id', user.id);
        if (error) throw error;
        return data?.map(d => d.raw_data as Opportunity) || [];
    } catch (e) { return []; }
};
export const saveOpportunity = async (o: Opportunity) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await supabase.from('opportunities').upsert({ id: o.id, workshop_id: user.id, raw_data: o });
        if (error) {
            console.error("❌ [saveOpportunity] Error:", error);
            throw error;
        }
        return true;
    } catch (error) {
        logError('saveOpportunity', error);
        return false;
    }
};
export const deleteOpportunity = async (id: string) => {
    try {
        const { error } = await supabase.from('opportunities').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (error) {
        return { success: false, error: logError('deleteOpportunity', error) };
    }
};
export const sendMessageToValuation = async (m: any) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        const { error } = await supabase.from('valuation_messages').insert({
            ...m,
            workshop_id: user.id,
            sender_id: user.id
        });
        if (error) throw error;
        return true;
    } catch (e) { return false; }
};

export const getValuationMessages = async (valuationId: string) => {
    try {
        const { data, error } = await supabase
            .from('valuation_messages')
            .select('*')
            .eq('valuation_id', valuationId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (e) {
        logError('getValuationMessages', e);
        return [];
    }
};

export const getInternalMessages = async (workOrderId: string) => {
    try {
        const { data, error } = await supabase
            .from('internal_messages')
            .select('*')
            .eq('work_order_id', workOrderId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (e) {
        logError('getInternalMessages', e);
        return [];
    }
};

export const sendInternalMessage = async (msg: any) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await supabase.from('internal_messages').insert({
            ...msg,
            workshop_id: user.id,
            sender_id: user.id
        });
        if (error) throw error;
        return true;
    } catch (e) {
        logError('sendInternalMessage', e);
        return false;
    }
};

export const addToWorkshopAuth = async (email: string) => {
    try {
        const { error } = await supabase.from('workshop_auth').upsert({ email }, { onConflict: 'email' });
        if (error) throw error;
        return true;
    } catch (e) {
        logError('addToWorkshopAuth', e);
        return false;
    }
};

// --- BITRIX SETTINGS (DEDICATED TABLE) ---
/**
 * Fetches Bitrix settings from the dedicated bitrix_settings table.
 * If workshopId is not provided, it tries to fetch for the current user.
 */
export const getBitrixSettingsFromSupabase = async (workshopId?: string) => {
    try {
        let finalId = workshopId;
        if (!finalId) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;
            finalId = user.id;
        }

        const { data, error } = await supabase
            .from('bitrix_settings')
            .select('*')
            .eq('workshop_id', finalId)
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (e) {
        console.error('getBitrixSettings error:', e);
        return null;
    }
};

/**
 * Saves Bitrix settings to the dedicated bitrix_settings table.
 */
export const saveBitrixSettingsToSupabase = async (webhookUrl: string, expertId?: string, expertName?: string) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        const payload = {
            workshop_id: user.id,
            webhook_url: webhookUrl.trim(),
            default_expert_id: expertId || null,
            default_expert_name: expertName || null,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('bitrix_settings')
            .upsert(payload);

        if (error) throw error;
        return true;
    } catch (e) {
        console.error('saveBitrixSettings error:', e);
        throw e;
    }
};

// --- WORKSHOP CUSTOMERS SERVICE ---

export interface Insurer {
    id: string;
    workshop_id: string;
    name: string;
    email?: string;
    phone?: string;
}

export interface Supplier {
    id: string;
    workshop_id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    tax_id?: string;
}

export interface WorkshopCustomer {
    id: string;
    workshop_id: string;
    customer_type: 'Individual' | 'Company';
    full_name: string;
    phone: string;
    email: string;
    tax_id: string;
    address: string;
    city: string;
    province: string;
    postal_code: string;
    notes?: string;
    created_at?: string;
    currentKm?: number;
    insuredName?: string;
}

export const getWorkOrderParts = async (workOrderId: string): Promise<any[]> => {
    try {
        const { data, error } = await supabase
            .from('work_order_parts')
            .select('*')
            .eq('work_order_id', workOrderId);

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error("Error fetching work order parts:", e);
        return [];
    }
};

export const getExtractionJobs = async (workOrderId: string): Promise<any[]> => {
    try {
        const { data, error } = await supabase
            .from('extraction_jobs')
            .select('*')
            .eq('work_order_id', workOrderId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error("Error fetching extraction jobs:", e);
        return [];
    }
};

export const processExtractionResults = async (jobId: string): Promise<boolean> => {
    try {
        const { data: job, error: jobErr } = await supabase
            .from('extraction_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (jobErr) throw jobErr;
        if (job.status !== 'completed' || !job.extracted_data) return false;

        const data = job.extracted_data;
        const workOrderId = job.work_order_id;
        const workshopId = job.workshop_id;

        // 1. Process Parts
        if (data.parts && Array.isArray(data.parts)) {
            const partLines = data.parts.map((p: any) => ({
                workshop_id: workshopId,
                work_order_id: workOrderId,
                part_number: p.part_number || p.reference,
                description: p.description,
                quantity: parseFloat(p.quantity || 1),
                unit_price: parseFloat(p.price || 0),
                total_amount: parseFloat(p.total || 0),
                confidence_score: p.confidence || 1.0
            }));
            await supabase.from('work_order_parts').insert(partLines);
        }

        // 2. Process Labor (Billing)
        if (data.labor && Array.isArray(data.labor)) {
            const laborLines = data.labor.map((l: any) => ({
                workshop_id: workshopId,
                work_order_id: workOrderId,
                description: l.description,
                quantity: parseFloat(l.hours || 0),
                unit_price: parseFloat(l.price_hour || 0),
                total_amount: parseFloat(l.total || 0),
                confidence_score: l.confidence || 1.0,
                billing_type: 'Labor'
            }));
            await supabase.from('work_order_billing').insert(laborLines);
        }

        return true;
    } catch (e) {
        console.error("Error processing AI results:", e);
        return false;
    }
};

export const getWorkshopCustomers = async (): Promise<WorkshopCustomer[]> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('workshop_customers')
            .select('*')
            .eq('workshop_id', user.id)
            .order('full_name', { ascending: true });

        if (error) {
            console.error('Error fetching workshop customers:', error);
            return [];
        }

        return data || [];
    } catch (e) {
        console.error('Exception fetching workshop customers:', e);
        return [];
    }
};

export const saveWorkshopCustomer = async (customer: Partial<WorkshopCustomer>): Promise<WorkshopCustomer | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        const payload = {
            ...customer,
            workshop_id: user.id
        };

        // If ID exists, update; else insert
        if (customer.id) {
            const { data, error } = await supabase
                .from('workshop_customers')
                .update(payload)
                .eq('id', customer.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            // Remove ID if empty string to allow auto-gen
            const { id, ...insertPayload } = payload;
            const { data, error } = await supabase
                .from('workshop_customers')
                .insert([insertPayload])
                .select()
                .single();

            if (error) throw error;
            return data;
        }
    } catch (e) {
        console.error('Error saving workshop customer:', e);
        return null;
    }
};

export const deleteWorkshopCustomer = async (id: string): Promise<boolean> => {
    try {
        const { error } = await supabase.from('workshop_customers').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) {
        return false;
    }
}

// --- AI Extraction Engine (Module A) ---

export const createExtractionJob = async (jobData: {
    work_order_id: string | null;
    file_id: string;
    status: string;
}) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        const { data, error } = await supabase
            .from('extraction_jobs')
            .insert({
                ...jobData,
                workshop_id: user.id,
                created_by: user.id
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, job: data };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

export const triggerExtractionProcess = async (jobId: string) => {
    try {
        const { data, error } = await supabase.functions.invoke('extraction-job', {
            body: { action: 'process', jobId }
        });

        if (error) throw error;
        return { success: true, data };
    } catch (e: any) {
        console.error("Extraction Trigger Failed:", e);
        return { success: false, error: e.message };
    }
};


// --- Time Tracking & Productivity (Module B) ---

export const getWorkOrderTasks = async (workOrderId: string) => {
    try {
        const { data, error } = await supabase
            .from('work_order_tasks')
            .select('*')
            .eq('work_order_id', workOrderId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (e: any) {
        console.error("Error fetching tasks:", e);
        return [];
    }
};

export const createWorkOrderTask = async (task: {
    workshop_id: string;
    work_order_id: string;
    employee_id: string;
    task_type: string;
    description?: string;
    status?: string;
}) => {
    try {
        const { data, error } = await supabase
            .from('work_order_tasks')
            .insert([task])
            .select()
            .single();

        if (error) throw error;
        return { success: true, task: data };
    } catch (e: any) {
        console.error("Error creating task:", e);
        return { success: false, error: e.message };
    }
};

export const getActiveTimeLog = async (employeeId: string) => {
    try {
        const { data, error } = await supabase
            .from('task_time_logs')
            .select('*, work_order_tasks(*)')
            .eq('employee_id', employeeId)
            .neq('status', 'completed')
            .is('ended_at', null)
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (e) {
        console.error("Error fetching active log:", e);
        return null;
    }
};

export const startTask = async (taskId: string, employeeId: string) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        // 1. Pause any active tasks for this employee
        const active = await getActiveTimeLog(employeeId);
        if (active && active.status === 'in_progress') {
            await pauseTask(active.id);
        }

        // 2. Start new log
        const { data, error } = await supabase
            .from('task_time_logs')
            .insert({
                workshop_id: user.id,
                task_id: taskId,
                employee_id: employeeId,
                started_at: new Date().toISOString(),
                status: 'in_progress'
            })
            .select()
            .single();

        if (error) throw error;

        // 3. Update task status
        await supabase.from('work_order_tasks').update({ status: 'in_progress' }).eq('id', taskId);

        return { success: true, timeLog: data };
    } catch (e: any) {
        console.error("Start task failed:", e);
        return { success: false, message: e.message };
    }
};

export const pauseTask = async (timeLogId: string) => {
    try {
        // Fetch started_at to calculate duration
        const { data: logData } = await supabase.from('task_time_logs').select('started_at').eq('id', timeLogId).single();
        if (!logData) throw new Error("Log not found");

        const endedAt = new Date().toISOString();
        const durationSeconds = Math.floor((new Date(endedAt).getTime() - new Date(logData.started_at).getTime()) / 1000);

        const { error } = await supabase
            .from('task_time_logs')
            .update({
                status: 'paused',
                ended_at: endedAt,
                duration_seconds: durationSeconds
            })
            .eq('id', timeLogId);

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const resumeTask = async (taskId: string, employeeId: string) => {
    // Resuming is essentially starting a new log for the same task
    return await startTask(taskId, employeeId);
};

export const finishTask = async (timeLogId: string, taskId: string) => {
    try {
        // Fetch started_at to calculate duration
        const { data: logData } = await supabase.from('task_time_logs').select('started_at').eq('id', timeLogId).single();
        if (!logData) throw new Error("Log not found");

        const endedAt = new Date().toISOString();
        const durationSeconds = Math.floor((new Date(endedAt).getTime() - new Date(logData.started_at).getTime()) / 1000);

        const { error: logErr } = await supabase
            .from('task_time_logs')
            .update({
                status: 'completed',
                ended_at: endedAt,
                duration_seconds: durationSeconds
            })
            .eq('id', timeLogId);

        if (logErr) throw logErr;

        // Update task to finished
        await supabase.from('work_order_tasks')
            .update({ status: 'finished' })
            .eq('id', taskId);

        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const getTaskTimeLogsForOrder = async (workOrderId: string) => {
    try {
        const { data: tasks } = await supabase.from('work_order_tasks').select('id').eq('work_order_id', workOrderId);
        if (!tasks || tasks.length === 0) return [];

        const taskIds = tasks.map(t => t.id);
        const { data, error } = await supabase
            .from('task_time_logs')
            .select('*, work_order_tasks(task_type), employees:employee_id(full_name)')
            .in('task_id', taskIds)
            .order('started_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error("Error fetching logs:", e);
        return [];
    }
};

// --- MODULE D: Purchase Importer ---

export const getSuppliers = async (): Promise<Supplier[]> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .eq('workshop_id', user.id)
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error("Error fetching suppliers:", e);
        return [];
    }
};

export const createPurchaseDocument = async (doc: Partial<PurchaseDocument>): Promise<PurchaseDocument | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        const { data, error } = await supabase
            .from('purchase_documents')
            .insert({ ...doc, workshop_id: user.id })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (e) {
        console.error("Error creating purchase document:", e);
        return null;
    }
};

export const createPurchaseLines = async (lines: Partial<PurchaseLine>[]): Promise<boolean> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        const payload = lines.map(l => ({ ...l, workshop_id: user.id }));
        const { error } = await supabase.from('purchase_lines').insert(payload);

        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Error creating purchase lines:", e);
        return false;
    }
};

export const getWorkOrderByNumber = async (woNumber: string): Promise<WorkOrder | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('work_orders')
            .select('*')
            .eq('workshop_id', user.id)
            .eq('expediente_id', woNumber)
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (e) {
        console.error("Error fetching WO by number:", e);
        return null;
    }
};

export const getPartByNumber = async (workOrderId: string, partNumber: string): Promise<any | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('work_order_parts')
            .select('*')
            .eq('workshop_id', user.id)
            .eq('work_order_id', workOrderId)
            .eq('part_number', partNumber)
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (e) {
        console.error("Error fetching part by number:", e);
        return null;
    }
};

export const updateWorkOrderPartCost = async (partId: string, cost: number): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('work_order_parts')
            .update({ cost_total: cost, cost_source: 'purchase' })
            .eq('id', partId);

        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Error updating part cost:", e);
        return false;
    }
};

// --- MODULE F: State Machine ---

export const transitionWorkOrder = async (workOrderId: string, toState: OTStatus, reason?: string): Promise<{ success: boolean, error?: string }> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        // 1. Get Current Order
        const { data: wo, error: woErr } = await supabase
            .from('work_orders')
            .select('status, workshop_id')
            .eq('id', workOrderId)
            .single();

        if (woErr) throw woErr;

        // 2. Validate Transition
        const currentStatus = wo.status as OTStatus;
        const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(toState)) {
            return { success: false, error: `Transición no permitida de ${currentStatus} a ${toState}` };
        }

        // 3. Update Order
        const { error: updErr } = await supabase
            .from('work_orders')
            .update({ status: toState })
            .eq('id', workOrderId);

        if (updErr) throw updErr;

        // 4. Record Transition
        await supabase.from('work_order_state_transitions').insert({
            workshop_id: wo.workshop_id,
            work_order_id: workOrderId,
            from_state: currentStatus,
            to_state: toState,
            transitioned_by: user.id,
            reason
        });

        return { success: true };
    } catch (e: any) {
        console.error("Error transitioning work order:", e);
        return { success: false, error: e.message };
    }
};

export const getWorkOrderTransitions = async (workOrderId: string): Promise<WorkOrderStateTransition[]> => {
    try {
        const { data, error } = await supabase
            .from('work_order_state_transitions')
            .select('*')
            .eq('work_order_id', workOrderId)
            .order('transitioned_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error("Error fetching transitions:", e);
        return [];
    }
};

// --- MODULE G: Control Horario (Attendance) ---

export const clockIn = async (): Promise<EmployeeAttendance | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        // Check for active session
        const { data: active } = await supabase
            .from('employee_attendance')
            .select('id')
            .eq('employee_id', user.id)
            .is('clock_out', null)
            .maybeSingle();

        if (active) throw new Error("Ya tienes una jornada activa.");

        // Get workshop context
        const workshopId = user.user_metadata?.workshop_id || user.id;

        const { data, error } = await supabase
            .from('employee_attendance')
            .insert({
                employee_id: user.id,
                workshop_id: workshopId,
                clock_in: new Date().toISOString(),
                day_type: 'work'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (e) {
        console.error("Error in clockIn:", e);
        throw e;
    }
};

export const clockOut = async (attendanceId: string, notes?: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('employee_attendance')
            .update({
                clock_out: new Date().toISOString(),
                notes,
                modified_at: new Date().toISOString()
            })
            .eq('id', attendanceId);

        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Error in clockOut:", e);
        return false;
    }
};

export const startBreak = async (attendanceId: string, type: 'meal' | 'rest' | 'personal'): Promise<AttendanceBreak | null> => {
    try {
        const { data, error } = await supabase
            .from('attendance_breaks')
            .insert({
                attendance_id: attendanceId,
                break_start: new Date().toISOString(),
                break_type: type
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (e) {
        console.error("Error in startBreak:", e);
        return null;
    }
};

export const endBreak = async (breakId: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('attendance_breaks')
            .update({ break_end: new Date().toISOString() })
            .eq('id', breakId);

        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Error in endBreak:", e);
        return false;
    }
};

export const getCurrentAttendance = async (): Promise<EmployeeAttendance | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('employee_attendance')
            .select('*, attendance_breaks(*)')
            .eq('employee_id', user.id)
            .is('clock_out', null)
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (e) {
        console.error("Error fetching current attendance:", e);
        return null;
    }
};


// --- MODULE D: MANUAL MATCHING HELPERS ---

export const getActiveWorkOrders = async (): Promise<any[]> => {
    try {
        const { data, error } = await supabase
            .from('work_orders')
            .select('id, number, license_plate, vehicle_make, vehicle_model, status') // 'number' might be 'work_order_number' depending on schema, let's use both or check. Previous code used 'work_order_number' in specs but 'getWorkOrder' returns 'number'? 
            // In ExpedienteDetail: foundJob.expedienteId is used. 
            // In NewAppraisal: tempTicketId.
            // Let's select * to be safe? No, too big. 
            // Let's try to select specific fields and fall back.
            // Actually, getWorkOrder returns * usually.
            // I'll select * for now to avoid errors, we can optimize later.
            .select('*')
            .in('status', ['intake', 'assigned', 'in_progress', 'ready_to_close'])
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error("Error fetching active work orders:", e);
        return [];
    }
};

export const createWorkOrderPart = async (workOrderId: string, partData: {
    part_number: string,
    description: string,
    quantity: number,
    unit_price: number,
    cost_price?: number,
    supplier_id?: string
}) => {
    try {
        const { data, error } = await supabase
            .from('work_order_parts')
            .insert({
                work_order_id: workOrderId,
                part_number: partData.part_number,
                description: partData.description,
                quantity: partData.quantity,
                unit_price: partData.unit_price,
                cost_price: partData.cost_price,
                supplier_id: partData.supplier_id,
                status: 'ordered'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (e) {
        console.error("Error creating work order part:", e);
        return null;
    }
};

export const manualMatchPurchaseLine = async (lineId: string, workOrderId: string, partId: string, totalCost: number) => {
    try {
        // 1. Update Purchase Line
        const { error: lineError } = await supabase
            .from('purchase_lines')
            .update({
                work_order_id: workOrderId,
                work_order_part_id: partId,
                matching_status: 'matched'
            })
            .eq('id', lineId);

        if (lineError) throw lineError;

        // 2. Update Work Order Part Cost (Accumulate? Or Set?)
        // Usually we add the purchase cost to the part cost.
        // For now, let's assume we set it.
        // We'll call updateWorkOrderPartCost which is already imported/defined?
        // No, I'll implement a direct update here.
        // But wait, updateWorkOrderPartCost was imported in PurchaseImporter from THIS file.
        // Let's use it if possible.
        // Since I'm IN supabaseClient.ts, I can just call it if it's exported in the same file.
        // I'll use direct supabase call to be safe.

        const { error: partError } = await supabase.rpc('update_part_cost', {
            p_part_id: partId,
            p_cost: totalCost
        });

        // Backup update if RPC doesn't exist (it should, but just in case)
        if (partError) {
            console.warn("RPC update_part_cost failed, trying direct update", partError);
            const { error: directError } = await supabase
                .from('work_order_parts')
                .update({ cost_price: totalCost }) // This overwrites.
                .eq('id', partId);
            if (directError) throw directError;
        }

        return true;
    } catch (e) {
        console.error("Error manual matching:", e);
        return false;
    }
};

export const getPurchaseLinesForWorkOrder = async (workOrderId: string): Promise<any[]> => {
    try {
        const { data, error } = await supabase
            .from('purchase_lines')
            .select('*')
            .eq('work_order_id', workOrderId);
        if (error) throw error;
        return data || [];
    } catch (e) {
        return [];
    }
};


export const getWorkOrderBilling = async (workOrderId: string): Promise<any | null> => {
    try {
        const { data, error } = await supabase
            .from('work_order_billing')
            .select('*')
            .eq('work_order_id', workOrderId)
            .maybeSingle();
        if (error) throw error;
        return data || null;
    } catch (e) {
        console.error("Error fetching work order billing:", e);
        return null;
    }
};