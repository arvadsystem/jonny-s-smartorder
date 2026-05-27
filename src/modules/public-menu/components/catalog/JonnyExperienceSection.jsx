import { LuBike, LuChefHat, LuLeaf, LuMapPin, LuPhoneCall, LuStar } from 'react-icons/lu';

const experienceItems = [
  {
    Icon: LuLeaf,
    titleTop: 'INGREDIENTES',
    highlight: 'FRESCOS',
    text: 'Seleccionamos lo mejor cada dia para garantizar sabor y calidad.'
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
    text: "Recetas originales con ese toque Jonny's que te hace volver."
  },
  {
    Icon: LuBike,
    titleTop: 'RAPIDO, FACIL Y',
    highlight: 'CONFIABLE',
    text: 'Tu pedido llega rapido y seguro, sin complicaciones.'
  },
  {
    Icon: LuMapPin,
    titleTop: 'DE SIGUATEPEQUE',
    highlight: 'PARA VOS',
    text: 'Orgullosamente de aqui, para nuestra gente, con el mejor servicio.'
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

const buildContactRows = (contactPhones = {}) => {
  const primary = String(contactPhones?.primary || '').trim();
  const secondary = String(contactPhones?.secondary || '').trim();
  const whatsapp = String(contactPhones?.whatsapp || '').trim();
  const rows = [];

  if (primary) rows.push({ id: 'primary', iconClassName: 'bi bi-telephone-fill', value: primary });
  if (secondary) rows.push({ id: 'secondary', iconClassName: 'bi bi-telephone', value: secondary });
  if (whatsapp) rows.push({ id: 'whatsapp', iconClassName: 'bi bi-whatsapp', value: whatsapp });

  return rows;
};

const JonnyExperienceSection = ({ contactPhones = {} }) => {
  const contactRows = buildContactRows(contactPhones);

  return (
    <section className="pm-jonny-experience" aria-label="La experiencia Jonny's">
      <div className="pm-jonny-experience__card">
        <article className="pm-jonny-experience__intro">
          <div className="pm-jonny-experience__brand-wrap">
            <span className="pm-jonny-experience__spark pm-jonny-experience__spark--left" aria-hidden="true" />
            <h2>JONNY'S</h2>
            <span className="pm-jonny-experience__spark pm-jonny-experience__spark--right" aria-hidden="true" />
          </div>
          <span className="pm-jonny-experience__underline" aria-hidden="true" />
          <p>
            En Jonny's ponemos pasion en cada detalle para que vivas una experiencia unica cada vez que nos eliges.
          </p>
          <div className="pm-jonny-experience__badge-row">
            <strong>HECHO CON ACTITUD, SERVIDO CON ORGULLO.</strong>
            <i className="bi bi-heart pm-jonny-experience__heart" aria-hidden="true" />
          </div>
        </article>

        <article className="pm-jonny-experience__item pm-jonny-experience__item--contact">
          <span className="pm-jonny-experience__icon" aria-hidden="true">
            <LuPhoneCall strokeWidth={1.85} />
          </span>
          <h3>
            CONTACTO
            <span>DIRECTO</span>
          </h3>
          <p>Estamos listos para atender tus pedidos y ayudarte rapido cuando lo necesites.</p>
          <div className="pm-jonny-experience__contact-list">
            {contactRows.length > 0 ? (
              contactRows.map((row) => (
                <div key={row.id} className="pm-jonny-experience__contact-line">
                  <i className={row.iconClassName} aria-hidden="true" />
                  <b>{row.value}</b>
                </div>
              ))
            ) : (
              <span className="pm-jonny-experience__contact-empty">Contacto disponible segun sucursal.</span>
            )}
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
          <h3>SIGUENOS EN NUESTRAS REDES</h3>
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
};

export default JonnyExperienceSection;
