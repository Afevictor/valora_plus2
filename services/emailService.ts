import { ValuationChatMsg } from "../types";
import { supabase, sendMessageToValuation } from './supabaseClient';
import { generateExpertReply } from './geminiService';

const CONFIG_KEY = 'vp_email_config';
const QUEUE_KEY = 'vp_email_queue';

interface QueuedMessage {
    chatId: string;
    senderName: string;
    text: string;
    timestamp: number;
    deliverAt: number; 
}

const scheduleSmartReply = async (to: string, subject: string, relatedId: string, userText: string, vehicleInfo: string) => {
    const senderName = to.split('@')[0].split('.')[0] || 'Expert';
    const cleanSender = senderName.charAt(0).toUpperCase() + senderName.slice(1);

    // 1. Generate Intelligent Reply using Gemini
    console.log("🤖 Generating AI Expert reply...");
    const aiResponseText = await generateExpertReply(userText, vehicleInfo);

    const queue: QueuedMessage[] = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    
    // Check if already queued to avoid dupes
    if (queue.some(m => m.chatId === relatedId && m.deliverAt > Date.now())) return;

    queue.push({
        chatId: relatedId,
        senderName: cleanSender, 
        text: aiResponseText, 
        timestamp: Date.now(),
        deliverAt: Date.now() + 5000 // Deliver in 5 seconds
    });
    
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log("⏳ Smart Reply queued.");
};

export const emailService = {
  
  getConfig: () => {
      const saved = localStorage.getItem(CONFIG_KEY);
      return saved ? JSON.parse(saved) : null;
  },

  /**
   * Opens the user's default email client (mailto:)
   * Uses window.location.href to ensure it triggers correctly even in async contexts.
   */
  openMailClient: (to: string, subject: string, body: string) => {
      const encodedSubject = encodeURIComponent(subject);
      const encodedBody = encodeURIComponent(body);
      const mailtoLink = `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
      
      // Create a temporary link and click it to bypass some popup blockers
      const link = document.createElement('a');
      link.href = mailtoLink;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      return true;
  },

  /**
   * Sends an email via Supabase Edge Function
   */
  sendEmail: async (to: string, subject: string, body: string, relatedId?: string): Promise<{ success: boolean, method: 'edge' | 'local' | 'mailto' }> => {
    const config = emailService.getConfig();
    
    if (!config) {
        console.warn("No email config found.");
        return { success: false, method: 'local' };
    }

    try {
        console.log("🚀 Attempting Supabase Edge Function: send-email...");
        
        // 1. CALL EDGE FUNCTION
        const { data, error } = await supabase.functions.invoke('send-email', {
            body: { 
                recipientEmail: to, 
                subject, 
                message: body 
            }
        });

        if (error) {
            console.warn("⚠️ Edge Function Failed:", error);
            // Return false so UI can handle the fallback
            return { success: false, method: 'local' };
        } else {
            console.log("✅ Email sent via Edge Function:", data);
            
            // VISUAL FEEDBACK (Local)
            showEmailToast(`To: ${to}`, 'Email Sent Successfully', 'bg-blue-600');
            
            return { success: true, method: 'edge' };
        }

    } catch (e) {
        console.error("Critical Email Error (Network/Deploy):", e);
        return { success: false, method: 'local' };
    }
  },

  /**
   * Manually trigger the auto-reply simulation (e.g. after mailto)
   */
  triggerAutoReply: (chatId: string, subject: string, toEmail: string, userMessageText: string, vehicleInfo: string) => {
      scheduleSmartReply(toEmail, subject, chatId, userMessageText, vehicleInfo);
  },

  /**
   * Polls for new "emails" (Mocked IMAP + Database check if implemented)
   * CHECKS LOCAL QUEUE AND INSERTS INTO DB IF TIME IS UP
   */
  checkNewEmails: async () => {
      const queue: QueuedMessage[] = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      const now = Date.now();

      const readyMessages = queue.filter(msg => msg.deliverAt <= now);
      const pendingMessages = queue.filter(msg => msg.deliverAt > now);

      if (readyMessages.length > 0) {
          // Update queue to remove delivered messages
          localStorage.setItem(QUEUE_KEY, JSON.stringify(pendingMessages));
          
          console.log(`📧 [Smart Inbox] Processing ${readyMessages.length} new messages...`);
          
          for (const msg of readyMessages) {
              // 1. Show Toast
              showEmailToast(msg.senderName, 'New Email Reply', 'bg-green-600');

              // 2. INSERT INTO DB (This triggers Realtime in UI)
              await sendMessageToValuation({
                  valuation_id: msg.chatId,
                  sender: 'Expert', // It comes from Expert
                  content: msg.text,
                  delivery_status: 'delivered',
                  is_email: true
              });
          }
      }

      return readyMessages;
  }
};

// Helper to inject a temporary toast notification into the DOM
const showEmailToast = (text: string, title: string, colorClass: string) => {
  let container = document.getElementById('toast-container');
  if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  
  toast.className = `${colorClass} text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-4 max-w-md transform transition-all duration-500 translate-y-10 opacity-0`;
  toast.innerHTML = `
    <div class="text-2xl">✉️</div>
    <div>
      <h4 class="font-bold text-sm uppercase tracking-wide opacity-90">${title}</h4>
      <p class="text-xs opacity-90 truncate max-w-[250px]">${text}</p>
    </div>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
      toast.classList.remove('translate-y-10', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => {
      if(container && container.contains(toast)) {
        container.removeChild(toast);
      }
    }, 500);
  }, 4000);
};