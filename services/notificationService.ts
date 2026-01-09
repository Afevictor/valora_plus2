import { AppNotification } from '../types';

const STORAGE_KEY = 'vp_notifications';

export const notificationService = {
  getAll: (): AppNotification[] => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  },

  add: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const current = notificationService.getAll();
    const newNote: AppNotification = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      read: false,
      ...notification
    };
    const updated = [newNote, ...current];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    // Dispatch event for UI updates
    window.dispatchEvent(new Event('notificationUpdated'));
  },

  markAsRead: (id: string) => {
    const current = notificationService.getAll();
    const updated = current.map(n => n.id === id ? { ...n, read: true } : n);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('notificationUpdated'));
  },
  
  markAllRead: () => {
    const current = notificationService.getAll();
    const updated = current.map(n => ({ ...n, read: true }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('notificationUpdated'));
  },

  clearAll: () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      window.dispatchEvent(new Event('notificationUpdated'));
  }
};
