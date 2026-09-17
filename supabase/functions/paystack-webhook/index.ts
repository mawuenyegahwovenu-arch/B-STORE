import { withSupabase } from "@supabase/server";

console.log("Paystack webhook started");

export default {
  fetch: withSupabase({ auth: [] }, async (req) => {
    try {
      const rawBody = await req.text();
      const signature = req.headers.get("x-paystack-signature");

      if (!signature) return new Response("No signature", { status: 401 });

      const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
      if (!secret) return new Response("Missing secret", { status: 500 });

      const crypto = await import("node:crypto");
      const expectedSignature = crypto
        .createHmac("sha512", secret)
        .update(rawBody)
        .digest("hex");

      if (signature !== expectedSignature) {
        return new Response("Invalid signature", { status: 401 });
      }

      const event = JSON.parse(rawBody);

      if (event.event === "charge.success") {
        const { reference, metadata } = event.data;

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // If this is a seller registration payment, log it
        if (metadata?.payment_type === "seller_registration") {
          await supabase.from("notifications").insert({
            user_id: metadata.user_id,
            title: "Seller Fee Paid",
            message: `GHS 20 received — Reference: ${reference}`,
            type: "seller_payment",
          });
          console.log("Seller payment received:", reference);
        } else {
          // Regular order payment
          await supabase
            .from("orders")
            .update({ payment_status: "paid", payment_reference: reference })
            .eq("payment_reference", reference);
          console.log("Order payment verified:", reference);
        }
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("Error", { status: 500 });
    }
  }),
};