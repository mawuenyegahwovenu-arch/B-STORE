import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, id]);

  async function loadData() {
    setLoading(true);

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    setCustomer(userData);

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false });

    const enriched = await Promise.all((ordersData || []).map(async (order) => {
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);
      return { ...order, items: items || [] };
    }));

    setOrders(enriched);
    setLoading(false);
  }

  async function updateOrderStatus(orderId, newStatus) {
    if (!confirm(`Mark this order as "${newStatus}"?`)) return;
    await supabase.from('orders').update({ order_status: newStatus }).eq('id', orderId);
    loadData();
  }

  async function notifySeller(item, order) {
    const { data: seller } = await supabase
      .from('sellers')
      .select('whatsapp, full_name')
      .eq('user_id', item.seller_id)
      .single();

    if (!seller || !seller.whatsapp) {
      alert('This seller has no WhatsApp number on file.');
      return;
    }

    let waNumber = seller.whatsapp.replace(/\D/g, '');
    if (waNumber.startsWith('0')) waNumber = '233' + waNumber.slice(1);
    if (!waNumber.startsWith('233')) waNumber = '233' + waNumber;

    const deliveryPoint = item.seller_delivery_note || (order.is_multi_seller ? order.consolidation_point : order.selected_delivery_point);

    const message =
      `🔔 *NEW ORDER — B STORE*\n\n` +
      `Order #${order.id.slice(0, 8)}\n\n` +
      `👤 Customer: ${order.customer_name}\n` +
      `📞 Phone: ${order.customer_phone}\n` +
      `📍 Deliver to: ${deliveryPoint}\n\n` +
      `🛒 Items:\n` +
      item.order_items?.map(i => `• ${i.product_name} (×${i.quantity})`).join('\n') +
      `\n\nPlease update your seller dashboard when you deliver.`;

    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  function statusColor(status) {
    switch (status) {
      case 'placed': return 'bg-amber-100 text-amber-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'dispatched': return 'bg-green-100 text-green-800'; // legacy
      case 'completed': return 'bg-green-100 text-green-800';  // legacy
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-red-600 font-bold">Access denied. Admins only.</p>
      </div>
    );
  }

  if (loading) {
    return <p className="text-center py-16 text-gray-500">Loading customer...</p>;
  }

  if (!customer) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-red-500 font-bold mb-4">Customer not found.</p>
        <button onClick={() => navigate('/admin')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm">
          Back to Admin
        </button>
      </div>
    );
  }

  const newOrders = orders.filter(o => o.order_status === 'placed');
  const inProgress = orders.filter(o => o.order_status === 'processing');
  const readyForPickup = orders.filter(o => ['delivered', 'dispatched', 'completed'].includes(o.order_status));
  const completedOrders = orders.filter(o => o.order_status === 'cancelled');

  function OrderCard({ order }) {
    return (
      <div className="bg-white border rounded-xl p-3 sm:p-4">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          <div>
            <p className="text-xs text-gray-500">Order #{order.id.slice(0, 8)}...</p>
            <p className="text-xs text-gray-400">
              {new Date(order.created_at).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded font-semibold ${statusColor(order.order_status)}`}>
            {order.order_status.toUpperCase()}
          </span>
        </div>

        {order.is_multi_seller && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs mb-2">
            <p className="font-semibold text-amber-800">📦 Multi-Seller → {order.consolidation_point}</p>
          </div>
        )}
        {!order.is_multi_seller && order.selected_delivery_point && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs mb-2">
            <p className="font-semibold text-blue-800">📍 {order.selected_delivery_point}</p>
          </div>
        )}

        <div className="space-y-2 mb-3">
          {order.items.map(item => (
            <div key={item.id} className="flex items-center gap-3 text-sm border-l-4 border-indigo-300 pl-3 flex-wrap">
              <div className="w-10 h-10 bg-gray-50 rounded border flex items-center justify-center p-0.5 flex-shrink-0">
                <img src={item.product_image || 'https://via.placeholder.com/100'} className="max-w-full max-h-full object-contain" />
              </div>
              <div className="flex-1 min-w-[140px]">
                <p className="font-medium text-gray-800 text-xs sm:text-sm">{item.product_name}</p>
                <p className="text-[10px] sm:text-xs text-gray-500">
                  Seller: {item.seller_name} • ×{item.quantity} • GHS {Number(item.subtotal).toFixed(2)}
                </p>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor(item.seller_status)}`}>
                {item.seller_status}
              </span>
              <button
                onClick={() => notifySeller(item, order)}
                className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded text-[10px] font-semibold"
              >
                📲 Notify
              </button>
            </div>
          ))}
        </div>

        <div className="border-t pt-3 flex flex-wrap justify-between items-center gap-2 mb-3">
          <div className="text-xs text-gray-500">
            💳 {order.payment_method.replace('_', ' ')} — {order.payment_status}
          </div>
          <div className="font-bold text-indigo-600">
            GHS {Number(order.total).toFixed(2)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-3 border-t">
          {order.order_status === 'placed' && (
            <button onClick={() => updateOrderStatus(order.id, 'processing')} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs font-semibold uppercase">
              MARK PROCESSING
            </button>
          )}
          {order.order_status === 'processing' && (
            <button onClick={() => updateOrderStatus(order.id, 'delivered')} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-xs font-semibold uppercase">
              MARK DELIVERED
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <button
        onClick={() => navigate('/admin')}
        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4"
      >
        ← Back to Admin
      </button>

      {/* Customer header */}
      <div className="bg-white rounded-2xl shadow border p-4 sm:p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
            👤
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-800 truncate">
              {customer.full_name || 'Customer'}
            </h1>
            <p className="text-sm text-gray-600">{customer.phone || 'No phone'}</p>
            <p className="text-xs text-gray-400 truncate">{customer.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-xl font-bold text-gray-800">{orders.length}</p>
            <p className="text-xs text-gray-500">Total Orders</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-amber-600">{newOrders.length}</p>
            <p className="text-xs text-gray-500">New</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-blue-600">{inProgress.length}</p>
            <p className="text-xs text-gray-500">In Progress</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-green-600">{readyForPickup.length}</p>
            <p className="text-xs text-gray-500">Ready</p>
          </div>
        </div>
      </div>

      {newOrders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-bold text-amber-700 mb-3">
            🟡 New Orders ({newOrders.length}) — Action Needed
          </h2>
          <div className="space-y-3">
            {newOrders.map(o => <OrderCard key={o.id} order={o} />)}
          </div>
        </div>
      )}

      {inProgress.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-bold text-blue-700 mb-3">
            🟠 In Progress ({inProgress.length})
          </h2>
          <div className="space-y-3">
            {inProgress.map(o => <OrderCard key={o.id} order={o} />)}
          </div>
        </div>
      )}

      {readyForPickup.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-bold text-green-700 mb-3">
            🟢 Ready for Pickup ({readyForPickup.length})
          </h2>
          <div className="space-y-3">
            {readyForPickup.map(o => <OrderCard key={o.id} order={o} />)}
          </div>
        </div>
      )}

      {completedOrders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-bold text-red-700 mb-3">
            ❌ Cancelled ({completedOrders.length})
          </h2>
          <div className="space-y-3 opacity-75">
            {completedOrders.map(o => <OrderCard key={o.id} order={o} />)}
          </div>
        </div>
      )}

      {orders.length === 0 && (
        <div className="bg-white rounded-xl shadow p-10 text-center">
          <p className="text-gray-500">This customer has no orders yet.</p>
        </div>
      )}
    </div>
  );
}