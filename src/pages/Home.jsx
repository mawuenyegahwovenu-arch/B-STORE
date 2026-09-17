import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [justAdded, setJustAdded] = useState({});
  const [wishlistIds, setWishlistIds] = useState([]);
  const { addToCart, updateQty, cart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (user) loadWishlistIds();
    else setWishlistIds([]);
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [prodRes, catRes] = await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .or('is_deleted.is.null,is_deleted.eq.false'),
      supabase.from('categories').select('*').order('name')
    ]);
    setProducts(prodRes.data || []);
    setCategories(catRes.data || []);
    setLoading(false);
  }

  async function loadWishlistIds() {
    const { data } = await supabase
      .from('wishlists')
      .select('product_id')
      .eq('user_id', user.id);
    setWishlistIds((data || []).map(w => w.product_id));
  }

  async function toggleWishlist(productId) {
    if (!user) {
      alert('Please log in to add to wishlist');
      return;
    }
    if (wishlistIds.includes(productId)) {
      await supabase.from('wishlists').delete().eq('user_id', user.id).eq('product_id', productId);
      setWishlistIds(wishlistIds.filter(id => id !== productId));
    } else {
      await supabase.from('wishlists').insert({ user_id: user.id, product_id: productId });
      setWishlistIds([...wishlistIds, productId]);
    }
  }

  function getQtyInCart(productId) {
    const item = cart.find(i => i.id === productId);
    return item ? item.qty : 0;
  }

  function handleAdd(product) {
    addToCart(product, 1);
    setJustAdded(prev => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setJustAdded(prev => ({ ...prev, [product.id]: false }));
    }, 700);
  }

  const filtered = products.filter(p => {
    const matchCat = selectedCategory === 'All' || p.category_name === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row gap-3 mb-4 sm:mb-6">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        />
        <div className="flex flex-wrap gap-2 -mx-1 px-1 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${selectedCategory === 'All' ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700'}`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${selectedCategory === cat.name ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-10">Loading products...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-lg font-bold text-gray-700 mb-1">No products found</p>
          <p className="text-sm text-gray-500">
            {search ? `Nothing matched "${search}"` : 'No products in this category yet.'}
          </p>
          {(search || selectedCategory !== 'All') && (
            <button
              onClick={() => { setSearch(''); setSelectedCategory('All'); }}
              className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map(p => {
            const qty = getQtyInCart(p.id);
            const added = justAdded[p.id];
            const outOfStock = p.stock <= 0;
            const inWishlist = wishlistIds.includes(p.id);

            return (
              <div key={p.id} className="bg-white rounded-xl shadow border overflow-hidden flex flex-col relative">
                <button
                  onClick={() => toggleWishlist(p.id)}
                  className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white rounded-full w-8 h-8 flex items-center justify-center shadow text-lg"
                  aria-label="Toggle wishlist"
                >
                  {inWishlist ? '❤️' : '🤍'}
                </button>
                <Link to={`/product/${p.id}`} className="w-full h-32 sm:h-40 bg-gray-100 flex items-center justify-center p-2">
                  <img
                    src={p.image_url || 'https://via.placeholder.com/300'}
                    alt={p.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </Link>
                <div className="p-2 sm:p-3 flex-1 flex flex-col">
                  <Link to={`/product/${p.id}`}>
                    <span className="text-[10px] sm:text-xs text-indigo-600 font-semibold uppercase">{p.category_name}</span>
                    <h3 className="font-bold text-gray-800 text-xs sm:text-sm line-clamp-2 hover:text-indigo-600">{p.name}</h3>
                  </Link>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-1">By {p.seller_name}</p>
                  <div className="flex items-center justify-between mt-auto pt-2 sm:pt-3">
                    <span className="font-bold text-gray-900 text-xs sm:text-sm">GHS {Number(p.price).toFixed(2)}</span>
                    <span className={`text-[10px] sm:text-xs ${p.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {p.stock > 0 ? `${p.stock} left` : 'Out'}
                    </span>
                  </div>

                  <div className="mt-2">
                    {outOfStock ? (
                      <button disabled className="w-full font-medium py-2 rounded-lg text-xs bg-gray-300 text-gray-500 cursor-not-allowed">
                        Out of Stock
                      </button>
                    ) : qty === 0 ? (
                      <button
                        onClick={() => handleAdd(p)}
                        className={`w-full font-medium py-2 rounded-lg text-xs transition-all duration-300 ${
                          added ? 'bg-emerald-500 text-white scale-105' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                      >
                        {added ? '✅ Added!' : 'Add to Cart'}
                      </button>
                    ) : (
                      <div className="flex items-center justify-between bg-emerald-600 rounded-lg overflow-hidden">
                        <button
                          onClick={() => updateQty(p.id, qty - 1)}
                          className="text-white font-bold text-lg w-9 sm:w-10 py-1.5 hover:bg-emerald-700 transition"
                        >−</button>
                        <span className="text-white font-bold text-xs flex-1 text-center">{qty} in cart</span>
                        <button
                          onClick={() => updateQty(p.id, qty + 1)}
                          disabled={qty >= p.stock}
                          className={`text-white font-bold text-lg w-9 sm:w-10 py-1.5 transition ${qty >= p.stock ? 'opacity-40 cursor-not-allowed' : 'hover:bg-emerald-700'}`}
                        >+</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}