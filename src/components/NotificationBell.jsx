import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function loadNotifications() {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications(data || []);
  }

  async function markAsRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    loadNotifications();
  }

  async function markAllRead() {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    for (const id of unreadIds) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    }
    loadNotifications();
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative bg-indigo-700 hover:bg-indigo-600 px-3 py-1.5 rounded-lg"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-40 z-40 md:hidden"
            onClick={() => setOpen(false)}
          />

          {/* Panel - full width on mobile, compact on desktop */}
          <div className="fixed md:absolute top-16 md:top-auto right-2 left-2 md:left-auto md:right-0 md:mt-2 md:w-96 bg-white text-gray-800 rounded-xl shadow-2xl border z-50 max-h-[80vh] md:max-h-96 flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b">
              <h3 className="font-bold text-sm">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-indigo-600 hover:underline">
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none md:hidden"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">No notifications yet.</p>
              ) : (
                <div className="divide-y">
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && markAsRead(n.id)}
                      className={`px-4 py-3 text-sm cursor-pointer hover:bg-gray-50 ${!n.is_read ? 'bg-indigo-50' : ''}`}
                    >
                      <p className="font-semibold text-gray-800 break-words">{n.title}</p>
                      <p className="text-gray-600 text-xs mt-0.5 break-words">{n.message}</p>
                      <p className="text-gray-400 text-[10px] mt-1">
                        {new Date(n.created_at).toLocaleString('en-GB')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}