import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export default function CartDrawer({ open, onClose }) {
  const { cart, removeFromCart, updateQty, totalAmount, totalItems } = useCart();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-indigo-900 text-white">
          <h2 className="text-base font-medium">Your Cart ({totalItems})</h2>
          <button onClick={onClose} className="text-2xl leading-none hover:text-indigo-200">&times;</button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <p className="text-center text-gray-500 py-10">Your cart is empty.</p>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center gap-3 border-b pb-3">
                <img
                  src={item.image_url || 'https://via.placeholder.com/100'}
                  className="w-14 h-14 object-cover rounded-lg border flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">GHS {item.price.toFixed(2)} × {item.qty}</p>
                  <p className="text-xs text-emerald-600">By: {item.seller_name}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQty(item.id, item.qty - 1)}
                    className="w-6 h-6 bg-gray-200 rounded text-xs font-bold"
                  >−</button>
                  <span className="text-sm font-semibold w-6 text-center">{item.qty}</span>
                  <button
                    onClick={() => updateQty(item.id, item.qty + 1)}
                    className="w-6 h-6 bg-gray-200 rounded text-xs font-bold"
                  >+</button>
                </div>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="text-red-500 hover:text-red-700 text-lg ml-1"
                >×</button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="border-t p-4 space-y-3 bg-gray-50">
            <div className="flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span className="text-indigo-600">GHS {totalAmount.toFixed(2)}</span>
            </div>
            <Link
              to="/checkout"
              onClick={onClose}
              className="block text-center w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg text-sm"
            >
              Proceed to Checkout
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}