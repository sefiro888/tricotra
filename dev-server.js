const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");

const root = __dirname;
const port = process.env.PORT || 8080;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const catalog = JSON.parse(fs.readFileSync(path.join(root, "catalog.json"), "utf8"));

const shippingPrice = 490;
const freeShippingFrom = 15000;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const securityHeaders = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' https://js.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "connect-src 'self' https://api.stripe.com https://js.stripe.com",
    "img-src 'self' https://www.tricotra.com data:",
    "style-src 'self' 'unsafe-inline'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join("; "),
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN"
};

http
  .createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url.startsWith("/api/config")) {
        sendJson(response, 200, {
          publishableKey: stripePublishableKey,
          currency: "eur",
          mode: stripePublishableKey.startsWith("pk_test_") ? "test" : "live"
        });
        return;
      }

      if (request.method === "POST" && request.url.startsWith("/api/create-payment-intent")) {
        await handlePaymentIntent(request, response);
        return;
      }

      if (request.method === "POST" && request.url.startsWith("/api/stripe-webhook")) {
        await handleStripeWebhook(request, response);
        return;
      }

      serveStatic(request, response);
    } catch (error) {
      sendJson(response, 500, { error: "No se pudo procesar la solicitud." });
    }
  })
  .listen(port, () => {
    console.log(`TRICOTRA preview: http://localhost:${port}`);
  });

async function handlePaymentIntent(request, response) {
  if (!stripeSecretKey || !stripePublishableKey) {
    sendJson(response, 503, {
      error: "Stripe no esta configurado. Define STRIPE_SECRET_KEY y STRIPE_PUBLISHABLE_KEY."
    });
    return;
  }

  const body = await readJson(request);
  const validated = validateOrder(body);

  if (validated.error) {
    sendJson(response, 400, { error: validated.error });
    return;
  }

  const orderId = `TRI-${Date.now().toString().slice(-8)}`;
  const paymentIntent = await createStripePaymentIntent({
    amount: validated.total,
    orderId,
    email: validated.customer.email,
    metadata: {
      order_id: orderId,
      items: validated.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")
    }
  });

  sendJson(response, 200, {
    orderId,
    clientSecret: paymentIntent.client_secret,
    total: validated.total
  });
}

async function handleStripeWebhook(request, response) {
  const rawBody = await readRaw(request);
  const signature = request.headers["stripe-signature"];

  if (!stripeWebhookSecret || !signature || !verifyStripeSignature(rawBody, signature, stripeWebhookSecret)) {
    sendJson(response, 400, { error: "Webhook no verificado." });
    return;
  }

  const event = JSON.parse(rawBody);

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const orderId = intent.metadata && intent.metadata.order_id ? intent.metadata.order_id : "sin-id";
    console.log(`Pedido pagado confirmado por webhook: ${orderId}`);
  }

  sendJson(response, 200, { received: true });
}

function validateOrder(body) {
  const customer = body && body.customer;
  const cart = Array.isArray(body && body.cart) ? body.cart : [];

  if (!customer || !isEmail(customer.email) || !isText(customer.name, 2) || !isText(customer.address, 6)) {
    return { error: "Revisa nombre, email y direccion de envio." };
  }

  if (cart.length === 0) {
    return { error: "Tu bolsa esta vacia." };
  }

  const items = [];

  for (const incomingItem of cart) {
    const product = catalog.find((catalogItem) => catalogItem.id === incomingItem.id);
    const quantity = Number(incomingItem.quantity);

    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return { error: "Hay un producto no valido en la bolsa." };
    }

    items.push({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal === 0 || subtotal >= freeShippingFrom ? 0 : shippingPrice;

  return {
    customer,
    items,
    subtotal,
    shipping,
    total: subtotal + shipping
  };
}

function createStripePaymentIntent({ amount, orderId, email, metadata }) {
  const params = new URLSearchParams({
    amount: String(amount),
    currency: "eur",
    receipt_email: email,
    automatic_payment_methods: JSON.stringify({ enabled: true }),
    "metadata[order_id]": metadata.order_id,
    "metadata[items]": metadata.items
  });

  return stripeRequest("/v1/payment_intents", params);
}

function stripeRequest(endpoint, params) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: "api.stripe.com",
        path: endpoint,
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(params.toString())
        }
      },
      (response) => {
        let data = "";

        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          const parsed = JSON.parse(data || "{}");

          if (response.statusCode >= 400) {
            reject(new Error(parsed.error && parsed.error.message ? parsed.error.message : "Stripe error"));
            return;
          }

          resolve(parsed);
        });
      }
    );

    request.on("error", reject);
    request.write(params.toString());
    request.end();
  });
}

function serveStatic(request, response) {
  const cleanPath = request.url.split("?")[0];
  const requestPath = cleanPath === "/" ? "/index.html" : cleanPath;
  const filePath = path.normalize(path.join(root, requestPath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403, securityHeaders);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, securityHeaders);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      ...securityHeaders,
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(content);
  });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 20_000) {
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function readRaw(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 200_000) {
        request.destroy();
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  const crypto = require("crypto");
  const timestamp = signatureHeader.split(",").find((part) => part.startsWith("t="));
  const signature = signatureHeader.split(",").find((part) => part.startsWith("v1="));

  if (!timestamp || !signature) {
    return false;
  }

  const signedPayload = `${timestamp.slice(2)}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  const actual = signature.slice(3);

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...securityHeaders,
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function isText(value, minLength) {
  return typeof value === "string" && value.trim().length >= minLength && value.trim().length <= 160;
}

function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
