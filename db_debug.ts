
import { createClient } from '@supabase/supabase-client';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkValuations() {
    try {
        const { data, count, error } = await supabase
            .from('valuations')
            .select('*', { count: 'exact' });

        if (error) {
            console.error("Error fetching valuations:", error.message);
            if (error.message.includes('relation "valuations" does not exist')) {
                console.log("TABLE DOES NOT EXIST");
            }
        } else {
            console.log(`Total valuations in table: ${count}`);
            console.log("First few rows (IDs and Workshop IDs):");
            data.slice(0, 5).forEach(d => {
                console.log(`ID: ${d.id}, Workshop: ${d.workshop_id}`);
            });
        }
    } catch (err) {
        console.error("Critical failure:", err);
    }
}

checkValuations();
