import { Link } from 'react-router-dom';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-indigo-900 text-white mt-12">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">

          <div>
            <h3 className="text-xl font-bold tracking-wider mb-3">B STORE</h3>
            <p className="text-sm text-indigo-200 leading-relaxed">
              Your multi-vendor marketplace in Ho, connecting buyers with trusted local sellers.
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-3 text-sm uppercase tracking-wider text-indigo-300">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-indigo-200 hover:text-white">Shop</Link></li>
              <li><Link to="/orders" className="text-indigo-200 hover:text-white">My Orders</Link></li>
              <li><Link to="/wishlist" className="text-indigo-200 hover:text-white">Wishlist</Link></li>
              <li><Link to="/become-seller" className="text-indigo-200 hover:text-white">Become a Seller</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-3 text-sm uppercase tracking-wider text-indigo-300">Contact B Store on</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span>📞</span>
                <a
                  href="https://wa.me/233597699623"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-200 hover:text-white"
                >
                 0597699623
                </a>
              </li>
              <li className="flex items-start gap-2">
                <span>📧</span>
                <a
                  href="mailto:Mawuenyegahwovenu@gmail.com"
                  className="text-indigo-200 hover:text-white break-all"
                >
                  Mawuenyegahwovenu@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <span>📍</span>
                <span className="text-indigo-200">Ho, Volta Region, Ghana</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-3 text-sm uppercase tracking-wider text-indigo-300">Data Bundles</h4>
            <p className="text-sm text-indigo-200 mb-3">
              📶Affordable data bundles for MTN, Telecel & AirtelTigo.
            </p>
            <a
              href="https://chat.whatsapp.com/E4gkQqa6s3yLmfgLRyiPK"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
            >
              📱 Join WhatsApp Data Group
            </a>
          </div>
        </div>

        <div className="border-t border-indigo-800 mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-indigo-300">
          <p>© {year} B STORE. All rights reserved.</p>
          <p>🛒 Shop on B STORE — or join us as a seller with your products🛒  , Ghana</p>
        </div>
      </div>
    </footer>
  );
}