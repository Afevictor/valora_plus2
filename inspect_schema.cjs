const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://igwbevwytsufppqohtsh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ft8tLP4X8msvjeT3jpGyeg_YoL9h03f';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSchema() {
    const tables = ['work_orders', 'vehicles', 'workshop_customers', 'clients'];
    for (const table of tables) {
        console.log(`--- Checking Table: ${table} ---`);
        const { data, error } = await supabase.rpc('get_table_columns', { table_name: table });
        if (error) {
            // Fallback: try querying a non-existent column to see the table schema error? No.
            // Try information_schema via standard query if RPC doesn't exist.
            // Actually Supabase doesn't allow direct SELECT on information_schema from anon key.
            console.log(`Error for ${table}:`, error.message);
        } else {
            console.log(`Columns for ${table}:`, data);
        }
    }
}
checkSchema();
