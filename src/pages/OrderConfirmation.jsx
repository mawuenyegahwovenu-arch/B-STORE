import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ADMIN_WHATSAPP = '233597699623'; // Your WhatsApp (0597699623 → 233597699623)

export default function OrderConfirmation() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, [id]);

  async function loadOrder() {
    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);

    setOrder(orderData);
    setItems(itemsData || []);
    setLoading(false);
  }

  function notifyAdmin() {
    if (!order) return;

    const itemLines = items.map(i =>
      `• ${i.product_name} (×${i.quantity}) — GHS ${Number(i.subtotal).toFixed(2)} — Seller: ${i.seller_name}`
    ).join('\n');

    const message =
      `🔔 *NEW ORDER — B STORE*\n\n` +
      `Order #${order.id.slice(0, 8)}\n` +
      `Date: ${new Date(order.created_at).toLocaleString('en-GB')}\n\n` +
      `👤 Customer: ${order.customer_name}\n` +
      `📞 Phone: ${order.customer_phone}\n` +
      `📍 Delivery: ${order.is_multi_seller ? order.consolidation_point : order.selected_delivery_point}\n\n` +
      `🛒 Items:\n${itemLines}\n\n` +
      `💰 Total: GHS ${Number(order.total).toFixed(2)}\n` +
      `💳 Payment: ${order.payment_method.replace('_', ' ')}\n` +
      `📦 Type: ${order.is_multi_seller ? 'Multi-Seller' : 'Single-Seller'}`;

    const url = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  if (loading) {
    return <p className="text-center py-16 text-gray-500">Loading...</p>;
  }

  if (!order) {
    return <p className="text-center py-16 text-red-500">Order not found.</p>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Order Placed!</h1>
        <p className="text-sm text-gray-600 mb-6">
          Thank you for your order. We'll notify you when it's being processed.
        </p>

        {/* Notify Admin button */}
        <button
          onClick={notifyAdmin}
          className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl mb-6 shadow-lg flex items-center justify-center gap-2"
        >
          📲 Notify B STORE on WhatsApp
        </button>
        <p className="text-xs text-gray-500 -mt-4 mb-6">
          Tap to send your order details to us on WhatsApp for faster processing.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-2 mb-6">
          <div className="flex justify-between">
            <span className="text-gray-500">Order ID:</span>
            <span className="font-mono font-bold">{order.id.slice(0, 12)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total:</span>
            <span className="font-bold text-indigo-600">GHS {Number(order.total).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Payment:</span>
            <span className="font-bold capitalize">{order.payment_method.replace('_', ' ')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Status:</span>
            <span className="font-bold capitalize">{order.order_status}</span>
          </div>
          {order.is_multi_seller && (
            <div className="flex justify-between">
              <span className="text-gray-500">Pickup Point:</span>
              <span className="font-bold">{order.consolidation_point}</span>
            </div>
          )}
          {!order.is_multi_seller && order.selected_delivery_point && (
            <div className="flex justify-between">
              <span className="text-gray-500">Delivery Point:</span>
              <span className="font-bold">{order.selected_delivery_point}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Link
            to="/"
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 rounded-lg text-sm text-center"
          >
            Continue Shopping
          </Link>
          <Link
            to="/orders"
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-sm text-center"
          >
            View My Orders
          </Link>
        </div>
      </div>
    </div>
  );
}