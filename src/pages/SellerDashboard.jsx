import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function SellerDashboard() {
  const { user, isSeller, isAdmin } = useAuth();
  const { sellerId } = useParams();
  const navigate = useNavigate();

  const viewingSellerId = sellerId || user?.id;
  const isImpersonating = isAdmin && sellerId && sellerId !== user?.id;
  const canAccess = isSeller || (isAdmin && sellerId);

  const [tab, setTab] = useState('products');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unifiedSearch, setUnifiedSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [sellerInfo, setSellerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [viewingWalletBreakdown, setViewingWalletBreakdown] = useState(false);

  const [sellerOrderSearch, setSellerOrderSearch] = useState('');
  const [sellerOrderFilter, setSellerOrderFilter] = useState('all');
  const [sellerPaymentFilter, setSellerPaymentFilter] = useState('all');
  const [productSearch, setProductSearch] = useState('');
  const [productApprovalFilter, setProductApprovalFilter] = useState('all');
  const [customerSearch, setCustomerSearch] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    category_name: '',
    price: '',
    stock: '',
    image_url: '',
  });

  useEffect(() => {
    if (canAccess && viewingSellerId) loadAll();
  }, [canAccess, viewingSellerId]);

  async function loadAll() {
    setLoading(true);
    const [prodRes, catRes, itemRes, walletRes, payoutsRes, sellerRes] = await Promise.all([
      supabase.from('products').select('*').eq('seller_id', viewingSellerId).or('is_deleted.is.null,is_deleted.eq.false').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
      supabase.from('order_items').select('*').eq('seller_id', viewingSellerId).order('created_at', { ascending: false }),
      supabase.from('wallets').select('*').eq('seller_id', viewingSellerId).maybeSingle(),
      supabase.from('payouts').select('*').eq('seller_id', viewingSellerId).order('requested_at', { ascending: false }),
      supabase.from('sellers').select('full_name, whatsapp').eq('user_id', viewingSellerId).maybeSingle(),
    ]);
    setProducts(prodRes.data || []);
    setCategories(catRes.data || []);
    setOrders(itemRes.data || []);
    setWallet(walletRes.data);
    setPayouts(payoutsRes.data || []);
    setSellerInfo(sellerRes.data);
    setLoading(false);
  }

  function update(field, value) {
    setForm({ ...form, [field]: value });
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image too large. Max 5MB.');
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const filename = `${viewingSellerId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filename, file, { upsert: false });

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(filename);

    update('image_url', urlData.publicUrl);
    setUploading(false);
  }

  async function handleAddProduct(e) {
    e.preventDefault();
    setMessage('');

    if (!form.category_name) {
      setMessage('Please choose a category.');
      return;
    }
    if (!form.image_url) {
      setMessage('Please upload an image or paste an image URL.');
      return;
    }

    const { data: sellerData } = await supabase
      .from('sellers')
      .select('full_name')
      .eq('user_id', viewingSellerId)
      .single();

    const realSellerName = sellerData?.full_name || 'Seller';

    const { error } = await supabase.from('products').insert({
      seller_id: viewingSellerId,
      seller_name: realSellerName,
      name: form.name,
      description: form.description,
      category_name: form.category_name,
      price: parseFloat(form.price),
      stock: parseInt(form.stock),
      image_url: form.image_url,
      approval_status: isImpersonating ? 'approved' : 'pending',
      is_active: true,
      is_deleted: false,
      approved_at: isImpersonating ? new Date().toISOString() : null,
    });

    if (error) {
      setMessage('Error: ' + error.message);
      return;
    }

    setMessage(isImpersonating ? '✅ Product added (auto-approved as admin)' : '✅ Product submitted for admin approval!');
    setForm({ name: '', description: '', category_name: '', price: '', stock: '', image_url: '' });
    loadAll();
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product? It will be hidden from the store.')) return;
    await supabase.from('products').update({ is_deleted: true, is_active: false }).eq('id', id);
    loadAll();
  }

  async function markStatus(itemId, newStatus) {
    if (!confirm(`Mark this order as "${newStatus}"?`)) return;

    const { data: item } = await supabase
      .from('order_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (!item) return;
    // Check if ALL items in this order are now delivered → send "Order Ready" email to customer
    if (newStatus === 'delivered') {
      const { data: allItems } = await supabase
        .from('order_items')
        .select('seller_status')
        .eq('order_id', item.order_id);

      const allDelivered = allItems && allItems.every(i => i.seller_status === 'delivered');

      if (allDelivered) {
        const { data: orderData } = await supabase
          .from('orders')
          .select('customer_email, customer_name, consolidation_point, selected_delivery_point, total')
          .eq('id', item.order_id)
          .single();

        if (orderData?.customer_email) {
          const deliveryPoint = orderData.consolidation_point || orderData.selected_delivery_point || 'HTU ENTRANCE';

          fetch('/api/send-order-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'order_ready',
              customerEmail: orderData.customer_email,
              customerName: orderData.customer_name,
              orderId: item.order_id.slice(0, 8),
              deliveryPoint: deliveryPoint,
              total: Number(orderData.total).toFixed(2),
            }),
          }).catch(err => console.error('Order ready email failed:', err));
        }
      }
    }
    await supabase.from('order_items').update({ seller_status: newStatus }).eq('id', itemId);

    if (newStatus === 'delivered') {
      const COMMISSION_RATE = 0.05;
      const gross = Number(item.subtotal);
      const commission = gross * COMMISSION_RATE;
      const net = gross - commission;

      const { data: existing } = await supabase
        .from('wallets')
        .select('*')
        .eq('seller_id', viewingSellerId)
        .single();

      if (existing) {
        await supabase
          .from('wallets')
          .update({
            total_gross: Number(existing.total_gross || 0) + gross,
            total_commission: Number(existing.total_commission || 0) + commission,
            total_net: Number(existing.total_net || 0) + net,
            available_balance: Number(existing.available_balance || 0) + net,
            updated_at: new Date().toISOString(),
          })
          .eq('seller_id', viewingSellerId);
      } else {
        await supabase.from('wallets').insert({
          seller_id: viewingSellerId,
          total_gross: gross,
          total_commission: commission,
          total_net: net,
          available_balance: net,
        });
      }
    }

    loadAll();
  }

  async function requestPayout(e) {
    e.preventDefault();
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) {
      alert('Enter a valid amount.');
      return;
    }
    if (!wallet || amount > Number(wallet.available_balance || 0)) {
      alert('Amount exceeds available balance.');
      return;
    }

    const { error } = await supabase.from('payouts').insert({
      seller_id: viewingSellerId,
      amount,
      status: 'pending',
    });

    if (error) {
      alert('Error: ' + error.message);
      return;
    }

    alert('Payout request submitted!');
    setPayoutAmount('');
    loadAll();
  }

  const customerMap = {};
  orders.forEach(item => {
    const cid = item.customer_id || item.order_id;
    if (!customerMap[cid]) {
      customerMap[cid] = {
        customer_id: cid,
        customer_name: item.customer_name || 'Customer',
        customer_phone: item.customer_phone || '',
        orders: [],
      };
    }
    customerMap[cid].orders.push(item);
  });
  const customers = Object.values(customerMap);

  if (!canAccess) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-red-600 font-bold">Access denied.</p>
      </div>
    );
  }

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.subtotal || 0), 0);
  const pendingCount = products.filter(p => p.approval_status === 'pending').length;
  const approvedCount = products.filter(p => p.approval_status === 'approved').length;
  const newOrdersCount = orders.filter(o => o.seller_status === 'placed').length;

  const customersWithAction = customers.filter(c =>
    c.orders.some(o => ['placed', 'processing', 'dispatched'].includes(o.seller_status))
  ).length;

  const deliveredItems = orders.filter(o => o.seller_status === 'delivered');
  const paystackItems = deliveredItems.filter(o => o.payment_method === 'paystack');
  const podItems = deliveredItems.filter(o => o.payment_method === 'pay_on_delivery');

  const paystackSales = paystackItems.reduce((s, o) => s + Number(o.subtotal || 0), 0);
  const podSales = podItems.reduce((s, o) => s + Number(o.subtotal || 0), 0);
  const totalSales = paystackSales + podSales;

  const paystackComm = paystackSales * 0.05;
  const podComm = podSales * 0.05;
  const totalComm = totalSales * 0.05;

  const paystackNet = paystackSales * 0.95;
  const podNet = podSales * 0.95;
  const totalNet = totalSales * 0.95;

  const paidPayouts = payouts.filter(p => p.status === 'paid');
  const paidSoFar = paidPayouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  const availableBalance = Math.max(0, totalNet - paidSoFar);

  const filteredOrders = orders.filter(o => {
    if (sellerOrderFilter !== 'all' && o.seller_status !== sellerOrderFilter) return false;
    if (sellerPaymentFilter === 'paystack' && o.payment_method !== 'paystack') return false;
    if (sellerPaymentFilter === 'pay_on_delivery' && o.payment_method !== 'pay_on_delivery') return false;
    if (sellerOrderSearch.trim()) {
      const q = sellerOrderSearch.toLowerCase();
      return (
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.customer_phone || '').toLowerCase().includes(q) ||
        (o.product_name || '').toLowerCase().includes(q) ||
        o.order_id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredProducts = products.filter(p => {
    if (productApprovalFilter !== 'all' && p.approval_status !== productApprovalFilter) return false;
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.category_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredCustomers = customers.filter(c => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return (
      (c.customer_name || '').toLowerCase().includes(q) ||
      (c.customer_phone || '').toLowerCase().includes(q)
    );
  });

  const sidebarMenu = [
    { id: 'products', icon: '📦', label: 'PRODUCTS', badge: 0 },
    { id: 'add', icon: '➕', label: 'ADD PRODUCT', badge: 0 },
    { id: 'orders', icon: '📋', label: 'ORDERS', badge: newOrdersCount },
    { id: 'customers', icon: '👤', label: 'CUSTOMERS', badge: customersWithAction },
    { id: 'wallet', icon: '💰', label: 'WALLET', badge: 0 },
  ];

  function handleTabClick(id) {
    setTab(id);
    setSidebarOpen(false);
    setUnifiedSearch('');
    setSellerOrderSearch('');
    setCustomerSearch('');
    setProductSearch('');
  }

  function handleUnifiedSearch(value) {
    setUnifiedSearch(value);
    if (tab === 'orders') setSellerOrderSearch(value);
    else if (tab === 'customers') setCustomerSearch(value);
    else if (tab === 'products') setProductSearch(value);
  }

  const searchPlaceholder = (() => {
    switch (tab) {
      case 'products': return '🔍 SEARCH IN PRODUCTS...';
      case 'orders': return '🔍 SEARCH IN ORDERS...';
      case 'customers': return '🔍 SEARCH IN CUSTOMERS...';
      default: return '🔍 SEARCH...';
    }
  })();

  function Badge({ count }) {
    if (!count) return null;
    return (
      <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
        {count > 9 ? '9+' : count}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed md:sticky top-0 left-0 z-50 md:z-0 h-screen w-64 bg-indigo-900 text-white flex flex-col transition-transform duration-300 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-indigo-800 flex justify-between items-center">
          <div className="min-w-0">
            <h2 className="font-bold text-lg uppercase">SELLER</h2>
            {isImpersonating && (
              <p className="text-xs text-amber-300 truncate">ACTING AS: {sellerInfo?.full_name || 'SELLER'}</p>
            )}
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-2xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {sidebarMenu.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm font-semibold transition ${
                tab === item.id
                  ? 'bg-indigo-700 border-l-4 border-amber-400'
                  : 'hover:bg-indigo-800'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="flex-1 uppercase">{item.label}</span>
              <Badge count={item.badge} />
            </button>
          ))}
        </div>

        {isImpersonating && (
          <div className="p-4 border-t border-indigo-800">
            <button onClick={() => navigate('/admin')} className="w-full bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-xs font-bold uppercase">
              EXIT TO ADMIN
            </button>
          </div>
        )}

        <div className="p-4 border-t border-indigo-800 text-xs text-indigo-300">
          B STORE Seller Panel
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="md:hidden bg-indigo-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="text-2xl leading-none">☰</button>
          <h1 className="font-bold text-sm uppercase">SELLER DASHBOARD</h1>
          <div className="w-6"></div>
        </div>

        <div className="p-3 sm:p-6">
          <h1 className="hidden md:block text-2xl font-bold text-indigo-900 mb-6 uppercase">
            {isImpersonating ? `${sellerInfo?.full_name || 'SELLER'}'S DASHBOARD` : 'SELLER DASHBOARD'}
          </h1>

          <div className="mb-4">
            <input
              type="text"
              value={unifiedSearch}
              onChange={(e) => handleUnifiedSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-xl shadow">
              <p className="text-xs text-gray-500 uppercase">Products</p>
              <p className="text-2xl font-bold text-indigo-600">{products.length}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-white p-4 rounded-xl shadow">
              <p className="text-xs text-gray-500 uppercase">Pending</p>
              <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-white p-4 rounded-xl shadow">
              <p className="text-xs text-gray-500 uppercase">Approved</p>
              <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-xl shadow">
              <p className="text-xs text-gray-500 uppercase">Sales</p>
              <p className="text-2xl font-bold text-blue-600">GHS {totalRevenue.toFixed(2)}</p>
            </div>
          </div>

          {tab === 'products' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'ALL' },
                  { id: 'approved', label: 'APPROVED' },
                  { id: 'pending', label: 'PENDING' },
                  { id: 'rejected', label: 'REJECTED' },
                ].map(f => {
                  const count = f.id === 'all' ? products.length : products.filter(p => p.approval_status === f.id).length;
                  return (
                    <button key={f.id} onClick={() => setProductApprovalFilter(f.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${productApprovalFilter === f.id ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700'}`}>
                      {f.label} ({count})
                    </button>
                  );
                })}
              </div>
              {filteredProducts.length === 0 ? (
                <p className="text-gray-500 text-sm">No products.</p>
              ) : (
                filteredProducts.map(p => (
                  <div key={p.id} className="bg-white border rounded-xl p-3 sm:p-4 flex flex-wrap justify-between gap-3">
                    <div className="flex gap-3 items-center flex-1 min-w-0">
                      <div className="w-14 h-14 bg-gray-50 rounded-lg border flex items-center justify-center p-1 flex-shrink-0">
                        <img src={p.image_url || 'https://via.placeholder.com/100'} className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="text-sm min-w-0">
                        <p className="font-bold text-gray-800 truncate">{p.name}</p>
                        <p className="text-gray-600 text-xs">{p.category_name} • GHS {Number(p.price).toFixed(2)} • Stock: {p.stock}</p>
                        <span className={`text-xs font-semibold uppercase ${p.approval_status === 'pending' ? 'text-amber-600' : p.approval_status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                          {p.approval_status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => deleteProduct(p.id)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-semibold uppercase self-center">DELETE</button>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'add' && (
            <div className="bg-white rounded-xl shadow p-4 sm:p-6 max-w-2xl">
              {isImpersonating && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-800 uppercase">
                  ℹ️ AS ADMIN — PRODUCTS YOU ADD ARE <strong>AUTO-APPROVED</strong>.
                </div>
              )}
              <form onSubmit={handleAddProduct} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 uppercase">PRODUCT NAME</label>
                  <input type="text" required value={form.name} onChange={(e) => update('name', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 uppercase">DESCRIPTION</label>
                  <textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 uppercase">CATEGORY</label>
                    <select required value={form.category_name} onChange={(e) => update('category_name', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                      <option value="">SELECT...</option>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 uppercase">PRICE (GHS)</label>
                    <input type="number" step="0.01" required value={form.price} onChange={(e) => update('price', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 uppercase">STOCK</label>
                  <input type="number" required value={form.stock} onChange={(e) => update('stock', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 uppercase">PRODUCT IMAGE</label>
                  <div className="space-y-2 mt-1">
                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="w-full text-xs" />
                    {uploading && <p className="text-xs text-amber-600">UPLOADING...</p>}
                    <input type="url" value={form.image_url} onChange={(e) => update('image_url', e.target.value)} placeholder="PASTE IMAGE URL" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </div>
                {form.image_url && (
                  <div className="w-32 h-32 bg-gray-50 rounded-lg border flex items-center justify-center p-2">
                    <img src={form.image_url} className="max-w-full max-h-full object-contain" />
                  </div>
                )}
                {message && (
                  <div className={`text-xs px-3 py-2 rounded-lg ${message.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{message}</div>
                )}
                <button type="submit" disabled={uploading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg text-sm uppercase">ADD PRODUCT</button>
              </form>
            </div>
          )}

          {tab === 'orders' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'ALL' },
                  { id: 'placed', label: 'PLACED' },
                  { id: 'processing', label: 'PROCESSING' },
                  { id: 'dispatched', label: 'DISPATCHED' },
                  { id: 'delivered', label: 'DELIVERED' },
                  { id: 'completed', label: 'COMPLETED' },
                ].map(f => {
                  const count = f.id === 'all' ? orders.length : orders.filter(o => o.seller_status === f.id).length;
                  return (
                    <button key={f.id} onClick={() => setSellerOrderFilter(f.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${sellerOrderFilter === f.id ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700'}`}>
                      {f.label} ({count})
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: '💰 ALL PAYMENTS' },
                  { id: 'paystack', label: '💳 PAID ONLINE' },
                  { id: 'pay_on_delivery', label: '💵 PAY ON DELIVERY' },
                ].map(f => {
                  const count = f.id === 'all' ? orders.length : orders.filter(o => o.payment_method === f.id).length;
                  return (
                    <button key={f.id} onClick={() => setSellerPaymentFilter(f.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${sellerPaymentFilter === f.id ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-700'}`}>
                      {f.label} ({count})
                    </button>
                  );
                })}
              </div>
              {filteredOrders.length === 0 ? (
                <p className="text-gray-500 text-sm">No orders in this filter.</p>
              ) : (
                filteredOrders.map(o => (
                  <div key={o.id} className="bg-white border rounded-xl p-3 sm:p-4">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-bold text-gray-700">ORDER: {o.order_id.slice(0, 8)}...</span>
                      <span className={`px-2 py-0.5 rounded font-semibold uppercase ${o.seller_status === 'placed' ? 'bg-amber-100 text-amber-800' : o.seller_status === 'processing' ? 'bg-blue-100 text-blue-800' : o.seller_status === 'dispatched' ? 'bg-indigo-100 text-indigo-800' : o.seller_status === 'delivered' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                        {o.seller_status}
                      </span>
                    </div>
                    {o.customer_name && <p className="text-xs text-gray-600 mb-2 uppercase">👤 <strong>{o.customer_name}</strong> {o.customer_phone && `— ${o.customer_phone}`}</p>}
                    {o.payment_method && (
                      <p className="text-xs mb-2">
                        {o.payment_method === 'paystack' ? <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold uppercase">💳 PAID ONLINE</span> : <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold uppercase">💵 PAY ON DELIVERY</span>}
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-50 rounded border flex items-center justify-center p-1 flex-shrink-0">
                        <img src={o.product_image || 'https://via.placeholder.com/100'} className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="text-sm flex-1 min-w-0">
                        <p className="font-bold truncate">{o.product_name}</p>
                        <p className="text-gray-600 text-xs">QTY: {o.quantity} × GHS {Number(o.unit_price).toFixed(2)}</p>
                        <p className="font-bold text-indigo-700 text-xs uppercase">SUBTOTAL: GHS {Number(o.subtotal).toFixed(2)}</p>
                      </div>
                    </div>
                    {o.seller_delivery_note && (
                      <div className="mt-3 bg-amber-50 border border-amber-300 rounded-lg p-2 text-xs">
                        <p className="font-bold text-amber-800 uppercase">📦 {o.seller_delivery_note}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                      {o.seller_status === 'placed' && <button onClick={() => markStatus(o.id, 'processing')} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs font-semibold uppercase">MARK PROCESSING</button>}
                      {o.seller_status === 'processing' && <button onClick={() => markStatus(o.id, 'dispatched')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs font-semibold uppercase">MARK DISPATCHED</button>}
                      {o.seller_status === 'dispatched' && <button onClick={() => markStatus(o.id, 'delivered')} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded text-xs font-semibold uppercase">MARK DELIVERED</button>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'customers' && (
            <div className="space-y-3">
              {filteredCustomers.length === 0 ? (
                <p className="text-gray-500 text-sm">No customers.</p>
              ) : (
                filteredCustomers.map(c => {
                  const newCount = c.orders.filter(o => o.seller_status === 'placed').length;
                  const inProgressCount = c.orders.filter(o => ['processing', 'dispatched'].includes(o.seller_status)).length;
                  const deliveredCount = c.orders.filter(o => o.seller_status === 'delivered').length;
                  return (
                    <div key={c.customer_id} className="bg-white border rounded-xl p-3 sm:p-4">
                      <div className="flex flex-wrap justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-xl flex-shrink-0">👤</div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-800 truncate uppercase">{c.customer_name}</p>
                            <p className="text-xs text-gray-600">{c.customer_phone || 'No phone'}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 self-center">
                          {newCount > 0 && <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded uppercase">🔴 {newCount} NEW</span>}
                          {inProgressCount > 0 && <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded uppercase">🟠 {inProgressCount} IN PROGRESS</span>}
                          {deliveredCount > 0 && <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded uppercase">🟣 {deliveredCount} DELIVERED</span>}
                          {newCount === 0 && inProgressCount === 0 && deliveredCount === 0 && <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded uppercase">✅ ALL DONE</span>}
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {c.orders.map(o => (
                          <div key={o.id} className="bg-gray-50 border rounded-lg p-2 text-xs flex items-center gap-3">
                            <div className="w-8 h-8 bg-white rounded border flex items-center justify-center p-0.5 flex-shrink-0">
                              <img src={o.product_image || 'https://via.placeholder.com/100'} className="max-w-full max-h-full object-contain" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 truncate">{o.product_name}</p>
                              <p className="text-gray-500">×{o.quantity} • GHS {Number(o.subtotal).toFixed(2)}</p>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${o.seller_status === 'placed' ? 'bg-amber-100 text-amber-800' : o.seller_status === 'processing' ? 'bg-blue-100 text-blue-800' : o.seller_status === 'dispatched' ? 'bg-indigo-100 text-indigo-800' : o.seller_status === 'delivered' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                              {o.seller_status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'wallet' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl p-4 sm:p-6 shadow-lg">
                <p className="text-xs sm:text-sm opacity-90 uppercase">TOTAL OWED TO ME</p>
                <p className="text-2xl sm:text-4xl font-bold mt-2">GHS {availableBalance.toFixed(2)}</p>
              </div>

              <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-indigo-900 text-white uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 text-left">SELLER</th>
                        <th className="px-4 py-3 text-right">PAYSTACK</th>
                        <th className="px-4 py-3 text-right">POD</th>
                        <th className="px-4 py-3 text-right">LIFETIME NET</th>
                        <th className="px-4 py-3 text-right">PAID</th>
                        <th className="px-4 py-3 text-right">OWED NOW</th>
                        <th className="px-4 py-3 text-center">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-800 uppercase">{sellerInfo?.full_name || 'YOU'}</p>
                          <p className="text-xs text-gray-500">{sellerInfo?.whatsapp || ''}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-semibold text-indigo-600">GHS {paystackSales.toFixed(2)}</p>
                          <p className="text-[10px] text-gray-500">({paystackItems.length} items)</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-semibold text-amber-600">GHS {podSales.toFixed(2)}</p>
                          <p className="text-[10px] text-gray-500">({podItems.length} items)</p>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">GHS {totalNet.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">GHS {paidSoFar.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold ${availableBalance > 0 ? 'text-red-600' : 'text-gray-400'}`}>GHS {availableBalance.toFixed(2)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => setViewingWalletBreakdown(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs font-semibold uppercase">VIEW</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow p-4 sm:p-6">
                <h3 className="font-bold text-gray-800 mb-3 uppercase">💰 REQUEST PAYOUT</h3>
                <form onSubmit={requestPayout} className="flex flex-wrap gap-2">
                  <input type="number" step="0.01" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} placeholder="AMOUNT (GHS)" className="flex-1 min-w-[150px] px-3 py-2 border rounded-lg text-sm" />
                  <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold uppercase">REQUEST</button>
                </form>
              </div>

              <div className="bg-white rounded-xl shadow p-4 sm:p-6">
                <h3 className="font-bold text-gray-800 mb-3 uppercase">📜 PAYOUT HISTORY</h3>
                {payouts.length === 0 ? (
                  <p className="text-sm text-gray-500">No payouts yet.</p>
                ) : (
                  <div className="space-y-2">
                    {payouts.map(p => (
                      <div key={p.id} className="flex justify-between items-center bg-gray-50 border rounded-lg px-3 py-2 text-sm">
                        <div>
                          <p className="font-bold">GHS {Number(p.amount).toFixed(2)}</p>
                          <p className="text-xs text-gray-500">{new Date(p.requested_at).toLocaleDateString('en-GB')}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded font-semibold uppercase ${p.status === 'pending' ? 'bg-amber-100 text-amber-800' : p.status === 'approved' ? 'bg-blue-100 text-blue-800' : p.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {viewingWalletBreakdown && (
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-lg font-bold text-gray-800 uppercase">💰 WALLET BREAKDOWN</h2>
                  <button onClick={() => setViewingWalletBreakdown(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b uppercase">
                        <th className="text-left pb-2">TYPE</th>
                        <th className="text-right pb-2">SALES</th>
                        <th className="text-right pb-2">COMM 5%</th>
                        <th className="text-right pb-2">NET</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2">💳 PAYSTACK</td>
                        <td className="text-right">GHS {paystackSales.toFixed(2)}</td>
                        <td className="text-right text-red-600">-GHS {paystackComm.toFixed(2)}</td>
                        <td className="text-right font-semibold">GHS {paystackNet.toFixed(2)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">💵 PAY ON DELIVERY</td>
                        <td className="text-right">GHS {podSales.toFixed(2)}</td>
                        <td className="text-right text-red-600">-GHS {podComm.toFixed(2)}</td>
                        <td className="text-right font-semibold">GHS {podNet.toFixed(2)}</td>
                      </tr>
                      <tr className="border-t-2 font-bold">
                        <td className="py-2">TOTAL</td>
                        <td className="text-right">GHS {totalSales.toFixed(2)}</td>
                        <td className="text-right text-red-600">-GHS {totalComm.toFixed(2)}</td>
                        <td className="text-right text-green-700">GHS {totalNet.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="bg-white rounded-xl p-4 border-2 border-gray-200 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs text-gray-500 uppercase">ALREADY PAID</p>
                    <p className="font-bold text-gray-700">GHS {paidSoFar.toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <p className="text-sm font-bold text-gray-800 uppercase">OWED NOW</p>
                    <p className={`text-xl font-bold ${availableBalance > 0 ? 'text-red-600' : 'text-gray-400'}`}>GHS {availableBalance.toFixed(2)}</p>
                  </div>
                </div>

                <button onClick={() => setViewingWalletBreakdown(false)} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 rounded-lg text-sm uppercase">CLOSE</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}