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
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
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
    const sorted = (prodRes.data || []).sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    setProducts(sorted);
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
      alert('Please log in to add to favourites');
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

  function handleCategorySelect(cat) {
    setSelectedCategory(cat);
    setCategoryDrawerOpen(false);
  }

  const suggestions = search.trim()
    ? products
        .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 6)
    : [];

  const filtered = products.filter(p => {
    const matchCat = selectedCategory === 'All' || p.category_name === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {categoryDrawerOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setCategoryDrawerOpen(false)}
        />
      )}

      <aside className={`fixed top-0 left-0 z-50 h-screen w-72 bg-white shadow-2xl transition-transform duration-300 lg:hidden ${categoryDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-bold uppercase text-indigo-900">CATEGORIES</h2>
          <button onClick={() => setCategoryDrawerOpen(false)} className="text-2xl leading-none text-gray-500">×</button>
        </div>
        <div className="overflow-y-auto">
          <button
            onClick={() => handleCategorySelect('All')}
            className={`w-full text-left px-4 py-3 text-sm font-semibold uppercase border-b ${selectedCategory === 'All' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-50'}`}
          >
            📁 ALL
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.name)}
              className={`w-full text-left px-4 py-3 text-sm font-semibold uppercase border-b ${selectedCategory === cat.name ? 'bg-indigo-600 text-white' : 'hover:bg-gray-50'}`}
            >
              📁 {cat.name}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex gap-6">
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="bg-white rounded-xl shadow border sticky top-20">
            <div className="p-4 border-b">
              <h2 className="font-bold uppercase text-indigo-900 text-sm">📁 CATEGORIES</h2>
            </div>
            <div className="py-2">
              <button
                onClick={() => setSelectedCategory('All')}
                className={`w-full text-left px-4 py-2 text-xs font-semibold uppercase transition ${selectedCategory === 'All' ? 'bg-indigo-600 text-white border-l-4 border-amber-400' : 'hover:bg-gray-50'}`}
              >
                ALL
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`w-full text-left px-4 py-2 text-xs font-semibold uppercase transition ${selectedCategory === cat.name ? 'bg-indigo-600 text-white border-l-4 border-amber-400' : 'hover:bg-gray-50'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex gap-2 mb-4 sm:mb-6">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="SEARCH PRODUCTS..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true); }}
                onFocus={() => search.trim() && setShowSuggestions(true)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm uppercase"
              />

              {showSuggestions && suggestions.length > 0 && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowSuggestions(false)}></div>
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-2xl border z-40 max-h-80 overflow-y-auto">
                    {suggestions.map(p => (
                      <Link
                        key={p.id}
                        to={`/product/${p.id}`}
                        onClick={() => { setShowSuggestions(false); setSearch(''); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-3 border-b last:border-b-0"
                      >
                        <div className="w-10 h-10 bg-gray-50 rounded border flex items-center justify-center p-0.5 flex-shrink-0">
                          <img src={p.image_url || 'https://via.placeholder.com/100'} className="max-w-full max-h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-800 truncate">{p.name}</p>
                          <p className="text-xs text-indigo-600 font-bold">GHS {Number(p.price).toFixed(2)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setCategoryDrawerOpen(true)}
              className="lg:hidden bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase whitespace-nowrap"
            >
              📁 FILTER
            </button>
          </div>

          {selectedCategory !== 'All' && (
            <div className="lg:hidden mb-3 flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full uppercase">
                {selectedCategory}
              </span>
              <button
                onClick={() => setSelectedCategory('All')}
                className="text-xs text-red-500 font-semibold uppercase"
              >
                ✕ CLEAR
              </button>
            </div>
          )}

          {loading ? (
            <p className="text-center text-gray-500 py-10">Loading products...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-lg font-bold text-gray-700 mb-1">NO PRODUCTS FOUND</p>
              <p className="text-sm text-gray-500">
                {search ? `Nothing matched "${search}"` : 'No products in this category yet.'}
              </p>
              {(search || selectedCategory !== 'All') && (
                <button
                  onClick={() => { setSearch(''); setSelectedCategory('All'); }}
                  className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold uppercase"
                >
                  CLEAR FILTERS
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filtered.map(p => {
                const qty = getQtyInCart(p.id);
                const added = justAdded[p.id];
                const outOfStock = p.stock <= 0;
                const inWishlist = wishlistIds.includes(p.id);

                return (
                  <div key={p.id} className="bg-white rounded-xl shadow border overflow-hidden flex flex-col relative">
                    <button
                      onClick={() => toggleWishlist(p.id)}
                      className={`absolute top-2 right-2 z-10 rounded-full w-9 h-9 flex items-center justify-center shadow-md transition text-lg ${
                        inWishlist
                          ? 'bg-red-500 hover:bg-red-600'
                          : 'bg-amber-100 hover:bg-amber-200 border-2 border-amber-300'
                      }`}
                      aria-label="Toggle favourite"
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
                          <button disabled className="w-full font-medium py-2 rounded-lg text-xs bg-gray-300 text-gray-500 cursor-not-allowed uppercase">
                            OUT OF STOCK
                          </button>
                        ) : qty === 0 ? (
                          <button
                            onClick={() => handleAdd(p)}
                            className={`w-full font-medium py-2 rounded-lg text-xs transition-all duration-300 uppercase ${
                              added ? 'bg-emerald-500 text-white scale-105' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                          >
                            {added ? '✅ ADDED!' : 'ADD TO CART'}
                          </button>
                        ) : (
                          <div className="flex items-center justify-between bg-emerald-600 rounded-lg overflow-hidden">
                            <button
                              onClick={() => updateQty(p.id, qty - 1)}
                              className="text-white font-bold text-lg w-9 sm:w-10 py-1.5 hover:bg-emerald-700 transition"
                            >−</button>
                            <span className="text-white font-bold text-xs flex-1 text-center">{qty} IN CART</span>
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
      </div>
    </div>
  );
}