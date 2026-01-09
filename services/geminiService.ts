
import { GoogleGenAI, Chat, Type } from "@google/genai";

// Fixed: Initialize the Gemini API client directly with the environment variable as per coding guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// System instruction for the chat assistant
const SYSTEM_INSTRUCTION = `
You are the virtual assistant for "Valora Plus", a DMS platform for automotive workshops.
You help with workshop management, CRM, and technical explanations.
`;

export const createChatSession = (): Chat => {
  return ai.chats.create({
    model: 'gemini-3-flash-preview', 
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7,
    },
  });
};

export const analyzeDamageImage = async (base64Image: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
    return "Error connecting to AI service.";
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
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
    console.error("AI Reply Error:", error);
    return "Thank you for the update. We will review the file shortly.";
  }
};

/**
 * Analyzes a batch of images.
 * 1. Classifies them into categories (FrontLeft, VIN, Odometer, etc.)
 * 2. Extracts technical data (Plate, VIN, KM).
 */
export const analyzeVehicleReceptionBatch = async (
  imagesBase64: string[]
): Promise<{ 
  data: { plate: string; vin: string; km: number; brand: string; model: string };
  classification: { [key: string]: number }; // e.g. { "VIN": 2, "Odometer": 0 }
}> => {
  try {
    const parts: any[] = [];
    
    // Add all images to the prompt
    imagesBase64.forEach((img, index) => {
      // Strip prefix if present
      const base64Data = img.includes('base64,') ? img.split(',')[1] : img;
      
      parts.push({ 
        inlineData: { 
          mimeType: 'image/jpeg', 
          data: base64Data
        } 
      });
      parts.push({ text: `[Image_ID_${index}]` });
    });

    parts.push({ 
      text: `Act as an expert workshop receptionist and OCR system.
      I have uploaded several photos of a vehicle.
      
      TASK 1: CLASSIFICATION
      Identify which [Image_ID_x] best matches each category:
      - FrontLeft
      - FrontRight
      - RearLeft
      - RearRight
      - VIN (Vehicle Identification Number)
      - Odometer (Instrument cluster)
      - Docs
      
      TASK 2: DATA EXTRACTION
      Read the License Plate, VIN (from chassis or windshield), Odometer reading (KM), and visual Brand/Model.
      ` 
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            classification: {
              type: Type.OBJECT,
              properties: {
                FrontLeft: { type: Type.INTEGER },
                FrontRight: { type: Type.INTEGER },
                RearLeft: { type: Type.INTEGER },
                RearRight: { type: Type.INTEGER },
                VIN: { type: Type.INTEGER },
                Odometer: { type: Type.INTEGER },
                Docs: { type: Type.INTEGER }
              },
              required: ["FrontLeft", "FrontRight", "RearLeft", "RearRight", "VIN", "Odometer", "Docs"]
            },
            data: {
              type: Type.OBJECT,
              properties: {
                plate: { type: Type.STRING },
                vin: { type: Type.STRING },
                km: { type: Type.NUMBER },
                brand: { type: Type.STRING },
                model: { type: Type.STRING }
              },
              required: ["plate", "vin", "km", "brand", "model"]
            }
          },
          required: ["classification", "data"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No data returned");
    
    return JSON.parse(text);

  } catch (error) {
    console.error("Error in AI Batch Analysis:", error);
    return { 
      data: { plate: '', vin: '', km: 0, brand: '', model: '' },
      classification: {} 
    };
  }
};

export const analyzeProfitabilityDocument = async (base64Data: string, mimeType: string = 'image/jpeg') => {
  try {
    console.log("Starting analysis with MIME:", mimeType);
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } },
          { 
            text: `Act as a Spanish Automotive Data Extractor.
            I am providing a document of a "Peritación" (Appraisal), "Presupuesto" (Estimate), or "Factura" (Invoice).
            It might be a "SilverDAT", "Audatex", or "GT Motive" document.

            TASK:
            Extract vehicle details, financial summaries, and technical metadata.
            Convert all numeric values to standard numbers.

            SPANISH KEYWORDS TO LOOK FOR:
            1. VEHICLE: "Matrícula", "Placa", "Bastidor", "VIN", "Marca", "Modelo".
            2. FINANCIALS: "Mano de Obra", "Recambios", "Material Pintura", "Base Imponible", "Total Neto", "Total", "Horas", "Precio Hora".
            3. METADATA: "Nº Valoración", "Referencia", "Fecha".
            ` 
          }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vehicle: {
              type: Type.OBJECT,
              properties: {
                make_model: { type: Type.STRING },
                plate: { type: Type.STRING },
                vin: { type: Type.STRING },
                year: { type: Type.STRING }
              },
              required: ["make_model", "plate", "vin", "year"]
            },
            financials: {
              type: Type.OBJECT,
              properties: {
                total_net: { type: Type.NUMBER },
                total_gross: { type: Type.NUMBER },
                parts_total: { type: Type.NUMBER },
                labor_total: { type: Type.NUMBER },
                paint_material_total: { type: Type.NUMBER },
                labor_hours: { type: Type.NUMBER },
                labor_rate: { type: Type.NUMBER }
              },
              required: ["total_net", "total_gross", "parts_total", "labor_total", "paint_material_total", "labor_hours", "labor_rate"]
            },
            metadata: {
              type: Type.OBJECT,
              properties: {
                doc_number: { type: Type.STRING },
                date: { type: Type.STRING },
                confidence_score: { type: Type.NUMBER }
              },
              required: ["doc_number", "date", "confidence_score"]
            },
            ai_analysis: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                profitability_rating: { type: Type.STRING },
                risk_factors: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["summary", "profitability_rating", "risk_factors"]
            }
          },
          required: ["vehicle", "financials", "metadata", "ai_analysis"]
        }
      }
    });

    let text = response.text;
    if (!text) throw new Error("No data returned from Gemini");
    
    // Clean up potential conversational text or markdown (though schema should prevent it)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        text = jsonMatch[0];
    }

    try {
        return JSON.parse(text);
    } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        return null;
    }

  } catch (error) {
    console.error("Error analyzing profitability document:", error);
    return null;
  }
};
