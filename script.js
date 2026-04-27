const filters = document.querySelectorAll(".filter");
const products = document.querySelectorAll(".product-card");
const addButtons = document.querySelectorAll("[data-name][data-price]");
const cartCount = document.querySelector("#cart-count");
const cartItems = document.querySelector("#cart-items");
const cartSubtotal = document.querySelector("#cart-subtotal");
const cartShipping = document.querySelector("#cart-shipping");
const cartTotal = document.querySelector("#cart-total");
const checkoutForm = document.querySelector("#checkout-form");
const orderConfirmation = document.querySelector("#order-confirmation");

const CART_KEY = "tricotra-cart";
const ORDER_KEY = "tricotra-orders";
const SHIPPING_PRICE = 4.9;
const FREE_SHIPPING_FROM = 150;

let cart = loadCart();

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
      name: button.dataset.name,
      price: Number(button.dataset.price)
    });
  });
});

cartItems.addEventListener("click", (event) => {
  const action = event.target.dataset.action;
  const name = event.target.dataset.name;

  if (!action || !name) {
    return;
  }

  if (action === "increase") {
    updateQuantity(name, 1);
  }

  if (action === "decrease") {
    updateQuantity(name, -1);
  }

  if (action === "remove") {
    removeItem(name);
  }
});

checkoutForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (cart.length === 0) {
    orderConfirmation.hidden = false;
    orderConfirmation.innerHTML = "<strong>Tu bolsa esta vacia.</strong><span>Anade una pieza antes de confirmar el pedido.</span>";
    return;
  }

  const formData = new FormData(checkoutForm);
  const totals = getTotals();
  const order = {
    id: `TRI-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString(),
    customer: Object.fromEntries(formData.entries()),
    items: cart,
    total: totals.total
  };

  const orders = JSON.parse(localStorage.getItem(ORDER_KEY) || "[]");
  orders.push(order);
  localStorage.setItem(ORDER_KEY, JSON.stringify(orders));

  cart = [];
  saveCart();
  renderCart();
  checkoutForm.reset();

  orderConfirmation.hidden = false;
  orderConfirmation.innerHTML = `<strong>Pedido ${order.id} confirmado.</strong><span>Hemos guardado tu pedido interno por ${formatPrice(order.total)}. El siguiente paso sera conectar pagos reales al dominio.</span>`;
});

renderCart();

function addToCart(product) {
  const existingProduct = cart.find((item) => item.name === product.name);

  if (existingProduct) {
    existingProduct.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  saveCart();
  renderCart();
  document.querySelector("#carrito").scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateQuantity(name, change) {
  cart = cart
    .map((item) => {
      if (item.name !== name) {
        return item;
      }

      return { ...item, quantity: item.quantity + change };
    })
    .filter((item) => item.quantity > 0);

  saveCart();
  renderCart();
}

function removeItem(name) {
  cart = cart.filter((item) => item.name !== name);
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
          <span>${item.name}</span>
          <strong>${formatPrice(item.price)}</strong>
        </div>
        <div class="quantity-controls" aria-label="Cantidad de ${item.name}">
          <button type="button" data-action="decrease" data-name="${item.name}">-</button>
          <span>${item.quantity}</span>
          <button type="button" data-action="increase" data-name="${item.name}">+</button>
          <button type="button" data-action="remove" data-name="${item.name}">Quitar</button>
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

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
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
