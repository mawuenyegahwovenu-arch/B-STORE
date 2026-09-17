import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, updateQty, cart } = useCart();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState([]);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [id]);

  async function loadProduct() {
    setLoading(true);

    const { data: prod } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('approval_status', 'approved')
      .eq('is_active', true)
      .maybeSingle();

    if (!prod) {
      setProduct(null);
      setLoading(false);
      return;
    }

    setProduct(prod);

    // Load seller info
    const { data: sellerData } = await supabase
      .from('sellers')
      .select('full_name, region, location_1, location_2')
      .eq('user_id', prod.seller_id)
      .single();
    setSeller(sellerData);

    // Load related products (same category, not this one)
    const { data: relatedData } = await supabase
      .from('products')
      .select('*')
      .eq('approval_status', 'approved')
      .eq('is_active', true)
      .eq('category_name', prod.category_name)
      .neq('id', prod.id)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .limit(4);
    setRelated(relatedData || []);

    setLoading(false);
  }

  function getQtyInCart() {
    const item = cart.find(i => i.id === id);
    return item ? item.qty : 0;
  }

  function handleAdd() {
    addToCart(product, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 800);
  }

  if (loading) {
    return <p className="text-center py-16 text-gray-500">Loading...</p>;
  }

  if (!product) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-red-500 font-bold mb-4">Product not found.</p>
        <Link to="/" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm">
          Back to Shop
        </Link>
      </div>
    );
  }

  const qty = getQtyInCart();
  const outOfStock = product.stock <= 0;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 inline-flex items-center gap-1"
      >
        ← Back
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {/* Product image */}
        <div className="bg-white rounded-2xl shadow border p-4">
          <div className="w-full h-64 sm:h-96 bg-gray-50 rounded-xl flex items-center justify-center p-4">
            <img
              src={product.image_url || 'https://via.placeholder.com/500'}
              alt={product.name}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>

        {/* Product info */}
        <div className="space-y-4">
          <div>
            <span className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">
              {product.category_name}
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mt-1">
              {product.name}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Sold by <strong>{product.seller_name}</strong>
              {seller?.region && <span> • {seller.region}</span>}
            </p>
          </div>

          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-indigo-700">
              GHS {Number(product.price).toFixed(2)}
            </p>
            {outOfStock ? (
              <span className="text-sm text-red-600 font-semibold pb-1">Out of Stock</span>
            ) : product.stock <= 5 ? (
              <span className="text-sm text-amber-600 font-semibold pb-1">⚠️ Only {product.stock} left</span>
            ) : (
              <span className="text-sm text-green-600 font-semibold pb-1">In Stock ({product.stock})</span>
            )}
          </div>

          {product.description && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Description</p>
              <p className="text-sm text-gray-600 whitespace-pre-line">{product.description}</p>
            </div>
          )}

          {/* Add to cart / stepper */}
          <div className="pt-2">
            {outOfStock ? (
              <button disabled className="w-full bg-gray-300 text-gray-500 font-bold py-3 rounded-xl cursor-not-allowed">
                Out of Stock
              </button>
            ) : qty === 0 ? (
              <button
                onClick={handleAdd}
                className={`w-full font-bold py-3 rounded-xl transition-all duration-300 ${
                  justAdded ? 'bg-emerald-500 text-white scale-105' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {justAdded ? '✅ Added to Cart!' : 'Add to Cart'}
              </button>
            ) : (
              <div className="flex items-center justify-between bg-emerald-600 rounded-xl overflow-hidden">
                <button
                  onClick={() => updateQty(product.id, qty - 1)}
                  className="text-white font-bold text-2xl w-14 py-3 hover:bg-emerald-700 transition"
                >−</button>
                <span className="text-white font-bold flex-1 text-center">
                  {qty} in cart
                </span>
                <button
                  onClick={() => updateQty(product.id, qty + 1)}
                  disabled={qty >= product.stock}
                  className={`text-white font-bold text-2xl w-14 py-3 transition ${qty >= product.stock ? 'opacity-40 cursor-not-allowed' : 'hover:bg-emerald-700'}`}
                >+</button>
              </div>
            )}
          </div>

          {/* Seller delivery info */}
          {seller && (seller.location_1 || seller.location_2) && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
              <p className="font-semibold text-blue-800 mb-2">📍 Delivery Points</p>
              <ul className="text-blue-700 space-y-1 text-xs">
                {seller.location_1 && <li>• {seller.location_1}</li>}
                {seller.location_2 && <li>• {seller.location_2}</li>}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4">More from {product.category_name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {related.map(p => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                className="bg-white rounded-xl shadow border overflow-hidden flex flex-col hover:shadow-lg transition"
              >
                <div className="w-full h-32 sm:h-40 bg-gray-100 flex items-center justify-center p-2">
                  <img src={p.image_url || 'https://via.placeholder.com/300'} className="max-w-full max-h-full object-contain" />
                </div>
                <div className="p-2 sm:p-3">
                  <h3 className="font-bold text-gray-800 text-xs sm:text-sm line-clamp-2">{p.name}</h3>
                  <p className="font-bold text-indigo-700 text-sm mt-1">GHS {Number(p.price).toFixed(2)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}