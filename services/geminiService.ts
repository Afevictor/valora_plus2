
import { GoogleGenAI, Chat, Type } from "@google/genai";

// Initialize the Gemini API client. 
// We try to get the key from multiple possible environment variable names used in Vite.
const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.API_KEY || (process as any).env?.API_KEY || '';
const genAI = new GoogleGenAI({ apiKey });

// System instruction for the chat assistant
const SYSTEM_INSTRUCTION = `
You are the virtual assistant for "Valora Plus", a DMS platform for automotive workshops.
You help with workshop management, CRM, and technical explanations.
`;

export const createChatSession = (): Chat => {
  return genAI.chats.create({
    model: 'gemini-1.5-pro',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7,
    },
  });
};

export const analyzeDamageImage = async (base64Image: string): Promise<string> => {
  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Analyze this image of a vehicle. Identify visible damage." }
        ]
      }
    });
    return response.text || "Could not analyze the image.";
  } catch (error) {
    console.error("Error analyzing image:", error);
    return "Error connecting to service.";
  }
};

/**
 * Generates a realistic response from an Automotive Expert.
 */
export const generateExpertReply = async (
  userMessage: string,
  vehicleContext: string
): Promise<string> => {
  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: {
        parts: [{
          text: `You are a professional automotive expert/appraiser working for an insurance company. 
          You are chatting with a workshop mechanic about a claim.
          
          Context:
          - Vehicle: ${vehicleContext}
          - The mechanic just said: "${userMessage}"
          
          Task:
          Write a short, professional, and natural reply (2-3 sentences max).
          If they ask for approval, either grant it or ask for a specific photo.
          If they report damage, acknowledge it.
          Do NOT sign the message. Keep it conversational but professional.`
        }]
      }
    });
    return response.text || "Received. We are reviewing the file.";
  } catch (error) {
    console.error("Reply Error:", error);
    return "Thank you for the update. We will review the file shortly.";
  }
};

/**
 * Analyzes a batch of images.
 * 1. Classifies them into categories (FrontLeft, VIN, Odometer, etc.)
 * 2. Extracts technical data (Plate, VIN, KM).
 */
export const analyzeVehicleReceptionBatch = async (
  files: { data: string; mimeType: string }[]
): Promise<{
  data: { plate: string; vin: string; km: number; brand: string; model: string };
  classification: { [key: string]: number };
}> => {
  try {
    const parts: any[] = [];

    // Add all files (Images and PDFs) to the prompt
    files.forEach((file, index) => {
      // Strip prefix if present
      const base64Data = file.data.includes('base64,') ? file.data.split(',')[1] : file.data;
      const mime = file.mimeType.startsWith('image/') ? 'image/jpeg' : 'application/pdf';

      parts.push({
        inlineData: {
          mimeType: mime,
          data: base64Data
        }
      });
      parts.push({ text: `[File_ID_${index}] - Type: ${file.mimeType}` });
    });

    parts.push({
      text: `Act as an expert workshop receptionist and OCR system.
      I have uploaded several files (photos and documents) of a vehicle.
      
      TASK 1: CLASSIFICATION
      Identify which [File_ID_x] best matches each category. Categories: FrontLeft, FrontRight, RearLeft, RearRight, VIN, Odometer, Docs.
      
      TASK 2: DATA EXTRACTION
      Read the License Plate, VIN, Odometer (KM), and visual Brand/Model from the files.
      If it's a PDF document (like a registration or quote), prioritize extracting data from it.
      
      RETURN ONLY JSON:
      {
        "classification": { "FrontLeft": 0, "FrontRight": 1, "RearLeft": 2, "RearRight": 3, "VIN": 4, "Odometer": 5, "Docs": 6 },
        "data": { "plate": "string", "vin": "string", "km": 0, "brand": "string", "model": "string" }
      }`
    });

    const response = await genAI.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: { parts },
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || "";
    if (!text) throw new Error("No data returned");

    const cleanJson = (str: string) => {
      try {
        return JSON.parse(str);
      } catch (e) {
        let cleaned = str.replace(/```json/g, "").replace(/```/g, "").trim();
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
          cleaned = cleaned.substring(start, end + 1);
        }
        return JSON.parse(cleaned);
      }
    };

    const result = cleanJson(text);
    return {
      classification: result.classification || {},
      data: result.data || { plate: '', vin: '', km: 0, brand: '', model: '' }
    };

  } catch (error) {
    console.error("Error in Batch Analysis:", error);
    return {
      data: { plate: '', vin: '', km: 0, brand: '', model: '' },
      classification: {}
    };
  }
};

export const analyzeProfitabilityDocument = async (base64Data: string, mimeType: string = 'application/pdf') => {
  console.log("Starting Local Extraction (Enhanced)...");

  try {
    let fullText = "";
    const binaryString = atob(base64Data);

    if (mimeType.includes("pdf")) {
      try {
        // @ts-ignore
        const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/+esm');
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

        const loadingTask = pdfjs.getDocument({ data: binaryString });
        const pdf = await loadingTask.promise;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + "\n";
        }
      } catch (pdfError) {
        console.error("PDF Parsing Error:", pdfError);
        throw new Error("No se pudo leer el texto del PDF.");
      }
    } else {
      throw new Error("La extracción local solo soporta PDFs de texto.");
    }

    // Helper to clean numbers: "3.732,60" -> 3732.6
    const cleanNum = (str: string) => {
      if (!str) return 0;
      return parseFloat(str.replace(/\./g, '').replace(',', '.'));
    };

    // --- REGEX PATTERNS ---
    
    // Total (Generic / GT Motive)
    const totalMatch = fullText.match(/asciende\s+a\s+([\d.]+,\d{2})/i) || fullText.match(/TOTAL\s+\(menos\s+franquicia\)\s+([\d.]+,\d{2})/i) || fullText.match(/TOTAL\s+VALORACION\s+([\d.]+,\d{2})/i);
    
    // Vehicle Data
    const plateMatch = fullText.match(/Matrícula\s+([A-Z0-9-]{6,10})/i);
    const vinMatch = fullText.match(/Nº\s+ID\s+del\s+vehículo\s+([A-Z0-9]{17,})/i) || fullText.match(/Bastidor\s+([A-Z0-9]{17,})/i);
    const brandModelMatch = fullText.match(/(Mercedes-Benz|Audi|BMW|Volkswagen|Renault|Peugeot|Citroen|Seat|Toyota|Ford|Nissan|Hyundai|Kia)\s+[^(\n]+/i);
    
    // Detailed Totals
    const partsMatch = fullText.match(/Total\s+recambios\s+([\d.]+,\d{2})/i) || fullText.match(/TOTAL\s+RECAMBIOS\s+([\d.]+,\d{2})/i);
    const laborMatch = fullText.match(/Total\s+MO\s+([\d.]+,\d{2})/i) || fullText.match(/TOTAL\s+MANO\s+DE\s+OBRA\s+([\d.]+,\d{2})/i);
    const paintLaborMatch = fullText.match(/Total\s+MO\s+pintura\s+([\d.]+,\d{2})/i) || fullText.match(/TOTAL\s+PINTURA\s+([\d.]+,\d{2})/i);
    const paintMaterialMatch = fullText.match(/Subtotal\s+material\s+([\d.]+,\d{2})/i) || fullText.match(/TOTAL\s+MATERIAL\s+DE\s+PINTURA\s+([\d.]+,\d{2})/i);
    const baseMatch = fullText.match(/Base\s+imponible\s+([\d.]+,\d{2})/i) || fullText.match(/TOTAL\s+NETO\s+([\d.]+,\d{2})/i);

    const data = {
      matricula: plateMatch ? plateMatch[1].trim() : "S/D",
      bastidor: vinMatch ? vinMatch[1].trim() : "S/D",
      fabricante: brandModelMatch ? brandModelMatch[1].trim() : "Detectado",
      modelo: brandModelMatch ? brandModelMatch[0].trim() : "Modelo",
      totales: {
        total_gross: totalMatch ? cleanNum(totalMatch[1]) : 0,
        subtotal_neto: baseMatch ? cleanNum(baseMatch[1]) : 0,
        repuestos: partsMatch ? cleanNum(partsMatch[1]) : 0,
        mo_chapa: laborMatch ? cleanNum(laborMatch[1]) : 0,
        mo_pintura: paintLaborMatch ? cleanNum(paintLaborMatch[1]) : 0,
        mat_pintura: paintMaterialMatch ? cleanNum(paintMaterialMatch[1]) : 0
      }
    };

    // Fallback net if only gross is found
    if (data.totales.total_gross > 0 && data.totales.subtotal_neto === 0) {
      data.totales.subtotal_neto = data.totales.total_gross / 1.21;
    }

    return {
      success: true,
      vehicle: { 
        make_model: data.modelo, 
        plate: data.matricula, 
        vin: data.bastidor,
        brand: data.fabricante 
      },
      financials: { 
        total_gross: data.totales.total_gross, 
        total_net: data.totales.subtotal_neto,
        parts_total: data.totales.repuestos,
        labor_total: data.totales.mo_chapa,
        paint_labor: data.totales.mo_pintura,
        paint_material: data.totales.mat_pintura
      },
      analysis: { 
        summary: `Extracción local exitosa: ${data.totales.total_gross}€`, 
        profitability_rating: data.totales.total_gross > 2000 ? "High" : "Medium" 
      }
    };

  } catch (error) {
    console.error("Local Extraction Failed:", error);
    return {
      success: false,
      financials: { total_gross: 0 },
      analysis: { summary: `Error: ${error instanceof Error ? error.message : "Error desconocido"}` },
    };
  }
};

// Helper for clean JSON parsing
const cleanJsonInput = (str: string) => {
  try {
    let cleaned = str.replace(/```json/g, "").replace(/```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1) cleaned = cleaned.substring(start, end + 1);
    return JSON.parse(cleaned);
  } catch (e) {
    return {};
  }
};

const fallbackResult = (reason: string) => ({
  vehicle: { make_model: "Pendiente", plate: "S/D", vin: "S/D", owner: "Proceso" },
  financials: { total_net: 0, total_gross: 0, parts_total: 0, labor_total: 0, paint_material_total: 0, labor_hours: 0, labor_rate: 0 },
  analysis: { summary: `ERROR: ${reason}`, profitability_rating: "Medium" },
  metadata: { file_ref: "MANUAL-REVIEW" }
});
