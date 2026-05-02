// MenuCategoryRail: rail visual de categorias principales de menu.
// Props:
// - categories: arreglo { label, imageUrl }.
// - onPrimaryAction: accion comun para ir al flujo de pedido.
const MenuCategoryRail = ({ categories = [], onPrimaryAction }) => (
  <section className="pm-landing-categories" aria-label="Categorias del menu">
    <header className="pm-landing-section__header">
      <h2>Explora por categorias</h2>
      <button type="button" onClick={onPrimaryAction}>Ver todas</button>
    </header>

    <div className="pm-landing-categories__grid">
      {categories.map((category) => (
        <button
          key={category.label}
          type="button"
          className="pm-landing-category-card"
          onClick={onPrimaryAction}
        >
          <div className="pm-landing-category-card__media">
            {category.imageUrl ? <img src={category.imageUrl} alt={category.label} loading="lazy" /> : <span />}
          </div>
          <strong>{category.label}</strong>
        </button>
      ))}
    </div>
  </section>
);

export default MenuCategoryRail;
