
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Authenticated user required to save file metadata");

        const payload = {
            ...m,
            workshop_id: m.workshop_id || user.id
        };

        const { error } = await supabase.from('workshop_files').insert(payload);
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
        // Check authentication first
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error('❌ [getClients] No authenticated user found');
            return [];
        }

        console.log('🔍 [getClients] Authenticated user ID:', user.id);
        console.log('🔍 [getClients] User metadata:', user.user_metadata);

        const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });

        if (error) {
            console.error('❌ [getClients] Database error:', error);
            throw error;
        }

        console.log('📊 [getClients] Raw data from DB:', data?.length || 0, 'records');

        if (data && data.length > 0) {
            console.log('📊 [getClients] First record:', {
                id: data[0].id,
                workshop_id: data[0].workshop_id,
                name: data[0].name
            });
        } else {
            console.warn('⚠️ [getClients] No clients found in database for this workshop');
            console.warn('⚠️ [getClients] This could mean:');
            console.warn('   1. No clients have been created yet');
            console.warn('   2. RLS policy is filtering out all records');
            console.warn('   3. Clients were created with a different workshop_id');
        }

        const clientsMap = new Map<string, Client>();

        (data || []).forEach(d => {
            const raw = d.raw_data || {};
            const client: Client = {
                ...raw,
                id: d.id,
                workshop_id: d.workshop_id,
                name: d.name || raw.name || 'Sin Nombre',
                email: d.email || raw.email || '',
                phone: raw.phone || '',
                taxId: raw.taxId || ''
            };

            // Deduplication strategy: Use Email or Tax ID as identity if ID differs
            // This handles cases where a client is manually added AND signs up as a user
            const identityKey = (client.email?.toLowerCase() || client.taxId?.toLowerCase() || client.id);

            if (!clientsMap.has(identityKey)) {
                clientsMap.set(identityKey, client);
            } else {
                // If collision, keep the one with more data (e.g. taxId) or the most recent (which Map allows by order)
                const existing = clientsMap.get(identityKey)!;
                if (!existing.taxId && client.taxId) {
                    clientsMap.set(identityKey, client);
                }
            }
        });

        const result = Array.from(clientsMap.values());
        console.log('✅ [getClients] Returning', result.length, 'unique clients');
        return result;
    } catch (e) {
        logError('getClients', e);
        return [];
    }
};

export const saveClientToSupabase = async (client: Client) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Authenticated user required to save client");

        const { error } = await supabase.from('clients').upsert({
            id: client.id,
            workshop_id: user.id,
            name: client.name,
            email: client.email,
            raw_data: client
        });
        if (error) throw error;
        return true;
    } catch (e) {
        logError('saveClient', e);
        return false;
    }
};

export const deleteClient = async (id: string) => {
    try {
        const { error } = await supabase.from('clients').delete().eq('id', id);
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

        // Isolation: If Client, only show their own OTs
        if (userType === 'client') {
            query = query.eq('client_id', user.id);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data?.map(d => ({
            ...d.raw_data,
            insurancePayment: d.insurance_payment,
            insurancePaymentStatus: d.insurance_payment_status
        } as RepairJob)) || [];
    } catch (e) {
        logError('getWorkOrders', e);
        return [];
    }
};

export const getWorkOrdersByClient = async (clientId: string): Promise<WorkOrder[]> => {
    try {
        const { data, error } = await supabase
            .from('work_orders')
            .select('*')
            .eq('client_id', clientId);

        if (error) throw error;
        return (data || []).map(d => ({
            ...d.raw_data,
            insurancePayment: d.insurance_payment,
            insurancePaymentStatus: d.insurance_payment_status
        } as WorkOrder));
    } catch (e) {
        logError('getWorkOrdersByClient', e);
        return [];
    }
};
export const getWorkOrder = async (id: string): Promise<RepairJob | null> => {
    try {
        const { data, error } = await supabase.from('work_orders').select('*').eq('id', id).single();
        if (error) throw error;
        return data ? ({
            ...data.raw_data,
            insurancePayment: data.insurance_payment,
            insurancePaymentStatus: data.insurance_payment_status
        } as RepairJob) : null;
    } catch (e) {
        return null;
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

        const { data, error } = await supabase
            .from('company_profiles') // Correct Table
            .select('*')
            .eq('id', user.id)
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
