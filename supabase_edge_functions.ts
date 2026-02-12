
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
  } else if (url.pathname.endsWith("extraction-job")) {
    return handleExtractionJob(req);
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

// -----------------------------------------------------------------------------
// MODULE A: AI EXTRACTION JOB HANDLER
// -----------------------------------------------------------------------------
async function handleExtractionJob(req: Request) {
  const { method } = req;
  const url = new URL(req.url);

  try {
    // --- 1. HANDLE QUERY (GET) ---
    if (method === 'GET') {
      const jobId = url.searchParams.get('jobId');
      if (!jobId) return new Response("Missing jobId parameter", { status: 400 });

      const { data: job, error } = await supabase
        .from('extraction_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error || !job) {
        return new Response(JSON.stringify({ error: "Job not found" }), { status: 404 });
      }

      return new Response(JSON.stringify({
        job_id: job.id,
        status: job.status,
        extracted_data: job.extracted_data,
        confidence_scores: job.confidence_scores,
        completed_at: job.completed_at
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // --- 2. HANDLE TRIGGER (POST) ---
    const { action, jobId } = await req.json();

    if (action !== 'process') {
      return new Response("Invalid action. Only 'process' is supported.", { status: 400 });
    }

    if (!jobId) {
      return new Response("Missing jobId", { status: 400 });
    }

    // UPDATE: Set status to processing
    await supabase.from('extraction_jobs').update({ status: 'processing' }).eq('id', jobId);

    // FETCH JOB DETAILS
    const { data: job, error: jobError } = await supabase
      .from('extraction_jobs')
      .select('*, workshop_files!inner(*)')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobError?.message}`);
    }

    const bucket = job.workshop_files.bucket || 'reception-files';
    const path = job.workshop_files.storage_path;

    const { data: fileData, error: downloadError } = await supabase.storage.from(bucket).download(path);
    if (downloadError) throw new Error(`Failed to download: ${downloadError.message}`);

    // --- MOCK AI RESPONSE (Strict Spec Alignment) ---
    await new Promise(resolve => setTimeout(resolve, 1500));

    const mockExtractedData = {
      vehicle: {
        plate: "1234BBB", brand: "BMW", model: "3 Series", vin: "WBA3B31000F123456", km: 45200, year: 2018, color: "Gris Metalizado"
      },
      claim: {
        claim_number: "SIN-2026-8899", incident_type: "collision", incident_date: "2026-02-05"
      },
      labor: {
        bodywork_hours: 12.5, paint_hours: 8.0, bodywork_rate: 45.00, paint_rate: 50.00
      },
      materials: {
        paint_amount: 350.00,
        parts: [
          { part_number: "BM-51117379920", description: "Front bumper", quantity: 1, unit_price: 580.00, confidence: 0.92 },
          { part_number: "BM-51137208261", description: "Right LED headlight", quantity: 1, unit_price: 425.00, confidence: 0.88 }
        ]
      },
      total_estimate: 2180.00
    };

    const mockConfidence = { overall: 0.89, labor: 0.92, materials: 0.88, parts: 0.85 };

    // --- SAVE BUSINESS LOGIC & PERSISTENCE ---
    const finalStatus = mockConfidence.overall > 0.80 ? 'completed' : 'requires_review';

    const { error: updError } = await supabase.from('extraction_jobs').update({
      status: finalStatus,
      extracted_data: mockExtractedData,
      confidence_scores: mockConfidence,
      completed_at: new Date().toISOString()
    }).eq('id', jobId);

    if (updError) throw updError;

    // Rule 1: Auto-fill if confidence > 80%
    if (finalStatus === 'completed' && job.work_order_id) {
      const laborTotal = (mockExtractedData.labor.bodywork_hours * mockExtractedData.labor.bodywork_rate) +
        (mockExtractedData.labor.paint_hours * mockExtractedData.labor.paint_rate);

      await supabase.from('work_order_billing').insert({
        workshop_id: job.workshop_id,
        work_order_id: job.work_order_id,
        labor_hours_billed: mockExtractedData.labor.bodywork_hours + mockExtractedData.labor.paint_hours,
        labor_amount: laborTotal,
        materials_amount: mockExtractedData.materials.paint_amount,
        total_amount: mockExtractedData.total_estimate,
        invoice_status: 'draft',
        source: 'ai_extraction'
      });

      const partsToInsert = mockExtractedData.materials.parts.map((p: any) => ({
        workshop_id: job.workshop_id,
        work_order_id: job.work_order_id,
        part_number: p.part_number,
        description: p.description,
        qty_billed: p.quantity,
        price_billed: p.unit_price,
        source: 'ai_extraction',
        confidence: p.confidence
      }));

      if (partsToInsert.length > 0) {
        await supabase.from('work_order_parts').insert(partsToInsert);
      }
    }

    return new Response(JSON.stringify({
      job_id: jobId,
      status: finalStatus,
      extracted_data: mockExtractedData,
      confidence_scores: mockConfidence,
      completed_at: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

