# FIX: Supabase Storage & Database Setup

## 1. Storage Permissions (Manual Step)
If you encounter permission errors, you must configure buckets in the Supabase Dashboard:

1.  **Log in to Supabase Dashboard > Storage**.
2.  **Create Buckets**: `reception-files` and `documents`. Ensure **"Public"** is checked.
3.  **Add Policies**:
    *   Select `reception-files` -> Policies -> New Policy -> For full customization.
    *   Name: "Allow All"
    *   Operations: SELECT, INSERT, UPDATE, DELETE.
    *   USING: `true`
    *   WITH CHECK: `true`
    *   *Repeat for `documents` bucket.*

## 2. Database Schema (New Table)
We have switched to a new table `ai_extraction_files` for AI uploads.
Ensure you have run the `create_ai_files_table.sql` script in the SQL Editor to create this table.

## 3. Filename Sanitization
Filenames are now automatically sanitized (e.g., `My File (1).pdf` -> `My_File_1_.pdf`) to prevent "Invalid Key" errors in storage.

## 4. Edge Function
If the AI extraction process (Edge Function) is offline, the file will still be saved successfully. You can retry processing later when the backend is deployed.
