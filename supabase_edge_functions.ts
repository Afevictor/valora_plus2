
/**
 * SUPABASE EDGE FUNCTIONS
 * 
 * TO DEPLOY THIS FUNCTION FOR REAL EMAIL SENDING:
 * 
 * 1. Install Supabase CLI: npm install -g supabase
 * 2. Login: supabase login
 * 3. Link Project: supabase link --project-ref <your-project-ref>
 * 4. Create Function: supabase functions new send-email
 * 5. Paste the code below into supabase/functions/send-email/index.ts
 * 6. Replace RESEND_API_KEY with your key from https://resend.com
 * 7. Deploy: supabase functions deploy send-email
 * 
 * NOTE: Without deployment, the frontend app will use a local simulation or 'mailto' fallback.
 */

// Declare Deno for TypeScript to avoid errors in this environment
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Shared Supabase Client for all functions in this file
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const RESEND_API_KEY = "re_123456789"; // Replace with your API Key

// -----------------------------------------------------------------------------
// FUNCTION 1: send-email
// Triggered when the Workshop sends a message via Email Channel.
// -----------------------------------------------------------------------------

serve(async (req) => {
  const url = new URL(req.url);
  
  // ROUTING LOGIC (Simple path based)
  if (url.pathname.endsWith("send-email")) {
      return handleSendEmail(req);
  } else if (url.pathname.endsWith("inbound-email")) {
      return handleInboundEmail(req);
  } else if (url.pathname.endsWith("bitrix-webhook")) {
      return handleBitrixWebhook(req);
  }

  return new Response("Function not found", { status: 404 });
});

// --- HANDLERS ---

async function handleSendEmail(req: Request) {
  const { message, recipientEmail, subject } = await req.json();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Valora Plus <updates@yourdomain.com>",
        to: [recipientEmail],
        subject: subject,
        html: `<p>${message}</p>`,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// FUNCTION 2: inbound-email-webhook
// Receives emails from provider (e.g. SendGrid/Mailgun)
// -----------------------------------------------------------------------------
async function handleInboundEmail(req: Request) {
  try {
    const formData = await req.formData();
    const subject = formData.get("subject")?.toString() || "";
    const text = formData.get("text")?.toString() || "";

    // Extract Valuation ID from Subject (e.g., "[VAL-2024-4091]")
    const match = subject.match(/(VAL-\d{4}-\d+)/);
    
    // Fallback: Check if we can find the UUID in a custom header or body pattern
    // For MVP, we rely on the Ticket Number being in the subject
    
    if (match) {
        // We need to look up the UUID based on the Ticket Number if necessary
        // Assuming match[1] corresponds to 'ticket_number' column
        const { data: valuation } = await supabase
            .from('valuations')
            .select('id')
            .eq('ticketNumber', match[1]) // Ensure your DB has this column or use ID
            .single();

        if (valuation) {
            const { error } = await supabase.from("valuation_messages").insert({
                valuation_id: valuation.id,
                sender: "Expert",
                content: text,
                is_email: true,
                delivery_status: 'delivered'
            });
            if (error) throw error;
            return new Response("Email processed", { status: 200 });
        }
    }

    return new Response("No Valuation found", { status: 200 }); 
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// FUNCTION 3: bitrix-inbound-webhook
// Receives chat messages from Bitrix24 (Outbound Webhook)
// -----------------------------------------------------------------------------
async function handleBitrixWebhook(req: Request) {
    try {
        // Bitrix sends data as application/x-www-form-urlencoded
        const formData = await req.formData();
        
        // Bitrix Event Data Structure
        const event = formData.get('event'); // ONIMMESSAGEADD
        const userId = formData.get('data[USER][ID]'); // Sender ID in Bitrix
        const messageText = formData.get('data[PARAMS][MESSAGE]'); // The message content

        if (!userId || !messageText) {
            return new Response("Invalid Bitrix Payload", { status: 400 });
        }

        // 1. FIND THE ACTIVE VALUATION FOR THIS EXPERT
        // Strategy: Find the most recent 'New' or 'Pending' valuation assigned to this Bitrix User ID
        // Note: The `assignedExpertId` in our DB stores the Bitrix User ID.
        
        const { data: valuations, error: searchError } = await supabase
            .from('valuations')
            .select('id')
            .eq('assigned_expert_id', userId.toString()) // Match Bitrix ID
            .neq('status', 'Archived') // Only active chats
            .order('updated_at', { ascending: false }) // Get most recent
            .limit(1);

        if (searchError || !valuations || valuations.length === 0) {
            console.log(`No active valuation found for Bitrix User ${userId}`);
            // Optional: Reply to Bitrix user saying "No active ticket found"
            return new Response("No active ticket matched", { status: 200 });
        }

        const valuationId = valuations[0].id;

        // 2. INSERT INCOMING MESSAGE
        const { error: insertError } = await supabase.from("valuation_messages").insert({
            valuation_id: valuationId,
            sender: "Expert", // Display name in UI
            content: messageText.toString(),
            is_email: false,
            delivery_status: 'received', // Marked as received
        });

        if (insertError) throw insertError;

        // ---------------------------------------------------------
        // OFFLINE AUTO-REPLY LOGIC (Server-Side)
        // ---------------------------------------------------------
        try {
            // A. Get Bitrix URL from Company Profile (to know where to reply)
            const { data: profile } = await supabase.from('company_profile').select('raw_data').single();
            const bitrixUrl = profile?.raw_data?.integrations?.bitrixUrl;

            if (bitrixUrl) {
                const autoText = "."; // The requested dot

                // B. Send "." to Bitrix API
                const baseUrl = bitrixUrl.endsWith('/') ? bitrixUrl : `${bitrixUrl}/`;
                await fetch(`${baseUrl}im.message.add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        DIALOG_ID: userId, // Reply to the sender
                        MESSAGE: autoText
                    })
                });

                // C. Save "." to DB so it appears in history
                await supabase.from("valuation_messages").insert({
                    valuation_id: valuationId,
                    sender: "Workshop",
                    content: autoText,
                    is_email: false,
                    delivery_status: 'sent',
                });
                
                console.log("Auto-reply sent successfully via Edge Function.");
            }
        } catch (replyError) {
            console.error("Auto-reply failed:", replyError);
            // We do not fail the whole request if auto-reply fails, as the incoming message was saved.
        }

        return new Response("Bitrix Message Synced & Replied", { status: 200 });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
