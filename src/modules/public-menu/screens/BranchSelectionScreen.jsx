import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SucursalCard from '../components/branch/SucursalCard';
import StateBlock from '../components/feedback/StateBlock';
import { useBranches } from '../hooks/useBranches';
import { publicMenuBootstrapService } from '../services/publicMenuBootstrapService';
import { usePublicMenuFlow } from '../hooks/usePublicMenuFlow';
import { getPublicMenuPathByStep } from '../routes/flowSteps';
import {
  PUBLIC_MENU_CART_STORAGE_KEY,
  PUBLIC_MENU_ORDER_TYPES,
  PUBLIC_MENU_STEPS
} from '../types/publicMenuTypes';

const clearPublicMenuCartStorage = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PUBLIC_MENU_CART_STORAGE_KEY);
};

const getBranchSortNumber = (branch) => {
  const label = String(branch?.displayName || branch?.name || branch?.slug || '').trim();
  if (!label) return Number.POSITIVE_INFINITY;
  const match = label.match(/sucursal\s*(\d+)/i);
  if (!match) return Number.POSITIVE_INFINITY;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
};

const findBranchBySlug = (branches, rawSlug) => {
  const target = String(rawSlug || '').trim().toLowerCase();
  if (!target) return null;

  return (Array.isArray(branches) ? branches : []).find(
    (branch) => String(branch?.slug || '').trim().toLowerCase() === target
  ) || null;
};

const resolvePreviewOrderType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === PUBLIC_MENU_ORDER_TYPES.DINE_IN) return PUBLIC_MENU_ORDER_TYPES.DINE_IN;
  if (normalized === PUBLIC_MENU_ORDER_TYPES.PICKUP) return PUBLIC_MENU_ORDER_TYPES.PICKUP;
  if (normalized === PUBLIC_MENU_ORDER_TYPES.DELIVERY) return PUBLIC_MENU_ORDER_TYPES.DELIVERY;
  return PUBLIC_MENU_ORDER_TYPES.DINE_IN;
};

const HERO_AUTOPLAY_MS = 5000;
const HERO_DEFAULT_EYEBROW = 'Menu destacado';

const buildHeroSlide = ({
  id,
  imageUrl,
  title,
  source = 'fallback',
  eyebrow = HERO_DEFAULT_EYEBROW
}) => ({
  id,
  imageUrl: String(imageUrl || '').trim(),
  title: String(title || '').trim() || 'Sabores listos para ordenar',
  source,
  eyebrow: String(eyebrow || '').trim() || HERO_DEFAULT_EYEBROW
});

// Step 1: customer picks the working branch for the rest of the flow.
const BranchSelectionScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, actions } = usePublicMenuFlow();
  const { branches, loading, error, reloadBranches } = useBranches();
  const [ignoreQueryPrefill, setIgnoreQueryPrefill] = useState(false);
  const [queryBranchError, setQueryBranchError] = useState('');
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroSlides, setHeroSlides] = useState([]);
  const autoPreviewRef = useRef('');
  const heroTimerRef = useRef(null);
  const orderedBranches = useMemo(() => {
    const list = Array.isArray(branches) ? [...branches] : [];
    return list.sort((a, b) => {
      const sortA = getBranchSortNumber(a);
      const sortB = getBranchSortNumber(b);
      if (sortA !== sortB) return sortA - sortB;

      const nameA = String(a?.displayName || a?.name || '').trim().toLowerCase();
      const nameB = String(b?.displayName || b?.name || '').trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [branches]);

  // Carga imagenes de platillos para el carrusel principal de la pantalla de sucursal.
  useEffect(() => {
    let cancelled = false;

    const loadDishSlides = async () => {
      if (!orderedBranches.length) return;

      const collectedSlides = [];
      const seenImages = new Set();

      for (const branch of orderedBranches) {
        try {
          const catalog = await publicMenuBootstrapService.getCatalog({
            idSucursal: branch.id,
            orderType: PUBLIC_MENU_ORDER_TYPES.DINE_IN
          });
          const rows = Array.isArray(catalog?.items) ? catalog.items : [];
          const withImage = rows.filter((item) => Boolean(item?.imagen_url));
          withImage.forEach((item, index) => {
            const image = String(item?.imagen_url || '').trim();
            if (!image || seenImages.has(image)) return;
            seenImages.add(image);
            collectedSlides.push(
              buildHeroSlide({
                id: `hero-dish-${branch.id}-${item?.id_detalle_menu || index}`,
                imageUrl: image,
                title: item?.nombre || 'Platillo destacado',
                eyebrow: 'Lo mas pedido',
                source: 'dish'
              })
            );
          });

          if (collectedSlides.length >= 8) break;
        } catch {
          // Si una sucursal falla, intentamos la siguiente sin romper la UI.
        }
      }

      if (!cancelled) {
        if (collectedSlides.length > 0) {
          setHeroSlides(collectedSlides.slice(0, 8));
        } else {
          setHeroSlides([
            buildHeroSlide({
              id: 'hero-menu-fallback',
              imageUrl: '',
              title: 'Menu en preparacion',
              eyebrow: 'Menu',
              source: 'fallback',
              branchName: ''
            })
          ]);
        }
      }
    };

    loadDishSlides();

    return () => {
      cancelled = true;
    };
  }, [orderedBranches]);

  // Mantiene el indice del carrusel en rango cuando cambian sucursales.
  useEffect(() => {
    if (heroIndex <= heroSlides.length - 1) return;
    setHeroIndex(0);
  }, [heroIndex, heroSlides.length]);

  // Autoplay del hero para replicar comportamiento comercial tipo banner principal.
  useEffect(() => {
    if (heroTimerRef.current) {
      window.clearInterval(heroTimerRef.current);
      heroTimerRef.current = null;
    }
    if (heroSlides.length <= 1) return undefined;

    heroTimerRef.current = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, HERO_AUTOPLAY_MS);

    return () => {
      if (!heroTimerRef.current) return;
      window.clearInterval(heroTimerRef.current);
      heroTimerRef.current = null;
    };
  }, [heroSlides.length]);

  const goToHeroSlide = (index) => {
    if (!heroSlides.length) return;
    const normalized = (index + heroSlides.length) % heroSlides.length;
    setHeroIndex(normalized);
  };

  const queryBranchSlug = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return String(params.get('sucursal') || '').trim().toLowerCase();
  }, [location.search]);

  const previewAdminMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return String(params.get('preview_admin') || '').trim() === '1'
      && String(params.get('auto') || '').trim() === '1';
  }, [location.search]);

  const previewOrderType = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return resolvePreviewOrderType(params.get('tipo_pedido'));
  }, [location.search]);

  useEffect(() => {
    if (queryBranchSlug) {
      setIgnoreQueryPrefill(false);
      setQueryBranchError('');
      autoPreviewRef.current = '';
      return;
    }

    setIgnoreQueryPrefill(true);
    setQueryBranchError('');
  }, [queryBranchSlug]);

  useEffect(() => {
    if (!queryBranchSlug || ignoreQueryPrefill) return;
    if (loading || error) return;
    if (!Array.isArray(branches) || branches.length === 0) return;

    const branchFromQuery = findBranchBySlug(branches, queryBranchSlug);
    if (!branchFromQuery) {
      setIgnoreQueryPrefill(true);
      setQueryBranchError('El QR o enlace de sucursal no es valido. Selecciona una sucursal disponible.');

      if (state.selectedBranch?.id) {
        actions.selectBranch(null);
        actions.selectOrderType(null);
        actions.selectMenu(null);
      }
      clearPublicMenuCartStorage();
      return;
    }

    setQueryBranchError('');
    if (Number(state.selectedBranch?.id) !== Number(branchFromQuery.id)) {
      actions.selectBranch(branchFromQuery);
      actions.selectOrderType(null);
      clearPublicMenuCartStorage();
    }

    // En modo preview_admin forzamos entrada directa al menu para espejo en iframe.
    if (previewAdminMode) {
      const previewKey = `${queryBranchSlug}:${previewOrderType}`;
      if (autoPreviewRef.current !== previewKey) {
        autoPreviewRef.current = previewKey;
        actions.selectBranch(branchFromQuery);
        actions.selectOrderType(previewOrderType);
        if (previewOrderType === PUBLIC_MENU_ORDER_TYPES.PICKUP) {
          actions.setPickupPaymentMethod('caja');
        }
        navigate(getPublicMenuPathByStep(PUBLIC_MENU_STEPS.MENU), { replace: true });
      }
    }
  }, [
    actions,
    branches,
    error,
    ignoreQueryPrefill,
    loading,
    navigate,
    previewAdminMode,
    previewOrderType,
    queryBranchSlug,
    state.selectedBranch?.id
  ]);

  useEffect(() => {
    // Mantiene sincronizada la sucursal guardada en snapshot con la data fresca de BD.
    // Evita que en menu publico siga saliendo un nombre viejo despues de editar sucursales.
    if (loading || error) return;
    if (!state.selectedBranch?.id) return;
    if (!Array.isArray(branches) || branches.length === 0) return;

    const freshBranch = branches.find(
      (branch) => Number(branch?.id) === Number(state.selectedBranch?.id)
    );

    if (!freshBranch) return;

    const changed =
      String(freshBranch?.name || '') !== String(state.selectedBranch?.name || '') ||
      String(freshBranch?.displayName || '') !== String(state.selectedBranch?.displayName || '') ||
      String(freshBranch?.slug || '') !== String(state.selectedBranch?.slug || '') ||
      String(freshBranch?.imageUrl || '') !== String(state.selectedBranch?.imageUrl || '');

    if (changed) {
      actions.selectBranch(freshBranch);
    }
  }, [actions, branches, error, loading, state.selectedBranch]);

  const handleSelectBranch = (branch) => {
    const isBranchChange = Number(state.selectedBranch?.id) !== Number(branch?.id);
    setQueryBranchError('');
    setIgnoreQueryPrefill(true);
    actions.selectBranch(branch);
    if (isBranchChange) {
      actions.selectOrderType(null);
      actions.selectMenu(null);
      clearPublicMenuCartStorage();
    }
    navigate(getPublicMenuPathByStep(PUBLIC_MENU_STEPS.ORDER_TYPE));
  };

  if (loading) {
    return (
      <StateBlock
        variant="loading"
        title="Cargando sucursales"
        description="Un momento, estamos preparando las opciones disponibles."
      />
    );
  }

  if (error) {
    return (
      <StateBlock
        variant="error"
        title="No pudimos cargar sucursales"
        description={error}
        actionLabel="Reintentar"
        onAction={reloadBranches}
      />
    );
  }

  if (!branches.length) {
    return (
      <StateBlock
        variant="empty"
        title="No hay sucursales disponibles"
        description="Intenta nuevamente en unos minutos."
      />
    );
  }

  return (
    <section className="pm-screen pm-branch-screen" aria-label="Seleccion de sucursal">
      <div
        className="pm-branch-showcase pm-branch-hero-carousel"
        aria-roledescription="carousel"
        aria-label="Carrusel de platillos"
      >
        <div className="pm-branch-showcase__topline" aria-hidden="true" />
        <div className="pm-branch-hero-carousel__viewport">
          {heroSlides.map((slide, index) => (
            <div
              key={slide.id}
              className={`pm-branch-screen__hero ${slide.imageUrl ? 'has-photo' : ''} ${index === heroIndex ? 'is-active' : ''}`}
              style={slide.imageUrl ? { backgroundImage: `url(${slide.imageUrl})` } : undefined}
              aria-hidden={index !== heroIndex}
            >
              <div className="pm-branch-screen__hero-overlay" aria-hidden="true" />
              <div className="pm-branch-screen__hero-content">
                <span className="pm-screen__eyebrow">{slide.eyebrow || HERO_DEFAULT_EYEBROW}</span>
                <h2 className="pm-branch-screen__hero-title">{slide.title}</h2>
              </div>
            </div>
          ))}
        </div>

        {heroSlides.length > 1 ? (
          <>
            <button
              type="button"
              className="pm-branch-hero-carousel__arrow pm-branch-hero-carousel__arrow--prev"
              onClick={() => goToHeroSlide(heroIndex - 1)}
              aria-label="Imagen anterior"
            >
              <i className="bi bi-chevron-left" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="pm-branch-hero-carousel__arrow pm-branch-hero-carousel__arrow--next"
              onClick={() => goToHeroSlide(heroIndex + 1)}
              aria-label="Siguiente imagen"
            >
              <i className="bi bi-chevron-right" aria-hidden="true" />
            </button>
            <div className="pm-branch-hero-carousel__dots" role="tablist" aria-label="Indicadores del carrusel">
              {heroSlides.map((slide, index) => (
                <button
                  key={`hero-dot-${slide.id}`}
                  type="button"
                  role="tab"
                  aria-selected={index === heroIndex}
                  aria-label={`Ir a imagen ${index + 1}`}
                  className={`pm-branch-hero-carousel__dot ${index === heroIndex ? 'is-active' : ''}`}
                  onClick={() => goToHeroSlide(index)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="pm-screen__intro">
        <span className="pm-screen__eyebrow">Paso 1 de 3</span>
        <h2 className="pm-screen__title">Selecciona tu sucursal</h2>
        <p className="pm-screen__subtitle">
          Elige la sucursal donde deseas pedir para cargar el menu y opciones disponibles.
        </p>
      </div>

      <div className="pm-screen__list">
        {queryBranchError ? (
          <div className="alert alert-warning py-2" role="alert">
            {queryBranchError}
          </div>
        ) : null}
        {orderedBranches.map((branch) => (
          <SucursalCard
            key={branch.id}
            branch={branch}
            selected={Number(state.selectedBranch?.id) === Number(branch.id)}
            onSelect={handleSelectBranch}
          />
        ))}
      </div>
    </section>
  );
};

export default BranchSelectionScreen;
