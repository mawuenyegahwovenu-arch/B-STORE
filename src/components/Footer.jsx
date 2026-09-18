import { Link } from 'react-router-dom';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-indigo-900 text-white mt-12">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">

          <div>
            <h3 className="text-xl font-bold tracking-wider mb-3 uppercase">B STORE</h3>
            <p className="text-sm text-indigo-200 leading-relaxed uppercase">
              YOUR MULTI-VENDOR MARKETPLACE IN HO, CONNECTING BUYERS WITH TRUSTED LOCAL SELLERS.
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-3 text-sm uppercase tracking-wider text-indigo-300">QUICK LINKS</h4>
            <ul className="space-y-2 text-sm uppercase">
              <li><Link to="/" className="text-indigo-200 hover:text-white">HOME</Link></li>
              <li><Link to="/orders" className="text-indigo-200 hover:text-white">MY ORDERS</Link></li>
              <li><Link to="/wishlist" className="text-indigo-200 hover:text-white">FAVOURITES</Link></li>
              <li><Link to="/become-seller" className="text-indigo-200 hover:text-white">BECOME A SELLER</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-3 text-sm uppercase tracking-wider text-indigo-300">CONTACT B STORE</h4>
            <ul className="space-y-2 text-sm uppercase">
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
                  href="mailto:mawuenyegahwovenu@gmail.com"
                  className="text-indigo-200 hover:text-white break-all"
                >
                  MAWUENYEGAHWOVENU@GMAIL.COM
                </a>
              </li>
              <li className="flex items-start gap-2">
                <span>📍</span>
                <span className="text-indigo-200">HO, VOLTA REGION, GHANA</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-3 text-sm uppercase tracking-wider text-indigo-300">DATA BUNDLES</h4>
            <p className="text-sm text-indigo-200 mb-3 uppercase">
              AFFORDABLE DATA BUNDLES FOR MTN, TELECEL & AIRTELTIGO.
            </p>
            <a
              href="https://chat.whatsapp.com/E4gkQqa6s3yLmfgLRyiPK"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition uppercase"
            >
              📱 JOIN WHATSAPP DATA GROUP
            </a>
          </div>
        </div>

        <div className="border-t border-indigo-800 mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-indigo-300 uppercase">
          <p>© {year} B STORE. ALL RIGHTS RESERVED.</p>
                  <p>🛒 SHOP ON B STORE — OR JOIN US AS A SELLER WITH YOUR PRODUCTS 🛒</p>
        </div>
      </div>
    </footer>
  );
}