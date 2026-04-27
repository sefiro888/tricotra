const filters = document.querySelectorAll(".filter");
const products = document.querySelectorAll(".product-card");
const addButtons = document.querySelectorAll("[data-id][data-name][data-price]");
const cartCount = document.querySelector("#cart-count");
const cartItems = document.querySelector("#cart-items");
const cartSubtotal = document.querySelector("#cart-subtotal");
const cartShipping = document.querySelector("#cart-shipping");
const cartTotal = document.querySelector("#cart-total");
const checkoutForm = document.querySelector("#checkout-form");
const checkoutButton = document.querySelector("#checkout-button");
const paymentElementContainer = document.querySelector("#payment-element");
const paymentMessage = document.querySelector("#payment-message");
const orderConfirmation = document.querySelector("#order-confirmation");

const CART_KEY = "tricotra-cart";
const SHIPPING_PRICE = 4.9;
const FREE_SHIPPING_FROM = 150;

let cart = loadCart();
let stripe = null;
let elements = null;
let paymentReady = false;
let activeOrderId = "";
let activeTotal = 0;

initStripe();
renderCart();

filters.forEach((filter) => {
  filter.addEventListener("click", () => {
    const activeFilter = filter.dataset.filter;

    filters.forEach((item) => item.classList.remove("active"));
    filter.classList.add("active");

    products.forEach((product) => {
      const isVisible = activeFilter === "all" || product.dataset.category === activeFilter;
      product.hidden = !isVisible;
    });
  });
});

addButtons.forEach((button) => {
  button.addEventListener("click", () => {
    addToCart({
      id: button.dataset.id,
      name: button.dataset.name,
      price: Number(button.dataset.price)
    });
  });
});

cartItems.addEventListener("click", (event) => {
  const action = event.target.dataset.action;
  const id = event.target.dataset.id;

  if (!action || !id) {
    return;
  }

  if (action === "increase") {
    updateQuantity(id, 1);
  }

  if (action === "decrease") {
    updateQuantity(id, -1);
  }

  if (action === "remove") {
    removeItem(id);
  }
});

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  if (cart.length === 0) {
    showMessage("Anade una pieza antes de confirmar el pedido.");
    return;
  }

  if (!stripe) {
    showMessage("Stripe no esta configurado todavia. Revisa las claves del servidor.");
    return;
  }

  setLoading(true);

  try {
    if (!paymentReady) {
      await prepareSecurePayment();
      return;
    }

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href.split("#")[0]
      },
      redirect: "if_required"
    });

    if (result.error) {
      showMessage(result.error.message || "No se pudo confirmar el pago.");
      return;
    }

    cart = [];
    saveCart();
    renderCart();
    checkoutForm.reset();
    resetPaymentElement();

    orderConfirmation.hidden = false;
    orderConfirmation.innerHTML = `<strong>Pedido ${activeOrderId} pagado.</strong><span>Pago seguro confirmado por ${formatPrice(activeTotal / 100)}.</span>`;
  } catch (error) {
    showMessage(error.message || "No se pudo preparar el pago seguro.");
  } finally {
    setLoading(false);
  }
});

async function initStripe() {
  try {
    const response = await fetch("/api/config");
    const config = await response.json();

    if (!config.publishableKey) {
      showMessage("Faltan las claves publicas de Stripe en el servidor.");
      return;
    }

    stripe = Stripe(config.publishableKey);
  } catch {
    showMessage("Abre la pagina desde el servidor local para activar el pago seguro.");
  }
}

async function prepareSecurePayment() {
  const response = await fetch("/api/create-payment-intent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      customer: getCustomerData(),
      cart: cart.map((item) => ({
        id: item.id,
        quantity: item.quantity
      }))
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "No se pudo crear el pago.");
  }

  activeOrderId = data.orderId;
  activeTotal = data.total;
  elements = stripe.elements({
    clientSecret: data.clientSecret,
    appearance: {
      theme: "stripe",
      variables: {
        colorPrimary: "#b0162d",
        colorBackground: "#fffdf8",
        colorText: "#110d0a",
        colorDanger: "#e83a3f",
        borderRadius: "0px",
        fontFamily: "Trebuchet MS, sans-serif"
      }
    }
  });

  const paymentElement = elements.create("payment");
  paymentElementContainer.innerHTML = "";
  paymentElement.mount("#payment-element");
  paymentElementContainer.classList.add("is-ready");
  paymentReady = true;
  checkoutButton.textContent = `Pagar ${formatPrice(activeTotal / 100)}`;
  showMessage("Pago seguro preparado. Introduce los datos de pago en el bloque de Stripe.");
}

function getCustomerData() {
  const formData = new FormData(checkoutForm);

  return {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    city: String(formData.get("city") || "").trim(),
    address: String(formData.get("address") || "").trim(),
    notes: String(formData.get("notes") || "").trim()
  };
}

function addToCart(product) {
  const existingProduct = cart.find((item) => item.id === product.id);

  if (existingProduct) {
    existingProduct.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  resetPaymentElement();
  saveCart();
  renderCart();
  document.querySelector("#carrito").scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateQuantity(id, change) {
  cart = cart
    .map((item) => {
      if (item.id !== id) {
        return item;
      }

      return { ...item, quantity: item.quantity + change };
    })
    .filter((item) => item.quantity > 0);

  resetPaymentElement();
  saveCart();
  renderCart();
}

function removeItem(id) {
  cart = cart.filter((item) => item.id !== id);
  resetPaymentElement();
  saveCart();
  renderCart();
}

function renderCart() {
  cartItems.innerHTML = "";

  if (cart.length === 0) {
    cartItems.innerHTML = '<li class="cart-empty">Tu bolsa esta vacia.</li>';
  } else {
    cart.forEach((item) => {
      const cartItem = document.createElement("li");
      cartItem.className = "cart-item";
      cartItem.innerHTML = `
        <div>
          <span>${escapeHtml(item.name)}</span>
          <strong>${formatPrice(item.price)}</strong>
        </div>
        <div class="quantity-controls" aria-label="Cantidad de ${escapeHtml(item.name)}">
          <button type="button" data-action="decrease" data-id="${item.id}">-</button>
          <span>${item.quantity}</span>
          <button type="button" data-action="increase" data-id="${item.id}">+</button>
          <button type="button" data-action="remove" data-id="${item.id}">Quitar</button>
        </div>
      `;
      cartItems.append(cartItem);
    });
  }

  const totals = getTotals();
  cartCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartSubtotal.textContent = formatPrice(totals.subtotal);
  cartShipping.textContent = totals.shipping === 0 ? "Gratis" : formatPrice(totals.shipping);
  cartTotal.textContent = formatPrice(totals.total);
}

function getTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_PRICE;

  return {
    subtotal,
    shipping,
    total: subtotal + shipping
  };
}

function resetPaymentElement() {
  if (paymentReady) {
    paymentElementContainer.innerHTML = "";
    paymentElementContainer.classList.remove("is-ready");
  }

  paymentReady = false;
  elements = null;
  activeOrderId = "";
  activeTotal = 0;
  checkoutButton.textContent = "Preparar pago seguro";
  clearMessage();
}

function setLoading(isLoading) {
  checkoutButton.disabled = isLoading;
  checkoutButton.textContent = isLoading ? "Procesando..." : paymentReady ? `Pagar ${formatPrice(activeTotal / 100)}` : "Preparar pago seguro";
}

function showMessage(message) {
  paymentMessage.textContent = message;
}

function clearMessage() {
  paymentMessage.textContent = "";
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function loadCart() {
  try {
    const storedCart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return storedCart.filter((item) => item.id && item.name && Number(item.price) > 0 && Number(item.quantity) > 0);
  } catch {
    return [];
  }
}

function formatPrice(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}
