const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu]');
const nav = document.querySelector('.nav');

const syncHeader = () => {
  header.classList.toggle('scrolled', window.scrollY > 12);
};

window.addEventListener('scroll', syncHeader);
syncHeader();

menuButton.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('is-open');
  header.classList.toggle('menu-open', isOpen);
  menuButton.setAttribute('aria-label', isOpen ? 'Cerrar menu' : 'Abrir menu');
});

nav.addEventListener('click', event => {
  if (event.target.matches('a')) {
    nav.classList.remove('is-open');
    header.classList.remove('menu-open');
    menuButton.setAttribute('aria-label', 'Abrir menu');
  }
});

document.querySelectorAll('.accordion button').forEach(button => {
  button.addEventListener('click', () => {
    const isOpen = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!isOpen));
  });
});
