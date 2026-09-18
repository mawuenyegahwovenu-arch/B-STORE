import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Wishlist() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadWishlist();
  }, [user]);

  async function loadWishlist() {
    setLoading(true);
    const { data } = await supabase
      .from('wishlists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Enrich with product details
    const enriched = await Promise.all((data || []).map(async (w) => {
      const { data: prod } = await supabase
        .from('products')
        .select('*')
        .eq('id', w.product_id)
        .maybeSingle();
      return { ...w, product: prod };
    }));

    setItems(enriched.filter(x => x.product));
    setLoading(false);
  }

  async function removeFromWishlist(productId) {
    if (!confirm('Remove from wishlist?')) return;
    await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', productId);
    loadWishlist();
  }

  function handleAddToCart(product) {
    addToCart(product, 1);
    alert(`${product.name} added to cart!`);
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-gray-600 mb-4">Please log in to view your wishlist.</p>
        <Link to="/login" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          Log In
        </Link>
      </div>
    );
  }

  if (loading) {
    return <p className="text-center py-16 text-gray-500">Loading wishlist...</p>;
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <h1 className="text-xl sm:text-2xl font-bold text-indigo-900 mb-4 sm:mb-6">
        ❤️ My FAVOURITES ({items.length})
      </h1>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-10 text-center">
          <div className="text-6xl mb-4">💔</div>
          <p className="text-gray-600 mb-4">Your wishlist is empty.</p>
          <Link to="/" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-6 rounded-lg text-sm inline-block">
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {items.map(w => {
            const p = w.product;
            const outOfStock = p.stock <= 0;
            return (
              <div key={w.id} className="bg-white rounded-xl shadow border overflow-hidden flex flex-col">
                <Link to={`/product/${p.id}`} className="w-full h-32 sm:h-40 bg-gray-100 flex items-center justify-center p-2">
                  <img src={p.image_url || 'https://via.placeholder.com/300'} className="max-w-full max-h-full object-contain" />
                </Link>
                <div className="p-2 sm:p-3 flex-1 flex flex-col">
                  <span className="text-[10px] sm:text-xs text-indigo-600 font-semibold uppercase">{p.category_name}</span>
                  <Link to={`/product/${p.id}`}>
                    <h3 className="font-bold text-gray-800 text-xs sm:text-sm line-clamp-2 hover:text-indigo-600">{p.name}</h3>
                  </Link>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-1">By {p.seller_name}</p>
                  <p className="font-bold text-gray-900 text-sm mt-2">GHS {Number(p.price).toFixed(2)}</p>

                  <div className="mt-2 space-y-1">
                    {outOfStock ? (
                      <button disabled className="w-full font-medium py-2 rounded-lg text-xs bg-gray-300 text-gray-500 cursor-not-allowed">
                        Out of Stock
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddToCart(p)}
                        className="w-full font-medium py-2 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                      >
                        Add to Cart
                      </button>
                    )}
                    <button
                      onClick={() => removeFromWishlist(p.id)}
                      className="w-full font-medium py-2 rounded-lg text-xs bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                    >
                      ❌ Remove
                    </button>
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