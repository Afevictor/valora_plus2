
import React, { useState, useEffect } from 'react';
import { notificationService } from '../services/notificationService';
import { AppNotification } from '../types';

const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = () => {
    const notes = notificationService.getAll();
    setNotifications(notes);
    setUnreadCount(notes.filter(n => !n.read).length);
  };

  useEffect(() => {
    loadNotifications();
    window.addEventListener('notificationUpdated', loadNotifications);
    return () => window.removeEventListener('notificationUpdated', loadNotifications);
  }, []);

  const handleMarkRead = (id: string) => {
      notificationService.markAsRead(id);
  };

  const handleClear = () => {
      notificationService.clearAll();
  };

  return (
    <div className="relative border-b border-slate-100 p-4">
        {/* Bell Icon */}
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className="relative text-slate-500 hover:text-brand-600 transition-colors w-full flex items-center gap-3"
        >
            <div className="relative">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {unreadCount}
                    </span>
                )}
            </div>
            <span className="font-medium text-sm text-slate-700">Notifications</span>
        </button>

        {/* Dropdown Panel */}
        {isOpen && (
            <div className="absolute left-0 top-full mt-2 w-full lg:w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-fade-in-up">
                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-500 uppercase">Notification Center</h3>
                    {notifications.length > 0 && (
                        <button onClick={handleClear} className="text-xs text-brand-600 hover:underline">Clear All</button>
                    )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-xs">
                            You have no notifications.
                        </div>
                    ) : (
                        notifications.map(note => (
                            <div 
                                key={note.id} 
                                onClick={() => handleMarkRead(note.id)}
                                className={`p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${note.read ? 'opacity-50' : 'bg-white'}`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                                        note.type === 'success' ? 'bg-green-500' :
                                        note.type === 'alert' ? 'bg-red-500' :
                                        note.type === 'chat' ? 'bg-purple-500' : 'bg-blue-500'
                                    }`}></div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{note.title}</p>
                                        <p className="text-xs text-slate-500">{note.message}</p>
                                        <p className="text-[10px] text-slate-400 mt-1">{new Date(note.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}
    </div>
  );
};

export default NotificationCenter;
