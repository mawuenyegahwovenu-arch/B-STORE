import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const { isAdmin, user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [pendingSellers, setPendingSellers] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [allSellers, setAllSellers] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [approvedSellers, setApprovedSellers] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [newCategory, setNewCategory] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteCategoryModal, setDeleteCategoryModal] = useState(null);

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
  });

  const [productForm, setProductForm] = useState({
    seller_id: 'STORE',
    name: '',
    description: '',
    category_name: '',
    price: '',
    stock: '',
    image_url: '',
  });
  const [productMsg, setProductMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isAdmin) loadAll();
  }, [isAdmin]);

  async function loadAll() {
    setDataLoading(true);

    const [sellersRes, productsRes, catsRes, ordersRes, allProductsRes, approvedSellersRes, payoutsRes, walletsRes, allSellersRes, customersRes] = await Promise.all([
      supabase.from('sellers').select('*').eq('status', 'pending'),
      supabase.from('products').select('*').eq('approval_status', 'pending').or('is_deleted.is.null,is_deleted.eq.false'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('id').or('is_deleted.is.null,is_deleted.eq.false'),
      supabase.from('sellers').select('user_id, full_name').eq('status', 'approved'),
      supabase.from('payouts').select('*').order('requested_at', { ascending: false }),
      supabase.from('wallets').select('*'),
      supabase.from('sellers').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('*').eq('role', 'customer').order('created_at', { ascending: false }),
    ]);

    setPendingSellers(sellersRes.data || []);
    setPendingProducts(productsRes.data || []);
    setCategories(catsRes.data || []);
    setApprovedSellers(approvedSellersRes.data || []);
    setPayouts(payoutsRes.data || []);
    setWallets(walletsRes.data || []);
    setAllSellers(allSellersRes.data || []);
    setAllCustomers(customersRes?.data || []);

    const { data: allProds } = await supabase
      .from('products')
      .select('*')
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('created_at', { ascending: false });
    setAllProducts(allProds || []);

    const ordersList = ordersRes.data || [];
    const enriched = await Promise.all(ordersList.map(async (order) => {
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);
      return { ...order, items: items || [] };
    }));

    setOrders(enriched);

    const pending = ordersList.filter(o => o.order_status === 'placed').length;
    const revenue = ordersList
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    setStats({
      totalProducts: (allProductsRes.data || []).length,
      totalOrders: ordersList.length,
      pendingOrders: pending,
      totalRevenue: revenue,
    });

    setDataLoading(false);
  }

  function updateProduct(field, value) {
    setProductForm({ ...productForm, [field]: value });
  }

  async function handleAdminImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image too large. Max 5MB.');
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const filename = `admin/${Date.now()}.${ext}`;

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

    updateProduct('image_url', urlData.publicUrl);
    setUploading(false);
  }

  async function handleAdminAddProduct(e) {
    e.preventDefault();
    setProductMsg('');

    if (!productForm.category_name) {
      setProductMsg('Please choose a category.');
      return;
    }
    if (!productForm.image_url) {
      setProductMsg('Please upload an image or paste an image URL.');
      return;
    }

    let sellerId, sellerName;
    if (productForm.seller_id === 'STORE') {
      sellerId = user.id;
      sellerName = 'B STORE';
    } else {
      sellerId = productForm.seller_id;
      const found = approvedSellers.find(s => s.user_id === productForm.seller_id);
      sellerName = found ? found.full_name : 'SELLER';
    }

    const { error } = await supabase.from('products').insert({
      seller_id: sellerId,
      seller_name: sellerName,
      name: productForm.name,
      description: productForm.description,
      category_name: productForm.category_name,
      price: parseFloat(productForm.price),
      stock: parseInt(productForm.stock),
      image_url: productForm.image_url,
      approval_status: 'approved',
      is_active: true,
      is_deleted: false,
      approved_at: new Date().toISOString(),
    });

    if (error) {
      setProductMsg('Error: ' + error.message);
      return;
    }

    setProductMsg('✅ Product added and live!');
    setProductForm({ seller_id: 'STORE', name: '', description: '', category_name: '', price: '', stock: '', image_url: '' });
    loadAll();
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingProduct) return;

    const { error } = await supabase
      .from('products')
      .update({
        name: editingProduct.name,
        description: editingProduct.description,
        category_name: editingProduct.category_name,
        price: parseFloat(editingProduct.price),
        stock: parseInt(editingProduct.stock),
        image_url: editingProduct.image_url,
      })
      .eq('id', editingProduct.id);

    if (error) {
      alert('Error: ' + error.message);
      return;
    }

    setEditingProduct(null);
    loadAll();
    alert('Product updated!');
  }

  async function softDeleteProduct(id) {
    if (!confirm('Hide this product? (You can restore it later from the database)')) return;
    await supabase.from('products').update({ is_deleted: true, is_active: false }).eq('id', id);
    loadAll();
  }

  async function approveSeller(seller) {
    if (!confirm(`Approve ${seller.full_name} as a seller?`)) return;
    await supabase
      .from('sellers')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', seller.id);
    await supabase.from('users').update({ role: 'seller' }).eq('id', seller.user_id);
    await supabase.from('wallets').insert({ seller_id: seller.user_id });
    loadAll();
    alert('Seller approved!');
  }

  async function rejectSeller(seller) {
    const reason = prompt('Reason for rejection (optional):');
    await supabase
      .from('sellers')
      .update({ status: 'rejected', rejection_reason: reason || null })
      .eq('id', seller.id);
    loadAll();
  }

  async function blockSeller(seller) {
    if (!confirm(`Block ${seller.full_name}? All their products will be hidden.`)) return;
    await supabase.from('sellers').update({ status: 'suspended' }).eq('id', seller.id);
    await supabase.from('products').update({ is_active: false }).eq('seller_id', seller.user_id);
    loadAll();
    alert('Seller blocked.');
  }

  async function unblockSeller(seller) {
    if (!confirm(`Unblock ${seller.full_name}?`)) return;
    await supabase.from('sellers').update({ status: 'approved' }).eq('id', seller.id);
    await supabase.from('products').update({ is_active: true }).eq('seller_id', seller.user_id);
    loadAll();
    alert('Seller unblocked.');
  }

  async function approveProduct(product) {
    if (!confirm(`Approve product: ${product.name}?`)) return;
    await supabase
      .from('products')
      .update({ approval_status: 'approved', approved_at: new Date().toISOString(), is_active: true })
      .eq('id', product.id);
    loadAll();
  }

  async function rejectProduct(product) {
    const reason = prompt('Reason for rejection (optional):');
    await supabase
      .from('products')
      .update({ approval_status: 'rejected', rejection_reason: reason || null })
      .eq('id', product.id);
    loadAll();
  }

  async function addCategory(e) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    const name = newCategory.trim().toUpperCase();
    const { error } = await supabase.from('categories').insert({ name });
    if (error) { alert(error.message); return; }
    setNewCategory('');
    loadAll();
  }

  async function saveCategoryEdit(e) {
    e.preventDefault();
    if (!editingCategory) return;

    const newName = editingCategory.name.trim().toUpperCase();
    if (!newName) return;

    await supabase.from('categories').update({ name: newName }).eq('id', editingCategory.id);
    await supabase.from('products').update({ category_name: newName }).eq('category_name', editingCategory.oldName);

    setEditingCategory(null);
    loadAll();
    alert('Category renamed!');
  }

  async function tryDeleteCategory(cat) {
    const { data: prods } = await supabase
      .from('products')
      .select('id, name')
      .eq('category_name', cat.name)
      .or('is_deleted.is.null,is_deleted.eq.false');

    if (prods && prods.length > 0) {
      setDeleteCategoryModal({ category: cat, products: prods, moveTo: '' });
    } else {
      if (!confirm(`Delete "${cat.name}"?`)) return;
      await supabase.from('categories').delete().eq('id', cat.id);
      loadAll();
    }
  }

  async function confirmMoveAndDelete() {
    if (!deleteCategoryModal) return;
    const { category, moveTo } = deleteCategoryModal;

    if (!moveTo) {
      alert('Please choose a category to move products to.');
      return;
    }

    await supabase.from('products').update({ category_name: moveTo }).eq('category_name', category.name);
    await supabase.from('categories').delete().eq('id', category.id);

    setDeleteCategoryModal(null);
    loadAll();
    alert('Products moved and category deleted!');
  }

  async function updateOrderStatus(orderId, newStatus) {
    if (!confirm(`Mark this order as "${newStatus}"?`)) return;
    await supabase.from('orders').update({ order_status: newStatus }).eq('id', orderId);
    loadAll();
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
      `🛒 Your items:\n` +
      `• ${item.product_name} (×${item.quantity}) — GHS ${Number(item.subtotal).toFixed(2)}\n\n` +
      `💰 Your total: GHS ${Number(item.subtotal).toFixed(2)}\n\n` +
      `Please update your seller dashboard when you deliver.`;

    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  async function approvePayout(payout) {
    if (!confirm(`Approve payout of GHS ${Number(payout.amount).toFixed(2)}?`)) return;
    await supabase
      .from('payouts')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', payout.id);
    loadAll();
  }

  async function markPayoutPaid(payout) {
    if (!confirm(`Mark this payout as PAID?`)) return;
    await supabase
      .from('payouts')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', payout.id);

    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('seller_id', payout.seller_id)
      .single();

    if (wallet) {
      await supabase
        .from('wallets')
        .update({
          available_balance: Math.max(0, Number(wallet.available_balance || 0) - Number(payout.amount)),
          updated_at: new Date().toISOString(),
        })
        .eq('seller_id', payout.seller_id);
    }

    loadAll();
    alert('Payout marked as paid!');
  }

  function findSellerName(sellerId) {
    const s = approvedSellers.find(x => x.user_id === sellerId);
    return s ? s.full_name : 'Unknown Seller';
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

  function sellerStatusColor(status) {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'suspended': return 'bg-gray-800 text-white';
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

  const pendingOrdersCount = orders.filter(o => o.order_status === 'placed').length;
  const pendingSellersCount = pendingSellers.length;
  const pendingProductsCount = pendingProducts.length;
  const pendingPayoutsCount = payouts.filter(p => p.status === 'pending').length;

  const customersWithAction = dataLoading ? 0 : allCustomers.filter(cust => {
    const custOrders = orders.filter(o => o.customer_id === cust.id);
    return custOrders.some(o => ['placed', 'processing', 'dispatched', 'delivered'].includes(o.order_status));
  }).length;

  function Badge({ count }) {
    if (!count) return null;
    return (
      <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
        {count > 9 ? '9+' : count}
      </span>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <h1 className="text-xl sm:text-2xl font-bold text-indigo-900 mb-4 sm:mb-6">Admin Dashboard</h1>

      <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
        {[
          { id: 'overview', label: '📊 Overview', badge: 0 },
          { id: 'orders', label: '📦 Orders', badge: pendingOrdersCount },
          { id: 'customers', label: '👤 Customers', badge: customersWithAction },
          { id: 'sellers', label: '👥 Pending Sellers', badge: pendingSellersCount },
          { id: 'products', label: '⏳ Pending Products', badge: pendingProductsCount },
          { id: 'all-sellers', label: '👥 All Sellers', badge: 0 },
          { id: 'all-products', label: '📦 All Products', badge: 0 },
          { id: 'add-product', label: '➕ Add Product', badge: 0 },
          { id: 'payouts', label: '💰 Payouts', badge: pendingPayoutsCount },
          { id: 'categories', label: '📁 Categories', badge: 0 },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center ${tab === t.id ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700'}`}
          >
            {t.label}
            <Badge count={t.badge} />
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
              <p className="text-[10px] sm:text-xs text-gray-500">Products</p>
              <p className="text-lg sm:text-2xl font-bold text-indigo-600">{stats.totalProducts}</p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
              <p className="text-[10px] sm:text-xs text-gray-500">Orders</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600">{stats.totalOrders}</p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
              <p className="text-[10px] sm:text-xs text-gray-500">Pending Orders</p>
              <p className="text-lg sm:text-2xl font-bold text-amber-600">{stats.pendingOrders}</p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
              <p className="text-[10px] sm:text-xs text-gray-500">Revenue</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-600">GHS {stats.totalRevenue.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl p-4 sm:p-6 shadow-lg">
            <p className="text-xs sm:text-sm opacity-90">Total B STORE Commission Earned (5%)</p>
            <p className="text-2xl sm:text-4xl font-bold mt-2">
              GHS {wallets.reduce((s, w) => s + Number(w.total_commission || 0), 0).toFixed(2)}
            </p>
          </div>
        </>
      )}

      {tab === 'customers' && (
        <div className="space-y-3">
          {dataLoading ? (
            <p className="text-gray-500 text-sm">Loading customers...</p>
          ) : allCustomers.filter(c => orders.some(o => o.customer_id === c.id)).length === 0 ? (
            <p className="text-gray-500 text-sm">No customers with orders yet.</p>
          ) : (
            allCustomers
              .filter(cust => orders.some(o => o.customer_id === cust.id))
              .map(cust => {
                const custOrders = orders.filter(o => o.customer_id === cust.id);
                const newCount = custOrders.filter(o => o.order_status === 'placed').length;
                const inProgressCount = custOrders.filter(o => ['processing', 'dispatched'].includes(o.order_status)).length;
                const readyCount = custOrders.filter(o => o.order_status === 'delivered').length;

                return (
                  <Link
                    key={cust.id}
                    to={`/admin/customer/${cust.id}`}
                    className="block bg-white border rounded-xl p-4 hover:shadow-lg transition"
                  >
                    <div className="flex flex-wrap justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                          👤
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-800 truncate">{cust.full_name || 'Customer'}</p>
                          <p className="text-xs text-gray-600">{cust.phone || 'No phone'}</p>
                          <p className="text-xs text-gray-400 truncate">{cust.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 self-center">
                        {newCount > 0 && (
                          <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">
                            🔴 {newCount} new
                          </span>
                        )}
                        {inProgressCount > 0 && (
                          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                            🟠 {inProgressCount} in progress
                          </span>
                        )}
                        {readyCount > 0 && (
                          <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded">
                            🟣 {readyCount} ready
                          </span>
                        )}
                        {newCount === 0 && inProgressCount === 0 && readyCount === 0 && (
                          <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">
                            ✅ All done
                          </span>
                        )}
                        <span className="text-xs text-gray-500 self-center">
                          {custOrders.length} order{custOrders.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
          )}
        </div>
      )}

      {tab === 'all-sellers' && (
        <div className="space-y-3">
          {allSellers.length === 0 ? (
            <p className="text-gray-500 text-sm">No sellers yet.</p>
          ) : (
            allSellers.map(s => (
              <div key={s.id} className="bg-white border rounded-xl p-3 sm:p-4 flex flex-wrap justify-between gap-3">
                <div className="text-sm">
                  <p className="font-bold text-gray-800">{s.full_name}</p>
                  <p className="text-gray-600 text-xs">📞 {s.phone} | 💬 {s.whatsapp}</p>
                  <p className="text-gray-600 text-xs">📍 {s.region} — {s.address}</p>
                  <p className="text-gray-500 text-xs mt-1">Delivery: {s.location_1}{s.location_2 ? ` / ${s.location_2}` : ''}</p>
                  <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded font-semibold ${sellerStatusColor(s.status)}`}>
                    {s.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex gap-2 self-center flex-wrap">
                  {s.status === 'pending' && (
                    <>
                      <button onClick={() => approveSeller(s)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-semibold">✅ Approve</button>
                      <button onClick={() => rejectSeller(s)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-semibold">❌ Reject</button>
                    </>
                  )}
                  {s.status === 'approved' && (
  <Link to={`/admin/enter-seller/${s.user_id}`} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-xs font-semibold">
    🔓 Enter Dashboard
  </Link>
)}
                  {s.status === 'approved' && (
                    <button onClick={() => blockSeller(s)} className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-1.5 rounded text-xs font-semibold">🚫 Block</button>
                  )}
                  {s.status === 'suspended' && (
                    <button onClick={() => unblockSeller(s)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-semibold">✅ Unblock</button>
                  )}
                  {s.status === 'rejected' && (
                    <button onClick={() => approveSeller(s)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-semibold">✅ Re-Approve</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'all-products' && (
        <div className="space-y-3">
          {allProducts.length === 0 ? (
            <p className="text-gray-500 text-sm">No products yet.</p>
          ) : (
            allProducts.map(p => (
              <div key={p.id} className="bg-white border rounded-xl p-3 sm:p-4 flex flex-wrap justify-between gap-3">
                <div className="flex gap-3 items-center flex-1 min-w-0">
                  <div className="w-14 h-14 bg-gray-50 rounded-lg border flex items-center justify-center p-1 flex-shrink-0">
                    <img src={p.image_url || 'https://via.placeholder.com/100'} className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="text-sm min-w-0">
                    <p className="font-bold text-gray-800 truncate">{p.name}</p>
                    <p className="text-gray-600 text-xs">{p.category_name} • GHS {Number(p.price).toFixed(2)} • Stock: {p.stock}</p>
                    <p className="text-xs text-gray-500">Seller: {p.seller_name}</p>
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded font-semibold ${
                      p.approval_status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      p.approval_status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {p.approval_status.toUpperCase()}
                      {!p.is_active && ' • HIDDEN'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 self-center flex-wrap">
                  <button onClick={() => setEditingProduct({ ...p })} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-semibold">✏️ Edit</button>
                  <button onClick={() => softDeleteProduct(p.id)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-semibold">🗑️ Hide</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Edit Product</h2>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">Name</label>
                <input type="text" required value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Description</label>
                <textarea rows={2} value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Category</label>
                  <select required value={editingProduct.category_name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category_name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Price (GHS)</label>
                  <input type="number" step="0.01" required value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Stock</label>
                <input type="number" required value={editingProduct.stock}
                  onChange={(e) => setEditingProduct({ ...editingProduct, stock: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Image URL</label>
                <input type="url" value={editingProduct.image_url || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, image_url: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              {editingProduct.image_url && (
                <div className="w-24 h-24 bg-gray-50 rounded border flex items-center justify-center p-1">
                  <img src={editingProduct.image_url} className="max-w-full max-h-full object-contain" />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditingProduct(null)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 rounded-lg text-sm">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-sm">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Rename Category</h2>
            <form onSubmit={saveCategoryEdit} className="space-y-3">
              <input type="text" required value={editingCategory.name}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              <p className="text-xs text-gray-500">All products in this category will be updated too.</p>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditingCategory(null)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 rounded-lg text-sm">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-sm">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-2">⚠️ Category in Use</h2>
            <p className="text-sm text-gray-600 mb-3">
              "<strong>{deleteCategoryModal.category.name}</strong>" has {deleteCategoryModal.products.length} product(s):
            </p>
            <ul className="list-disc list-inside text-xs text-gray-500 mb-4 max-h-32 overflow-y-auto">
              {deleteCategoryModal.products.map(p => <li key={p.id}>{p.name}</li>)}
            </ul>
            <p className="text-sm font-medium mb-2">Move them to:</p>
            <select
              value={deleteCategoryModal.moveTo}
              onChange={(e) => setDeleteCategoryModal({ ...deleteCategoryModal, moveTo: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm mb-4"
            >
              <option value="">Choose category...</option>
              {categories.filter(c => c.id !== deleteCategoryModal.category.id).map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setDeleteCategoryModal(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 rounded-lg text-sm">
                Cancel
              </button>
              <button onClick={confirmMoveAndDelete}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg text-sm">
                Move & Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'payouts' && (
        <div className="space-y-6">
          <div>
            <h3 className="font-bold text-gray-800 mb-3">⏳ Pending Payout Requests</h3>
            {payouts.filter(p => p.status === 'pending').length === 0 ? (
              <p className="text-sm text-gray-500">No pending payout requests.</p>
            ) : (
              <div className="space-y-2">
                {payouts.filter(p => p.status === 'pending').map(p => (
                  <div key={p.id} className="bg-white border border-amber-300 rounded-xl p-3 sm:p-4 flex flex-wrap justify-between gap-3 items-center">
                    <div className="text-sm">
                      <p className="font-bold text-gray-800">{findSellerName(p.seller_id)}</p>
                      <p className="text-gray-600">GHS {Number(p.amount).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{new Date(p.requested_at).toLocaleString('en-GB')}</p>
                    </div>
                    <button onClick={() => approvePayout(p)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-semibold">✅ Approve</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-bold text-gray-800 mb-3">💳 Approved — Waiting to Pay</h3>
            {payouts.filter(p => p.status === 'approved').length === 0 ? (
              <p className="text-sm text-gray-500">None waiting.</p>
            ) : (
              <div className="space-y-2">
                {payouts.filter(p => p.status === 'approved').map(p => (
                  <div key={p.id} className="bg-white border border-blue-300 rounded-xl p-3 sm:p-4 flex flex-wrap justify-between gap-3 items-center">
                    <div className="text-sm">
                      <p className="font-bold text-gray-800">{findSellerName(p.seller_id)}</p>
                      <p className="text-gray-600">GHS {Number(p.amount).toFixed(2)}</p>
                    </div>
                    <button onClick={() => markPayoutPaid(p)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-semibold">💸 Mark Paid</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-bold text-gray-800 mb-3">✅ Paid Payouts</h3>
            {payouts.filter(p => p.status === 'paid').length === 0 ? (
              <p className="text-sm text-gray-500">None yet.</p>
            ) : (
              <div className="space-y-2">
                {payouts.filter(p => p.status === 'paid').map(p => (
                  <div key={p.id} className="bg-green-50 border border-green-200 rounded-xl p-3 flex justify-between items-center text-sm">
                    <div>
                      <p className="font-bold">{findSellerName(p.seller_id)}</p>
                      <p className="text-xs text-gray-500">{new Date(p.paid_at).toLocaleString('en-GB')}</p>
                    </div>
                    <p className="font-bold text-green-700">GHS {Number(p.amount).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'add-product' && (
        <div className="bg-white rounded-xl shadow p-4 sm:p-6 max-w-2xl">
          <form onSubmit={handleAdminAddProduct} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Sell As</label>
              <select value={productForm.seller_id} onChange={(e) => updateProduct('seller_id', e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                <option value="STORE">🏪 B STORE (store itself)</option>
                {approvedSellers.map(s => <option key={s.user_id} value={s.user_id}>👤 {s.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Product Name</label>
              <input type="text" required value={productForm.name} onChange={(e) => updateProduct('name', e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea rows={3} value={productForm.description} onChange={(e) => updateProduct('description', e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select required value={productForm.category_name} onChange={(e) => updateProduct('category_name', e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select...</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Price (GHS)</label>
                <input type="number" step="0.01" required value={productForm.price} onChange={(e) => updateProduct('price', e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Stock</label>
              <input type="number" required value={productForm.stock} onChange={(e) => updateProduct('stock', e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Product Image</label>
              <div className="space-y-2 mt-1">
                <input type="file" accept="image/*" onChange={handleAdminImageUpload} disabled={uploading} className="w-full text-xs" />
                {uploading && <p className="text-xs text-amber-600">Uploading...</p>}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <span className="text-xs text-gray-400">OR</span>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>
                <input type="url" value={productForm.image_url} onChange={(e) => updateProduct('image_url', e.target.value)}
                  placeholder="Paste image URL"
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            {productForm.image_url && (
              <div className="w-32 h-32 bg-gray-50 rounded-lg border flex items-center justify-center p-2">
                <img src={productForm.image_url} className="max-w-full max-h-full object-contain" />
              </div>
            )}
            {productMsg && (
              <div className={`text-xs px-3 py-2 rounded-lg ${productMsg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {productMsg}
              </div>
            )}
            <button type="submit" disabled={uploading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg text-sm disabled:opacity-60">
              Add Product (Auto-Approved)
            </button>
          </form>
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <p className="text-gray-500 text-sm">No orders yet.</p>
          ) : (
            orders.map(order => (
              <div key={order.id} className="bg-white border rounded-xl p-3 sm:p-4">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Order #{order.id.slice(0, 8)}...</p>
                    <p className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-semibold ${statusColor(order.order_status)}`}>
                    {order.order_status.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm text-gray-700 mb-3">
                  <p><strong>{order.customer_name}</strong> — {order.customer_phone}</p>
                </div>
                {order.is_multi_seller && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs mb-3">
                    <p className="font-semibold text-amber-800">📦 Multi-Seller → {order.consolidation_point}</p>
                  </div>
                )}
                {!order.is_multi_seller && order.selected_delivery_point && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs mb-3">
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
                        <p className="text-[10px] sm:text-xs text-gray-500">{item.seller_name} • ×{item.quantity} • GHS {Number(item.subtotal).toFixed(2)}</p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor(item.seller_status)}`}>{item.seller_status}</span>
                      <button onClick={() => notifySeller(item, order)} className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded text-[10px] font-semibold">
                        📲
                      </button>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3 flex flex-wrap justify-between items-center gap-2">
                  <div className="text-xs text-gray-500">💳 {order.payment_method.replace('_', ' ')}</div>
                  <div className="font-bold text-indigo-600 text-sm">GHS {Number(order.total).toFixed(2)}</div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                  {order.order_status === 'placed' && (
                    <button onClick={() => updateOrderStatus(order.id, 'processing')} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs font-semibold">Processing</button>
                  )}
                  {order.order_status === 'processing' && (
                    <button onClick={() => updateOrderStatus(order.id, 'dispatched')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs font-semibold">Dispatched</button>
                  )}
                  {order.order_status === 'dispatched' && (
                    <button onClick={() => updateOrderStatus(order.id, 'delivered')} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded text-xs font-semibold">Delivered</button>
                  )}
                  {order.order_status === 'delivered' && (
                    <button onClick={() => updateOrderStatus(order.id, 'completed')} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-xs font-semibold">Completed</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'sellers' && (
        <div className="space-y-3">
          {pendingSellers.length === 0 ? (
            <p className="text-gray-500 text-sm">No pending seller applications.</p>
          ) : (
            pendingSellers.map(s => (
              <div key={s.id} className="bg-white border border-amber-300 rounded-xl p-3 sm:p-4 flex flex-wrap justify-between gap-3">
                <div className="text-sm">
                  <p className="font-bold text-gray-800">{s.full_name}</p>
                  <p className="text-gray-600 text-xs">📞 {s.phone} | 💬 {s.whatsapp}</p>
                  <p className="text-gray-600 text-xs">📍 {s.region} — {s.address}</p>
                  <p className="text-gray-500 text-xs mt-1">Delivery: {s.location_1}{s.location_2 ? ` / ${s.location_2}` : ''}</p>
                </div>
                <div className="flex gap-2 self-center">
                  <button onClick={() => approveSeller(s)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-semibold">✅ Approve</button>
                  <button onClick={() => rejectSeller(s)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-semibold">❌ Reject</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'products' && (
        <div className="space-y-3">
          {pendingProducts.length === 0 ? (
            <p className="text-gray-500 text-sm">No products pending approval.</p>
          ) : (
            pendingProducts.map(p => (
              <div key={p.id} className="bg-white border border-blue-300 rounded-xl p-3 sm:p-4 flex flex-wrap justify-between gap-3">
                <div className="flex gap-3 items-center flex-1 min-w-0">
                  <div className="w-14 h-14 bg-gray-50 rounded-lg border flex items-center justify-center p-1 flex-shrink-0">
                    <img src={p.image_url || 'https://via.placeholder.com/100'} className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="text-sm min-w-0">
                    <p className="font-bold text-gray-800 truncate">{p.name}</p>
                    <p className="text-gray-600 text-xs">{p.category_name} • GHS {Number(p.price).toFixed(2)} • Stock: {p.stock}</p>
                    <p className="text-xs text-gray-500">Seller: {p.seller_name}</p>
                  </div>
                </div>
                <div className="flex gap-2 self-center">
                  <button onClick={() => approveProduct(p)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-semibold">✅ Approve</button>
                  <button onClick={() => rejectProduct(p)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-semibold">❌ Reject</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'categories' && (
        <div className="bg-white rounded-xl shadow p-4 sm:p-6">
          <form onSubmit={addCategory} className="flex gap-2 mb-4">
            <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category name"
              className="flex-1 px-3 py-2 border rounded-lg text-sm" />
            <button type="submit" className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Add</button>
          </form>
          <div className="space-y-2">
            {categories.length === 0 ? (
              <p className="text-gray-500 text-sm">No categories yet.</p>
            ) : (
              categories.map(c => (
                <div key={c.id} className="flex flex-wrap justify-between items-center bg-gray-50 border px-3 py-2 rounded-lg text-sm gap-2">
                  <span className="font-medium">{c.name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingCategory({ id: c.id, name: c.name, oldName: c.name })}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs font-semibold"
                    >✏️ Edit</button>
                    <button
                      onClick={() => tryDeleteCategory(c)}
                      className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-semibold"
                    >🗑️ Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}