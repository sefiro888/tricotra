const filters = document.querySelectorAll(".filter");
const products = document.querySelectorAll(".product-card");

filters.forEach((filter) => {
  filter.addEventListener("click", () => {
    const activeFilter = filter.dataset.filter;

    filters.forEach((item) => item.classList.remove("active"));
    filter.classList.add("active");

    products.forEach((product) => {
      product.hidden = activeFilter !== "all" && product.dataset.category !== activeFilter;
    });
  });
});
