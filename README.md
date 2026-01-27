<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Valora Plus

**Valora Plus** is a platform designed for vehicle repair workshops to improve claims management and understand the real profitability of their repairs. 

It is built on two core pillars: **independent damage assessment** and **post-repair profitability analytics**.

## Core Pillars

### 1. Independent Damage Assessment
Valora Plus provides workshops with independent expert damage assessment reports. 
- **Workflow:** Workshops upload accident data and photos.
- **Output:** Within 24 hours, they receive an expert report used to negotiate effectively with insurance companies.
- **Goal:** Help workshops defend valuations and aim for fair compensation.
- *Note:* At this stage, only independent/expert/estimated profitability can be calculated.

### 2. Valora Plus Analytics
Focuses on calculating the **actual profitability** of each repair once the work is completed.
- **Comparison:** Compares what the insurance company paid (final assessment) vs. real costs (labor, materials, paint).
- **AI Automation:** Uses AI to extract data automatically from insurer PDFs.
- **Reporting:** Generates detailed profitability reports (Euros & %) with category breakdowns.
- **Long-term Goal:** Build a historical profitability database and provide transparency into workshop performance.

## Getting Started

### Prerequisites
- Node.js
- Supabase Account

### Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables in `.env.local`:
   - `GEMINI_API_KEY` (for AI features)
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

3. Run the app:
   ```bash
   npm run dev
   ```
