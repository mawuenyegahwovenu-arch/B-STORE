import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const NoticeModal = () => {
  const { user } = useAuth();
  const [notice, setNotice] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchLatestNotice();

    const channel = supabase
      .channel('notice-modal-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          setNotice(payload.new);
          setIsOpen(true);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  const fetchLatestNotice = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !data || !data[0]) return;

      const latest = data[0];
      const key = `bstore_dismissed_notice_${user.id}`;
      const dismissedNoticeId = localStorage.getItem(key);

      if (dismissedNoticeId !== latest.id) {
        setNotice(latest);
        setIsOpen(true);
      }
    } catch (err) {
      console.error('Error fetching notice:', err);
    }
  };

  const handleDismiss = () => {
    if (notice && user) {
      const key = `bstore_dismissed_notice_${user.id}`;
      localStorage.setItem(key, notice.id);
    }
    setIsOpen(false);
  };

  if (!isOpen || !notice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md p-6 bg-white rounded-2xl shadow-2xl">
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
        >
          &times;
        </button>

        <div className="mb-4">
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-900 bg-indigo-100 rounded-full">
            📢 Announcement
          </span>
          <h2 className="mt-2 text-xl font-bold text-gray-900">
            {notice.title || 'Important Notice'}
          </h2>
        </div>

        <div className="mb-6 text-sm leading-relaxed text-gray-600">
          <p>{notice.message}</p>
        </div>

        <div>
          <button
            onClick={handleDismiss}
            className="w-full py-3 px-4 bg-indigo-900 hover:bg-indigo-800 text-white font-semibold text-sm rounded-xl shadow transition duration-200"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoticeModal;