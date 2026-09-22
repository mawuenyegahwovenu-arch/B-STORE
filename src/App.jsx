import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import TickerBanner from './components/TickerBanner';
import NoticeModal from './components/NoticeModal';
import Home from './pages/Home';
import Login from './pages/Login';
import BecomeSeller from './pages/BecomeSeller';
import AdminDashboard from './pages/AdminDashboard';
import SellerDashboard from './pages/SellerDashboard';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import ProductDetail from './pages/ProductDetail';
import Wishlist from './pages/Wishlist';
import CustomerProfile from './pages/CustomerProfile';
import ResetPassword from './pages/ResetPassword';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

function App() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Global Announcement Notice Modal */}
      <NoticeModal />

      <Navbar />
      {location.pathname === '/' && <TickerBanner />}
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/become-seller" element={<BecomeSeller />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/customer/:id" element={<CustomerProfile />} />
          <Route path="/admin/enter-seller/:sellerId" element={<SellerDashboard />} />
          <Route path="/seller" element={<SellerDashboard />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-confirmation/:id" element={<OrderConfirmation />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/order/:id" element={<OrderDetail />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

export default App;