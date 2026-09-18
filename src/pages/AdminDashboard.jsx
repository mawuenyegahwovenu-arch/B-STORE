import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const { isAdmin, user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unifiedSearch, setUnifiedSearch] = useState('');
  const [pendingSellers, setPendingSellers] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [allSellers, setAllSellers] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [allOrderItems, setAllOrderItems] = useState([]);
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
  const [orderFilter, setOrderFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('all');
  const [payoutFilter, setPayoutFilter] = useState('all');
  const [sellerFilter, setSellerFilter] = useState('all');
  const [viewingSeller, setViewingSeller] = useState(null);

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

    const [sellersRes, productsRes, catsRes, ordersRes, allProductsRes, approvedSellersRes, payoutsRes, walletsRes, allSellersRes, customersRes, orderItemsRes] = await Promise.all([
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
      supabase.from('order_items').select('*'),
    ]);

    setPendingSellers(sellersRes.data || []);
    setPendingProducts(productsRes.data || []);
    setCategories(catsRes.data || []);
    setApprovedSellers(approvedSellersRes.data || []);
    setPayouts(payoutsRes.data || []);
    setWallets(walletsRes.data || []);
    setAllSellers(allSellersRes.data || []);
    setAllCustomers(customersRes?.data || []);
    setAllOrderItems(orderItemsRes.data || []);

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
  async function toggleFeatured(product) {
    const newValue = !product.is_featured;
    await supabase
      .from('products')
      .update({ is_featured: newValue })
      .eq('id', product.id);
    loadAll();
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

    if (newStatus === 'delivered') {
      await supabase
        .from('order_items')
        .update({ seller_status: 'delivered' })
        .eq('order_id', orderId);

      const { data: orderData } = await supabase
        .from('orders')
        .select('customer_email, customer_name, consolidation_point, selected_delivery_point, total')
        .eq('id', orderId)
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
            orderId: orderId.slice(0, 8),
            deliveryPoint: deliveryPoint,
            total: Number(orderData.total).toFixed(2),
          }),
        }).catch(err => console.error('Order ready email failed:', err));
      }
    }

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

  async function paySellerDirect(seller, amount) {
    if (!confirm(`Mark GHS ${amount.toFixed(2)} as PAID to ${seller.full_name}? Make sure you've sent the MoMo first.`)) return;

    const { error } = await supabase.from('payouts').insert({
      seller_id: seller.user_id,
      amount: amount,
      status: 'paid',
      paid_at: new Date().toISOString(),
    });

    if (error) {
      alert('Error: ' + error.message);
      return;
    }

    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('seller_id', seller.user_id)
      .maybeSingle();

    if (wallet) {
      await supabase
        .from('wallets')
        .update({
          available_balance: Math.max(0, Number(wallet.available_balance || 0) - amount),
          updated_at: new Date().toISOString(),
        })
        .eq('seller_id', seller.user_id);
    }

    setViewingSeller(null);
    loadAll();
    alert('✅ Payment recorded!');
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

  function calcSellerMoney(seller) {
    const sellerItems = allOrderItems.filter(i => i.seller_id === seller.user_id && i.seller_status === 'delivered');

    const paystackItems = sellerItems.filter(i => i.payment_method === 'paystack');
    const podItems = sellerItems.filter(i => i.payment_method === 'pay_on_delivery');

    const paystackSales = paystackItems.reduce((s, i) => s + Number(i.subtotal || 0), 0);
    const podSales = podItems.reduce((s, i) => s + Number(i.subtotal || 0), 0);
    const totalSales = paystackSales + podSales;

    const paystackComm = paystackSales * 0.05;
    const podComm = podSales * 0.05;
    const totalComm = paystackComm + podComm;

    const totalNet = totalSales - totalComm;

    const sellerPayouts = payouts.filter(p => p.seller_id === seller.user_id && p.status === 'paid');
    const paidSoFar = sellerPayouts.reduce((s, p) => s + Number(p.amount || 0), 0);

    const owedNow = Math.max(0, totalNet - paidSoFar);

    return {
      paystackSales, podSales, totalSales,
      paystackComm, podComm, totalComm,
      totalNet, paidSoFar, owedNow,
      paystackCount: paystackItems.length,
      podCount: podItems.length,
    };
  }

  const sellersMoneyData = allSellers
    .filter(s => s.status === 'approved')
    .map(s => ({ seller: s, money: calcSellerMoney(s) }))
    .sort((a, b) => b.money.owedNow - a.money.owedNow);

  const totalOwedAll = sellersMoneyData.reduce((s, x) => s + x.money.owedNow, 0);

  const pendingOrdersCount = orders.filter(o => o.order_status === 'placed').length;
  const pendingSellersCount = pendingSellers.length;
  const pendingProductsCount = pendingProducts.length;
  const pendingPayoutsCount = payouts.filter(p => p.status === 'pending').length;

  const customersWithAction = dataLoading ? 0 : allCustomers.filter(cust => {
    const custOrders = orders.filter(o => o.customer_id === cust.id);
    return custOrders.some(o => ['placed', 'processing', 'dispatched', 'delivered'].includes(o.order_status));
  }).length;

  const filteredOrders = orders.filter(o => {
    if (orderFilter !== 'all' && o.order_status !== orderFilter) return false;
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      return (
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.customer_phone || '').toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.items || []).some(i => (i.product_name || '').toLowerCase().includes(q))
      );
    }
    return true;
  });

  const filteredCustomers = allCustomers.filter(cust => {
    const hasOrders = orders.some(o => o.customer_id === cust.id);
    if (!hasOrders) return false;
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return (
      (cust.full_name || '').toLowerCase().includes(q) ||
      (cust.phone || '').toLowerCase().includes(q) ||
      (cust.email || '').toLowerCase().includes(q)
    );
  });

  const filteredProducts = allProducts.filter(p => {
    if (productStatusFilter === 'approved' && p.approval_status !== 'approved') return false;
    if (productStatusFilter === 'pending' && p.approval_status !== 'pending') return false;
    if (productStatusFilter === 'rejected' && p.approval_status !== 'rejected') return false;
    if (productStatusFilter === 'hidden' && p.is_active) return false;
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.seller_name || '').toLowerCase().includes(q) ||
      (p.category_name || '').toLowerCase().includes(q)
    );
  });

  const filteredSellers = allSellers.filter(s => {
    if (sellerFilter !== 'all' && s.status !== sellerFilter) return false;
    return true;
  });

  const filteredPayouts = payouts.filter(p => {
    if (payoutFilter !== 'all' && p.status !== payoutFilter) return false;
    return true;
  });

  const sidebarMenu = [
    { id: 'overview', icon: '📊', label: 'OVERVIEW', badge: 0 },
    { id: 'sellers-money', icon: '💰', label: 'SELLERS MONEY', badge: 0 },
    { id: 'orders', icon: '📦', label: 'ORDERS', badge: pendingOrdersCount },
    { id: 'customers', icon: '👤', label: 'CUSTOMERS', badge: customersWithAction },
    { id: 'sellers', icon: '👥', label: 'PENDING SELLERS', badge: pendingSellersCount },
    { id: 'products', icon: '⏳', label: 'PENDING PRODUCTS', badge: pendingProductsCount },
    { id: 'all-sellers', icon: '👥', label: 'ALL SELLERS', badge: 0 },
    { id: 'all-products', icon: '📦', label: 'ALL PRODUCTS', badge: 0 },
    { id: 'add-product', icon: '➕', label: 'ADD PRODUCT', badge: 0 },
    { id: 'payouts', icon: '💰', label: 'PAYOUTS', badge: pendingPayoutsCount },
    { id: 'categories', icon: '📁', label: 'CATEGORIES', badge: 0 },
  ];

  function handleTabClick(id) {
    setTab(id);
    setSidebarOpen(false);
    setUnifiedSearch('');
    setOrderSearch('');
    setCustomerSearch('');
    setProductSearch('');
  }

  function handleUnifiedSearch(value) {
    setUnifiedSearch(value);
    if (tab === 'orders') setOrderSearch(value);
    else if (tab === 'customers') setCustomerSearch(value);
    else if (tab === 'all-products') setProductSearch(value);
  }

  const searchPlaceholder = (() => {
    switch (tab) {
      case 'orders': return '🔍 SEARCH IN ORDERS...';
      case 'customers': return '🔍 SEARCH IN CUSTOMERS...';
      case 'all-products': return '🔍 SEARCH IN ALL PRODUCTS...';
      case 'all-sellers': return '🔍 SEARCH IN ALL SELLERS...';
      case 'sellers-money': return '🔍 SEARCH IN SELLERS MONEY...';
      case 'payouts': return '🔍 SEARCH IN PAYOUTS...';
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
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed md:sticky top-0 left-0 z-50 md:z-0 h-screen w-64 bg-indigo-900 text-white flex flex-col transition-transform duration-300 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-indigo-800 flex justify-between items-center">
          <h2 className="font-bold text-lg uppercase">ADMIN</h2>
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

        <div className="p-4 border-t border-indigo-800 text-xs text-indigo-300">
          B STORE Admin Panel
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="md:hidden bg-indigo-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="text-2xl leading-none">☰</button>
          <h1 className="font-bold text-sm uppercase">ADMIN DASHBOARD</h1>
          <div className="w-6"></div>
        </div>

        <div className="p-3 sm:p-6">
          <h1 className="hidden md:block text-2xl font-bold text-indigo-900 mb-6 uppercase">ADMIN DASHBOARD</h1>

          <div className="mb-4">
            <input
              type="text"
              value={unifiedSearch}
              onChange={(e) => handleUnifiedSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase"
            />
          </div>

          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-xl shadow">
                  <p className="text-xs text-gray-500 uppercase">Products</p>
                  <p className="text-2xl font-bold text-indigo-600">{stats.totalProducts}</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-white p-4 rounded-xl shadow">
                  <p className="text-xs text-gray-500 uppercase">Orders</p>
                  <p className="text-2xl font-bold text-green-600">{stats.totalOrders}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-white p-4 rounded-xl shadow">
                  <p className="text-xs text-gray-500 uppercase">Pending Orders</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.pendingOrders}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-xl shadow">
                  <p className="text-xs text-gray-500 uppercase">Revenue</p>
                  <p className="text-2xl font-bold text-blue-600">GHS {stats.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl p-6 shadow-lg">
                <p className="text-sm opacity-90 uppercase">Total B STORE Commission Earned (5%)</p>
                <p className="text-4xl font-bold mt-2">
                  GHS {wallets.reduce((s, w) => s + Number(w.total_commission || 0), 0).toFixed(2)}
                </p>
              </div>
            </>
          )}

          {tab === 'sellers-money' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl p-4 sm:p-6 shadow-lg">
                <p className="text-xs sm:text-sm opacity-90 uppercase">TOTAL OWED TO ALL SELLERS</p>
                <p className="text-2xl sm:text-4xl font-bold mt-2">GHS {totalOwedAll.toFixed(2)}</p>
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
                      {sellersMoneyData.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No approved sellers yet.</td>
                        </tr>
                      ) : (
                        sellersMoneyData
                          .filter(({ seller }) => !unifiedSearch.trim() || (seller.full_name || '').toLowerCase().includes(unifiedSearch.toLowerCase()))
                          .map(({ seller, money }) => (
                          <tr key={seller.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-bold text-gray-800">{seller.full_name}</p>
                              <p className="text-xs text-gray-500">{seller.phone}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-semibold text-indigo-600">GHS {money.paystackSales.toFixed(2)}</p>
                              <p className="text-[10px] text-gray-500">({money.paystackCount} items)</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-semibold text-amber-600">GHS {money.podSales.toFixed(2)}</p>
                              <p className="text-[10px] text-gray-500">({money.podCount} items)</p>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-green-700">GHS {money.totalNet.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-gray-500">GHS {money.paidSoFar.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-bold ${money.owedNow > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                GHS {money.owedNow.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => setViewingSeller({ seller, money })} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs font-semibold uppercase">
                                VIEW
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {viewingSeller && (
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 uppercase">👤 {viewingSeller.seller.full_name}</h2>
                    <p className="text-xs text-gray-500">📞 {viewingSeller.seller.phone}</p>
                  </div>
                  <button onClick={() => setViewingSeller(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                  <p className="text-xs font-bold text-gray-700 uppercase mb-3">PAYMENT BREAKDOWN</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b">
                        <th className="text-left pb-2">TYPE</th>
                        <th className="text-right pb-2">SALES</th>
                        <th className="text-right pb-2">COMM 5%</th>
                        <th className="text-right pb-2">NET</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2">💳 PAYSTACK</td>
                        <td className="text-right">GHS {viewingSeller.money.paystackSales.toFixed(2)}</td>
                        <td className="text-right text-red-600">-GHS {viewingSeller.money.paystackComm.toFixed(2)}</td>
                        <td className="text-right font-semibold">GHS {(viewingSeller.money.paystackSales - viewingSeller.money.paystackComm).toFixed(2)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">💵 PAY ON DELIVERY</td>
                        <td className="text-right">GHS {viewingSeller.money.podSales.toFixed(2)}</td>
                        <td className="text-right text-red-600">-GHS {viewingSeller.money.podComm.toFixed(2)}</td>
                        <td className="text-right font-semibold">GHS {(viewingSeller.money.podSales - viewingSeller.money.podComm).toFixed(2)}</td>
                      </tr>
                      <tr className="border-t-2 font-bold">
                        <td className="py-2">TOTAL</td>
                        <td className="text-right">GHS {viewingSeller.money.totalSales.toFixed(2)}</td>
                        <td className="text-right text-red-600">-GHS {viewingSeller.money.totalComm.toFixed(2)}</td>
                        <td className="text-right text-green-700">GHS {viewingSeller.money.totalNet.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="bg-white rounded-xl p-4 mb-4 border-2 border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs text-gray-500 uppercase">ALREADY PAID</p>
                    <p className="font-bold text-gray-700">GHS {viewingSeller.money.paidSoFar.toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <p className="text-sm font-bold text-gray-800 uppercase">OWED NOW</p>
                    <p className={`text-xl font-bold ${viewingSeller.money.owedNow > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      GHS {viewingSeller.money.owedNow.toFixed(2)}
                    </p>
                  </div>
                </div>

                {viewingSeller.money.owedNow > 0 && (
                  <button onClick={() => paySellerDirect(viewingSeller.seller, viewingSeller.money.owedNow)} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg text-sm mb-2 uppercase">
                    💸 SEND GHS {viewingSeller.money.owedNow.toFixed(2)} & MARK PAID
                  </button>
                )}

                <button onClick={() => setViewingSeller(null)} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 rounded-lg text-sm uppercase">
                  CLOSE
                </button>
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'ALL' },
                  { id: 'placed', label: 'PLACED' },
                  { id: 'processing', label: 'PROCESSING' },
                  { id: 'dispatched', label: 'DISPATCHED' },
                  { id: 'delivered', label: 'DELIVERED' },
                  { id: 'completed', label: 'COMPLETED' },
                  { id: 'cancelled', label: 'CANCELLED' },
                ].map(f => {
                  const count = f.id === 'all' ? orders.length : orders.filter(o => o.order_status === f.id).length;
                  return (
                    <button key={f.id} onClick={() => setOrderFilter(f.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${orderFilter === f.id ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}>
                      {f.label} ({count})
                    </button>
                  );
                })}
              </div>

              {filteredOrders.length === 0 ? (
                <p className="text-gray-500 text-sm py-4">No orders in this filter.</p>
              ) : (
                filteredOrders.map(order => (
                  <div key={order.id} className="bg-white border rounded-xl p-3 sm:p-4">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                      <div>
                        <p className="text-xs text-gray-500">Order #{order.id.slice(0, 8)}...</p>
                        <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded font-semibold ${statusColor(order.order_status)}`}>{order.order_status.toUpperCase()}</span>
                    </div>
                    <div className="text-sm text-gray-700 mb-3 uppercase"><strong>{order.customer_name}</strong> — {order.customer_phone}</div>
                    {order.is_multi_seller && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs mb-3">
                        <p className="font-semibold text-amber-800 uppercase">📦 MULTI-SELLER → {order.consolidation_point}</p>
                      </div>
                    )}
                    {!order.is_multi_seller && order.selected_delivery_point && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs mb-3">
                        <p className="font-semibold text-blue-800 uppercase">📍 {order.selected_delivery_point}</p>
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
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor(item.seller_status)}`}>{item.seller_status.toUpperCase()}</span>
                          <button onClick={() => notifySeller(item, order)} className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded text-[10px] font-semibold">📲</button>
                        </div>
                      ))}
                    </div>
                    <div className="border-t pt-3 flex flex-wrap justify-between items-center gap-2">
                      <div className="text-xs text-gray-500 uppercase">💳 {order.payment_method.replace('_', ' ')}</div>
                      <div className="font-bold text-indigo-600 text-sm">GHS {Number(order.total).toFixed(2)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                      {order.order_status === 'placed' && <button onClick={() => updateOrderStatus(order.id, 'processing')} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs font-semibold uppercase">PROCESSING</button>}
                      {order.order_status === 'processing' && <button onClick={() => updateOrderStatus(order.id, 'dispatched')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs font-semibold uppercase">DISPATCHED</button>}
                      {order.order_status === 'dispatched' && <button onClick={() => updateOrderStatus(order.id, 'delivered')} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded text-xs font-semibold uppercase">DELIVERED</button>}
                      {order.order_status === 'delivered' && <button onClick={() => updateOrderStatus(order.id, 'completed')} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-xs font-semibold uppercase">COMPLETED</button>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'customers' && (
            <div className="space-y-3">
              {dataLoading ? (
                <p className="text-gray-500 text-sm">Loading customers...</p>
              ) : filteredCustomers.length === 0 ? (
                <p className="text-gray-500 text-sm">No customers matching.</p>
              ) : (
                filteredCustomers.map(cust => {
                  const custOrders = orders.filter(o => o.customer_id === cust.id);
                  const newCount = custOrders.filter(o => o.order_status === 'placed').length;
                  const inProgressCount = custOrders.filter(o => ['processing', 'dispatched'].includes(o.order_status)).length;
                  const readyCount = custOrders.filter(o => o.order_status === 'delivered').length;
                  return (
                    <Link key={cust.id} to={`/admin/customer/${cust.id}`} className="block bg-white border rounded-xl p-4 hover:shadow-lg transition">
                      <div className="flex flex-wrap justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-xl flex-shrink-0">👤</div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-800 truncate uppercase">{cust.full_name || 'CUSTOMER'}</p>
                            <p className="text-xs text-gray-600">{cust.phone || 'No phone'}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 self-center">
                          {newCount > 0 && <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">🔴 {newCount} NEW</span>}
                          {inProgressCount > 0 && <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">🟠 {inProgressCount} IN PROGRESS</span>}
                          {readyCount > 0 && <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded">🟣 {readyCount} READY</span>}
                          {newCount === 0 && inProgressCount === 0 && readyCount === 0 && <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">✅ ALL DONE</span>}
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
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'ALL' },
                  { id: 'approved', label: 'APPROVED' },
                  { id: 'pending', label: 'PENDING' },
                  { id: 'suspended', label: 'SUSPENDED' },
                  { id: 'rejected', label: 'REJECTED' },
                ].map(f => {
                  const count = f.id === 'all' ? allSellers.length : allSellers.filter(s => s.status === f.id).length;
                  return (
                    <button key={f.id} onClick={() => setSellerFilter(f.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${sellerFilter === f.id ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}>
                      {f.label} ({count})
                    </button>
                  );
                })}
              </div>
              {filteredSellers.length === 0 ? (
                <p className="text-gray-500 text-sm">No sellers in this filter.</p>
              ) : (
                filteredSellers.map(s => (
                  <div key={s.id} className="bg-white border rounded-xl p-3 sm:p-4 flex flex-wrap justify-between gap-3">
                    <div className="text-sm">
                      <p className="font-bold text-gray-800 uppercase">{s.full_name}</p>
                      <p className="text-gray-600 text-xs">📞 {s.phone} | 💬 {s.whatsapp}</p>
                      <p className="text-gray-600 text-xs">📍 {s.region} — {s.address}</p>
                      <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded font-semibold ${sellerStatusColor(s.status)}`}>{s.status.toUpperCase()}</span>
                    </div>
                    <div className="flex gap-2 self-center flex-wrap">
                      {s.status === 'approved' && (
                        <>
                          <Link to={`/admin/enter-seller/${s.user_id}`} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-xs font-semibold uppercase">🔓 ENTER</Link>
                          <button onClick={() => blockSeller(s)} className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-1.5 rounded text-xs font-semibold uppercase">🚫 BLOCK</button>
                        </>
                      )}
                      {s.status === 'suspended' && <button onClick={() => unblockSeller(s)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-semibold uppercase">✅ UNBLOCK</button>}
                      {s.status === 'pending' && (
                        <>
                          <button onClick={() => approveSeller(s)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-semibold uppercase">✅ APPROVE</button>
                          <button onClick={() => rejectSeller(s)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-semibold uppercase">❌ REJECT</button>
                        </>
                      )}
                      {s.status === 'rejected' && <button onClick={() => approveSeller(s)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-semibold uppercase">✅ RE-APPROVE</button>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'all-products' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'ALL' },
                  { id: 'approved', label: 'APPROVED' },
                  { id: 'pending', label: 'PENDING' },
                  { id: 'rejected', label: 'REJECTED' },
                  { id: 'hidden', label: 'HIDDEN' },
                ].map(f => {
                  const count = f.id === 'all' ? allProducts.length : f.id === 'hidden' ? allProducts.filter(p => !p.is_active).length : allProducts.filter(p => p.approval_status === f.id).length;
                  return (
                    <button key={f.id} onClick={() => setProductStatusFilter(f.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${productStatusFilter === f.id ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}>
                      {f.label} ({count})
                    </button>
                  );
                })}
              </div>
              {filteredProducts.length === 0 ? (
                <p className="text-gray-500 text-sm">No matching products.</p>
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
                        <p className="text-xs text-gray-500">Seller: {p.seller_name}</p>
                      </div>
                    </div>
                               <div className="flex gap-2 self-center flex-wrap">
                      <button
                        onClick={() => toggleFeatured(p)}
                        className={`px-3 py-1.5 rounded text-xs font-semibold uppercase ${
                          p.is_featured
                            ? 'bg-amber-500 hover:bg-amber-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                      >
                        {p.is_featured ? '⭐ FEATURED' : '☆ FEATURE'}
                      </button>
                      <button onClick={() => setEditingProduct({ ...p })} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-semibold uppercase">✏️ EDIT</button>
                      <button onClick={() => softDeleteProduct(p.id)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-semibold uppercase">🗑️ HIDE</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'add-product' && (
            <div className="bg-white rounded-xl shadow p-4 sm:p-6 max-w-2xl">
              <form onSubmit={handleAdminAddProduct} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 uppercase">SELL AS</label>
                  <select value={productForm.seller_id} onChange={(e) => updateProduct('seller_id', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                    <option value="STORE">🏪 B STORE (STORE ITSELF)</option>
                    {approvedSellers.map(s => <option key={s.user_id} value={s.user_id}>👤 {s.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 uppercase">PRODUCT NAME</label>
                  <input type="text" required value={productForm.name} onChange={(e) => updateProduct('name', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 uppercase">DESCRIPTION</label>
                  <textarea rows={3} value={productForm.description} onChange={(e) => updateProduct('description', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 uppercase">CATEGORY</label>
                    <select required value={productForm.category_name} onChange={(e) => updateProduct('category_name', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                      <option value="">SELECT...</option>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 uppercase">PRICE (GHS)</label>
                    <input type="number" step="0.01" required value={productForm.price} onChange={(e) => updateProduct('price', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 uppercase">STOCK</label>
                  <input type="number" required value={productForm.stock} onChange={(e) => updateProduct('stock', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 uppercase">PRODUCT IMAGE</label>
                  <div className="space-y-2 mt-1">
                    <input type="file" accept="image/*" onChange={handleAdminImageUpload} disabled={uploading} className="w-full text-xs" />
                    {uploading && <p className="text-xs text-amber-600">Uploading...</p>}
                    <input type="url" value={productForm.image_url} onChange={(e) => updateProduct('image_url', e.target.value)} placeholder="PASTE IMAGE URL" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </div>
                {productForm.image_url && (
                  <div className="w-32 h-32 bg-gray-50 rounded-lg border flex items-center justify-center p-2">
                    <img src={productForm.image_url} className="max-w-full max-h-full object-contain" />
                  </div>
                )}
                {productMsg && (
                  <div className={`text-xs px-3 py-2 rounded-lg ${productMsg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{productMsg}</div>
                )}
                <button type="submit" disabled={uploading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg text-sm uppercase">ADD PRODUCT</button>
              </form>
            </div>
          )}

          {tab === 'payouts' && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'ALL' },
                  { id: 'pending', label: 'PENDING' },
                  { id: 'approved', label: 'APPROVED' },
                  { id: 'paid', label: 'PAID' },
                ].map(f => {
                  const count = f.id === 'all' ? payouts.length : payouts.filter(p => p.status === f.id).length;
                  return (
                    <button key={f.id} onClick={() => setPayoutFilter(f.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${payoutFilter === f.id ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}>
                      {f.label} ({count})
                    </button>
                  );
                })}
              </div>

              {(payoutFilter === 'all' || payoutFilter === 'pending') && (
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 uppercase">⏳ PENDING PAYOUT REQUESTS</h3>
                  {payouts.filter(p => p.status === 'pending').length === 0 ? (
                    <p className="text-sm text-gray-500">No pending payout requests.</p>
                  ) : (
                    <div className="space-y-2">
                      {payouts.filter(p => p.status === 'pending').map(p => (
                        <div key={p.id} className="bg-white border border-amber-300 rounded-xl p-3 sm:p-4 flex flex-wrap justify-between gap-3 items-center">
                          <div className="text-sm">
                            <p className="font-bold text-gray-800 uppercase">{findSellerName(p.seller_id)}</p>
                            <p className="text-gray-600">GHS {Number(p.amount).toFixed(2)}</p>
                            <p className="text-xs text-gray-500">{new Date(p.requested_at).toLocaleString('en-GB')}</p>
                          </div>
                          <button onClick={() => approvePayout(p)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-semibold uppercase">✅ APPROVE</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(payoutFilter === 'all' || payoutFilter === 'approved') && (
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 uppercase">💳 APPROVED — WAITING TO PAY</h3>
                  {payouts.filter(p => p.status === 'approved').length === 0 ? (
                    <p className="text-sm text-gray-500">None waiting.</p>
                  ) : (
                    <div className="space-y-2">
                      {payouts.filter(p => p.status === 'approved').map(p => (
                        <div key={p.id} className="bg-white border border-blue-300 rounded-xl p-3 sm:p-4 flex flex-wrap justify-between gap-3 items-center">
                          <div className="text-sm">
                            <p className="font-bold text-gray-800 uppercase">{findSellerName(p.seller_id)}</p>
                            <p className="text-gray-600">GHS {Number(p.amount).toFixed(2)}</p>
                          </div>
                          <button onClick={() => markPayoutPaid(p)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-semibold uppercase">💸 MARK PAID</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(payoutFilter === 'all' || payoutFilter === 'paid') && (
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 uppercase">✅ PAID PAYOUTS</h3>
                  {payouts.filter(p => p.status === 'paid').length === 0 ? (
                    <p className="text-sm text-gray-500">None yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {payouts.filter(p => p.status === 'paid').map(p => (
                        <div key={p.id} className="bg-green-50 border border-green-200 rounded-xl p-3 flex justify-between items-center text-sm">
                          <div>
                            <p className="font-bold uppercase">{findSellerName(p.seller_id)}</p>
                            <p className="text-xs text-gray-500">{new Date(p.paid_at).toLocaleString('en-GB')}</p>
                          </div>
                          <p className="font-bold text-green-700">GHS {Number(p.amount).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                      <p className="font-bold text-gray-800 uppercase">{s.full_name}</p>
                      <p className="text-gray-600 text-xs">📞 {s.phone} | 💬 {s.whatsapp}</p>
                      <p className="text-gray-600 text-xs">📍 {s.region} — {s.address}</p>
                    </div>
                    <div className="flex gap-2 self-center">
                      <button onClick={() => approveSeller(s)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-semibold uppercase">✅ APPROVE</button>
                      <button onClick={() => rejectSeller(s)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-semibold uppercase">❌ REJECT</button>
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
                      </div>
                    </div>
                    <div className="flex gap-2 self-center">
                      <button onClick={() => approveProduct(p)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-semibold uppercase">✅ APPROVE</button>
                      <button onClick={() => rejectProduct(p)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-semibold uppercase">❌ REJECT</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'categories' && (
            <div className="bg-white rounded-xl shadow p-4 sm:p-6">
              <form onSubmit={addCategory} className="flex gap-2 mb-4">
                <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="NEW CATEGORY NAME" className="flex-1 px-3 py-2 border rounded-lg text-sm uppercase" />
                <button type="submit" className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold uppercase">ADD</button>
              </form>
              <div className="space-y-2">
                {categories.map(c => (
                  <div key={c.id} className="flex flex-wrap justify-between items-center bg-gray-50 border px-3 py-2 rounded-lg text-sm gap-2">
                    <span className="font-medium uppercase">{c.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingCategory({ id: c.id, name: c.name, oldName: c.name })} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs font-semibold uppercase">✏️ EDIT</button>
                      <button onClick={() => tryDeleteCategory(c)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-semibold uppercase">🗑️ DELETE</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {editingProduct && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-bold mb-4 uppercase">EDIT PRODUCT</h2>
                <form onSubmit={handleSaveEdit} className="space-y-3">
                  <input type="text" required value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} placeholder="NAME" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  <textarea rows={2} value={editingProduct.description || ''} onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })} placeholder="DESCRIPTION" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <select required value={editingProduct.category_name} onChange={(e) => setEditingProduct({ ...editingProduct, category_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <input type="number" step="0.01" required value={editingProduct.price} onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })} placeholder="PRICE" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <input type="number" required value={editingProduct.stock} onChange={(e) => setEditingProduct({ ...editingProduct, stock: e.target.value })} placeholder="STOCK" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  <input type="url" value={editingProduct.image_url || ''} onChange={(e) => setEditingProduct({ ...editingProduct, image_url: e.target.value })} placeholder="IMAGE URL" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg text-sm uppercase">CANCEL</button>
                    <button type="submit" className="flex-1 bg-indigo-600 text-white font-bold py-2 rounded-lg text-sm uppercase">SAVE</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {editingCategory && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
                <h2 className="text-lg font-bold mb-4 uppercase">RENAME CATEGORY</h2>
                <form onSubmit={saveCategoryEdit} className="space-y-3">
                  <input type="text" required value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditingCategory(null)} className="flex-1 bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg text-sm uppercase">CANCEL</button>
                    <button type="submit" className="flex-1 bg-indigo-600 text-white font-bold py-2 rounded-lg text-sm uppercase">SAVE</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {deleteCategoryModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-bold mb-2 uppercase">⚠️ CATEGORY IN USE</h2>
                <p className="text-sm text-gray-600 mb-3">"{deleteCategoryModal.category.name}" has {deleteCategoryModal.products.length} product(s):</p>
                <ul className="list-disc list-inside text-xs text-gray-500 mb-4 max-h-32 overflow-y-auto">
                  {deleteCategoryModal.products.map(p => <li key={p.id}>{p.name}</li>)}
                </ul>
                <select value={deleteCategoryModal.moveTo} onChange={(e) => setDeleteCategoryModal({ ...deleteCategoryModal, moveTo: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm mb-4">
                  <option value="">MOVE THEM TO...</option>
                  {categories.filter(c => c.id !== deleteCategoryModal.category.id).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteCategoryModal(null)} className="flex-1 bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg text-sm uppercase">CANCEL</button>
                  <button onClick={confirmMoveAndDelete} className="flex-1 bg-red-600 text-white font-bold py-2 rounded-lg text-sm uppercase">MOVE & DELETE</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}