import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { supabase } from '../supabaseClient';
import CartDrawer from './CartDrawer';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, userData, isAdmin, isSeller, signOut } = useAuth();
  const { totalItems } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutModal, setLogoutModal] = useState(false);
  const [adminBadge, setAdminBadge] = useState(0);
  const [sellerBadge, setSellerBadge] = useState(0);
  const [ordersBadge, setOrdersBadge] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) {
      setAdminBadge(0);
      setSellerBadge(0);
      setOrdersBadge(0);
      return;
    }
    loadBadges();
    const interval = setInterval(loadBadges, 30000);
    return () => clearInterval(interval);
  }, [user, isAdmin, isSeller]);

  async function loadBadges() {
    if (!user) return;
    if (isAdmin) {
      const [pendSellers, pendProducts, pendOrders] = await Promise.all([
        supabase.from('sellers').select('id').eq('status', 'pending'),
        supabase.from('products').select('id').eq('approval_status', 'pending').or('is_deleted.is.null,is_deleted.eq.false'),
        supabase.from('orders').select('id').eq('order_status', 'placed'),
      ]);
      const total =
        (pendSellers.data?.length || 0) +
        (pendProducts.data?.length || 0) +
        (pendOrders.data?.length || 0);
      setAdminBadge(total);
    }
    if (isSeller) {
      const { data } = await supabase
        .from('order_items')
        .select('id')
        .eq('seller_id', user.id)
        .eq('seller_status', 'placed');
      setSellerBadge(data?.length || 0);
    }
    if (!isAdmin && !isSeller) {
      const { data } = await supabase
        .from('orders')
        .select('id')
        .eq('customer_id', user.id)
        .in('order_status', ['placed', 'processing']);
      setOrdersBadge(data?.length || 0);
    }
  }

  async function confirmLogout() {
    setLogoutModal(false);
    setMenuOpen(false);
    await signOut();
    navigate('/');
  }

  function Badge({ count, color = 'bg-red-500' }) {
    if (!count) return null;
    return (
      <span className={`ml-2 ${color} text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full`}>
        {count > 9 ? '9+' : count}
      </span>
    );
  }

  function navClass(path) {
    const active = location.pathname === path;
    return `hover:text-indigo-200 uppercase ${active ? 'font-bold border-b-2 border-amber-400 pb-0.5' : ''}`;
  }

  function mobileNavClass(path) {
    const active = location.pathname === path;
    return `flex items-center gap-2 px-4 py-3 hover:bg-indigo-700 text-sm uppercase text-white ${active ? 'bg-indigo-700 font-bold border-l-4 border-amber-400' : ''}`;
  }

  // Hide storefront navbar only on full-screen dashboards
  const hideOnRoutes = ['/seller', '/admin'];
  if (hideOnRoutes.some(r => location.pathname.startsWith(r))) {
    return null;
  }

  return (
    <>
      <nav className="bg-indigo-900 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex justify-between items-center">
          <Link to="/" className="text-lg sm:text-xl font-bold tracking-wider">
            B STORE
          </Link>

          {/* DESKTOP menu */}
          <div className="hidden md:flex items-center space-x-4 text-sm uppercase">
            <Link to="/" className={navClass('/')}>HOME</Link>
            {user && (
              <Link to="/wishlist" className={navClass('/wishlist')}>FAVOURITES</Link>
            )}
            {user && (
              <Link to="/orders" className={`${navClass('/orders')} inline-flex items-center`}>
                ORDERS <Badge count={ordersBadge} color="bg-blue-500" />
              </Link>
            )}
            {isSeller && (
              <Link
                to="/seller"
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-3 py-1.5 rounded-lg text-xs font-bold uppercase text-white shadow-md inline-flex items-center gap-1.5"
              >
                🏪 SELLER
                {sellerBadge > 0 && (
                  <span className="bg-yellow-200 text-indigo-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {sellerBadge}
                  </span>
                )}
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin" className={`${navClass('/admin')} inline-flex items-center`}>
                ADMIN <Badge count={adminBadge} color="bg-red-500" />
              </Link>
            )}
            {user && !isSeller && !isAdmin && (
              <Link to="/become-seller" className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1 rounded text-xs font-semibold uppercase">
                SELL
              </Link>
            )}
          </div>

          {/* Right side icons */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {user && <NotificationBell />}

            <button
              onClick={() => setCartOpen(true)}
              className="relative bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg flex items-center"
            >
              <span className="text-base">🛒</span>
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                  {totalItems}
                </span>
              )}
            </button>

            {!user && (
              <Link to="/login" className="bg-amber-500 hover:bg-amber-600 px-3 sm:px-4 py-1.5 rounded font-semibold text-xs uppercase">
                LOGIN
              </Link>
            )}

            {user && (
              <>
                <button
                  onClick={() => setLogoutModal(true)}
                  className="hidden md:inline-block bg-amber-500 hover:bg-amber-600 px-3 py-1 rounded text-xs font-semibold uppercase"
                >
                  LOGOUT
                </button>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="md:hidden bg-indigo-700 hover:bg-indigo-600 px-3 py-1.5 rounded-lg text-lg leading-none"
                  aria-label="Menu"
                >
                  {menuOpen ? '✕' : '☰'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* MOBILE menu */}
        {menuOpen && user && (
          <>
            <div
              className="md:hidden fixed inset-0 top-[57px] bg-black/50 z-30"
              onClick={() => setMenuOpen(false)}
            />
            <div className="md:hidden bg-indigo-900 border-t border-indigo-700 relative z-40 animate-slideDown max-h-[calc(100vh-57px)] overflow-y-auto">
              {/* User header */}
              <div className="px-4 py-3 border-b border-indigo-700 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {(userData?.full_name || user.email || 'U')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm uppercase truncate text-white leading-tight">
                    {userData?.full_name || 'USER'}
                  </p>
                  <p className="text-[11px] text-indigo-300 truncate leading-tight">{user.email}</p>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-2">
                <Link
                  to="/"
                  onClick={() => {
                    setMenuOpen(false);
                    if (location.pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex items-center gap-2 px-4 py-3 hover:bg-indigo-700 text-sm uppercase text-white"
                >
                  🏪 HOME
                </Link>

                <Link
                  to="/wishlist"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 hover:bg-indigo-700 text-sm uppercase text-white"
                >
                  ❤️ FAVOURITES
                </Link>

                <Link
                  to="/orders"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 hover:bg-indigo-700 text-sm uppercase text-white"
                >
                  <span>📋 MY ORDERS</span>
                  {ordersBadge > 0 && (
                    <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{ordersBadge}</span>
                  )}
                </Link>

                {isSeller && (
                  <Link
                    to="/seller"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 hover:bg-indigo-700 text-sm uppercase font-bold"
                    style={{ color: '#fef08a' }}
                  >
                    🏪 SELLER DASHBOARD
                    {sellerBadge > 0 && (
                      <span className="bg-yellow-200 text-indigo-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {sellerBadge}
                      </span>
                    )}
                  </Link>
                )}

                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 hover:bg-indigo-700 text-sm uppercase font-bold"
                    style={{ color: '#fef08a' }}
                  >
                    ⚙️ ADMIN DASHBOARD
                    {adminBadge > 0 && (
                      <span className="bg-yellow-200 text-indigo-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {adminBadge}
                      </span>
                    )}
                  </Link>
                )}

                {user && !isSeller && !isAdmin && (
                  <Link
                    to="/become-seller"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 hover:bg-indigo-700 text-sm uppercase"
                  >
                    <span className="bg-yellow-200 text-indigo-900 px-3 py-1 rounded text-xs font-bold">💼 BECOME A SELLER</span>
                  </Link>
                )}

                <button
                  onClick={() => setLogoutModal(true)}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-indigo-700 text-sm uppercase text-red-300"
                >
                  🚪 LOGOUT
                </button>
              </div>
            </div>
          </>
        )}
      </nav>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      {/* LOGOUT CONFIRMATION MODAL */}
      {logoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <div className="text-4xl mb-3">👋</div>
            <h3 className="text-lg font-bold text-gray-800 mb-1 uppercase">LOG OUT?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Are you sure you want to log out of your account?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setLogoutModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2.5 rounded-xl text-sm uppercase"
              >
                CANCEL
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl text-sm uppercase"
              >
                YES, LOGOUT
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}