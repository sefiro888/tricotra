const filters = document.querySelectorAll(".filter");
const products = document.querySelectorAll(".product-card");
const addButtons = document.querySelectorAll("[data-name][data-price]");
const cartCount = document.querySelector("#cart-count");
const cartItems = document.querySelector("#cart-items");
const cartTotal = document.querySelector("#cart-total");

const cart = [];

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
    cart.push({
      name: button.dataset.name,
      price: Number(button.dataset.price)
    });
    renderCart();
  });
});

function renderCart() {
  cartItems.innerHTML = "";

  if (cart.length === 0) {
    cartItems.innerHTML = '<li class="cart-empty">Tu bolsa esta vacia.</li>';
  } else {
    cart.forEach((item) => {
      const cartItem = document.createElement("li");
      cartItem.innerHTML = `<span>${item.name}</span><strong>${formatPrice(item.price)}</strong>`;
      cartItems.append(cartItem);
    });
  }

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  cartCount.textContent = cart.length;
  cartTotal.textContent = formatPrice(total);
}

function formatPrice(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}
