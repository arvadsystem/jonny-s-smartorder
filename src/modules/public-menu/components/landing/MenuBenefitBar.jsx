const BENEFITS = [
  { icon: 'bi-clock', title: '20-30 min', subtitle: 'Entrega rapida' },
  { icon: 'bi-stars', title: 'Al momento', subtitle: 'Preparado al instante' },
  { icon: 'bi-shield-lock', title: 'Pago seguro', subtitle: 'Metodos confiables' },
  { icon: 'bi-emoji-smile', title: 'Sabor garantizado', subtitle: 'Recetas de la casa' }
];

// MenuBenefitBar: resumen visual de beneficios clave del servicio.
const MenuBenefitBar = () => (
  <section className="pm-landing-benefits" aria-label="Beneficios del servicio">
    {BENEFITS.map((item) => (
      <article key={item.title} className="pm-landing-benefits__item">
        <i className={`bi ${item.icon}`} aria-hidden="true" />
        <div>
          <strong>{item.title}</strong>
          <small>{item.subtitle}</small>
        </div>
      </article>
    ))}
  </section>
);

export default MenuBenefitBar;
