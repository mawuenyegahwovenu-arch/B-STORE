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
        .in('order_status', ['placed', 'processing', 'dispatched']);
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
    return `hover:text-indigo-200 ${active ? 'font-bold border-b-2 border-amber-400 pb-0.5' : ''}`;
  }

  function mobileNavClass(path) {
    const active = location.pathname === path;
    return `block px-4 py-3 hover:bg-indigo-700 text-sm ${active ? 'bg-indigo-700 font-bold border-l-4 border-amber-400' : ''}`;
  }

  return (
    <>
      <nav className="bg-indigo-900 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex justify-between items-center">
          <Link to="/" className="text-lg sm:text-xl font-bold tracking-wider">
            B STORE
          </Link>

          {/* DESKTOP menu */}
          <div className="hidden md:flex items-center space-x-4 text-sm">
            <Link to="/" className={navClass('/')}>Shop</Link>
            {user && (
              <Link to="/wishlist" className={navClass('/wishlist')}>Wishlist</Link>
            )}
            {user && (
              <Link to="/orders" className={`${navClass('/orders')} inline-flex items-center`}>
                Orders <Badge count={ordersBadge} color="bg-blue-500" />
              </Link>
            )}
            {isSeller && (
              <Link to="/seller" className={`${navClass('/seller')} inline-flex items-center`}>
                Seller <Badge count={sellerBadge} color="bg-amber-500" />
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin" className={`${navClass('/admin')} inline-flex items-center`}>
                Admin <Badge count={adminBadge} color="bg-red-500" />
              </Link>
            )}
            {user && !isSeller && !isAdmin && (
              <Link to="/become-seller" className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1 rounded text-xs font-semibold">
                Sell
              </Link>
            )}
          </div>

          {/* Right icons */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {user && <NotificationBell />}

            <button
              onClick={() => setCartOpen(true)}
              className="relative bg-indigo-700 hover:bg-indigo-600 px-3 py-1.5 rounded-lg flex items-center"
            >
              🛒
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>

            {!user && (
              <Link to="/login" className="bg-amber-500 hover:bg-amber-600 px-3 sm:px-4 py-1.5 rounded font-semibold text-xs">
                Login
              </Link>
            )}

            {user && (
              <>
                <button
                  onClick={() => setLogoutModal(true)}
                  className="hidden md:inline-block bg-amber-500 hover:bg-amber-600 px-3 py-1 rounded text-xs font-semibold"
                >
                  Logout
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
          <div className="md:hidden bg-indigo-800 border-t border-indigo-700">
            <div className="px-4 py-3 border-b border-indigo-700">
              <p className="font-bold text-sm">{userData?.full_name || 'User'}</p>
              <p className="text-xs text-indigo-300 truncate">{user.email}</p>
            </div>
            <div className="py-2">
              <Link to="/" className={mobileNavClass('/')}>🏪 Shop</Link>
              <Link to="/wishlist" className={mobileNavClass('/wishlist')}>❤️ Wishlist</Link>
              <Link to="/orders" className={mobileNavClass('/orders')}>
                <span className="flex items-center justify-between">
                  <span>📋 My Orders</span>
                  {ordersBadge > 0 && (
                    <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{ordersBadge}</span>
                  )}
                </span>
              </Link>
              {isSeller && (
                <Link to="/seller" className={mobileNavClass('/seller')}>
                  <span className="flex items-center justify-between">
                    <span>🏪 Seller Dashboard</span>
                    {sellerBadge > 0 && (
                      <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{sellerBadge}</span>
                    )}
                  </span>
                </Link>
              )}
              {isAdmin && (
                <Link to="/admin" className={mobileNavClass('/admin')}>
                  <span className="flex items-center justify-between">
                    <span>⚙️ Admin Dashboard</span>
                    {adminBadge > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{adminBadge}</span>
                    )}
                  </span>
                </Link>
              )}
              {user && !isSeller && !isAdmin && (
                <Link to="/become-seller" className={mobileNavClass('/become-seller')}>
                  <span className="text-emerald-300">💼 Become a Seller</span>
                </Link>
              )}
              <button
                onClick={() => setLogoutModal(true)}
                className="w-full text-left px-4 py-3 hover:bg-indigo-700 text-sm text-red-300 border-t border-indigo-700 mt-2"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      {/* LOGOUT CONFIRMATION MODAL */}
      {logoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <div className="text-4xl mb-3">👋</div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Log Out?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Are you sure you want to log out of your account?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setLogoutModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2.5 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl text-sm"
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}