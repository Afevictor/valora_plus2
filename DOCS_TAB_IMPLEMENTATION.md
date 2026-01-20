# Workshop Files Documentation - DOCS Tab Implementation

## Overview
This document explains the implementation of the DOCS tab in the ExpedienteDetail component and the database setup required for storing and displaying uploaded files.

## Database Setup

### 1. Create the `workshop_files` Table
Run the SQL script in `sql_workshop_files.sql` to create the table in your Supabase database:

```sql
CREATE TABLE IF NOT EXISTS workshop_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expediente_id TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    category TEXT,
    storage_path TEXT NOT NULL,
    bucket TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Storage Buckets
Ensure you have the following Supabase Storage buckets created:
- `evidence_photos` - For photos uploaded during reception
- `videos` - For video files
- `documents` - For PDF and other documents

### 3. Storage Bucket Policies
Make sure each bucket has appropriate RLS policies to allow:
- Users to upload files to their own workshop folders
- Users to read files from their own workshop folders

## File Upload Flow

### During "New Entry" (NewAppraisal.tsx)
When a user creates a new workshop entry:

1. **Files are staged** with categories (Daño Frontal, Ficha Técnica, etc.)
2. **Files are uploaded** to Supabase Storage in the appropriate bucket
3. **Metadata is saved** to the `workshop_files` table with:
   - `workshop_id`: Current user's ID
   - `expediente_id`: Work order ID
   - `original_filename`: Original file name
   - `category`: User-selected category
   - `storage_path`: Path in storage
   - `bucket`: Storage bucket name
   - `mime_type`: File MIME type
   - `size_bytes`: File size

### During "Closure" (RepairKanban.tsx)
When closing a work order:

1. **Valuation report is uploaded** as a PDF or image
2. **Metadata is saved** with category "Valuation Report"
3. **Work order status** is updated to "finished"

## DOCS Tab Display

### File Categories Displayed:

1. **Informes de Valoración (Valuation Reports)** - Purple theme
   - Files with `category = 'Valuation Report'`
   - Typically PDFs from insurance companies

2. **Documentos Generales (General Documents)** - Blue theme
   - Files in `bucket = 'documents'` (excluding valuation reports)
   - PDFs, invoices, technical sheets, etc.

3. **Fotografías (Photos)** - Green theme
   - Files in `bucket = 'evidence_photos'`
   - Image thumbnails with hover zoom
   - Organized in responsive grid

4. **Videos** - Red theme
   - Files in `bucket = 'videos'`
   - Video files with play icon

### Features:
- ✅ Download functionality for all files
- ✅ Loading states during download
- ✅ File metadata display (name, upload date)
- ✅ Responsive grid layouts
- ✅ Empty state when no files exist
- ✅ Color-coded sections
- ✅ File count badges

## Testing Checklist

### Before Testing:
1. ✅ Run `sql_workshop_files.sql` in Supabase SQL Editor
2. ✅ Verify storage buckets exist
3. ✅ Check RLS policies on storage buckets
4. ✅ Restart your dev server (`npm run dev`)

### Test Scenarios:
1. **Create New Entry**:
   - Upload photos, videos, and documents
   - Assign categories to each file
   - Complete the entry
   - Navigate to the expediente detail page
   - Click on "DOCS" tab
   - Verify all files appear in correct sections

2. **Close Work Order**:
   - Drag a work order to "Listo para Entrega"
   - Upload a valuation report PDF
   - Complete the closure
   - Open the expediente
   - Verify the report appears in "Informes de Valoración"

3. **Download Files**:
   - Click download button on any file
   - Verify file downloads correctly
   - Check loading state appears during download

## Troubleshooting

### Files Not Appearing?
1. Check browser console for errors
2. Verify `workshop_files` table exists in Supabase
3. Check that files were actually uploaded to storage
4. Verify `expediente_id` matches between work_orders and workshop_files

### Download Not Working?
1. Check storage bucket is public or has correct RLS policies
2. Verify `publicUrl` is being generated correctly
3. Check browser console for CORS errors

### Empty State Always Showing?
1. Verify data is in `workshop_files` table
2. Check `getFilesForExpediente` function is being called
3. Verify `expediente_id` parameter is correct
4. Check browser network tab for API calls

## Code Changes Made

### Files Modified:
1. `components/ExpedienteDetail.tsx` - Added complete DOCS tab UI
2. `components/NewAppraisal.tsx` - Fixed metadata field name
3. `components/RepairKanban.tsx` - Fixed metadata field name

### Files Created:
1. `sql_workshop_files.sql` - Database schema

### Key Changes:
- Changed `name` → `original_filename` in metadata saves
- Added complete DOCS tab with 4 file category sections
- Implemented download functionality with loading states
- Added empty state handling
