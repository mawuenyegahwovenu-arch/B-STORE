import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: email,
            full_name: fullName,
            phone: phone,
            role: 'customer',
          });

        if (insertError) {
          setError('Account created but profile failed: ' + insertError.message);
          setLoading(false);
          return;
        }

        setMessage('Account created! You can now log in.');
        setMode('login');
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      navigate('/');
    }

    setLoading(false);
  }

  async function handleSendReset(e) {
    e.preventDefault();
    setResetError('');
    setResetMessage('');
    setResetLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setResetError(error.message);
      setResetLoading(false);
      return;
    }

    setResetMessage('✅ Reset link sent! Check your email inbox (and spam folder).');
    setResetLoading(false);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-indigo-900 uppercase">B STORE</h1>
          <p className="text-sm text-gray-500 mt-1 uppercase">
            {mode === 'login' ? 'WELCOME BACK' : 'CREATE YOUR ACCOUNT'}
          </p>
        </div>

        <div className="flex border-b mb-6">
          <button
            onClick={() => { setMode('login'); setError(''); setMessage(''); }}
            className={`flex-1 pb-2 font-bold text-sm uppercase ${mode === 'login' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
          >
            LOG IN
          </button>
          <button
            onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
            className={`flex-1 pb-2 font-bold text-sm uppercase ${mode === 'signup' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-gray-500'}`}
          >
            SIGN UP
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 uppercase">FULL NAME</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 uppercase">PHONE</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 uppercase">EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 uppercase">PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          {mode === 'login' && (
            <div className="text-right -mt-2">
              <button
                type="button"
                onClick={() => { setShowForgot(true); setResetEmail(''); setResetMessage(''); setResetError(''); }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold uppercase"
              >
                FORGOT PASSWORD?
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-xs px-3 py-2 rounded-lg">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full font-bold py-2.5 rounded-lg transition text-sm uppercase ${mode === 'login' ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'} ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {loading ? 'PLEASE WAIT...' : mode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}
          </button>
        </form>
      </div>

      {showForgot && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🔐</div>
              <h3 className="text-lg font-bold text-gray-800 uppercase">RESET YOUR PASSWORD</h3>
            </div>

            <p className="text-sm text-gray-600 text-center mb-4">
              Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSendReset} className="space-y-3 mb-4">
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                placeholder="YOUR EMAIL ADDRESS"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
              />

              {resetError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                  {resetError}
                </div>
              )}

              {resetMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs px-3 py-2 rounded-lg">
                  {resetMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg text-sm disabled:opacity-60 uppercase"
              >
                {resetLoading ? 'SENDING...' : '📧 SEND RESET LINK'}
              </button>
            </form>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="text-xs text-gray-400 uppercase">OR</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            <a
              href="https://wa.me/233597699623?text=Hi%2C%20I%20need%20help%20resetting%20my%20B%20STORE%20password"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg text-center text-sm mb-2 uppercase"
            >
              📲 CHAT ON WHATSAPP
            </a>

            <button
              onClick={() => setShowForgot(false)}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 rounded-lg text-sm uppercase"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}