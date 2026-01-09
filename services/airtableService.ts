// Stub service to satisfy imports in Valuations and AirtableConfig components
// and prevent build failures.

export const airtableService = {
    getConfig: () => {
        const saved = localStorage.getItem('vp_airtable_config');
        return saved ? JSON.parse(saved) : null;
    },
    saveConfig: (config: any) => {
        localStorage.setItem('vp_airtable_config', JSON.stringify(config));
    },
    testConnection: async (config: any): Promise<boolean> => {
        console.log("Testing Airtable connection with config:", config);
        // Simulation for now
        return !!(config.apiKey && config.baseId);
    },
    syncValuation: async (valuation: any): Promise<boolean> => {
        console.log("Airtable sync requested for:", valuation.id);
        return true;
    }
};
