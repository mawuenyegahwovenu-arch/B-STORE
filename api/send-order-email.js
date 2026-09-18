export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { action, ...data } = req.body;

  if (!process.env.BREVO_API_KEY) {
    console.error("BREVO_API_KEY is not set");
    return res.status(500).json({ success: false, error: "BREVO_API_KEY not configured" });
  }

  const SENDER = {
    name: "B STORE",
    email: "mawuenyegahwovenu@gmail.com",
  };

  try {
    let emailPayload;

    if (action === 'order_confirmation') {
      emailPayload = buildOrderConfirmation(data);
    } else if (action === 'new_order_seller') {
      emailPayload = buildSellerNotification(data);
    } else if (action === 'new_order_admin') {
      emailPayload = buildAdminNotification(data);
    } else if (action === 'order_ready') {
      emailPayload = buildOrderReady(data);
    } else {
      return res.status(400).json({ success: false, error: "Unknown action" });
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: SENDER,
        ...emailPayload,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Brevo error:", result);
      return res.status(response.status).json({ success: false, error: result });
    }

    console.log(`Email [${action}] sent:`, result.messageId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ===== EMAIL BUILDERS =====

function buildOrderConfirmation({ customerEmail, customerName, orderDetails }) {
  return {
    to: [{ email: customerEmail, name: customerName }],
    subject: "Order Confirmation — B STORE",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto;">
        <h2 style="color: #312e81;">Thank you for your order, ${customerName}!</h2>
        <p>Your order has been received. Here is your summary:</p>
        <p style="background: #f3f4f6; padding: 12px; border-radius: 8px;"><strong>Order Items:</strong><br>${orderDetails}</p>
        <p>We'll notify you when your order is ready.</p>
        <br>
        <p style="color: #6b7280;">— B STORE</p>
        <p style="font-size: 11px; color: #9ca3af;">Ho, Volta Region, Ghana</p>
      </div>
    `,
  };
}

function buildSellerNotification({ sellerEmail, sellerName, orderId, customerName, customerPhone, sellerItems, deliveryPoint, total }) {
  return {
    to: [{ email: sellerEmail, name: sellerName }],
    subject: "🔔 New Order — B STORE",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto;">
        <h2 style="color: #16a34a;">Hi ${sellerName}, you have a new order!</h2>
        <p><strong>Order #${orderId}</strong></p>
        <p>👤 Customer: <strong>${customerName}</strong></p>
        <p>📞 Phone: <strong>${customerPhone}</strong></p>
        <p>📍 Deliver to: <strong>${deliveryPoint}</strong></p>
        <br>
        <p style="background: #f3f4f6; padding: 12px; border-radius: 8px;"><strong>Your items:</strong><br>${sellerItems}</p>
        <p><strong>Your Total: GHS ${total}</strong></p>
        <br>
        <p>Please update your seller dashboard when you deliver.</p>
        <br>
        <p style="color: #6b7280;">— B STORE</p>
      </div>
    `,
  };
}

function buildAdminNotification({ orderId, customerName, customerPhone, total, paymentMethod, allItems, deliveryPoint, sellerCount }) {
  return {
    to: [{ email: "mawuenyegahwovenu@gmail.com", name: "B STORE Admin" }],
    subject: `🆕 New Order #${orderId} — GHS ${total}`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto;">
        <h2 style="color: #312e81;">New Order Received</h2>
        <p><strong>Order #${orderId}</strong></p>
        <p>👤 Customer: <strong>${customerName}</strong></p>
        <p>📞 Phone: <strong>${customerPhone}</strong></p>
        <p>💳 Payment: <strong>${paymentMethod}</strong></p>
        <p>📍 Deliver to: <strong>${deliveryPoint}</strong></p>
        <br>
        <p style="background: #f3f4f6; padding: 12px; border-radius: 8px;"><strong>All Items (${sellerCount} sellers):</strong><br>${allItems}</p>
        <p><strong>Total: GHS ${total}</strong></p>
        <br>
        <p style="color: #6b7280;">— B STORE Admin Panel</p>
      </div>
    `,
  };
}

function buildOrderReady({ customerEmail, customerName, orderId, deliveryPoint, total }) {
  return {
    to: [{ email: customerEmail, name: customerName }],
    subject: "🎉 Your B STORE order is ready!",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto;">
        <h2 style="color: #16a34a;">Your order is ready, ${customerName}!</h2>
        <p><strong>Order #${orderId}</strong></p>
        <p style="background: #f0fdf4; padding: 12px; border-radius: 8px; border-left: 4px solid #16a34a;">
          <strong>Pickup Point:</strong> ${deliveryPoint}
        </p>
        <p><strong>Order Total: GHS ${total}</strong></p>
        <p>Please bring your phone number for verification.</p>
        <br>
        <p style="color: #6b7280;">— B STORE</p>
      </div>
    `,
  };
}