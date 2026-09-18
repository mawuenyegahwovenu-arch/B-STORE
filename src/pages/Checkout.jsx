import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const PAYSTACK_PUBLIC_KEY = 'pk_live_af38a972a9bc58d04951d3cc2c4350e9d0906405';
const MOMO_NUMBER = '0597699623';
const MOMO_NAME = 'MAWUEWOE WOVENU';

export default function Checkout() {
  const { user, userData } = useAuth();
  const { cart, totalAmount, isMultiSeller, uniqueSellers, clearCart } = useCart();
  const navigate = useNavigate();

  const [sellerLocations, setSellerLocations] = useState({});
  const [selectedSellerLocation, setSelectedSellerLocation] = useState(null);

  const [phone, setPhone] = useState(userData?.phone || '');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pay_on_delivery');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (cart.length === 0) {
      navigate('/');
      return;
    }
    loadCheckoutData();
  }, []);

  async function loadCheckoutData() {
    if (!isMultiSeller && uniqueSellers.length === 1) {
      const sellerId = uniqueSellers[0];
      const { data: seller } = await supabase
        .from('sellers')
        .select('location_1, location_2')
        .eq('user_id', sellerId)
        .maybeSingle();

      if (seller) setSellerLocations(seller);
    }
  }

  function copyNumber() {
    navigator.clipboard.writeText(MOMO_NUMBER);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function validateBeforePayment() {
    if (!phone.trim()) {
      setError('Phone number is required.');
      return false;
    }
    if (!isMultiSeller && !selectedSellerLocation) {
      setError('Please select a delivery location.');
      return false;
    }
    return true;
  }

  async function sendEmail(payload) {
    try {
      const res = await fetch('/api/send-order-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log(`Email [${payload.action}] status:`, data);
    } catch (err) {
      console.error(`Failed to send email [${payload.action}]:`, err);
    }
  }

  function handlePaystackPayment() {
    setError('');
    if (!validateBeforePayment()) return;

    if (!window.PaystackPop) {
      setError('Payment system not loaded. Please refresh the page.');
      return;
    }

    const ref = 'BSTORE_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);

    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: user.email,
      amount: Math.round(totalAmount * 100),
      currency: 'GHS',
      ref: ref,
      metadata: {
        customer_name: userData?.full_name || 'Customer',
        customer_phone: phone,
      },
      callback: function (response) {
        saveOrder('paystack', 'paid', response.reference);
      },
      onClose: function () {
        setError('Payment window closed. Order not placed.');
      },
    });

    handler.openIframe();
  }

  async function handlePlaceOrder() {
    setError('');
    if (!validateBeforePayment()) return;
    saveOrder(paymentMethod, 'pending', null);
  }

  async function saveOrder(method, paymentStatus, paymentRef) {
    setLoading(true);
    setError('');

    let finalDeliveryPoint = '';
    if (isMultiSeller) {
      finalDeliveryPoint = 'HTU ENTRANCE — Sundays 5pm–6pm';
    } else {
      finalDeliveryPoint = selectedSellerLocation;
    }

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: user.id,
        customer_name: userData?.full_name || 'Customer',
        customer_phone: phone,
        customer_email: user.email,
        delivery_address: address || null,
        is_multi_seller: isMultiSeller,
        consolidation_point: isMultiSeller ? finalDeliveryPoint : null,
        selected_delivery_point: !isMultiSeller ? finalDeliveryPoint : null,
        total: totalAmount,
        payment_method: method,
        payment_status: paymentStatus,
        payment_reference: paymentRef,
        order_status: 'placed',
      })
      .select()
      .single();

    if (orderError) {
      setError(orderError.message);
      setLoading(false);
      return;
    }

    const items = cart.map(item => ({
      order_id: orderData.id,
      seller_id: item.seller_id,
      seller_name: item.seller_name,
      product_id: item.id,
      product_name: item.name,
      product_image: item.image_url,
      quantity: item.qty,
      unit_price: item.price,
      subtotal: item.price * item.qty,
      seller_status: 'placed',
      seller_delivery_note: finalDeliveryPoint,
      customer_id: user.id,
      customer_name: userData?.full_name || 'Customer',
      customer_phone: phone,
      payment_method: method,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(items);

    if (itemsError) {
      setError(itemsError.message);
      setLoading(false);
      return;
    }
    // ===== SEND EMAILS =====

    // 1. Order Confirmation → Customer
    const orderSummaryString = cart
      .map(i => `${i.name} (x${i.qty}) - GHS ${(i.price * i.qty).toFixed(2)}`)
      .join('<br>');

    await sendEmail({
      action: 'order_confirmation',
      customerEmail: user.email,
      customerName: userData?.full_name || 'Customer',
      orderDetails: `${orderSummaryString}<br><br>Total: GHS ${totalAmount.toFixed(2)}`,
    });

    // 2. New Order Alert → Each Seller
    const bySellerForEmail = {};
    cart.forEach(item => {
      if (!bySellerForEmail[item.seller_id]) {
        bySellerForEmail[item.seller_id] = {
          sellerName: item.seller_name,
          items: [],
        };
      }
      bySellerForEmail[item.seller_id].items.push(item);
    });

    for (const [sellerId, sellerData] of Object.entries(bySellerForEmail)) {
      const { data: sellerRecord } = await supabase
        .from('sellers')
        .select('full_name')
        .eq('user_id', sellerId)
        .maybeSingle();

      const { data: sellerUser } = await supabase
        .from('users')
        .select('email')
        .eq('id', sellerId)
        .maybeSingle();

      if (sellerUser?.email) {
        const sellerTotal = sellerData.items.reduce((s, i) => s + (i.price * i.qty), 0);
        const sellerItemsList = sellerData.items
          .map(i => `• ${i.name} (×${i.qty}) — GHS ${(i.price * i.qty).toFixed(2)}`)
          .join('<br>');

        await sendEmail({
          action: 'new_order_seller',
          sellerEmail: sellerUser.email,
          sellerName: sellerRecord?.full_name || sellerData.sellerName,
          orderId: orderData.id.slice(0, 8),
          customerName: userData?.full_name || 'Customer',
          customerPhone: phone,
          sellerItems: sellerItemsList,
          deliveryPoint: finalDeliveryPoint,
          total: sellerTotal.toFixed(2),
        });
      }
    }

    // 3. Admin Alert → Only if customer bought from admin's own products
    const ADMIN_USER_ID = 'fbf10fb9-27f2-40ea-84af-9da392b412f2';
    const hasAdminItems = cart.some(item => item.seller_id === ADMIN_USER_ID);

    if (hasAdminItems) {
      const allItemsList = cart
        .map(i => `• ${i.name} (×${i.qty}) — GHS ${(i.price * i.qty).toFixed(2)} — Seller: ${i.seller_name}`)
        .join('<br>');

      await sendEmail({
        action: 'new_order_admin',
        orderId: orderData.id.slice(0, 8),
        customerName: userData?.full_name || 'Customer',
        customerPhone: phone,
        total: totalAmount.toFixed(2),
        paymentMethod: method.replace('_', ' '),
        allItems: allItemsList,
        deliveryPoint: finalDeliveryPoint,
        sellerCount: Object.keys(bySellerForEmail).length,
      });
    }
    for (const item of cart) {
      const { data: prod } = await supabase
        .from('products')
        .select('stock, seller_id, name')
        .eq('id', item.id)
        .single();

      if (prod) {
        const newStock = Math.max(0, prod.stock - item.qty);
        await supabase.from('products').update({ stock: newStock }).eq('id', item.id);

        if (newStock <= 5 && prod.seller_id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: prod.seller_id,
            title: newStock === 0 ? '⚠️ Product Out of Stock' : '⚠️ Low Stock Alert',
            message: newStock === 0
              ? `"${prod.name}" is now out of stock.`
              : `"${prod.name}" has only ${newStock} left.`,
            type: 'low_stock',
          });
        }
      }
    }

    const bySeller = {};
    cart.forEach(item => {
      if (!bySeller[item.seller_id]) bySeller[item.seller_id] = [];
      bySeller[item.seller_id].push(item);
    });

    for (const [sellerId, sellerItems] of Object.entries(bySeller)) {
      const itemLines = sellerItems.map(i => `${i.name} (×${i.qty})`).join(', ');
      await supabase.from('notifications').insert({
        user_id: sellerId,
        title: '🔔 New Order Received',
        message: `New order: ${itemLines}. Deliver to: ${finalDeliveryPoint}`,
        type: 'new_order',
        related_order_id: orderData.id,
      });
    }

    clearCart();
    navigate(`/order-confirmation/${orderData.id}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-8">
      <h1 className="text-2xl font-bold text-indigo-900 mb-6 uppercase">CHECKOUT</h1>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="font-bold text-sm text-gray-700 mb-3 uppercase">YOUR ITEMS ({cart.length})</h2>
        <div className="space-y-2">
          {cart.map(item => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <div className="w-10 h-10 bg-gray-50 rounded border flex items-center justify-center p-0.5 flex-shrink-0">
                <img src={item.image_url || 'https://via.placeholder.com/100'} className="max-w-full max-h-full object-contain" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">{item.name}</p>
                <p className="text-xs text-gray-500">{item.qty} × GHS {item.price.toFixed(2)}</p>
              </div>
              <p className="font-bold text-gray-800">GHS {(item.qty * item.price).toFixed(2)}</p>
            </div>
          ))}
        </div>
        <div className="border-t mt-3 pt-3 flex justify-between font-bold text-lg">
          <span>TOTAL:</span>
          <span className="text-indigo-600">GHS {totalAmount.toFixed(2)}</span>
        </div>
      </div>

      {isMultiSeller && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4 text-sm">
          <p className="font-bold text-amber-800 mb-1 uppercase">📦 MULTI-SELLER ORDER</p>
          <p className="text-amber-700">
            Multi-seller order — deliver all items to the customer's selected pickup point.
          </p>
          <div className="mt-3 bg-white rounded-lg p-3 border border-amber-200">
            <p className="text-xs text-gray-500 mb-1 uppercase">PICKUP POINT:</p>
            <p className="font-bold text-gray-800">🏫 HTU ENTRANCE</p>
            <p className="text-xs text-gray-500 mt-1">📅 SUNDAY, 5PM – 6PM</p>
          </div>
          <p className="text-xs text-amber-700 mt-3">
            🔔 You will be notified when your order is ready.
          </p>
        </div>
      )}

      {!isMultiSeller && sellerLocations.location_1 && (
        <div className="bg-blue-50 border border-blue-300 rounded-xl p-4 mb-4 text-sm">
          <p className="font-bold text-blue-800 mb-2 uppercase">📍 CHOOSE YOUR DELIVERY POINT</p>
          <p className="text-xs text-blue-700 mb-3">
            The seller will message you when your order is ready.
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setSelectedSellerLocation(sellerLocations.location_1)}
              className={`w-full text-left p-3 rounded-lg border-2 transition ${
                selectedSellerLocation === sellerLocations.location_1
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 bg-white hover:border-indigo-300'
              }`}
            >
              <p className="font-bold text-sm text-gray-800">{sellerLocations.location_1}</p>
            </button>
            {sellerLocations.location_2 && (
              <button
                type="button"
                onClick={() => setSelectedSellerLocation(sellerLocations.location_2)}
                className={`w-full text-left p-3 rounded-lg border-2 transition ${
                  selectedSellerLocation === sellerLocations.location_2
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 bg-white hover:border-indigo-300'
                }`}
              >
                <p className="font-bold text-sm text-gray-800">{sellerLocations.location_2}</p>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="font-bold text-sm text-gray-700 mb-3 uppercase">CONTACT DETAILS</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">PHONE NUMBER (MOMO / CONTACT)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="059XXXXXXX"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">ADDITIONAL INFO (OPTIONAL)</label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Anything sellers should know"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="font-bold text-sm text-gray-700 mb-3 uppercase">PAYMENT METHOD</h2>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setPaymentMethod('pay_on_delivery')}
            className={`w-full text-left p-3 rounded-lg border-2 transition ${
              paymentMethod === 'pay_on_delivery' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white'
            }`}
          >
            <p className="font-bold text-sm">💵 PAY ON DELIVERY</p>
            <p className="text-xs text-gray-500">Pay when you receive your items</p>
          </button>

          <button
            type="button"
            onClick={() => { setPaymentMethod('paystack'); handlePaystackPayment(); }}
            className={`w-full text-left p-3 rounded-lg border-2 transition ${
              paymentMethod === 'paystack' ? 'border-indigo-600 bg-indigo-50' : 'border-sky-200 bg-sky-50'
            }`}
          >
            <p className="font-bold text-sm text-sky-700">💳 PAY ONLINE (CARD/MOMO)</p>
            <p className="text-xs text-sky-500">Secure payment via Paystack</p>
          </button>
        </div>

        {paymentMethod === 'pay_on_delivery' && (
          <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs">
            <p className="text-gray-600 mb-1">Optional: You can prepay to:</p>
            <p className="font-bold text-indigo-900">{MOMO_NUMBER}</p>
            <p className="text-gray-700">Name: <strong>{MOMO_NAME}</strong></p>
            <button
              type="button"
              onClick={copyNumber}
              className="mt-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold px-3 py-1 rounded text-xs uppercase"
            >
              {copied ? '✅ COPIED!' : '📋 COPY NUMBER'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">
          {error}
        </div>
      )}

      {paymentMethod === 'pay_on_delivery' && (
        <button
          onClick={handlePlaceOrder}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg text-sm disabled:opacity-60 uppercase"
        >
          {loading ? 'PLACING ORDER...' : `PLACE ORDER — GHS ${totalAmount.toFixed(2)}`}
        </button>
      )}

      {paymentMethod === 'paystack' && (
        <div className="bg-sky-50 border border-sky-300 rounded-xl p-4 text-center text-sm text-sky-700">
          👆 Click "PAY ONLINE (CARD/MOMO)" above to complete payment
        </div>
      )}
    </div>
  );
}