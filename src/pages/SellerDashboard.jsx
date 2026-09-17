import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function SellerDashboard() {
  const { user, isSeller, isAdmin } = useAuth();
  const { sellerId } = useParams();
  const navigate = useNavigate();

  // Whose dashboard is being viewed?
  const viewingSellerId = sellerId || user?.id;
  const isImpersonating = isAdmin && sellerId && sellerId !== user?.id;
  const canAccess = isSeller || (isAdmin && sellerId);

  const [tab, setTab] = useState('products');
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

  // Group orders by customer
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

  const customersWithAction = customers.filter(c =>
    c.orders.some(o => ['placed', 'processing', 'dispatched'].includes(o.seller_status))
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {isImpersonating && (
        <div className="bg-amber-100 border-2 border-amber-500 rounded-xl p-3 sm:p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-amber-900 text-sm">Acting as: {sellerInfo?.full_name || 'Seller'}</p>
              <p className="text-xs text-amber-700">You are viewing this seller's dashboard as admin. All actions are silent.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-bold"
          >
            Exit to Admin
          </button>
        </div>
      )}

      <h1 className="text-xl sm:text-2xl font-bold text-indigo-900 mb-4 sm:mb-6">
        {isImpersonating ? `${sellerInfo?.full_name || 'Seller'}'s Dashboard` : 'Seller Dashboard'}
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
          <p className="text-[10px] sm:text-xs text-gray-500">Products</p>
          <p className="text-lg sm:text-2xl font-bold text-indigo-600">{products.length}</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
          <p className="text-[10px] sm:text-xs text-gray-500">Pending</p>
          <p className="text-lg sm:text-2xl font-bold text-amber-600">{pendingCount}</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
          <p className="text-[10px] sm:text-xs text-gray-500">Approved</p>
          <p className="text-lg sm:text-2xl font-bold text-green-600">{approvedCount}</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
          <p className="text-[10px] sm:text-xs text-gray-500">Sales</p>
          <p className="text-lg sm:text-2xl font-bold text-blue-600">GHS {totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
        {[
          { id: 'products', label: '📦 Products', badge: 0 },
          { id: 'add', label: '➕ Add Product', badge: 0 },
          { id: 'orders', label: '📋 Orders', badge: newOrdersCount },
          { id: 'customers', label: '👤 Customers', badge: customersWithAction },
          { id: 'wallet', label: '💰 Wallet', badge: 0 },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center ${tab === t.id ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700'}`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {t.badge > 9 ? '9+' : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <div className="space-y-3">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : products.length === 0 ? (
            <p className="text-gray-500 text-sm">No products yet.</p>
          ) : (
            products.map(p => (
              <div key={p.id} className="bg-white border rounded-xl p-3 sm:p-4 flex flex-wrap justify-between gap-3">
                <div className="flex gap-3 items-center flex-1 min-w-0">
                  <div className="w-14 h-14 bg-gray-50 rounded-lg border flex items-center justify-center p-1 flex-shrink-0">
                    <img src={p.image_url || 'https://via.placeholder.com/100'} className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="text-sm min-w-0">
                    <p className="font-bold text-gray-800 truncate">{p.name}</p>
                    <p className="text-gray-600 text-xs">{p.category_name} • GHS {Number(p.price).toFixed(2)} • Stock: {p.stock}</p>
                    <span className={`text-xs font-semibold ${
                      p.approval_status === 'pending' ? 'text-amber-600' :
                      p.approval_status === 'approved' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {p.approval_status === 'pending' ? '⏳ Pending' :
                       p.approval_status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => deleteProduct(p.id)}
                  className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-semibold self-center"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'add' && (
        <div className="bg-white rounded-xl shadow p-4 sm:p-6 max-w-2xl">
          {isImpersonating && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-800">
              ℹ️ As admin, products you add for this seller are <strong>auto-approved</strong> (no pending review).
            </div>
          )}
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Product Name</label>
              <input type="text" required value={form.name} onChange={(e) => update('name', e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select required value={form.category_name} onChange={(e) => update('category_name', e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select category...</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Price (GHS)</label>
                <input type="number" step="0.01" required value={form.price} onChange={(e) => update('price', e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Stock</label>
              <input type="number" required value={form.stock} onChange={(e) => update('stock', e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Product Image</label>
              <div className="space-y-2 mt-1">
                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="w-full text-xs" />
                {uploading && <p className="text-xs text-amber-600 mt-1">Uploading...</p>}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <span className="text-xs text-gray-400">OR</span>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>
                <input type="url" value={form.image_url} onChange={(e) => update('image_url', e.target.value)}
                  placeholder="Paste image URL"
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            {form.image_url && (
              <div className="w-32 h-32 bg-gray-50 rounded-lg border flex items-center justify-center p-2">
                <img src={form.image_url} className="max-w-full max-h-full object-contain" />
              </div>
            )}
            {message && (
              <div className={`text-xs px-3 py-2 rounded-lg ${message.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {message}
              </div>
            )}
            <button type="submit" disabled={uploading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg text-sm disabled:opacity-60">
              Add Product
            </button>
          </form>
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <p className="text-gray-500 text-sm">No orders yet.</p>
          ) : (
            orders.map(o => (
              <div key={o.id} className="bg-white border rounded-xl p-3 sm:p-4">
                <div className="flex justify-between text-xs mb-2">
                  <span className="font-bold text-gray-700">Order: {o.order_id.slice(0, 8)}...</span>
                  <span className={`px-2 py-0.5 rounded font-semibold ${
                    o.seller_status === 'placed' ? 'bg-amber-100 text-amber-800' :
                    o.seller_status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    o.seller_status === 'dispatched' ? 'bg-indigo-100 text-indigo-800' :
                    o.seller_status === 'delivered' ? 'bg-purple-100 text-purple-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {o.seller_status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-50 rounded border flex items-center justify-center p-1 flex-shrink-0">
                    <img src={o.product_image || 'https://via.placeholder.com/100'} className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="text-sm flex-1 min-w-0">
                    <p className="font-bold truncate">{o.product_name}</p>
                    <p className="text-gray-600 text-xs">Qty: {o.quantity} × GHS {Number(o.unit_price).toFixed(2)}</p>
                    <p className="font-bold text-indigo-700 text-xs">Subtotal: GHS {Number(o.subtotal).toFixed(2)}</p>
                  </div>
                </div>
                {o.seller_delivery_note && (
                  <div className="mt-3 bg-amber-50 border border-amber-300 rounded-lg p-2 text-xs">
                    <p className="font-bold text-amber-800">📦 {o.seller_delivery_note}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                  {o.seller_status === 'placed' && (
                    <button onClick={() => markStatus(o.id, 'processing')} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs font-semibold">Mark Processing</button>
                  )}
                  {o.seller_status === 'processing' && (
                    <button onClick={() => markStatus(o.id, 'dispatched')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs font-semibold">Mark Dispatched</button>
                  )}
                  {o.seller_status === 'dispatched' && (
                    <button onClick={() => markStatus(o.id, 'delivered')} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded text-xs font-semibold">Mark Delivered</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'customers' && (
        <div className="space-y-3">
          {customers.length === 0 ? (
            <p className="text-gray-500 text-sm">No customers yet.</p>
          ) : (
            customers.map(c => {
              const newCount = c.orders.filter(o => o.seller_status === 'placed').length;
              const inProgressCount = c.orders.filter(o => ['processing', 'dispatched'].includes(o.seller_status)).length;
              const deliveredCount = c.orders.filter(o => o.seller_status === 'delivered').length;

              return (
                <div key={c.customer_id} className="bg-white border rounded-xl p-3 sm:p-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                        👤
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-800 truncate">{c.customer_name}</p>
                        <p className="text-xs text-gray-600">{c.customer_phone || 'No phone'}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 self-center">
                      {newCount > 0 && (
                        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">🔴 {newCount} new</span>
                      )}
                      {inProgressCount > 0 && (
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">🟠 {inProgressCount} in progress</span>
                      )}
                      {deliveredCount > 0 && (
                        <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded">🟣 {deliveredCount} delivered</span>
                      )}
                      {newCount === 0 && inProgressCount === 0 && deliveredCount === 0 && (
                        <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">✅ All done</span>
                      )}
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
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          o.seller_status === 'placed' ? 'bg-amber-100 text-amber-800' :
                          o.seller_status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          o.seller_status === 'dispatched' ? 'bg-indigo-100 text-indigo-800' :
                          o.seller_status === 'delivered' ? 'bg-purple-100 text-purple-800' :
                          'bg-green-100 text-green-800'
                        }`}>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
              <p className="text-[10px] sm:text-xs text-gray-500">Total Gross</p>
              <p className="text-base sm:text-xl font-bold text-indigo-600">GHS {Number(wallet?.total_gross || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
              <p className="text-[10px] sm:text-xs text-gray-500">Commission 5%</p>
              <p className="text-base sm:text-xl font-bold text-red-600">- GHS {Number(wallet?.total_commission || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
              <p className="text-[10px] sm:text-xs text-gray-500">Total Net</p>
              <p className="text-base sm:text-xl font-bold text-green-600">GHS {Number(wallet?.total_net || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-xl shadow border-2 border-emerald-500">
              <p className="text-[10px] sm:text-xs text-gray-500">Available</p>
              <p className="text-base sm:text-xl font-bold text-emerald-600">GHS {Number(wallet?.available_balance || 0).toFixed(2)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4 sm:p-6">
            <h3 className="font-bold text-gray-800 mb-3">💰 Request Payout</h3>
            <form onSubmit={requestPayout} className="flex flex-wrap gap-2">
              <input type="number" step="0.01" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="Amount (GHS)"
                className="flex-1 min-w-[150px] px-3 py-2 border rounded-lg text-sm" />
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Request</button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow p-4 sm:p-6">
            <h3 className="font-bold text-gray-800 mb-3">📜 Payout History</h3>
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
                    <span className={`text-xs px-2 py-1 rounded font-semibold ${
                      p.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      p.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                      p.status === 'paid' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}