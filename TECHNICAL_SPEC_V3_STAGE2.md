# 📋 VALORA PLUS V3 STAGE 2 - Technical Specification (ENGLISH)

**Version:** V3 Stage 2 - Complete Specification

**Date:** February 10, 2026

**Recipient:** Development Team

**Author:** ExpertIA - Technical Audit

---

> **⚠️ CRITICAL CORRECTION TO ORIGINAL REPORT**
> 

> 
> 

> The received report "VALORA PLUS PHASE 3 STAGE 2" covers advanced functionalities (2FA, internal chat) but **omits the critical data capture modules** that make V3 work.
> 

> 
> 

> **Without automatic data capture, dashboards will be empty and the system has no value.**
> 

---

## 🎯 V3 GUIDING PRINCIPLE

### The Golden Rule:

**"If the workshop keeps entering data manually, we have failed"**

### V3 Objective:

Create an **automatic economic truth capture system** where:

- ✅ 90% of data is captured without human intervention
- ✅ Dashboards show real and updated information
- ✅ The workshop can work 1 month without using Excel
- ✅ The profitability of each work order is visible before closing

---

## 📊 ANALYSIS OF RECEIVED REPORT

### ✅ What is GOOD in the report:

**1. Base technical architecture**

- Use of Supabase and its services
- Supabase Realtime for live updates
- Work_orders table structure with key fields

**2. Labor Efficiency (Section 2.1)**

- Correct field definition: order_id, assigned_to, status, start_time, end_time, labor_hours
- Calculated metrics: hours per task, efficiency ratios
- Real-time analytics

**3. Profitability Dashboard (Section 4.1)**

- Visualizations with Chart.js
- Profitability calculations (revenue - costs)
- Filters by date, department, project
- Export to CSV/PDF

### ❌ What is MISSING (critical) in the report:

**1. AI Extraction Engine** → GAP 1 (CRITICAL) Valora Plus Analytics Integration (My Part)

- No specification of how AI reads the assessment PDF
- No automatic data extraction pipeline
- No extraction_jobs table or related endpoints
- **Impact:** Without this, workshop enters data manually

**2. Time Tracking Interface for Operators** → GAP 2 (CRITICAL)

- Labor Efficiency section mentions tables but **not the user interface**
- No mobile/web app for operators to clock in (START/PAUSE/FINISH)
- No offline synchronization
- **Impact:** Without captured labor hours, dashboards don't work

**3. Work Order Intake Form** → GAP 4 (HIGH)

- No intake form specification
- No mandatory field validations
- No initial work_orders creation flow
- **Impact:** Inconsistent data entry

**4. Purchase Importer** → GAP 3 (HIGH)

- No flow for supplier invoice entry
- No CSV parsing or PDF OCR
- No automatic SKU → WO matching
- **Impact:** Incorrect material costs

**5. Mandatory Pre-Close Modal** → GAP 5 (HIGH)

- No profitability validation before closing WO
- No visual traffic light 🟢🟡🔴
- No profit snapshot
- **Impact:** No loss control

**6. State Machine** → GAP 6 (HIGH)

- No WO state orchestration
- No transition validation
- No state change audit trail
- **Impact:** Inconsistent states

### ⚠️ What is WRONGLY PRIORITIZED:

**Authentication 2FA (Section 1.1)** → Move to STAGE 3

- Important, but not critical for MVP
- We first need the system to work

**Session Management (Section 1.2)** → Move to STAGE 3

- Nice-to-have, but not a priority
- Workshops have few concurrent users

**Internal Chat (Section 3.1)** → Move to STAGE 4

- Workshops already use WhatsApp
- Not critical for value proposition

---

## 🏗️ COMPLETE V3 ARCHITECTURE (End-to-End)

### Complete data flow:

```jsx
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: DATA ENTRY (Automatic capture)                   │
└─────────────────────────────────────────────────────────────┘

1️⃣ WO CREATION (Intake)
   └─ Web/mobile form → work_orders (status='intake')

2️⃣ ASSESSMENT UPLOAD
   └─ Upload PDF → storage → files → extraction_job

3️⃣ AI EXTRACTION (Automatic)
   └─ PDF → AI → work_order_billing + work_order_parts

4️⃣ MATERIAL PURCHASES
   └─ CSV/PDF → purchase_documents → purchase_lines → matching

┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: EXECUTION (Real-time capture)                    │
└─────────────────────────────────────────────────────────────┘

5️⃣ TASK ASSIGNMENT
   └─ Shop manager → work_order_tasks (by operator/specialty)

6️⃣ TIME TRACKING
   └─ Mobile app START/PAUSE/FINISH → task_time_logs

7️⃣ MATERIAL USAGE
   └─ Code scan → work_order_parts (qty_assigned)

┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: CLOSURE (Automatic)                              │
└─────────────────────────────────────────────────────────────┘

8️⃣ PRE-CLOSE VALIDATION
   └─ Mandatory modal → Traffic light 🟢🟡🔴 → Review checkbox

9️⃣ FINAL CLOSURE
   └─ work_orders.closed → work_order_profit_snapshot

┌─────────────────────────────────────────────────────────────┐
│  PHASE 4: REPORTING (Automatic)                            │
└─────────────────────────────────────────────────────────────┘

🔟 LIVE DASHBOARDS - now we have assessment for analysis
   ├─ Valora Plus Analytics Integration (My Part)
   ├─ Operational Dashboard (active WOs)
   ├─ Performance Dashboard (employee profitability)
   └─ Insurer Dashboard (insurer margins)
```

---

## 🔧 MODULES TO DEVELOP (Stage 2)

### MODULE A: AI Extraction Engine

**Priority:** 🔴 CRITICAL

#### Description:

Automatic assessment PDF reading system using AI, extracting structured data and pre-filling billing and parts list.

#### New table:

```sql
CREATE TABLE extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  extracted_data JSONB,
  confidence_scores JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_extraction_jobs_work_order ON extraction_jobs(work_order_id);
CREATE INDEX idx_extraction_jobs_status ON extraction_jobs(status);
```

#### Required endpoints:

**1. Assessment upload**

```tsx
POST /api/work-orders/{workOrderId}/upload-assessment

Body: FormData
  - file: File (PDF)
  - document_type: 'assessment'

Response: {
  file_id: UUID,
  extraction_job_id: UUID,
  status: 'pending'
}
```

**2. Trigger AI processing**

```tsx
POST /api/extraction-jobs/{jobId}/process

Response: {
  job_id: UUID,
  status: 'processing',
  estimated_time_seconds: 30
}
```

**3. Query result**

```tsx
GET /api/extraction-jobs/{jobId}

Response: {
  job_id: UUID,
  status: 'completed',
  extracted_data: {
    labor: {
      bodywork_hours: 12.5,
      paint_hours: 8.0,
      bodywork_rate: 45.00,
      paint_rate: 50.00
    },
    materials: {
      paint_amount: 350.00,
      parts: [
        {
          description: 'Front bumper',
          part_number: 'BM-51117379920',
          quantity: 1,
          unit_price: 580.00
        }
      ]
    },
    total_estimate: 2180.00
  },
  confidence_scores: {
    labor: 0.92,
    materials: 0.88,
    parts: 0.85
  },
  completed_at: '2026-02-10T10:30:00Z'
}
```

#### Business logic:

**Rule 1: Auto-fill if confidence > 80%**

```tsx
if (confidence_scores.labor > 0.80 && confidence_scores.materials > 0.80) {
  // Pre-fill work_order_billing automatically
  INSERT INTO work_order_billing (
    work_order_id,
    labor_hours_billed,
    labor_amount,
    materials_amount,
    total_amount,
    invoice_status,
    source
  ) VALUES (
    work_order_id,
    extracted_data.labor.bodywork_hours + extracted_data.labor.paint_hours,
    (extracted_data.labor.bodywork_hours * extracted_data.labor.bodywork_rate) +
    (extracted_data.labor.paint_hours * extracted_data.labor.paint_rate),
    extracted_data.materials.paint_amount,
    extracted_data.total_estimate,
    'draft',
    'ai_extraction'
  );
  
  // Pre-fill work_order_parts
  foreach (part in extracted_data.materials.parts) {
    INSERT INTO work_order_parts (
      work_order_id,
      part_number,
      description,
      qty_billed,
      price_billed,
      source
    ) VALUES (
      work_order_id,
      part.part_number,
      part.description,
      part.quantity,
      part.unit_price,
      'ai_extraction'
    );
  }
} else {
  // If confidence < 80%, mark for manual review
  UPDATE extraction_jobs 
  SET status = 'requires_review'
  WHERE id = job_id;
}
```

**Rule 2: Quick correction UI**

- If status = 'requires_review', show validation UI
- Pre-filled fields with extracted data
- Highlight fields with confidence < 0.80 in yellow
- "Confirm and apply" button inserts into work_order_billing

#### AI model integration:

**Option 1: OpenAI Vision API**

```tsx
import OpenAI from 'openai';

const extractFromPDF = async (pdfBuffer: Buffer) => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4-vision-preview',
    messages: [
      {
        role: 'system',
        content: 'Extract structured data from this vehicle assessment report. Return JSON with: labor (bodywork hours, paint hours, rates), materials (paint amount, parts), total.'
      },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBuffer.toString('base64')}` } }
        ]
      }
    ],
    response_format: { type: 'json_object' }
  });
  
  return JSON.parse(response.choices[0].message.content);
};
```

**Option 2: Claude 3.5 Sonnet (Anthropic)**

```tsx
import Anthropic from '@anthropic-ai/sdk';

const extractFromPDF = async (pdfBuffer: Buffer) => {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  
  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBuffer.toString('base64')
            }
          },
          {
            type: 'text',
            text: 'Extract: bodywork hours, paint hours, hourly rates, paint quantity, parts list (code, description, quantity, price), total assessed. Return structured JSON.'
          }
        ]
      }
    ]
  });
  
  return JSON.parse(message.content[0].text);
};
```

#### AI response JSON format:

```json
{
  "labor": {
    "bodywork_hours": 12.5,
    "paint_hours": 8.0,
    "bodywork_rate": 45.00,
    "paint_rate": 50.00
  },
  "materials": {
    "paint_amount": 350.00,
    "parts": [
      {
        "part_number": "BM-51117379920",
        "description": "Front bumper",
        "quantity": 1,
        "unit_price": 580.00,
        "confidence": 0.92
      },
      {
        "part_number": "BM-51137208261",
        "description": "Right LED headlight",
        "quantity": 1,
        "unit_price": 425.00,
        "confidence": 0.88
      }
    ]
  },
  "total_estimate": 2180.00,
  "confidence_overall": 0.89
}
```

---

### MODULE B: Time Tracking for Operators

**Priority:** 🔴 CRITICAL (Week 3-4)

#### Description:

Mobile/web application (PWA) allowing operators to clock in/out of tasks, capturing labor hours in real-time with offline support.

#### User interface:

**Main screen (operator):**

```
┌─────────────────────────────┐
│  👷 John Smith              │
│  ⚙️ Mechanic - Bodywork    │
├─────────────────────────────┤
│  Current task:              │
│  🔧 Bodywork WO-2026-00123  │
│  📍 BMW 3 Series            │
│                             │
│  ⏱ Time: 02:34:12          │
│                             │
│  ┌───────────────────────┐  │
│  │   ⏸ PAUSE            │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │   ✅ FINISH TASK     │  │
│  └───────────────────────┘  │
├─────────────────────────────┤
│  Pending tasks: 2           │
│  ▸ Paint WO-2026-00124      │
│  ▸ Assembly WO-2026-00119   │
└─────────────────────────────┘
```

**Task selection screen:**

```
┌─────────────────────────────┐
│  📋 My assigned tasks       │
├─────────────────────────────┤
│  ┌─────────────────────┐    │
│  │ WO-2026-00123       │    │
│  │ 🔧 Bodywork         │    │
│  │ BMW 3 Series        │    │
│  │ Est: 12.5h          │    │
│  │ [▶ START]           │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ WO-2026-00124       │    │
│  │ 🎨 Paint            │    │
│  │ Audi A4             │    │
│  │ Est: 8.0h           │    │
│  │ [▶ START]           │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

#### Required endpoints:

**1. List assigned tasks**

```tsx
GET /api/time-tracking/my-tasks

Headers:
  Authorization: Bearer {employee_token}

Response: {
  tasks: [
    {
      task_id: UUID,
      work_order_id: UUID,
      work_order_number: 'WO-2026-00123',
      vehicle: 'BMW 3 Series',
      task_type: 'bodywork',
      estimated_hours: 12.5,
      status: 'assigned',
      priority: 'high'
    }
  ]
}
```

**2. Start task**

```tsx
POST /api/time-tracking/start

Body: {
  task_id: UUID,
  location?: { lat: number, lng: number } // Optional
}

Response: {
  time_log_id: UUID,
  task_id: UUID,
  started_at: '2026-02-10T09:00:00Z',
  status: 'in_progress'
}

Logic:
1. Validate user doesn't have another active task
2. INSERT INTO task_time_logs (task_id, employee_id, started_at, status)
3. UPDATE work_order_tasks SET status='in_progress' WHERE id=task_id
4. Respond with time_log_id
```

**3. Pause task**

```tsx
POST /api/time-tracking/pause

Body: {
  time_log_id: UUID
}

Response: {
  time_log_id: UUID,
  duration_seconds: 9252, // 2h 34m 12s
  status: 'paused'
}

Logic:
1. Calculate duration_seconds = now() - started_at - SUM(previous_pauses)
2. UPDATE task_time_logs SET paused_at=now(), duration_seconds=X
3. Keep task 'in_progress' (don't change status)
```

**4. Resume task**

```tsx
POST /api/time-tracking/resume

Body: {
  time_log_id: UUID
}

Response: {
  time_log_id: UUID,
  resumed_at: '2026-02-10T11:30:00Z',
  status: 'in_progress'
}
```

**5. Finish task**

```tsx
POST /api/time-tracking/finish

Body: {
  time_log_id: UUID,
  notes?: string // Optional: operator notes
}

Response: {
  time_log_id: UUID,
  total_duration_seconds: 12600, // 3h 30m
  total_duration_hours: 3.5,
  ended_at: '2026-02-10T12:30:00Z',
  status: 'completed'
}

Logic:
1. Calculate total_duration_seconds = ended_at - started_at - SUM(pause_durations)
2. UPDATE task_time_logs SET ended_at=now(), duration_seconds=X, status='completed'
3. UPDATE work_order_tasks SET status='completed', actual_hours=X/3600
4. Trigger: recalculate v_work_order_profit
```

**6. Query active task**

```tsx
GET /api/time-tracking/active

Headers:
  Authorization: Bearer {employee_token}

Response: {
  active_task: {
    time_log_id: UUID,
    task_id: UUID,
    work_order_number: 'WO-2026-00123',
    vehicle: 'BMW 3 Series',
    started_at: '2026-02-10T09:00:00Z',
    elapsed_seconds: 9252,
    status: 'in_progress'
  } | null
}
```

#### Business rules:

**Rule 1: One operator can only have 1 active task**

```sql
-- Application constraint
SELECT COUNT(*) 
FROM task_time_logs 
WHERE employee_id = $1 
  AND status IN ('in_progress', 'paused')
  AND ended_at IS NULL;

-- If COUNT > 0, reject POST /start with 409 error
```

**Rule 2: Offline synchronization**

```tsx
// Client (PWA) saves to IndexedDB if offline
interface PendingAction {
  id: string;
  type: 'start' | 'pause' | 'resume' | 'finish';
  task_id: UUID;
  timestamp: string;
  synced: boolean;
}

// When connection recovers, send in chronological order
const syncPendingActions = async () => {
  const pending = await db.pendingActions.where('synced').equals(false).toArray();
  
  for (const action of pending.sort((a, b) => a.timestamp - b.timestamp)) {
    try {
      await api.post(`/api/time-tracking/${action.type}`, {
        task_id: action.task_id,
        timestamp: action.timestamp // Backend uses this timestamp, not now()
      });
      
      await db.pendingActions.update(action.id, { synced: true });
    } catch (err) {
      console.error('Sync failed', action, err);
      break; // Stop on failure to maintain order
    }
  }
};
```

**Rule 3: Correct calculation with pauses**

```sql
-- Table to store pauses
CREATE TABLE task_time_pauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_log_id UUID REFERENCES task_time_logs(id) ON DELETE CASCADE,
  paused_at TIMESTAMP NOT NULL,
  resumed_at TIMESTAMP,
  duration_seconds INTEGER GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (resumed_at - paused_at))) STORED
);

-- Calculate total duration
SELECT 
  tl.id,
  EXTRACT(EPOCH FROM (tl.ended_at - tl.started_at)) - COALESCE(SUM(tp.duration_seconds), 0) AS net_duration_seconds
FROM task_time_logs tl
LEFT JOIN task_time_pauses tp ON tp.time_log_id = tl.id
WHERE tl.id = $1
GROUP BY tl.id;
```

#### Recommended tech stack:

**Frontend (PWA):**

- **Framework:** React + Vite (or Next.js if SSR needed)
- **UI Components:** shadcn/ui or Tailwind CSS
- **Offline:** Workbox (service workers) + IndexedDB (Dexie.js)
- **State:** Zustand or React Query
- **PWA:** vite-plugin-pwa

**Backend:**

- **Runtime:** Node.js + Supabase Edge Functions
- **Auth:** Supabase Auth with row-level security
- **Realtime:** Supabase Realtime subscriptions

---

### MODULE C: Work Order Intake Form

**Priority:** 🟡 HIGH (Week 1)

#### Description:

Initial work order creation form with validations and data pre-loading when prior assessment exists.

#### Form fields:

**Section 1: Vehicle identification**

```tsx
interface VehicleInfo {
  license_plate: string;        // License plate - REQUIRED
  vin?: string;                  // VIN - Optional
  make: string;                  // Make - REQUIRED (select)
  model: string;                 // Model - REQUIRED
  year?: number;                 // Year - Optional
  color?: string;                // Color - Optional
}
```

**Section 2: Customer**

```tsx
interface CustomerInfo {
  customer_name: string;         // Name - REQUIRED
  phone: string;                 // Phone - REQUIRED
  email?: string;                // Email - Optional
  address?: string;              // Address - Optional
}
```

**Section 3: Claim**

```tsx
interface ClaimInfo {
  insurer_id: UUID;              // Insurer - REQUIRED (select)
  claim_number?: string;         // Insurer claim number
  incident_type: string;         // Incident type - REQUIRED (select)
  incident_date?: Date;          // Incident date
  description?: string;          // Damage description
}

// incident_type options:
[
  'collision',           // Collision
  'scratch',             // Scratch/scrape
  'hail',                // Hail
  'vandalism',           // Vandalism
  'parking',             // Parking hit
  'animal',              // Animal strike
  'other'                // Other
]
```

**Section 4: Files**

```tsx
interface Files {
  assessment_pdf?: File;         // Assessment PDF (triggers AI extraction)
  photos?: File[];               // Initial photos (max 10)
}
```

#### Creation endpoint:

```tsx
POST /api/work-orders

Body: {
  license_plate: string;
  make: string;
  model: string;
  customer_name: string;
  phone: string;
  insurer_id: UUID;
  incident_type: string;
  // ... rest of optional fields
}

Response: {
  work_order_id: UUID,
  work_order_number: 'WO-2026-00123',
  status: 'intake',
  created_at: '2026-02-10T10:00:00Z'
}

Backend logic:
1. Validate required fields
2. Generate sequential work_order_number per workshop
3. INSERT INTO work_orders (...) RETURNING id
4. If assessment_pdf exists:
   a. Upload to storage
   b. INSERT INTO files
   c. Trigger extraction_job
5. Respond with work_order_id
```

#### Validations:

**Frontend:**

```tsx
const validateForm = (data: IntakeFormData) => {
  const errors: Record<string, string> = {};
  
  // License plate (Spanish format)
  if (!data.license_plate) {
    errors.license_plate = 'License plate is required';
  } else if (!/^[0-9]{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(data.license_plate)) {
    errors.license_plate = 'Invalid license plate format (ex: 1234ABC)';
  }
  
  // Phone (Spanish format)
  if (!data.phone) {
    errors.phone = 'Phone is required';
  } else if (!/^[679][0-9]{8}$/.test(data.phone.replace(/\s/g, ''))) {
    errors.phone = 'Invalid phone format (ex: 600123456)';
  }
  
  // Email (if provided)
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Invalid email format';
  }
  
  return errors;
};
```

**Backend:**

```sql
-- Database constraints
ALTER TABLE work_orders
  ADD CONSTRAINT chk_license_plate_format 
    CHECK (license_plate ~ '^[0-9]{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$'),
  ADD CONSTRAINT chk_phone_format 
    CHECK (phone ~ '^[679][0-9]{8}$');
```

---

### MODULE D: Purchase Importer

**Priority:** 🟡 HIGH (Week 5)

#### Description:

System for importing supplier invoices and delivery notes (CSV or PDF) with automatic matching to work orders.

#### Expected CSV format:

```
SKU,Description,Quantity,Unit_Price,Total,WO_Reference
BM-51117379920,Front bumper,1,580.00,580.00,WO-2026-00123
BM-51137208261,Right LED headlight,1,425.00,425.00,WO-2026-00123
PAINT-BASE-BL,Blue base paint,2.5,45.00,112.50,WO-2026-00123
```

#### Endpoints:

**1. Import CSV**

```tsx
POST /api/purchases/import-csv

Body: FormData
  - file: File (CSV)
  - supplier_id: UUID
  - document_date: Date
  - document_number: string

Response: {
  purchase_document_id: UUID,
  lines_imported: 15,
  lines_matched: 12,
  lines_pending: 3,
  total_amount: 3450.00
}

Logic:
1. Parse CSV
2. INSERT INTO purchase_documents (supplier_id, document_date, document_number)
3. For each line:
   a. INSERT INTO purchase_lines (...)
   b. If WO_Reference exists, find work_order by number
   c. Matching by SKU:
      - Find work_order_parts where part_number=SKU AND work_order_id=matched_order
      - If exists: UPDATE work_order_parts SET cost_total=price, cost_source='purchase'
   d. If no match: mark as pending_assignment
4. Respond with summary
```

**2. Import PDF (OCR)**

```tsx
POST /api/purchases/import-pdf

Body: FormData
  - file: File (PDF)
  - supplier_id: UUID

Response: {
  purchase_document_id: UUID,
  ocr_confidence: 0.87,
  requires_review: true,
  preview_data: {
    document_number: 'INV-2024-00456',
    document_date: '2026-02-08',
    lines: [
      { sku: 'BM-511...', description: '...', qty: 1, price: 580.00, confidence: 0.92 }
    ]
  }
}

Logic:
1. Upload PDF to storage
2. OCR with Tesseract or cloud service (Google Vision API, AWS Textract)
3. AI extracts tabular structure
4. If confidence < 0.85: requires_review=true, show validation UI
5. If confidence >= 0.85: auto-import like CSV
```

**3. Manual matching**

```tsx
POST /api/purchases/{purchaseLineId}/match

Body: {
  work_order_id: UUID,
  work_order_part_id: UUID
}

Response: {
  matched: true
}

Logic:
1. UPDATE purchase_lines SET work_order_id=$1 WHERE id=purchaseLineId
2. UPDATE work_order_parts SET cost_total=purchase_line.price WHERE id=work_order_part_id
```

#### Automatic matching algorithm:

```tsx
const autoMatchPurchaseLine = async (line: PurchaseLine) => {
  // Step 1: Search by explicit WO reference
  if (line.work_order_reference) {
    const wo = await db.work_orders.findOne({ number: line.work_order_reference });
    if (wo) {
      return matchByWorkOrder(line, wo.id);
    }
  }
  
  // Step 2: Search by SKU in active work_order_parts
  const candidates = await db.query(`
    SELECT wop.id, wop.work_order_id, wo.status
    FROM work_order_parts wop
    JOIN work_orders wo ON wo.id = wop.work_order_id
    WHERE wop.part_number = $1
      AND wo.status IN ('assigned', 'in_progress', 'ready_to_close')
      AND wop.cost_total IS NULL  -- Only if no cost assigned yet
    ORDER BY wo.created_at DESC
    LIMIT 5
  `, [line.sku]);
  
  if (candidates.length === 1) {
    // Auto-match if only 1 candidate
    return matchPart(line.id, candidates[0].id);
  } else if (candidates.length > 1) {
    // Ambiguous: mark for manual matching
    return { status: 'pending', candidates };
  } else {
    // Not found: create as general stock
    return { status: 'no_match', action: 'add_to_inventory' };
  }
};
```

---

### MODULE E: Mandatory Pre-Close Modal

**Priority:** 🟡 HIGH (Week 6)

#### Description:

Modal shown MANDATORILY before closing a WO, displaying real profitability and requiring shop manager validation.

#### Modal interface:

```
┌─────────────────────────────────────────────────────┐
│  ⚠️ MANDATORY PROFITABILITY VALIDATION             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  WO-2026-00123 - BMW 3 Series                      │
│  Customer: John Doe                                 │
│  Insurer: ACME Insurance                            │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │  📊 FINANCIAL SUMMARY                         │ │
│  ├───────────────────────────────────────────────┤ │
│  │  Billed:                 $2,180.00            │ │
│  │  - Labor:                $1,487.50            │ │
│  │  - Materials:              $692.50            │ │
│  │                                               │ │
│  │  Actual costs:           $1,856.30            │ │
│  │  - Labor:                $1,295.00            │ │
│  │  - Materials:              $561.30            │ │
│  │                                               │ │
│  │  ═══════════════════════════════════          │ │
│  │  Margin:                   $323.70            │ │
│  │  Profitability:              14.9% 🟡         │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ⚠️ ANALYSIS:                                       │
│  • Actual hours (37h) higher than billed (32.5h):  │
│    +13.8%                                           │
│  • Materials within budget: -18.9%                  │
│  • Margin below target (>20%)                       │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ ☑ I have reviewed profitability and confirm │   │
│  │   closing this work order                   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Reason (required if margin < 15%):                │
│  ┌─────────────────────────────────────────────┐   │
│  │ Hidden damages found during disassembly that│   │
│  │ were not in the initial assessment          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [ ❌ CANCEL ]              [ ✅ CLOSE ORDER ]     │
└─────────────────────────────────────────────────────┘
```

#### Profitability traffic light:

```tsx
const getProfitabilityColor = (marginPercent: number) => {
  if (marginPercent >= 20) return '🟢'; // Green: Excellent
  if (marginPercent >= 15) return '🟡'; // Yellow: Acceptable
  return '🔴';                           // Red: Loss or low margin
};
```

#### Pre-close endpoint:

```tsx
GET /api/work-orders/{workOrderId}/pre-close-check

Response: {
  can_close: boolean,
  profit_snapshot: {
    billed_amount: 2180.00,
    labor_cost: 1295.00,
    material_cost: 561.30,
    total_cost: 1856.30,
    profit: 323.70,
    profit_percent: 14.9,
    color: '🟡'
  },
  warnings: [
    'Actual hours (37h) higher than billed (32.5h): +13.8%',
    'Margin below target (>20%)'
  ],
  requires_reason: true // If profit_percent < 15%
}

Logic:
1. Query v_work_order_profit to get metrics
2. Calculate profit_percent
3. Generate warnings if deviations exist
4. requires_reason = true if profit_percent < 15%
```

#### Final close endpoint:

```tsx
POST /api/work-orders/{workOrderId}/close

Body: {
  reviewed: true,           // Required: must be true
  reason?: string           // Required if requires_reason=true
}

Response: {
  work_order_id: UUID,
  status: 'closed',
  closed_at: '2026-02-10T14:30:00Z',
  profit_snapshot_id: UUID
}

Logic:
1. Validate reviewed=true
2. If requires_reason and no reason: ERROR 400
3. INSERT INTO work_order_profit_snapshot (
     work_order_id,
     snapshot_type='closed',
     billed_amount,
     total_cost,
     profit,
     profit_percent
   )
4. INSERT INTO work_order_close_review (
     work_order_id,
     reviewed_by,
     reason,
     reviewed_at
   )
5. UPDATE work_orders SET status='closed', closed_at=now()
6. Trigger: recalculate dashboards
```

#### Close review table:

```sql
CREATE TABLE work_order_close_review (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES users(id),
  profit_snapshot_id UUID REFERENCES work_order_profit_snapshot(id),
  reason TEXT,
  reviewed_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_close_review_work_order ON work_order_close_review(work_order_id);

-- Constraint: don't allow closing without review
CREATE OR REPLACE FUNCTION check_close_review()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
    IF NOT EXISTS (
      SELECT 1 FROM work_order_close_review WHERE work_order_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cannot close work order without review';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_close_review
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION check_close_review();
```

---

### MODULE F: State Machine

**Priority:** 🟡 HIGH (Week 1)

#### Description:

Work order state management system with transition validation and complete audit trail.

#### Valid states:

```tsx
enum WorkOrderStatus {
  INTAKE = 'intake',              // Newly created
  ASSIGNED = 'assigned',          // Assigned to operators
  IN_PROGRESS = 'in_progress',    // In execution
  ON_HOLD = 'on_hold',            // Paused (waiting for parts, etc.)
  READY_TO_CLOSE = 'ready_to_close', // Ready to close
  CLOSED = 'closed',              // Closed
  CANCELLED = 'cancelled'         // Cancelled
}
```

#### Allowed transitions:

```tsx
const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  [WorkOrderStatus.INTAKE]: [
    WorkOrderStatus.ASSIGNED,
    WorkOrderStatus.CANCELLED
  ],
  [WorkOrderStatus.ASSIGNED]: [
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.ON_HOLD,
    WorkOrderStatus.CANCELLED
  ],
  [WorkOrderStatus.IN_PROGRESS]: [
    WorkOrderStatus.ON_HOLD,
    WorkOrderStatus.READY_TO_CLOSE
  ],
  [WorkOrderStatus.ON_HOLD]: [
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.CANCELLED
  ],
  [WorkOrderStatus.READY_TO_CLOSE]: [
    WorkOrderStatus.IN_PROGRESS, // Reopen if changes needed
    WorkOrderStatus.CLOSED
  ],
  [WorkOrderStatus.CLOSED]: [],  // Final state, cannot change
  [WorkOrderStatus.CANCELLED]: [] // Final state, cannot change
};
```

#### Audit table:

```sql
CREATE TABLE work_order_state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  transitioned_by UUID REFERENCES users(id),
  transitioned_at TIMESTAMP DEFAULT now(),
  reason TEXT,
  metadata JSONB
);

CREATE INDEX idx_state_transitions_work_order ON work_order_state_transitions(work_order_id);
CREATE INDEX idx_state_transitions_date ON work_order_state_transitions(transitioned_at);
```

#### Transition endpoint:

```tsx
POST /api/work-orders/{workOrderId}/transition

Body: {
  to_state: WorkOrderStatus,
  reason?: string
}

Response: {
  work_order_id: UUID,
  from_state: 'in_progress',
  to_state: 'ready_to_close',
  transitioned_at: '2026-02-10T14:00:00Z'
}

Logic:
1. Get current state: current_state
2. Validate transition:
   if (!ALLOWED_TRANSITIONS[current_state].includes(to_state)) {
     throw new Error(`Transition not allowed: ${current_state} -> ${to_state}`);
   }
3. If to_state='closed', validate close_review exists
4. INSERT INTO work_order_state_transitions (...)
5. UPDATE work_orders SET status=to_state
6. Respond with confirmation
```

#### Automatic transition trigger:

```sql
-- Auto-transition to IN_PROGRESS when first task starts
CREATE OR REPLACE FUNCTION auto_transition_to_in_progress()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE work_orders
  SET status = 'in_progress'
  WHERE id = NEW.work_order_id
    AND status = 'assigned';
  
  IF FOUND THEN
    INSERT INTO work_order_state_transitions (
      work_order_id, from_state, to_state, transitioned_by, reason
    ) VALUES (
      NEW.work_order_id, 'assigned', 'in_progress', NEW.employee_id, 'First task started'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_transition_in_progress
  AFTER INSERT ON task_time_logs
  FOR EACH ROW
  WHEN (NEW.started_at IS NOT NULL)
  EXECUTE FUNCTION auto_transition_to_in_progress();
```

---

## 📅 CORRECTED ROADMAP (Stage 2)

### WEEK 1: Foundations

- ✅ Multi-tenant + RLS (already completed)
- ✅ Profitability views (already completed)
- 🔲 **WO intake form** (Module C)
- 🔲 **Basic state machine** (Module F)
- 🔲 Change event log

### WEEKS 2-3: AI Extraction (CRITICAL)

- 🔲 **Assessment PDF upload**
- 🔲 **extraction_jobs table**
- 🔲 **OpenAI/Claude integration**
- 🔲 **AI → automatic billing pipeline** (Module A)
- 🔲 Validation/correction UI

### WEEKS 4-5: Time Tracking (CRITICAL)

- 🔲 **start/pause/finish endpoints**
- 🔲 **Mobile PWA for operators** (Module B)
- 🔲 **Offline logic with IndexedDB**
- 🔲 **Automatic synchronization**
- 🔲 Live labor hours dashboard (for managers)

### WEEK 6: Materials

- 🔲 **CSV importer** (Module D)
- 🔲 **Automatic SKU → WO matching**
- 🔲 **Manual matching UI**

### WEEK 7: Closure and validation

- 🔲 **Mandatory pre-close modal** (Module E)
- 🔲 **Profit snapshot**
- 🔲 **close_review table**
- 🔲 **Constraint: no closing without review**

### WEEK 8: Testing and refinement

- 🔲 E2E tests of complete flow
- 🔲 Dashboards with real data
- 🔲 Query optimization
- 🔲 Technical documentation

### STAGE 3 (Future):

- 2FA & Session Management (Section 1 of original report)
- Internal Chat (Section 3 of original report)
- Advanced OCR for supplier PDFs
- Push notifications
- External ERP integration

---

## ⚠️ MÓDULO CRÍTICO ADICIONAL: Control Horario Laboral

### MÓDULO G: Control Horario Laboral (Obligatorio España)

**Prioridad:** 🔴 CRÍTICA - **OBLIGATORIO POR LEY (RD-ley 8/2019)**

#### ⚠️ IMPORTANTE:

**Este módulo es DISTINTO del Módulo B (Time Tracking de tareas)**

- **Módulo B:** Tracking de tiempo en tareas específicas de ORs (para calcular HI)
- **Módulo G:** Control horario laboral general (entrada/salida jornada completa)

#### Descripción:

Sistema de registro de jornada laboral completo que cumple con la normativa española, registrando entrada/salida del puesto de trabajo, descansos, ausencias y horas extra.

#### Requisitos legales (España):

1. Registro diario de hora de inicio y fin de jornada
2. Conservación de registros durante 4 años
3. Accesible a empleados, representantes y autoridades laborales
4. Sistema fiable e inalterable (inmutabilidad de registros cerrados)
5. Información en tiempo real

#### Tablas necesarias:

```sql
-- Tabla principal de registros de jornada
CREATE TABLE employee_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  workshop_id UUID REFERENCES workshops(id) ON DELETE CASCADE,
  
  -- Entrada/Salida
  clock_in TIMESTAMP NOT NULL,
  clock_out TIMESTAMP,
  
  -- Tipo de jornada
  day_type TEXT NOT NULL DEFAULT 'work' CHECK (day_type IN (
    'work',           -- Jornada normal
    'vacation',       -- Vacaciones
    'sick_leave',     -- Baja médica
    'personal_leave', -- Asunto propio
    'holiday'         -- Festivo
  )),
  
  -- Cálculos automáticos
  total_hours DECIMAL(5,2) GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600
  ) STORED,
  
  -- Extras
  extra_hours DECIMAL(5,2) DEFAULT 0,
  notes TEXT,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT now(),
  modified_at TIMESTAMP DEFAULT now(),
  is_locked BOOLEAN DEFAULT false, -- Bloquea edición después de 48h
  
  -- Validaciones
  CONSTRAINT chk_clock_out_after_clock_in CHECK (clock_out > clock_in OR clock_out IS NULL)
);

CREATE INDEX idx_attendance_employee ON employee_attendance(employee_id);
CREATE INDEX idx_attendance_date ON employee_attendance(DATE(clock_in));
CREATE INDEX idx_attendance_workshop ON employee_attendance(workshop_id);

-- Tabla de descansos durante jornada
CREATE TABLE attendance_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES employee_attendance(id) ON DELETE CASCADE,
  break_start TIMESTAMP NOT NULL,
  break_end TIMESTAMP,
  break_type TEXT NOT NULL CHECK (break_type IN (
    'meal',      -- Comida (obligatorio >6h)
    'rest',      -- Descanso
    'personal'   -- Personal
  )),
  duration_minutes INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (break_end - break_start)) / 60
  ) STORED
);

CREATE INDEX idx_breaks_attendance ON attendance_breaks(attendance_id);

-- Tabla de ausencias programadas
CREATE TABLE employee_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  absence_type TEXT NOT NULL CHECK (absence_type IN (
    'vacation',
    'sick_leave',
    'personal_leave',
    'maternity_leave',
    'paternity_leave',
    'unpaid_leave'
  )),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER GENERATED ALWAYS AS (
    (end_date - start_date) + 1
  ) STORED,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'approved',
    'rejected'
  )),
  approved_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_absences_employee ON employee_absences(employee_id);
CREATE INDEX idx_absences_dates ON employee_absences(start_date, end_date);

-- Vista para reportes legales
CREATE VIEW v_attendance_monthly_report AS
SELECT 
  ea.employee_id,
  u.full_name AS employee_name,
  DATE_TRUNC('month', ea.clock_in) AS month,
  COUNT(*) AS days_worked,
  SUM(ea.total_hours) AS total_hours,
  SUM(ea.extra_hours) AS total_extra_hours,
  AVG(ea.total_hours) AS avg_hours_per_day
FROM employee_attendance ea
JOIN users u ON u.id = ea.employee_id
WHERE ea.day_type = 'work' AND ea.clock_out IS NOT NULL
GROUP BY ea.employee_id, u.full_name, DATE_TRUNC('month', ea.clock_in);
```

#### Endpoints necesarios:

**1. Fichar entrada (Clock In)**

```tsx
POST /api/attendance/clock-in

Headers:
  Authorization: Bearer {employee_token}

Body: {
  location?: { lat: number, lng: number } // Opcional
}

Response: {
  attendance_id: UUID,
  employee_id: UUID,
  clock_in: '2026-02-10T08:00:00Z',
  day_type: 'work'
}

Logic:
1. Validar que no hay registro abierto (clock_out = NULL)
2. INSERT INTO employee_attendance (employee_id, clock_in, day_type='work')
3. Responder con attendance_id
```

**2. Fichar salida (Clock Out)**

```tsx
POST /api/attendance/clock-out

Headers:
  Authorization: Bearer {employee_token}

Body: {
  extra_hours?: number,  // Si hizo horas extra
  notes?: string
}

Response: {
  attendance_id: UUID,
  clock_in: '2026-02-10T08:00:00Z',
  clock_out: '2026-02-10T17:00:00Z',
  total_hours: 9.0,
  extra_hours: 1.0
}

Logic:
1. Buscar registro abierto del empleado (clock_out IS NULL)
2. UPDATE employee_attendance SET clock_out=now(), extra_hours=?, notes=?
3. Calcular total_hours automáticamente
4. Si más de 48h desde clock_in, marcar is_locked=true
```

**3. Iniciar descanso**

```tsx
POST /api/attendance/break-start

Headers:
  Authorization: Bearer {employee_token}

Body: {
  break_type: 'meal' | 'rest' | 'personal'
}

Response: {
  break_id: UUID,
  attendance_id: UUID,
  break_start: '2026-02-10T13:00:00Z',
  break_type: 'meal'
}
```

**4. Finalizar descanso**

```tsx
POST /api/attendance/break-end

Headers:
  Authorization: Bearer {employee_token}

Response: {
  break_id: UUID,
  break_start: '2026-02-10T13:00:00Z',
  break_end: '2026-02-10T14:00:00Z',
  duration_minutes: 60
}
```

**5. Solicitar ausencia**

```tsx
POST /api/absences/request

Headers:
  Authorization: Bearer {employee_token}

Body: {
  absence_type: 'vacation' | 'sick_leave' | 'personal_leave',
  start_date: '2026-03-01',
  end_date: '2026-03-05',
  notes?: string
}

Response: {
  absence_id: UUID,
  days_count: 5,
  status: 'pending'
}
```

**6. Aprobar/rechazar ausencia (manager)**

```tsx
PATCH /api/absences/{absenceId}

Headers:
  Authorization: Bearer {manager_token}

Body: {
  status: 'approved' | 'rejected',
  notes?: string
}

Response: {
  absence_id: UUID,
  status: 'approved',
  approved_by: UUID,
  approved_at: '2026-02-10T10:00:00Z'
}
```

**7. Consultar mi jornada actual**

```tsx
GET /api/attendance/current

Headers:
  Authorization: Bearer {employee_token}

Response: {
  attendance_id: UUID,
  clock_in: '2026-02-10T08:00:00Z',
  clock_out: null,
  elapsed_hours: 3.5,
  active_break: {
    break_id: UUID,
    break_type: 'meal',
    break_start: '2026-02-10T13:00:00Z',
    elapsed_minutes: 25
  } | null
}
```

**8. Reporte mensual (empleado)**

```tsx
GET /api/attendance/my-report?month=2026-02

Headers:
  Authorization: Bearer {employee_token}

Response: {
  month: '2026-02',
  employee_name: 'Juan García',
  days_worked: 20,
  total_hours: 168.5,
  total_extra_hours: 8.5,
  avg_hours_per_day: 8.4,
  absences: [
    {
      absence_type: 'vacation',
      start_date: '2026-02-15',
      end_date: '2026-02-16',
      days_count: 2
    }
  ]
}
```

**9. Reporte legal (manager/admin)**

```tsx
GET /api/attendance/legal-report?start_date=2026-01-01&end_date=2026-12-31

Headers:
  Authorization: Bearer {admin_token}

Response: {
  workshop_name: 'Taller Expert',
  period: '2026-01-01 to 2026-12-31',
  employees: [
    {
      employee_id: UUID,
      employee_name: 'Juan García',
      total_days: 220,
      total_hours: 1848,
      extra_hours: 52,
      vacation_days: 22,
      sick_days: 3
    }
  ],
  export_formats: ['pdf', 'excel', 'csv']
}

Logic:
- Genera informe oficial con firma digital
- Cumple formato requerido por Inspección de Trabajo
- Incluye todos los registros del período
- Conserva durante 4 años
```

#### Interfaz de usuario (empleado):

**Pantalla principal de fichaje:**

```
┌─────────────────────────────────────┐
│  ⏰ CONTROL HORARIO                │
│  👤 Juan García                     │
├─────────────────────────────────────┤
│                                     │
│  📅 Lunes, 10 Febrero 2026          │
│                                     │
│  🟢 Fichado desde: 08:00            │
│  ⏱️ Tiempo trabajado: 3h 30m        │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  🍽️ INICIAR DESCANSO          │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  🚪 FICHAR SALIDA             │  │
│  └───────────────────────────────┘  │
│                                     │
├─────────────────────────────────────┤
│  📊 Esta semana: 22.5h              │
│  📆 Este mes: 85.5h                 │
│  ⭐ Vacaciones restantes: 15 días   │
└─────────────────────────────────────┘
```

**Pantalla cuando NO está fichado:**

```
┌─────────────────────────────────────┐
│  ⏰ CONTROL HORARIO                │
│  👤 Juan García                     │
├─────────────────────────────────────┤
│                                     │
│  📅 Lunes, 10 Febrero 2026          │
│                                     │
│  ⚪ No has fichado entrada aún      │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  ▶️ FICHAR ENTRADA             │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  🏖️ SOLICITAR AUSENCIA         │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

#### Integración con Módulo B (Time Tracking de tareas):

**Diferencias clave:**

- **Módulo G (Control Horario):** Jornada laboral completa (8h típicamente)
- **Módulo B (Task Tracking):** Tiempo en tareas específicas dentro de la jornada

**Relación:**

```tsx
// Un empleado PRIMERO ficha entrada (Módulo G)
POST /api/attendance/clock-in → employee_attendance

// LUEGO trabaja en tareas (Módulo B)
POST /api/time-tracking/start → task_time_logs
POST /api/time-tracking/finish

// Puede hacer múltiples tareas en su jornada
POST /api/time-tracking/start → otra tarea
POST /api/time-tracking/finish

// AL FINAL ficha salida (Módulo G)
POST /api/attendance/clock-out → employee_attendance

// VALIDACIÓN:
SUM(task_time_logs.duration) <= employee_attendance.total_hours
```

**Vista combinada para manager:**

```sql
CREATE VIEW v_employee_daily_summary AS
SELECT 
  ea.employee_id,
  DATE(ea.clock_in) AS date,
  ea.clock_in AS day_start,
  ea.clock_out AS day_end,
  ea.total_hours AS total_workday_hours,
  COALESCE(SUM(ttl.duration_seconds) / 3600, 0) AS task_hours,
  ea.total_hours - COALESCE(SUM(ttl.duration_seconds) / 3600, 0) AS unassigned_hours
FROM employee_attendance ea
LEFT JOIN task_time_logs ttl ON ttl.employee_id = ea.employee_id 
  AND DATE(ttl.started_at) = DATE(ea.clock_in)
WHERE ea.day_type = 'work'
GROUP BY ea.employee_id, DATE(ea.clock_in), ea.clock_in, ea.clock_out, ea.total_hours;
```

Esto permite ver:

- ✅ Cuántas horas trabajó el empleado en total (legal)
- ✅ Cuántas de esas horas están asignadas a tareas (productividad)
- ✅ Cuántas horas están "sin asignar" (reuniones, formación, etc.)

#### Cumplimiento normativo:

**RD-ley 8/2019 (España):**

1. ✅ Registro diario de jornada (clock_in / clock_out)
2. ✅ Conservación 4 años (PostgreSQL + backups)
3. ✅ Accesible a empleados (endpoint /my-report)
4. ✅ Accesible a Inspección (endpoint /legal-report con autenticación)
5. ✅ Sistema fiable (is_locked después de 48h)
6. ✅ Información en tiempo real (Supabase Realtime)
7. ✅ Firma digital en reportes oficiales

**Multas por incumplimiento:**

- Falta leve: 60-625€
- Falta grave: 626-6.250€
- Falta muy grave: 6.251-187.515€

#### Roadmap actualizado:

**SEMANA 1:**

- Añadir Módulo G (Control Horario) junto con Módulo F (State Machine)

**CRITICAL:** El Módulo G debe estar funcional ANTES del lanzamiento a producción para cumplir la ley.

---

## 📋 ROADMAP ACTUALIZADO (Stage 2 + Control Horario)

---

## 🎯 SUCCESS CRITERIA (Definition of Done)

V3 Stage 2 is complete when:

### Functional:

1. ✅ A workshop can create a WO from scratch in <2 minutes
2. ✅ AI extracts assessment data with >80% accuracy
3. ✅ Operators clock in/out correctly on mobile (no Excel)
4. ✅ Material costs are imported automatically
5. ✅ Pre-close modal blocks closing without validation
6. ✅ Dashboards show real and updated data

### Technical:

1. ✅ RLS works correctly (isolated multi-tenant)
2. ✅ Time tracking works offline and syncs
3. ✅ AI executes in <30 seconds per PDF
4. ✅ Material matching is >90% automatic

### Business:

1. ✅ 90% reduction in manual data entry
2. ✅ Real-time profitability visibility
3. ✅ Complete change traceability (audit)
4. ✅ One pilot workshop can work 1 month without Excel

---

## 🚨 RISKS AND MITIGATIONS

### Risk 1: Insufficient AI accuracy

**Probability:** Medium | **Impact:** High

**Mitigation:**

- Implement quick correction UI
- Show confidence score per field
- Allow manual validation when confidence <0.80
- Train model with client's real PDFs

### Risk 2: Low time tracking adoption by operators

**Probability:** Medium | **Impact:** Critical

**Mitigation:**

- Make time tracking MANDATORY (block closing without labor hours)
- Ultra-simple interface (1 big button)
- Works offline (doesn't depend on shop WiFi)
- Gamification: show personal productivity
- Incentives: bonuses based on efficiency

### Risk 3: Material matching with high error rate

**Probability:** High | **Impact:** Medium

**Mitigation:**

- Very fast manual matching UI
- SKU normalization algorithm
- Unified parts catalog
- Learning: system remembers previous matches

### Risk 4: Resistance to pre-close modal

**Probability:** Medium | **Impact:** Low

**Mitigation:**

- Don't block, only require SEE and confirm
- Positive message: "Protect your margin"
- Show statistics: "You've avoided $X in losses this month"
- Review time: <15 seconds

### Risk 5: Performance with many workshops

**Probability:** Low | **Impact:** High

**Mitigation:**

- Well-designed RLS (already in spec)
- Indexes on all foreign keys
- Query optimization from the start
- Dashboard caching (5 minutes)
- Connection pooling in Supabase

