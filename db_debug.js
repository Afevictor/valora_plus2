import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://igwbevwytsufppqohtsh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ft8tLP4X8msvjeT3jpGyeg_YoL9h03f';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugDatabase() {
    console.log("=== DATABASE DEBUG ===");

    // Get ALL valuations without any filter
    const { data: all, error } = await supabase.from('valuations').select('id, workshop_id, created_at');

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Total records in database: ${all?.length || 0}`);

    if (all && all.length > 0) {
        console.log("\nFirst 5 records:");
        all.slice(0, 5).forEach((record, idx) => {
            console.log(`${idx + 1}. ID: ${record.id.substring(0, 8)}... | workshop_id: ${record.workshop_id} | created: ${record.created_at}`);
        });

        // Group by workshop_id
        const grouped = all.reduce((acc, record) => {
            const wid = record.workshop_id || 'NULL';
            acc[wid] = (acc[wid] || 0) + 1;
            return acc;
        }, {});

        console.log("\nRecords grouped by workshop_id:");
        Object.entries(grouped).forEach(([wid, count]) => {
            console.log(`  ${wid}: ${count} records`);
        });
    }

    // Check clients table
    console.log("\n=== CLIENTS TABLE ===");
    const { data: clients, error: clientError } = await supabase.from('clients').select('id, name, workshop_id');
    if (clientError) {
        console.error("Client error:", clientError);
    } else {
        console.log(`Total clients: ${clients?.length || 0}`);
        clients?.forEach(c => {
            console.log(`  ${c.name}: client_id=${c.id.substring(0, 8)}... workshop_id=${c.workshop_id || 'NULL'}`);
        });
    }
}

debugDatabase();
