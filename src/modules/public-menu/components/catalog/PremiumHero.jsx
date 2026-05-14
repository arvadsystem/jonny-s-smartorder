import HeroSection from './HeroSection';

// PremiumHero: hero visual premium del catalogo real.
// Reutiliza el carrusel actual y sus handlers.
const PremiumHero = ({
  slides = [],
  heroIndex = 0,
  branchName = '',
  orderTypeLabel = '',
  onPrev,
  onNext,
  onSelectSlide,
  onPrimaryAction
}) => (
  <HeroSection
    slides={slides}
    heroIndex={heroIndex}
    branchName={branchName}
    orderTypeLabel={orderTypeLabel}
    onPrev={onPrev}
    onNext={onNext}
    onSelectSlide={onSelectSlide}
    onPrimaryAction={onPrimaryAction}
  />
);

export default PremiumHero;
