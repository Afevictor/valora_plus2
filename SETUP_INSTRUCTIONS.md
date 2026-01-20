# 🚀 Quick Setup Instructions for DOCS Tab

## Step 1: Create Database Table

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project: `igwbevwytsufppqohtsh`

2. **Run SQL Script**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"
   - Copy the entire contents of `sql_workshop_files.sql`
   - Paste into the SQL editor
   - Click "Run" or press `Ctrl+Enter`

3. **Verify Table Created**
   - Go to "Table Editor" in the left sidebar
   - You should see a new table called `workshop_files`
   - Click on it to verify the columns

## Step 2: Verify Storage Buckets

1. **Go to Storage**
   - Click "Storage" in the left sidebar

2. **Check These Buckets Exist**:
   - ✅ `evidence_photos`
   - ✅ `videos`
   - ✅ `documents`
   - ✅ `attachments` (for chat/valuation files)

3. **If Missing, Create Them**:
   - Click "New bucket"
   - Name: (e.g., `evidence_photos`)
   - Public bucket: ✅ Yes (or set up RLS policies)
   - Click "Create bucket"

## Step 3: Set Storage Policies (Optional but Recommended)

For each bucket, you can set up Row Level Security policies:

```sql
-- Allow authenticated users to upload to their own folders
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'evidence_photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to read from their own folders
CREATE POLICY "Users can read own folder"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'evidence_photos' AND (storage.foldername(name))[1] = auth.uid()::text);
```

**OR** simply make the buckets public (easier for testing):
- In Storage → Click bucket → Settings → Make public

## Step 4: Test the Application

1. **Restart Dev Server** (if running):
   ```bash
   # Press Ctrl+C to stop
   npm run dev
   ```

2. **Create a Test Entry**:
   - Navigate to "Nueva Entrada a Taller" or "New Entry"
   - Select a client
   - Upload some test files:
     - At least 1 photo (will go to `evidence_photos`)
     - At least 1 PDF (will go to `documents`)
     - Optional: 1 video (will go to `videos`)
   - Assign categories to each file
   - Complete the entry

3. **View the DOCS Tab**:
   - Go to "Planificador de Taller" (Kanban)
   - Click on the entry you just created
   - Click the "DOCS" tab
   - You should see all your uploaded files organized by category!

## Step 5: Test Valuation Report Upload

1. **Move Entry to Finished**:
   - Drag the work order to "Listo para Entrega"
   - Upload a test PDF as the valuation report
   - Click "Finalizar Entrega"

2. **Check DOCS Tab Again**:
   - Open the expediente
   - Go to DOCS tab
   - You should see the valuation report in the purple "Informes de Valoración" section

## Troubleshooting

### ❌ "Files not displaying"
- Check browser console (F12) for errors
- Verify SQL script ran successfully
- Check that `workshop_files` table has data:
  ```sql
  SELECT * FROM workshop_files LIMIT 10;
  ```

### ❌ "Download not working"
- Check storage bucket is public OR has correct RLS policies
- Verify files exist in Supabase Storage
- Check browser console for CORS errors

### ❌ "Upload failing"
- Check storage bucket exists
- Verify user is authenticated
- Check browser console for error messages

## Expected Result

When you open the DOCS tab, you should see:

```
📋 Documentación del Expediente

🟣 Informes de Valoración (1)
   [Card with PDF download button]

🔵 Documentos Generales (2)
   [Cards with document download buttons]

🟢 Fotografías (5)
   [Grid of image thumbnails]

🔴 Videos (1)
   [Card with video download button]
```

## Need Help?

If something isn't working:
1. Check the browser console (F12)
2. Check Supabase logs
3. Verify the SQL table was created
4. Make sure storage buckets exist
5. Review `DOCS_TAB_IMPLEMENTATION.md` for detailed troubleshooting
