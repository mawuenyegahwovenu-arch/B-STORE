import { createContext, useContext, useEffect, useState } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    // Load from localStorage on first load
    try {
      const saved = localStorage.getItem('sstore_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save to localStorage whenever cart changes
  useEffect(() => {
    localStorage.setItem('sstore_cart', JSON.stringify(cart));
  }, [cart]);

  function addToCart(product, qty = 1) {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        const newQty = existing.qty + qty;
        if (newQty > product.stock) {
          alert(`Only ${product.stock} in stock.`);
          return prev;
        }
        return prev.map(i => i.id === product.id ? { ...i, qty: newQty } : i);
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        image_url: product.image_url,
        stock: product.stock,
        seller_id: product.seller_id,
        seller_name: product.seller_name,
        category_name: product.category_name,
        qty,
      }];
    });
  }

  function removeFromCart(productId) {
    setCart(prev => prev.filter(i => i.id !== productId));
  }

  function updateQty(productId, qty) {
    if (qty < 1) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(i => {
      if (i.id === productId) {
        if (qty > i.stock) {
          alert(`Only ${i.stock} in stock.`);
          return i;
        }
        return { ...i, qty };
      }
      return i;
    }));
  }

  function clearCart() {
    setCart([]);
  }

  const totalItems = cart.reduce((sum, i) => sum + i.qty, 0);
  const totalAmount = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const uniqueSellers = [...new Set(cart.map(i => i.seller_id))];
  const isMultiSeller = uniqueSellers.length > 1;

  const value = {
    cart,
    addToCart,
    removeFromCart,
    updateQty,
    clearCart,
    totalItems,
    totalAmount,
    uniqueSellers,
    isMultiSeller,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}