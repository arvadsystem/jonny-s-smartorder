import { LuBike, LuChefHat, LuLeaf, LuMapPin, LuStar } from 'react-icons/lu';

const experienceItems = [
  {
    Icon: LuLeaf,
    titleTop: 'INGREDIENTES',
    highlight: 'FRESCOS',
    text: 'Seleccionamos lo mejor cada día para garantizar sabor y calidad.'
  },
  {
    Icon: LuChefHat,
    titleTop: 'HECHO AL',
    highlight: 'MOMENTO',
    text: 'Cocinamos tu pedido al instante para que llegue perfecto.'
  },
  {
    Icon: LuStar,
    titleTop: 'SABOR QUE NOS',
    highlight: 'DISTINGUE',
    text: 'Recetas originales con ese toque Jonny’s que te hace volver.'
  },
  {
    Icon: LuBike,
    titleTop: 'RÁPIDO, FÁCIL Y',
    highlight: 'CONFIABLE',
    text: 'Tu pedido llega rápido y seguro, sin complicaciones.'
  },
  {
    Icon: LuMapPin,
    titleTop: 'DE SIGUATEPEQUE',
    highlight: 'PARA VOS',
    text: 'Orgullosamente de aquí, para nuestra gente, con el mejor servicio.'
  }
];

const socialLinks = [
  {
    iconClassName: 'bi bi-facebook',
    label: 'Facebook',
    handle: "Jonny's"
  },
  {
    iconClassName: 'bi bi-instagram',
    label: 'Instagram',
    handle: 'jonnys_hn'
  }
];

const JonnyExperienceSection = () => (
  <section className="pm-jonny-experience" aria-label="La experiencia Jonny’s">
    <div className="pm-jonny-experience__card">
      <article className="pm-jonny-experience__intro">
        <div className="pm-jonny-experience__brand-wrap">
          <span className="pm-jonny-experience__spark pm-jonny-experience__spark--left" aria-hidden="true" />
          <h2>JONNY’S</h2>
          <span className="pm-jonny-experience__spark pm-jonny-experience__spark--right" aria-hidden="true" />
        </div>
        <span className="pm-jonny-experience__underline" aria-hidden="true" />
        <p>
          En Jonny’s ponemos pasión en cada detalle para que vivás una experiencia única cada vez que nos elegís.
        </p>
        <div className="pm-jonny-experience__badge-row">
          <strong>HECHO CON ACTITUD, SERVIDO CON ORGULLO.</strong>
          <i className="bi bi-heart pm-jonny-experience__heart" aria-hidden="true" />
        </div>
      </article>

      {experienceItems.map(({ Icon, ...item }) => (
        <article key={`${item.titleTop}-${item.highlight}`} className="pm-jonny-experience__item">
          <span className="pm-jonny-experience__icon" aria-hidden="true">
            <Icon strokeWidth={1.85} />
          </span>
          <h3>
            {item.titleTop}
            <span>{item.highlight}</span>
          </h3>
          <p>{item.text}</p>
        </article>
      ))}

      <aside className="pm-jonny-experience__social" aria-label="Redes sociales de Jonny's">
        <h3>SEGUINOS EN NUESTRAS REDES</h3>
        <div className="pm-jonny-experience__social-list">
          {socialLinks.map((item) => (
            <div key={item.label} className="pm-jonny-experience__social-item">
              <span className="pm-jonny-experience__social-icon" aria-hidden="true">
                <i className={item.iconClassName} />
              </span>
              <span className="pm-jonny-experience__social-copy">
                <strong>{item.label}</strong>
                <b>{item.handle}</b>
              </span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  </section>
);

export default JonnyExperienceSection;
