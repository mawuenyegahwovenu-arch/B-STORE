import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const PAYSTACK_PUBLIC_KEY = 'pk_live_af38a972a9bc58d04951d3cc2c4350e9d0906405';
const MOMO_NUMBER = '0597699623';
const MOMO_NAME = 'MAWUEWOE WOVENU';
const FEE_GHS = 20;

export default function BecomeSeller() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [paymentDone, setPaymentDone] = useState(false);
  const [txnId, setTxnId] = useState('');
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    whatsapp: '',
    region: '',
    address: '',
    location_1: '',
    location_2: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm({ ...form, [field]: value });
  }

  function copyNumber() {
    navigator.clipboard.writeText(MOMO_NUMBER);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ===== Paystack Payment =====
  function handlePaystackPayment() {
    setError('');

    if (!window.PaystackPop) {
      setError('Payment system not loaded. Please refresh.');
      return;
    }

    const ref = 'BSTORE_SELLER_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);

    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: user.email,
      amount: FEE_GHS * 100,
      currency: 'GHS',
      ref: ref,
      metadata: {
        payment_type: 'seller_registration',
        user_id: user.id,
      },
      callback: function (response) {
        // Payment succeeded → mark paid and go to form
        setTxnId(response.reference);
        setPaymentDone(true);
        setStep(2);
      },
      onClose: function () {
        setError('Payment window closed. Please try again.');
      },
    });

    handler.openIframe();
  }

  // ===== Manual MoMo =====
  function proceedWithManual() {
    if (!txnId.trim()) {
      setError('Please enter the transaction ID from your MoMo receipt.');
      return;
    }
    setError('');
    setPaymentDone(true);
    setStep(2);
  }

  // ===== Final Submit =====
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: insertError } = await supabase
      .from('sellers')
      .insert({
        user_id: user.id,
        full_name: form.full_name,
        phone: form.phone,
        whatsapp: form.whatsapp,
        region: form.region,
        address: form.address,
        location_1: form.location_1,
        location_2: form.location_2 || null,
        registration_fee_paid: true,
        status: 'pending',
      });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    // Log the transaction for admin
    await supabase.from('notifications').insert({
      user_id: user.id,
      title: 'Seller Application Submitted',
      message: `GHS 20 payment reference: ${txnId} — from ${form.full_name} (${form.phone})`,
      type: 'seller_application',
    });

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Application Submitted!</h2>
          <p className="text-sm text-gray-600 mb-6">
            We'll verify your payment and notify you once your seller account is approved.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-6 rounded-lg text-sm"
          >
            Back to Shop
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-indigo-900 mb-1">Become a Seller</h1>
        <p className="text-sm text-gray-500 mb-6">
          Join B STORE. Step {step} of 2.
        </p>

        {step === 1 && (
          <div className="space-y-5">
            <div className="bg-gradient-to-br from-amber-100 to-amber-200 border-2 border-amber-500 rounded-xl p-5 text-center">
              <p className="text-sm text-gray-700">Seller Registration Fee</p>
              <p className="text-4xl font-bold text-amber-600 my-2">GHS {FEE_GHS}</p>
              <p className="text-xs text-gray-500 mb-4">One-time payment</p>
            </div>

            {/* Paystack option */}
            <button
              type="button"
              onClick={handlePaystackPayment}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-lg text-sm"
            >
              💳 Pay GHS {FEE_GHS} with Card/MoMo (Paystack)
            </button>

            {/* OR divider */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="text-xs text-gray-400">OR PAY VIA MOMO</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            {/* Manual MoMo */}
            <div className="bg-white rounded-lg p-4 border">
              <p className="text-xs text-gray-500 mb-1">Send GHS {FEE_GHS} to:</p>
              <p className="text-lg font-bold text-indigo-900 tracking-wider">{MOMO_NUMBER}</p>
              <p className="text-sm text-gray-700 mb-3">Name: <span className="font-semibold">{MOMO_NAME}</span></p>
              <button
                type="button"
                onClick={copyNumber}
                className="w-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold py-2 rounded-lg text-xs mb-3"
              >
                {copied ? '✅ Copied!' : '📋 Copy Number'}
              </button>

              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Enter your MoMo transaction ID
              </label>
              <input
                type="text"
                value={txnId}
                onChange={(e) => setTxnId(e.target.value)}
                placeholder="e.g., 1234567890"
                className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
              />
              <button
                type="button"
                onClick={proceedWithManual}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-xs"
              >
                ✅ I've Paid — Continue
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                {error}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3 py-2 rounded-lg">
              ✅ Payment registered — Reference: <strong>{txnId}</strong>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input type="text" required value={form.full_name}
                  onChange={(e) => update('full_name', e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input type="tel" required value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">WhatsApp Number</label>
                <input type="tel" required value={form.whatsapp}
                  onChange={(e) => update('whatsapp', e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Region</label>
                <input type="text" required value={form.region}
                  onChange={(e) => update('region', e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Business Address / Info</label>
              <textarea required rows={2} value={form.address}
                onChange={(e) => update('address', e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Delivery Location 1</label>
                <input type="text" required value={form.location_1}
                  onChange={(e) => update('location_1', e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Delivery Location 2 (optional)</label>
                <input type="text" value={form.location_2}
                  onChange={(e) => update('location_2', e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-lg text-sm">
                ← Back
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg text-sm disabled:opacity-60">
                {loading ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}