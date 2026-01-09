
import { getCompanyProfileFromSupabase } from "./supabaseClient";

export interface BitrixUser {
  ID: string;
  NAME: string;
  LAST_NAME: string;
  WORK_POSITION?: string;
  ACTIVE: boolean;
  PERSONAL_PHOTO?: string;
}

// Internal cache to avoid fetching config on every single call if not needed
let cachedUrl: string | null = null;

export const clearBitrixCache = () => {
    cachedUrl = null;
};

const getWebhookUrl = async () => {
    if (cachedUrl) return cachedUrl;
    
    const profile = await getCompanyProfileFromSupabase();
    if (profile?.integrations?.bitrixUrl) {
        cachedUrl = profile.integrations.bitrixUrl;
        return cachedUrl;
    }
    
    // Fallback to local storage if user hasn't synced yet (migration support)
    const local = localStorage.getItem('vp_bitrix_config');
    if (local) {
        const parsed = JSON.parse(local);
        return parsed.url;
    }
    return null;
};

export const testBitrixConnection = async (url: string): Promise<boolean> => {
    try {
        const baseUrl = url.endsWith('/') ? url : `${url}/`;
        // We test with user.current to see if the webhook is valid
        const response = await fetch(`${baseUrl}user.current`, {
            method: 'GET'
        });
        const data = await response.json();
        return !!data.result;
    } catch (e) {
        console.error("Bitrix Connection Test Failed:", e);
        return false;
    }
};

export const getBitrixUsers = async (forceRefresh = false): Promise<BitrixUser[]> => {
  if (forceRefresh) {
      clearBitrixCache();
  }

  const url = await getWebhookUrl();
  if (!url) return [];

  try {
    const baseUrl = url.endsWith('/') ? url : `${url}/`;
    // Add timestamp to prevent browser caching of the fetch request
    const response = await fetch(`${baseUrl}user.get?t=${Date.now()}`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          FILTER: { ACTIVE: true }, 
          sort: 'LAST_NAME', 
          order: 'ASC' 
      }) 
    });

    const data = await response.json();
    
    if (data.result) {
      return data.result as BitrixUser[];
    }
    return [];
  } catch (error) {
    console.error("Error fetching Bitrix users:", error);
    return [];
  }
};

export const getBitrixMessages = async (userId: string): Promise<any[]> => {
  const url = await getWebhookUrl();
  if (!url) return [];

  try {
    const baseUrl = url.endsWith('/') ? url : `${url}/`;
    
    // Fetch last 50 messages from the dialog with this specific user
    const response = await fetch(`${baseUrl}im.dialog.messages.get`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          DIALOG_ID: userId, // The Bitrix User ID we are chatting with
          LIMIT: 50
      }) 
    });

    const data = await response.json();
    
    if (data.result && data.result.messages) {
      return data.result.messages;
    }
    return [];
  } catch (error) {
    console.error("Error fetching Bitrix messages:", error);
    throw error; // Throw so component knows polling failed
  }
};

export const sendBitrixMessage = async (userId: string, message: string): Promise<boolean> => {
    const url = await getWebhookUrl();
    if (!url) return false;

    try {
        const baseUrl = url.endsWith('/') ? url : `${url}/`;
        const response = await fetch(`${baseUrl}im.message.add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                DIALOG_ID: userId,
                MESSAGE: message
            })
        });
        const data = await response.json();
        // Bitrix returns { result: message_id } on success
        return !!data.result;
    } catch (e) {
        console.error("Error sending Bitrix message:", e);
        return false;
    }
};

/**
 * Pushes a new Valuation Request to Bitrix24 CRM as a Deal
 * @param valuationData The form data from the valuation request
 * @param fileLinks Array of uploaded file links
 * @param costData Optional full cost calculation object (HourCostCalculation)
 */
export const pushValuationToBitrix = async (
    valuationData: any, 
    fileLinks: { url: string, type: 'image' | 'video' | 'doc' }[],
    costData?: any
): Promise<boolean> => {
    const url = await getWebhookUrl();
    if (!url) return false;

    try {
        const baseUrl = url.endsWith('/') ? url : `${url}/`;

        // --- COMPREHENSIVE DESCRIPTION BUILDER (BBCode) ---
        let description = `[B]VALORA PLUS: NEW APPRAISAL REQUEST[/B]\n`;
        description += `Ref: ${valuationData.ticketNumber}\n`;
        description += `Date: ${valuationData.requestDate}\n\n`;

        // 1. WORKSHOP DATA
        description += `[B]WORKSHOP / REQUESTER[/B]\n`;
        description += `--------------------------\n`;
        description += `Company: ${valuationData.workshop?.name || 'N/A'}\n`;
        description += `VAT ID: ${valuationData.workshop?.cif || 'N/A'}\n`;
        description += `Contact: ${valuationData.workshop?.contact || 'N/A'}\n`;
        description += `Province: ${valuationData.workshop?.province || 'N/A'}\n\n`;

        // 2. CLAIM DETAILS
        description += `[B]CLAIM DETAILS[/B]\n`;
        description += `--------------------------\n`;
        description += `Insured Name: [B]${valuationData.insuredName}[/B]\n`;
        description += `Insurance Co: ${valuationData.insuranceCompany}\n`;
        description += `Claim Type: ${valuationData.claimType}\n`;
        description += `Claim Date: ${valuationData.claimDate || 'N/A'}\n\n`;

        // 3. COST CALCULATION (Detailed)
        description += `[B]COST CALCULATION DETAILS[/B]\n`;
        description += `--------------------------\n`;
        description += `Reference Period: ${valuationData.costReference}\n`;
        
        if (costData) {
            const results = costData.resultado_calculo || {};
            const input = costData.payload_input || {};
            
            description += `[B]Internal Hourly Cost: ${results.hourlyCost?.toFixed(2)} €[/B]\n`;
            description += `Annual Personnel Cost: ${results.totalSalary?.toLocaleString()} €\n`;
            description += `Annual Structure Overheads: ${results.totalStructure?.toLocaleString()} €\n`;
            description += `Productive Capacity: ${results.productiveCapacity?.toFixed(0)} hours/year\n`;
            description += `Productive Staff (FTE): ${results.fteProductives?.toFixed(2)}\n\n`;
            
            description += `[B]Operational Variables:[/B]\n`;
            description += `- Shift Hours: ${input.hoursPerDay}h/day\n`;
            description += `- Billable Days: ${input.daysPerYear} days/year\n\n`;

            if (input.structure) {
                description += `[B]Infrastructure Cost Breakdown (Top):[/B]\n`;
                const topExpenses = Object.entries(input.structure as Record<string, number>)
                    .filter(([_, val]) => val > 0)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8);
                
                topExpenses.forEach(([key, val]) => {
                    description += `- ${key.toUpperCase()}: ${val.toLocaleString()} €\n`;
                });
            }
        } else {
            description += `(Detailed calculation data not found, see Ref)\n`;
        }
        description += `\n`;

        // 4. VEHICLE DATA
        description += `[B]VEHICLE DATA[/B]\n`;
        description += `--------------------------\n`;
        description += `Brand/Model: ${valuationData.vehicle.brand} ${valuationData.vehicle.model}\n`;
        description += `Plate: [B]${valuationData.vehicle.plate}[/B]\n`;
        description += `VIN: ${valuationData.vehicle.vin || 'N/A'}\n`;
        description += `Mileage: ${valuationData.vehicle.km} km\n\n`;

        // 5. OPPOSING VEHICLE
        description += `[B]OPPOSING VEHICLE[/B]\n`;
        description += `--------------------------\n`;
        if (valuationData.opposingVehicle?.exists) {
            description += `Status: [COLOR=RED]YES[/COLOR]\n`;
            description += `Opposing Plate: ${valuationData.opposingVehicle.plate || 'N/A'}\n`;
            description += `Opposing Model: ${valuationData.opposingVehicle.model || 'N/A'}\n`;
        } else {
            description += `Status: NO\n`;
        }
        description += `\n`;

        // 6. NOTES
        if (valuationData.notes) {
            description += `[B]NOTES:[/B]\n${valuationData.notes}\n\n`;
        }

        // 7. ATTACHMENTS
        description += `[B]ATTACHMENTS (${fileLinks.length}):[/B]\n`;
        fileLinks.forEach((f, index) => {
            const typeLabel = f.type ? f.type.toUpperCase() : 'FILE';
            description += `${index + 1}. [URL=${f.url}]View ${typeLabel}[/URL]\n`;
        });

        // ----------------------------------------------------

        // 2. Create the Deal Payload
        const payload = {
            fields: {
                TITLE: `Appraisal: ${valuationData.vehicle.plate} - ${valuationData.insuredName}`,
                TYPE_ID: "SERVICE", 
                STAGE_ID: "NEW",
                OPENED: "Y", 
                ASSIGNED_BY_ID: valuationData.assignedExpertId, 
                COMMENTS: description, 
                OPPORTUNITY: 0 
            }
        };

        const performDealAdd = async (currentPayload: any) => {
            const response = await fetch(`${baseUrl}crm.deal.add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentPayload)
            });
            return await response.json();
        };

        let data = await performDealAdd(payload);

        if (data.error_description && data.error_description.includes('Access denied')) {
            console.warn("⚠️ Bitrix Access Denied (Attempt 1). Retrying without ASSIGNED_BY_ID...");
            const fallbackPayload1 = { ...payload };
            delete fallbackPayload1.fields.ASSIGNED_BY_ID;
            fallbackPayload1.fields.COMMENTS += `\n\n[B]NOTE:[/B] Auto-assign failed (Permissions). Please assign manually.`;
            data = await performDealAdd(fallbackPayload1);
        }

        if (data.error_description && data.error_description.includes('Access denied')) {
            console.warn("⚠️ Bitrix Access Denied (Attempt 2). Retrying with Minimal Payload...");
            const minimalPayload = {
                fields: {
                    TITLE: payload.fields.TITLE,
                    COMMENTS: payload.fields.COMMENTS,
                    OPENED: "Y"
                }
            };
            data = await performDealAdd(minimalPayload);
        }

        if (data.result) {
            console.log("✅ Created Bitrix Deal ID:", data.result);
            return true;
        } else {
            console.error("❌ Bitrix Final Error:", data.error_description);
            return false;
        }

    } catch (e) {
        console.error("Exception pushing to Bitrix:", e);
        return false;
    }
};
