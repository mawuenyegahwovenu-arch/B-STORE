import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const STAGES = ['placed', 'processing', 'dispatched', 'delivered', 'completed'];

function stageIndex(status) {
  const i = STAGES.indexOf(status);
  return i === -1 ? 0 : i;
}

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadOrders();
  }, [user]);

  async function loadOrders() {
    setLoading(true);

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', user.id)
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

  function masterStage(items) {
    if (items.length === 0) return 'placed';
    let lowest = 999;
    items.forEach(i => {
      const idx = stageIndex(i.seller_status);
      if (idx < lowest) lowest = idx;
    });
    return STAGES[lowest] || 'placed';
  }

  function ProgressTracker({ currentStatus }) {
    const current = stageIndex(currentStatus);
    return (
      <div className="flex items-center gap-1 mt-3">
        {STAGES.map((stage, i) => {
          const done = i <= current;
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
    );
  }

  if (loading) {
    return <p className="text-center py-16 text-gray-500">Loading orders...</p>;
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <h1 className="text-xl sm:text-2xl font-bold text-indigo-900 mb-4 sm:mb-6">My Orders</h1>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-10 text-center">
          <div className="text-6xl mb-4">📦</div>
          <p className="text-gray-500 mb-4">You haven't placed any orders yet.</p>
          <Link to="/" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-6 rounded-lg text-sm inline-block">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-5">
          {orders.map(order => {
            const master = masterStage(order.items);
            return (
              <Link
                key={order.id}
                to={`/order/${order.id}`}
                className="block bg-white rounded-xl shadow border p-3 sm:p-4 hover:shadow-lg transition cursor-pointer"
              >
                <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Order #{order.id.slice(0, 8)}...</p>
                    <p className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-semibold ${statusColor(master)}`}>
                    {master.toUpperCase()}
                  </span>
                </div>

                <ProgressTracker currentStatus={master} />

                {order.is_multi_seller && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs mt-3">
                    <p className="font-semibold text-amber-800">📦 Multi-Seller Order</p>
                    <p className="text-amber-700">Pickup: <strong>{order.consolidation_point}</strong></p>
                    <p className="text-amber-600 mt-1">🔔 You will be notified when ready.</p>
                  </div>
                )}
                {!order.is_multi_seller && order.selected_delivery_point && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs mt-3">
                    <p className="font-semibold text-blue-800">📍 Delivery Point</p>
                    <p className="text-blue-700">{order.selected_delivery_point}</p>
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  {order.items.slice(0, 2).map(item => (
                    <div key={item.id} className="flex items-center gap-2 text-xs">
                      <div className="w-10 h-10 bg-gray-50 rounded border flex items-center justify-center p-0.5 flex-shrink-0">
                        <img src={item.product_image || 'https://via.placeholder.com/100'} className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-700 truncate">{item.product_name}</p>
                        <p className="text-gray-500 text-[10px]">×{item.quantity} • {item.seller_name}</p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor(item.seller_status)}`}>
                        {item.seller_status}
                      </span>
                    </div>
                  ))}
                  {order.items.length > 2 && (
                    <p className="text-xs text-gray-500 pl-12">+{order.items.length - 2} more item(s)</p>
                  )}
                </div>

                <div className="border-t mt-3 pt-3 flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    💳 {order.payment_method.replace('_', ' ')}
                  </div>
                  <div className="font-bold text-indigo-600 text-sm sm:text-base">
                    GHS {Number(order.total).toFixed(2)}
                  </div>
                </div>

                <p className="text-center text-xs text-indigo-600 font-medium mt-2">
                  Tap for details →
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}