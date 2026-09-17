import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const STAGES = ['placed', 'processing', 'dispatched', 'delivered', 'completed'];

function stageIndex(status) {
  const i = STAGES.indexOf(status);
  return i === -1 ? 0 : i;
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadOrder();
  }, [user, id]);

  async function loadOrder() {
    setLoading(true);

    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('customer_id', user.id)
      .maybeSingle();

    if (!orderData) {
      setOrder(null);
      setLoading(false);
      return;
    }

    setOrder(orderData);

    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);

    setItems(itemsData || []);
    setLoading(false);
  }

  function statusColor(status) {
    switch (status) {
      case 'placed': return 'bg-amber-100 text-amber-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'dispatched': return 'bg-indigo-100 text-indigo-800';
      case 'delivered': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  if (loading) {
    return <p className="text-center py-16 text-gray-500">Loading order...</p>;
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-red-500 font-bold mb-4">Order not found.</p>
        <Link to="/orders" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm">
          Back to Orders
        </Link>
      </div>
    );
  }

  const currentStage = stageIndex(
    items.length > 0
      ? items.reduce((lowest, item) => {
          const idx = stageIndex(item.seller_status);
          return idx < lowest ? idx : lowest;
        }, 999)
      : 0
  );

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4"
      >
        ← Back
      </button>

      <div className="bg-white rounded-2xl shadow border p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-800">Order Details</h1>
            <p className="text-xs text-gray-500 font-mono mt-1">#{order.id}</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusColor(order.order_status)}`}>
            {order.order_status.toUpperCase()}
          </span>
        </div>

        <div className="text-xs text-gray-500 mb-4">
          Placed on {new Date(order.created_at).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })}
        </div>

        {/* Progress tracker */}
        <div className="mb-6">
          <div className="flex items-center gap-1">
            {STAGES.map((stage, i) => {
              const done = i <= currentStage;
              return (
                <div key={stage} className="flex-1 flex flex-col items-center">
                  <div className={`w-full h-1.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                  <p className={`text-[10px] mt-1 capitalize text-center ${done ? 'text-emerald-700 font-semibold' : 'text-gray-400'}`}>
                    {stage}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delivery info */}
        {order.is_multi_seller ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm">
            <p className="font-bold text-amber-800 mb-1">📦 Multi-Seller Order</p>
            <p className="text-amber-700 text-xs">Pickup: <strong>{order.consolidation_point}</strong></p>
            <p className="text-amber-600 text-xs mt-1">🔔 You'll be notified when ready.</p>
          </div>
        ) : (
          order.selected_delivery_point && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm">
              <p className="font-bold text-blue-800 mb-1">📍 Delivery Point</p>
              <p className="text-blue-700 text-xs">{order.selected_delivery_point}</p>
            </div>
          )
        )}

        {/* Items */}
        <h2 className="font-bold text-gray-800 mb-2 text-sm">Items ({items.length})</h2>
        <div className="space-y-3 mb-4">
          {items.map(item => (
            <div key={item.id} className="flex gap-3 border rounded-xl p-3">
              <div className="w-16 h-16 bg-gray-50 rounded-lg border flex items-center justify-center p-1 flex-shrink-0">
                <img src={item.product_image || 'https://via.placeholder.com/100'} className="max-w-full max-h-full object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm">{item.product_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">Seller: {item.seller_name}</p>
                <p className="text-xs text-gray-500">Qty: {item.quantity} × GHS {Number(item.unit_price).toFixed(2)}</p>
                <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded ${statusColor(item.seller_status)}`}>
                  {item.seller_status}
                </span>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-gray-800 text-sm">GHS {Number(item.subtotal).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="border-t pt-4 space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Customer</span>
            <span className="font-medium text-gray-800">{order.customer_name}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Phone</span>
            <span className="font-medium text-gray-800">{order.customer_phone}</span>
          </div>
          {order.customer_email && (
            <div className="flex justify-between text-gray-600">
              <span>Email</span>
              <span className="font-medium text-gray-800 truncate ml-4">{order.customer_email}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>Payment</span>
            <span className="font-medium text-gray-800 capitalize">{order.payment_method.replace('_', ' ')} — {order.payment_status}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t mt-2">
            <span>Total</span>
            <span className="text-indigo-700">GHS {Number(order.total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="text-center mt-4">
        <Link to="/orders" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          ← View all orders
        </Link>
      </div>
    </div>
  );
}