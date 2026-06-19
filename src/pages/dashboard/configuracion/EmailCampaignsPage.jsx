import { useCallback, useEffect, useMemo, useState } from 'react';
import SinPermiso from '../../../components/common/SinPermiso';
import { usePermisos } from '../../../context/PermisosContext';
import { PERMISSIONS } from '../../../utils/permissions';
import { emailCampaignsService } from '../../../services/emailCampaignsService';
import { createPortal } from 'react-dom';
import './email-campaigns.css';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'scheduled', label: 'Programada' },
  { value: 'processing', label: 'Procesando' },
  { value: 'sent', label: 'Enviada' },
  { value: 'partial_failure', label: 'Enviada con fallos' },
  { value: 'failed', label: 'Fallida' },
  { value: 'cancelled', label: 'Cancelada' }
];

const EXECUTION_OPTIONS = [
  { value: 'draft', label: 'Guardar borrador' },
  { value: 'scheduled', label: 'Programar envío' },
  { value: 'send_now', label: 'Enviar ahora' }
];

const DEFAULT_FORM = {
  title: '',
  subject: '',
  html_content: '',
  scheduled_for: '',
  execution_mode: 'draft'
};

const CAMPAIGN_STATUS_META = Object.freeze({
  draft: { label: 'Borrador', badgeClass: 'text-bg-secondary' },
  scheduled: { label: 'Programada', badgeClass: 'text-bg-info' },
  processing: { label: 'Procesando', badgeClass: 'text-bg-warning' },
  sent: { label: 'Enviada', badgeClass: 'text-bg-success' },
  partial_failure: { label: 'Enviada con fallos', badgeClass: 'text-bg-warning' },
  failed: { label: 'Fallida', badgeClass: 'text-bg-danger' },
  cancelled: { label: 'Cancelada', badgeClass: 'text-bg-dark' }
});

const RECIPIENT_STATUS_META = Object.freeze({
  pending: { label: 'Pendiente', badgeClass: 'text-bg-secondary' },
  sending: { label: 'Enviando', badgeClass: 'text-bg-info' },
  sent: { label: 'Enviado', badgeClass: 'text-bg-success' },
  failed: { label: 'Fallido', badgeClass: 'text-bg-danger' },
  skipped: { label: 'Omitido', badgeClass: 'text-bg-dark' }
});

const AUDIENCE_LABEL = Object.freeze({
  all_clients: 'Todos los clientes con correo',
  selected_clients: 'Selección manual (legacy)'
});

const hasValue = (value) =>
  value !== undefined &&
  value !== null &&
  !(typeof value === 'string' && value.trim() === '');

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-HN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const toDatetimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
};

const fromDatetimeLocalToIso = (value) => {
  if (!hasValue(value)) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const resolveCampaignStatusMeta = (status) => {
  const key = String(status || '').trim().toLowerCase();
  return CAMPAIGN_STATUS_META[key] || { label: key || '-', badgeClass: 'text-bg-light' };
};

const resolveRecipientStatusMeta = (status) => {
  const key = String(status || '').trim().toLowerCase();
  return RECIPIENT_STATUS_META[key] || { label: key || '-', badgeClass: 'text-bg-light' };
};

const resolveAudienceLabel = (audienceType) => AUDIENCE_LABEL[String(audienceType || '').trim().toLowerCase()] || '-';

const resolveCampaignOutcomeHint = (status) => {
  const key = String(status || '').trim().toLowerCase();
  if (key === 'processing') return 'La campaña está en ejecución.';
  if (key === 'scheduled') return 'La campaña está lista para ejecutarse en la fecha programada.';
  if (key === 'sent') return 'Todos los destinatarios fueron procesados correctamente.';
  if (key === 'partial_failure') return 'La campaña finalizó con mezcla de envíos correctos y fallidos.';
  if (key === 'failed') return 'No se lograron completar envíos correctamente.';
  if (key === 'cancelled') return 'La campaña fue cancelada antes del envío.';
  return 'Campaña en espera de ejecución.';
};

const buildSparkPoints = (series, width = 120, height = 44, padding = 4) => {
  if (!Array.isArray(series) || series.length < 2) return '';
  const values = series.map((value) => Number(value || 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const safeWidth = Math.max(width - padding * 2, 1);
  const safeHeight = Math.max(height - padding * 2, 1);

  return values
    .map((value, index) => {
      const x = padding + (safeWidth * index) / (values.length - 1);
      const y = padding + safeHeight - ((value - min) / range) * safeHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const compareCampaignRecency = (left, right) => {
  const rightTime = Math.max(
    toTimestamp(right?.created_at),
    toTimestamp(right?.scheduled_for),
    toTimestamp(right?.updated_at),
    toTimestamp(right?.finished_at)
  );
  const leftTime = Math.max(
    toTimestamp(left?.created_at),
    toTimestamp(left?.scheduled_for),
    toTimestamp(left?.updated_at),
    toTimestamp(left?.finished_at)
  );
  if (rightTime !== leftTime) return rightTime - leftTime;
  return Number(right?.id_campaign || 0) - Number(left?.id_campaign || 0);
};

const buildVisiblePageNumbers = (page, totalPages, max = 5) => {
  const current = Number(page || 1);
  const total = Number(totalPages || 1);
  if (total <= 0) return [1];
  if (total <= max) return Array.from({ length: total }, (_, idx) => idx + 1);

  const half = Math.floor(max / 2);
  let start = Math.max(1, current - half);
  let end = start + max - 1;

  if (end > total) {
    end = total;
    start = Math.max(1, end - max + 1);
  }

  return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
};

const sanitizeCampaignHtml = (value) => {
  const rawHtml = String(value || '').trim();
  if (!rawHtml) return '<p>Aun no hay un mensaje listo para mostrar.</p>';

  return rawHtml
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+=(\"[^\"]*\"|'[^']*')/gi, '')
    .replace(/javascript:/gi, '');
};

const normalizeRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const normalizePagination = (payload, fallbackPage = 1, fallbackLimit = 20) => {
  const page = Number(payload?.pagination?.page || fallbackPage) || fallbackPage;
  const limit = Number(payload?.pagination?.limit || fallbackLimit) || fallbackLimit;
  const total = Number(payload?.pagination?.total || normalizeRows(payload).length) || 0;
  const totalPages = Number(payload?.pagination?.total_pages || Math.max(1, Math.ceil(total / limit))) || 1;
  return { page, limit, total, total_pages: totalPages };
};

const EmailCampaignsPage = () => {
  const { canAny, loading: permisosLoading } = usePermisos();
  const canView = canAny([
    PERMISSIONS.CONFIGURACION_EMAIL_CAMPAIGNS_VER,
    PERMISSIONS.CONFIGURACION_EMAIL_CAMPAIGNS_GESTIONAR
  ]);
  const canManage = canAny([PERMISSIONS.CONFIGURACION_EMAIL_CAMPAIGNS_GESTIONAR]);

  const [filters, setFilters] = useState({ q: '', status: '', page: 1, limit: 20 });
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsPagination, setCampaignsPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 1 });
  const [listLoading, setListLoading] = useState(false);

  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [campaignDetail, setCampaignDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [recipientsPagination, setRecipientsPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1
  });

  const [formMode, setFormMode] = useState('create');
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, title: '', message: '', variant: 'success' });
  const [confirmAction, setConfirmAction] = useState({ show: false, mode: '', campaign: null });
  const [actionLoading, setActionLoading] = useState({ id: null, mode: '' });

  const modalPortalTarget = typeof document !== 'undefined' ? document.body : null;

  const editableStatuses = useMemo(() => new Set(['draft', 'scheduled']), []);
  const hasActiveFilters = useMemo(
    () => Boolean(String(filters.q || '').trim() || String(filters.status || '').trim()),
    [filters.q, filters.status]
  );
  const toastVariant = toast.variant || 'success';

  const toastIconClass = (variant) => {
    if (variant === 'danger') return 'bi bi-x-octagon-fill';
    if (variant === 'warning') return 'bi bi-exclamation-triangle-fill';
    if (variant === 'info') return 'bi bi-info-circle-fill';
    return 'bi bi-check2-circle';
  };

  const openToast = useCallback((title, message, variant = 'success') => {
    setToast({ show: true, title, message, variant });
  }, []);

  const closeToast = useCallback(() => {
    setToast((current) => ({ ...current, show: false }));
  }, []);

  useEffect(() => {
    if (!toast.show) return undefined;
    const timer = setTimeout(() => {
      setToast((current) => ({ ...current, show: false }));
    }, 3200);
    return () => clearTimeout(timer);
  }, [toast.show]);

  const loadCampaigns = useCallback(async () => {
    if (!canView) return;
    setListLoading(true);
    try {
      const payload = await emailCampaignsService.list(filters);
      setCampaigns(normalizeRows(payload));
      setCampaignsPagination(normalizePagination(payload, filters.page, filters.limit));
    } catch (error) {
      openToast('Error', error?.message || 'No se pudieron cargar las campañas.', 'danger');
    } finally {
      setListLoading(false);
    }
  }, [canView, filters, openToast]);

  const loadCampaignDetail = useCallback(
    async (idCampaign) => {
      if (!idCampaign || !canView) return;
      setDetailLoading(true);
      try {
        const payload = await emailCampaignsService.getById(idCampaign);
        const detail = payload?.data || payload;
        setCampaignDetail(detail || null);
      } catch (error) {
        openToast('Error', error?.message || 'No se pudo cargar el detalle de la campaña.', 'danger');
      } finally {
        setDetailLoading(false);
      }
    },
    [canView, openToast]
  );

  const loadRecipients = useCallback(
    async (idCampaign, page = 1) => {
      if (!idCampaign || !canView) return;
      try {
        const payload = await emailCampaignsService.getRecipients(idCampaign, { page, limit: 20 });
        setRecipients(normalizeRows(payload));
        setRecipientsPagination(normalizePagination(payload, page, 20));
      } catch (error) {
        openToast('Error', error?.message || 'No se pudieron cargar los destinatarios.', 'danger');
      }
    },
    [canView, openToast]
  );

  useEffect(() => {
    if (!canView) return;
    void loadCampaigns();
  }, [canView, loadCampaigns]);

  useEffect(() => {
    if (!detailModalOpen || !selectedCampaignId || !canView) return;
    void loadCampaignDetail(selectedCampaignId);
    void loadRecipients(selectedCampaignId, recipientsPagination.page || 1);
  }, [canView, detailModalOpen, loadCampaignDetail, loadRecipients, recipientsPagination.page, selectedCampaignId]);

  const openCreateForm = () => {
    setFormMode('create');
    setFormData(DEFAULT_FORM);
    setFormOpen(true);
  };

  const openCampaignDetail = (campaign) => {
    const idCampaign = Number(campaign?.id_campaign || 0);
    if (!idCampaign) return;
    setSelectedCampaignId(idCampaign);
    setRecipientsPagination((current) => ({ ...current, page: 1 }));
    setDetailModalOpen(true);
  };

  const openEditForm = async (campaign) => {
    try {
      setFormMode('edit');
      const detailPayload = await emailCampaignsService.getById(campaign.id_campaign);
      const detail = detailPayload?.data || detailPayload;
      setFormData({
        title: detail?.title || '',
        subject: detail?.subject || '',
        html_content: detail?.html_content || '',
        scheduled_for: toDatetimeLocalValue(detail?.scheduled_for),
        execution_mode: detail?.status === 'scheduled' ? 'scheduled' : 'draft'
      });
      setSelectedCampaignId(Number(campaign.id_campaign));
      setFormOpen(true);
    } catch (error) {
      openToast('Error', error?.message || 'No se pudo cargar la campaña para editar.', 'danger');
    }
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setCampaignDetail(null);
    setRecipients([]);
    setSelectedCampaignId(null);
    setRecipientsPagination({ page: 1, limit: 20, total: 0, total_pages: 1 });
  };

  const onSubmitForm = async (event) => {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true);

    try {
      const payload = {
        title: String(formData.title || '').trim(),
        subject: String(formData.subject || '').trim(),
        html_content: String(formData.html_content || ''),
        audience_type: 'all_clients',
        selected_client_ids: [],
        status: formData.execution_mode === 'scheduled' ? 'scheduled' : 'draft',
        scheduled_for: formData.execution_mode === 'scheduled'
          ? fromDatetimeLocalToIso(formData.scheduled_for)
          : null
      };

      if (!payload.title) throw new Error('El título es obligatorio.');
      if (!payload.subject) throw new Error('El asunto es obligatorio.');
      if (!payload.html_content.trim()) throw new Error('El contenido de la campaña es obligatorio.');
      if (formData.execution_mode === 'scheduled' && !payload.scheduled_for) {
        throw new Error('Debes seleccionar fecha y hora para programar.');
      }

      let savedCampaign = null;
      if (formMode === 'create') {
        const created = await emailCampaignsService.create(payload);
        savedCampaign = created?.data || created;
      } else {
        if (!selectedCampaignId) throw new Error('No se encontró la campaña a editar.');
        const updated = await emailCampaignsService.update(selectedCampaignId, payload);
        savedCampaign = updated?.data || updated;
      }

      const targetId = Number(savedCampaign?.id_campaign || selectedCampaignId || 0);
      if (formData.execution_mode === 'send_now' && targetId > 0) {
        await emailCampaignsService.sendNow(targetId);
      }

      await loadCampaigns();
      if (targetId > 0 && detailModalOpen) {
        setSelectedCampaignId(targetId);
        await loadCampaignDetail(targetId);
        await loadRecipients(targetId, 1);
      }

      setFormOpen(false);
      openToast(
        'Campañas de correo',
        formData.execution_mode === 'send_now'
          ? 'Campaña guardada y envío iniciado correctamente.'
          : 'Campaña guardada correctamente.',
        'success'
      );
    } catch (error) {
      openToast('Error', error?.message || 'No se pudo guardar la campaña.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const openActionConfirm = (mode, campaign) => {
    if (!canManage || !campaign?.id_campaign) return;
    setConfirmAction({ show: true, mode, campaign });
  };

  const closeActionConfirm = () => {
    if (actionLoading.id !== null) return;
    setConfirmAction({ show: false, mode: '', campaign: null });
  };

  const executeConfirmedAction = async () => {
    const campaign = confirmAction.campaign;
    const mode = confirmAction.mode;
    const idCampaign = Number(campaign?.id_campaign || 0);
    if (!idCampaign || !mode) return;

    setActionLoading({ id: idCampaign, mode });

    try {
      if (mode === 'send_now') {
        await emailCampaignsService.sendNow(idCampaign);
        openToast('Envío iniciado', 'La campaña empezó a procesarse correctamente.', 'success');
      } else if (mode === 'cancel') {
        await emailCampaignsService.cancel(idCampaign);
        openToast('Campaña cancelada', 'La programación fue cancelada correctamente.', 'success');
      } else if (mode === 'retry_failed') {
        const payload = await emailCampaignsService.retryFailed(idCampaign);
        const result = payload?.data || payload || {};
        const sentCount = Number(result?.counters?.sent || 0);
        const failedCount = Number(result?.counters?.failed || 0);
        openToast(
          'Reintento completado',
          `Enviados: ${sentCount}. Fallidos: ${failedCount}.`,
          failedCount > 0 ? 'warning' : 'success'
        );
      }

      await loadCampaigns();
      if (detailModalOpen && Number(selectedCampaignId) === idCampaign) {
        await loadCampaignDetail(idCampaign);
        await loadRecipients(idCampaign, recipientsPagination.page || 1);
      }
      setConfirmAction({ show: false, mode: '', campaign: null });
    } catch (error) {
      openToast('Error', error?.message || 'No se pudo completar la acción seleccionada.', 'danger');
    } finally {
      setActionLoading({ id: null, mode: '' });
    }
  };

  const orderedCampaigns = useMemo(() => {
    const rows = Array.isArray(campaigns) ? [...campaigns] : [];
    rows.sort(compareCampaignRecency);
    return rows;
  }, [campaigns]);

  const campaignKpis = useMemo(() => {
    const rows = orderedCampaigns;
    const kpis = {
      total: rows.length,
      draft: 0,
      scheduled: 0,
      processing: 0,
      sent: 0,
      failed: 0
    };

    rows.forEach((item) => {
      const status = String(item?.status || '').trim().toLowerCase();
      if (status === 'draft') kpis.draft += 1;
      else if (status === 'scheduled') kpis.scheduled += 1;
      else if (status === 'processing') kpis.processing += 1;
      else if (status === 'sent') kpis.sent += 1;
      else if (status === 'partial_failure' || status === 'failed') kpis.failed += 1;
    });

    return kpis;
  }, [orderedCampaigns]);

  const campaignSparkSeries = useMemo(
    () => [campaignKpis.draft, campaignKpis.scheduled, campaignKpis.processing, campaignKpis.sent, campaignKpis.failed],
    [campaignKpis.draft, campaignKpis.failed, campaignKpis.processing, campaignKpis.scheduled, campaignKpis.sent]
  );

  const renderKpiCard = (id, label, value, tone = '') => (
    <div key={id} className={`inv-prod-kpi email-campaigns-kpi ${tone}`}>
      <div className="inv-prod-kpi-content">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <svg className="inv-prod-kpi-spark" viewBox="0 0 120 44" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={buildSparkPoints(campaignSparkSeries)} />
      </svg>
    </div>
  );

  const isActionBusy = (campaignId) => Number(actionLoading.id || 0) === Number(campaignId || 0);

  const confirmMeta = useMemo(() => {
    if (confirmAction.mode === 'send_now') {
      return {
        title: 'Confirmar envío inmediato',
        subtitle: 'La campaña empezará a procesarse ahora mismo.',
        note: 'Usa esta acción cuando el contenido y destinatarios estén listos para enviar.',
        question: '¿Deseas iniciar el envío ahora?',
        buttonClass: 'btn btn-warning',
        actionLabel: 'Enviar ahora',
        actionBusyLabel: 'Enviando...',
        icon: 'bi-send'
      };
    }

    if (confirmAction.mode === 'cancel') {
      return {
        title: 'Confirmar cancelación',
        subtitle: 'La campaña programada quedará cancelada.',
        note: 'Solo se cancelan campañas programadas que aún no empiezan a procesarse.',
        question: '¿Deseas cancelar esta campaña?',
        buttonClass: 'btn inv-pro-btn-danger',
        actionLabel: 'Cancelar campaña',
        actionBusyLabel: 'Cancelando...',
        icon: 'bi-x-circle'
      };
    }

    return {
      title: 'Confirmar reintento de fallidos',
      subtitle: 'Solo se reintentará el envío para destinatarios en estado fallido.',
      note: 'No se crean campañas nuevas ni se duplican destinatarios.',
      question: '¿Deseas reintentar envíos fallidos?',
      buttonClass: 'btn btn-success',
      actionLabel: 'Reintentar fallidos',
      actionBusyLabel: 'Reintentando...',
      icon: 'bi-arrow-repeat'
    };
  }, [confirmAction.mode]);

  const detailStatus = String(campaignDetail?.status || '').toLowerCase();
  const detailStatusMeta = resolveCampaignStatusMeta(campaignDetail?.status);
  const detailIsEditable = editableStatuses.has(detailStatus) && !campaignDetail?.started_at;
  const detailCanRetry =
    canManage &&
    Number(campaignDetail?.failed_count || 0) > 0 &&
    detailStatus !== 'processing' &&
    detailStatus !== 'cancelled';
  const readableCampaignHtml = useMemo(
    () => sanitizeCampaignHtml(campaignDetail?.html_content),
    [campaignDetail?.html_content]
  );
  const currentPage = Math.max(1, Number(campaignsPagination.page || filters.page || 1));
  const pageLimit = Math.max(1, Number(campaignsPagination.limit || filters.limit || 20));
  const totalCampaigns = Math.max(0, Number(campaignsPagination.total || 0));
  const totalPages = Math.max(1, Number(campaignsPagination.total_pages || 1));
  const visiblePageNumbers = useMemo(
    () => buildVisiblePageNumbers(currentPage, totalPages),
    [currentPage, totalPages]
  );
  const pageStart = totalCampaigns > 0 ? (currentPage - 1) * pageLimit + 1 : 0;
  const pageEnd = totalCampaigns > 0 ? pageStart + orderedCampaigns.length - 1 : 0;

  if (permisosLoading) return null;

  if (!canView) {
    return (
      <SinPermiso
        permiso={`${PERMISSIONS.CONFIGURACION_EMAIL_CAMPAIGNS_VER} | ${PERMISSIONS.CONFIGURACION_EMAIL_CAMPAIGNS_GESTIONAR}`}
        detalle="No tienes acceso al módulo de campañas de correo."
      />
    );
  }

  const formModal =
    modalPortalTarget && formOpen
      ? createPortal(
          <div className="inv-prod-pmodal inv-prod-pmodal--create show" aria-hidden={!formOpen}>
            <div className="inv-prod-pmodal__overlay" onClick={closeForm} />
            <div className="inv-prod-pmodal__viewport">
              <div
                className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create email-campaigns-form-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="email-campaigns-form-title"
                onClick={(event) => event.stopPropagation()}
              >
                <form onSubmit={onSubmitForm} className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create">
                  <div className="inv-prod-pmodal__body">
                    <div className="inv-ins-create-hero is-create">
                      <button
                        type="button"
                        className="inv-prod-drawer-close inv-ins-create-hero__close"
                        onClick={closeForm}
                        aria-label="Cerrar formulario de campaña"
                        disabled={saving}
                      >
                        <i className="bi bi-x-lg" aria-hidden="true" />
                      </button>

                      <div className="inv-ins-create-hero__icon">
                        <i className="bi bi-envelope-paper-heart" aria-hidden="true" />
                      </div>

                      <div className="inv-ins-create-hero__copy">
                        <div className="inv-ins-create-hero__kicker">Campañas de correo</div>
                        <div id="email-campaigns-form-title" className="inv-ins-create-hero__title">
                          {formMode === 'create' ? 'Crear campaña de correo' : `Actualizar campaña #${selectedCampaignId}`}
                        </div>
                        <div className="inv-ins-create-hero__text">
                          Configura el asunto, el contenido y la fecha de ejecución en un flujo claro y seguro.
                        </div>
                      </div>
                    </div>

                    <div className="inv-prod-pmodal__sections">
                      <section className="inv-prod-pmodal__section">
                        <div className="inv-prod-pmodal__section-head">
                          <div className="inv-prod-pmodal__section-title">Contenido de la campaña</div>
                        </div>

                        <div className="row g-2">
                          <div className="col-12 col-lg-6">
                            <label className="form-label mb-1">Título de la campaña</label>
                            <input
                              className="form-control"
                              value={formData.title}
                              onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                              required
                              disabled={saving}
                            />
                          </div>
                          <div className="col-12 col-lg-6">
                            <label className="form-label mb-1">Asunto del correo</label>
                            <input
                              className="form-control"
                              value={formData.subject}
                              onChange={(event) => setFormData((prev) => ({ ...prev, subject: event.target.value }))}
                              required
                              disabled={saving}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label mb-1">Contenido del mensaje (HTML)</label>
                            <textarea
                              className="form-control email-campaigns-html"
                              value={formData.html_content}
                              onChange={(event) => setFormData((prev) => ({ ...prev, html_content: event.target.value }))}
                              required
                              disabled={saving}
                            />
                          </div>
                        </div>
                      </section>

                      <section className="inv-prod-pmodal__section mt-2">
                        <div className="inv-prod-pmodal__section-head">
                          <div className="inv-prod-pmodal__section-title">Configuración de envío</div>
                        </div>
                        <div className="email-campaigns-audience-note">
                          <i className="bi bi-people" aria-hidden="true" />
                          <span>Audiencia fija: todos los clientes con correo registrado.</span>
                        </div>
                        <div className="row g-2 mt-1">
                          <div className="col-12 col-md-6">
                            <label className="form-label mb-1">Modo de ejecución</label>
                            <select
                              className="form-select"
                              value={formData.execution_mode}
                              onChange={(event) => setFormData((prev) => ({ ...prev, execution_mode: event.target.value }))}
                              disabled={saving}
                            >
                              {EXECUTION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-12 col-md-6">
                            <label className="form-label mb-1">Fecha y hora de envío</label>
                            <input
                              type="datetime-local"
                              className="form-control"
                              value={formData.scheduled_for}
                              onChange={(event) => setFormData((prev) => ({ ...prev, scheduled_for: event.target.value }))}
                              disabled={saving || formData.execution_mode !== 'scheduled'}
                            />
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>

                  <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
                    <button type="button" className="btn inv-prod-btn-subtle" onClick={closeForm} disabled={saving}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn inv-prod-btn-primary" disabled={saving || !canManage}>
                      {saving ? 'Guardando...' : formMode === 'create' ? 'Crear campaña' : 'Guardar cambios'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          modalPortalTarget
        )
      : null;

  const detailModal =
    modalPortalTarget && detailModalOpen && selectedCampaignId
      ? createPortal(
          <div
            className="modal fade show email-campaigns-detail-modal"
            style={{ display: 'block', backgroundColor: 'rgba(17, 8, 10, 0.55)', zIndex: 2600 }}
            role="dialog"
            aria-modal="true"
            onClick={closeDetailModal}
          >
            <div
              className="modal-dialog modal-dialog-centered modal-lg email-campaigns-detail-dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-content shadow inv-warehouse-detail-modal__body">
                <div className="modal-body">
                  {detailLoading ? (
                    <div className="text-center py-5 text-muted">Cargando detalle de campaña...</div>
                  ) : campaignDetail ? (
                    <>
                      <div className="inv-warehouse-detail-modal__hero">
                        <div className="inv-warehouse-detail-modal__hero-main">
                          <p className="inv-warehouse-detail-modal__eyebrow">Asi se vera tu campana</p>
                          <strong>{campaignDetail.title || `Campaña #${selectedCampaignId}`}</strong>
                          <p>{campaignDetail.subject || 'Sin asunto definido'}</p>
                        </div>
                        <span className={`badge ${detailStatusMeta.badgeClass}`}>{detailStatusMeta.label}</span>
                      </div>

                      <div className="email-campaigns-detail-head mt-3">
                        <div className="email-campaigns-detail-list">
                          <div className="email-campaigns-detail-item">
                            <span className="email-campaigns-detail-item__label">
                              <i className="bi bi-people-fill" /> Para quien es
                            </span>
                            <strong className="email-campaigns-detail-item__value">
                              {resolveAudienceLabel(campaignDetail.audience_type)}
                            </strong>
                          </div>
                          <div className="email-campaigns-detail-item">
                            <span className="email-campaigns-detail-item__label">
                              <i className="bi bi-calendar-event" /> Cuando saldra
                            </span>
                            <strong className="email-campaigns-detail-item__value">
                              {formatDateTime(campaignDetail.scheduled_for)}
                            </strong>
                          </div>
                          <div className="email-campaigns-detail-item">
                            <span className="email-campaigns-detail-item__label">
                              <i className="bi bi-play-circle" /> Empezo
                            </span>
                            <strong className="email-campaigns-detail-item__value">
                              {formatDateTime(campaignDetail.started_at)}
                            </strong>
                          </div>
                          <div className="email-campaigns-detail-item">
                            <span className="email-campaigns-detail-item__label">
                              <i className="bi bi-check2-circle" /> Termino
                            </span>
                            <strong className="email-campaigns-detail-item__value">
                              {formatDateTime(campaignDetail.finished_at)}
                            </strong>
                          </div>
                          <div className="email-campaigns-detail-hint">{resolveCampaignOutcomeHint(campaignDetail.status)}</div>
                        </div>

                        <div className="d-flex flex-wrap gap-2 justify-content-end">
                          <button
                            type="button"
                            className="btn inv-prod-btn-subtle"
                            onClick={() => {
                              void loadCampaignDetail(selectedCampaignId);
                              void loadRecipients(selectedCampaignId, recipientsPagination.page || 1);
                            }}
                            disabled={isActionBusy(selectedCampaignId)}
                          >
                            Recargar
                          </button>
                          {canManage && detailIsEditable ? (
                            <button
                              type="button"
                              className="btn inv-prod-btn-outline"
                              onClick={() => {
                                setDetailModalOpen(false);
                                void openEditForm(campaignDetail);
                              }}
                              disabled={isActionBusy(selectedCampaignId)}
                            >
                              Editar
                            </button>
                          ) : null}
                          {canManage && detailIsEditable ? (
                            <button
                              type="button"
                              className="btn inv-prod-btn-primary"
                              onClick={() => openActionConfirm('send_now', campaignDetail)}
                              disabled={isActionBusy(selectedCampaignId)}
                            >
                              Enviar ahora
                            </button>
                          ) : null}
                          {canManage && detailStatus === 'scheduled' && !campaignDetail.started_at ? (
                            <button
                              type="button"
                              className="btn inv-prod-btn-inactivate"
                              onClick={() => openActionConfirm('cancel', campaignDetail)}
                              disabled={isActionBusy(selectedCampaignId)}
                            >
                              Cancelar
                            </button>
                          ) : null}
                          {detailCanRetry ? (
                            <button
                              type="button"
                              className="btn inv-prod-btn-success-lite"
                              onClick={() => openActionConfirm('retry_failed', campaignDetail)}
                              disabled={isActionBusy(selectedCampaignId)}
                            >
                              Reintentar fallidos
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="email-campaigns-summary-grid mt-3">
                        <div className="email-campaigns-summary-box">
                          <div className="email-campaigns-summary-label">Personas en la lista</div>
                          <div className="email-campaigns-summary-value">{campaignDetail.summary?.total || 0}</div>
                        </div>
                        <div className="email-campaigns-summary-box">
                          <div className="email-campaigns-summary-label">Por enviar</div>
                          <div className="email-campaigns-summary-value">{campaignDetail.summary?.pending || 0}</div>
                        </div>
                        <div className="email-campaigns-summary-box">
                          <div className="email-campaigns-summary-label">Ya enviados</div>
                          <div className="email-campaigns-summary-value">{campaignDetail.summary?.sent || 0}</div>
                        </div>
                        <div className="email-campaigns-summary-box">
                          <div className="email-campaigns-summary-label">Con problema</div>
                          <div className="email-campaigns-summary-value">{campaignDetail.summary?.failed || 0}</div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <strong className="email-campaigns-block-title">Mensaje que vera tu cliente</strong>
                        <div className="email-campaigns-preview border rounded p-2 mt-2">
                          <div className="email-campaigns-preview-html" dangerouslySetInnerHTML={{ __html: readableCampaignHtml }} />
                        </div>
                      </div>

                      <div className="email-campaigns-recipients-head mt-3">
                        <div className="email-campaigns-recipients-head-main">
                          <strong>Lista de personas</strong>
                          <small>Aqui puedes ver como va cada envio</small>
                        </div>
                        <span>Personas mostradas: {recipients.length}</span>
                      </div>

                      <div className="table-responsive inv-prod-table-wrap">
                        <table className="table table-sm align-middle inv-prod-table email-campaigns-table email-campaigns-recipients-table">
                          <thead>
                            <tr>
                              <th>Persona</th>
                              <th>Correo</th>
                              <th>Como va</th>
                              <th>Nota</th>
                              <th>Enviado el</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recipients.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center text-muted py-3">Sin destinatarios registrados.</td>
                              </tr>
                            ) : (
                              recipients.map((row) => (
                                <tr key={row.id_campaign_recipient}>
                                  <td>{row.recipient_name || '-'}</td>
                                  <td>{row.recipient_email || '-'}</td>
                                  <td>
                                    <span className={`badge ${resolveRecipientStatusMeta(row.send_status).badgeClass}`}>
                                      {resolveRecipientStatusMeta(row.send_status).label}
                                    </span>
                                  </td>
                                  <td className={row.error_message ? 'text-danger' : ''}>{row.error_message || '-'}</td>
                                  <td>{formatDateTime(row.sent_at)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-5 text-muted">No se encontró detalle para esta campaña.</div>
                  )}
                </div>
                <div className="modal-footer inv-warehouse-detail-modal__footer">
                  <button type="button" className="btn btn-light" onClick={closeDetailModal}>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          modalPortalTarget
        )
      : null;

  const confirmBusy =
    confirmAction.show &&
    Number(actionLoading.id || 0) === Number(confirmAction.campaign?.id_campaign || 0) &&
    actionLoading.mode === confirmAction.mode;

  const confirmModal =
    modalPortalTarget && confirmAction.show
      ? createPortal(
          <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeActionConfirm}>
            <div className="inv-pro-confirm-panel inv-pro-confirm-panel--danger" onClick={(event) => event.stopPropagation()}>
              <div className="inv-pro-confirm-glow" aria-hidden="true" />

              <div className="inv-pro-confirm-head">
                <div className="inv-pro-confirm-head-main">
                  <div className="inv-pro-confirm-head-icon">
                    <i className={`bi ${confirmMeta.icon}`} aria-hidden="true" />
                  </div>
                  <div className="inv-pro-confirm-head-copy">
                    <div className="inv-pro-confirm-kicker">Campañas de correo</div>
                    <div className="inv-pro-confirm-title">{confirmMeta.title}</div>
                    <div className="inv-pro-confirm-sub">{confirmMeta.subtitle}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="inv-pro-confirm-close"
                  onClick={closeActionConfirm}
                  aria-label="Cerrar"
                  disabled={confirmBusy}
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>

              <div className="inv-pro-confirm-body">
                <div className="inv-pro-confirm-note">
                  <i className="bi bi-shield-exclamation" aria-hidden="true" />
                  <span>{confirmMeta.note}</span>
                </div>
                <div className="inv-pro-confirm-question">{confirmMeta.question}</div>
                <div className="inv-pro-confirm-name">
                  <div className="inv-pro-confirm-name-label">Campaña seleccionada</div>
                  <div className="inv-pro-confirm-name-value">
                    <i className="bi bi-envelope-paper-heart" aria-hidden="true" />
                    <span>{confirmAction.campaign?.title || `Campaña #${confirmAction.campaign?.id_campaign || '-'}`}</span>
                  </div>
                </div>
              </div>

              <div className="inv-pro-confirm-footer">
                <button
                  type="button"
                  className="btn inv-pro-btn-cancel"
                  onClick={closeActionConfirm}
                  disabled={confirmBusy}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className={confirmMeta.buttonClass}
                  onClick={() => void executeConfirmedAction()}
                  disabled={confirmBusy}
                >
                  <i className={`bi ${confirmBusy ? 'bi-hourglass-split' : confirmMeta.icon}`} aria-hidden="true" />
                  <span>{confirmBusy ? confirmMeta.actionBusyLabel : confirmMeta.actionLabel}</span>
                </button>
              </div>
            </div>
          </div>,
          modalPortalTarget
        )
      : null;

  return (
    <>
      <div className="p-4 email-campaigns-page">
        <div className="card shadow-sm mb-3 inv-prod-card inv-ins-module email-campaigns-module inv-has-sticky-header">
          <div className="card-header inv-prod-header">
            <div className="inv-prod-title-wrap">
              <div className="inv-prod-title-row">
                <i className="bi bi-envelope-paper-heart inv-prod-title-icon" />
                <span className="inv-prod-title">Campañas de correo</span>
              </div>
              <div className="inv-prod-subtitle">Gestión interna de campañas y seguimiento por destinatario</div>
            </div>
            <div className="inv-prod-header-actions email-campaigns-header-actions">
              <label className="email-campaigns-search" aria-label="Buscar campañas">
                <i className="bi bi-search" />
                <input
                  type="search"
                  value={filters.q}
                  onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value, page: 1 }))}
                  placeholder="Buscar por título o asunto..."
                />
              </label>
              <select
                className="form-select email-campaigns-status-select"
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={`inv-prod-toolbar-btn ${hasActiveFilters ? 'is-on' : ''}`}
                onClick={() => void loadCampaigns()}
              >
                <i className="bi bi-funnel" />
                <span>Filtrar</span>
              </button>
              {canManage ? (
                <button type="button" className={`inv-prod-toolbar-btn ${formOpen ? 'is-on' : ''}`} onClick={openCreateForm}>
                  <i className="bi bi-plus-circle" />
                  <span>Nueva campaña</span>
                </button>
              ) : null}
            </div>
          </div>

          <div className="inv-prod-kpis email-campaigns-kpis">
            {renderKpiCard('total', 'Visibles', campaignKpis.total)}
            {renderKpiCard('draft', 'Borrador', campaignKpis.draft)}
            {renderKpiCard('scheduled', 'Programadas', campaignKpis.scheduled, 'is-ok')}
            {renderKpiCard('processing', 'Procesando', campaignKpis.processing, 'is-low')}
            {renderKpiCard('sent', 'Enviadas', campaignKpis.sent, 'is-ok')}
            {renderKpiCard('failed', 'Con fallos', campaignKpis.failed, 'is-empty')}
          </div>

          <div className="card-body inv-prod-body email-campaigns-body">
            <div className="inv-prod-results-meta inv-inventory-results-meta email-campaigns-results-meta">
              <span>{listLoading ? 'Cargando campañas...' : `${orderedCampaigns.length} resultados`}</span>
              <span>{listLoading ? '' : `Total API: ${campaignsPagination.total || 0}`}</span>
              {detailModalOpen && selectedCampaignId ? <span>Seleccionada: #{selectedCampaignId}</span> : null}
            </div>

            <div className="email-campaigns-table-shell">
              {listLoading ? (
                <div className="inv-prod-loading" role="status" aria-live="polite">Cargando campañas...</div>
              ) : campaigns.length === 0 ? (
                <div className="inv-prod-empty inv-prod-empty-rich email-campaigns-empty">
                  <i className={`bi ${hasActiveFilters ? 'bi-search' : 'bi-envelope-open'}`} />
                  <div className="inv-prod-empty-title">
                    {hasActiveFilters
                      ? 'No encontramos campañas con los filtros aplicados.'
                      : 'No hay campañas registradas. Crea la primera para iniciar envíos.'}
                  </div>
                  {canManage ? (
                    <button type="button" className="btn inv-prod-btn-primary" onClick={openCreateForm}>
                      <i className="bi bi-plus-circle me-1" />
                      Crear campaña
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="inv-warehouse-moves__table-responsive email-campaigns-table-desktop d-none d-lg-block">
                    <table className="table inv-warehouse-moves__table align-middle mb-0 email-campaigns-table">
                      <thead>
                        <tr>
                          <th className="inv-warehouse-moves__col-item inv-warehouse-moves__cell-item">Campaña</th>
                          <th className="inv-warehouse-moves__col-type inv-warehouse-moves__cell-center">Estado</th>
                          <th className="inv-warehouse-moves__col-date inv-warehouse-moves__cell-center">Programada</th>
                          <th className="email-campaigns-col-result inv-warehouse-moves__cell-note">Resultado</th>
                          <th className="email-campaigns-col-actions inv-warehouse-moves__cell-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderedCampaigns.map((campaign) => {
                          const idCampaign = Number(campaign.id_campaign || 0);
                          const normalizedStatus = String(campaign.status || '').toLowerCase();
                          const statusMeta = resolveCampaignStatusMeta(normalizedStatus);
                          const isEditable = editableStatuses.has(normalizedStatus) && !campaign.started_at;
                          const canRetryFailed =
                            canManage &&
                            Number(campaign.failed_count || 0) > 0 &&
                            normalizedStatus !== 'processing' &&
                            normalizedStatus !== 'cancelled';
                          const rowBusy = isActionBusy(idCampaign);

                          return (
                            <tr key={campaign.id_campaign} className={detailModalOpen && Number(selectedCampaignId) === idCampaign ? 'is-selected' : ''}>
                              <td className="inv-warehouse-moves__cell-item">
                                <div className="inv-warehouse-moves__item-cell email-campaigns-table-main">
                                  <div className="inv-warehouse-moves__item-main">{campaign.title}</div>
                                </div>
                              </td>
                              <td className="inv-warehouse-moves__cell-center">
                                <span className={`badge ${statusMeta.badgeClass}`}>{statusMeta.label}</span>
                              </td>
                              <td className="inv-warehouse-moves__cell-center">
                                <span className="inv-warehouse-moves__date">{formatDateTime(campaign.scheduled_for)}</span>
                              </td>
                              <td className="inv-warehouse-moves__cell-note">
                                <div className="inv-warehouse-moves__note-cell email-campaigns-results-cell">
                                  <div className="inv-warehouse-moves__note">{`Enviados: ${campaign.sent_count || 0}`}</div>
                                  <div className="inv-warehouse-moves__note">{`Fallidos: ${campaign.failed_count || 0}`}</div>
                                </div>
                              </td>
                              <td className="inv-warehouse-moves__cell-center">
                                <div className="email-campaigns-table-actions">
                                  <button type="button" className="btn inv-prod-btn-subtle inv-ins-table-action email-campaigns-table-action" onClick={() => openCampaignDetail(campaign)} disabled={rowBusy}>Ver</button>
                                  {canManage && isEditable ? <button type="button" className="btn inv-prod-btn-outline inv-ins-table-action email-campaigns-table-action" onClick={() => void openEditForm(campaign)} disabled={rowBusy}>Editar</button> : null}
                                  {canManage && isEditable ? <button type="button" className="btn inv-prod-btn-primary inv-ins-table-action email-campaigns-table-action" onClick={() => openActionConfirm('send_now', campaign)} disabled={rowBusy}>Enviar</button> : null}
                                  {canManage && normalizedStatus === 'scheduled' && !campaign.started_at ? <button type="button" className="btn inv-prod-btn-inactivate inv-ins-table-action email-campaigns-table-action" onClick={() => openActionConfirm('cancel', campaign)} disabled={rowBusy}>Cancelar</button> : null}
                                  {canRetryFailed ? <button type="button" className="btn inv-prod-btn-success-lite inv-ins-table-action email-campaigns-table-action" onClick={() => openActionConfirm('retry_failed', campaign)} disabled={rowBusy}>Reintentar</button> : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="email-campaigns-mobile-list d-lg-none personas-page">
                    {orderedCampaigns.map((campaign, index) => {
                      const idCampaign = Number(campaign.id_campaign || 0);
                      const normalizedStatus = String(campaign.status || '').toLowerCase();
                      const statusMeta = resolveCampaignStatusMeta(normalizedStatus);
                      const isEditable = editableStatuses.has(normalizedStatus) && !campaign.started_at;
                      const canRetryFailed =
                        canManage &&
                        Number(campaign.failed_count || 0) > 0 &&
                        normalizedStatus !== 'processing' &&
                        normalizedStatus !== 'cancelled';
                      const rowBusy = isActionBusy(idCampaign);
                      const stateDotClass =
                        normalizedStatus === 'failed' || normalizedStatus === 'cancelled' ? 'off' : 'ok';

                      return (
                        <article
                          key={campaign.id_campaign}
                          className="inv-catpro-item inv-cat-card inv-anim-in personas-page__entity-card email-campaigns-mobile-card"
                          style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
                        >
                          <div className="inv-cat-card__halo" aria-hidden="true">
                            <i className="bi bi-envelope-paper-heart" />
                          </div>
                          <div className="inv-catpro-item-top email-campaigns-mobile-top">
                            <div className="inv-cat-card__title-wrap">
                              <span className="inv-cat-card__icon" aria-hidden="true">
                                <i className="bi bi-envelope-open-heart" />
                              </span>
                              <div className="email-campaigns-mobile-title-wrap">
                                <strong>{campaign.title}</strong>
                                <span>{campaign.subject}</span>
                              </div>
                            </div>
                            <span className={`badge ${statusMeta.badgeClass}`}>{statusMeta.label}</span>
                          </div>
                          <div className="personas-page__card-details email-campaigns-mobile-details">
                            <div className="personas-page__card-row">
                              <i className="bi bi-people" />
                              <span>Audiencia: {resolveAudienceLabel(campaign.audience_type)}</span>
                            </div>
                            <div className="personas-page__card-row">
                              <i className="bi bi-calendar-event" />
                              <span>Programada: {formatDateTime(campaign.scheduled_for)}</span>
                            </div>
                            <div className="personas-page__card-row">
                              <i className="bi bi-people-fill" />
                              <span>Total destinatarios: {campaign.total_recipients || 0}</span>
                            </div>
                            <div className="personas-page__card-row">
                              <i className="bi bi-bar-chart-line" />
                              <span>{`Enviados: ${campaign.sent_count || 0} | Fallidos: ${campaign.failed_count || 0}`}</span>
                            </div>
                          </div>
                          <div className="inv-catpro-meta inv-catpro-item-footer email-campaigns-mobile-footer">
                            <div className="inv-catpro-code-wrap">
                              <span className={`inv-catpro-state-dot ${stateDotClass}`} />
                              <span className="inv-catpro-code">{`CAM-${idCampaign || '-'}`}</span>
                            </div>
                            <div className="inv-catpro-meta-actions inv-catpro-action-bar inv-cat-card__actions email-campaigns-mobile-actions">
                              <button
                                type="button"
                                className="inv-catpro-action inv-catpro-action-compact"
                                onClick={() => openCampaignDetail(campaign)}
                                disabled={rowBusy}
                              >
                                <i className="bi bi-eye" />
                                <span className="inv-catpro-action-label">Ver</span>
                              </button>
                              {canManage && isEditable ? (
                                <button
                                  type="button"
                                  className="inv-catpro-action edit inv-catpro-action-compact"
                                  onClick={() => void openEditForm(campaign)}
                                  disabled={rowBusy}
                                >
                                  <i className="bi bi-pencil-square" />
                                  <span className="inv-catpro-action-label">Editar</span>
                                </button>
                              ) : null}
                              {canManage && isEditable ? (
                                <button
                                  type="button"
                                  className="inv-catpro-action state-on inv-catpro-action-compact"
                                  onClick={() => openActionConfirm('send_now', campaign)}
                                  disabled={rowBusy}
                                >
                                  <i className="bi bi-send" />
                                  <span className="inv-catpro-action-label">Enviar</span>
                                </button>
                              ) : null}
                              {canManage && normalizedStatus === 'scheduled' && !campaign.started_at ? (
                                <button
                                  type="button"
                                  className="inv-catpro-action danger inv-catpro-action-compact"
                                  onClick={() => openActionConfirm('cancel', campaign)}
                                  disabled={rowBusy}
                                >
                                  <i className="bi bi-x-circle" />
                                  <span className="inv-catpro-action-label">Cancelar</span>
                                </button>
                              ) : null}
                              {canRetryFailed ? (
                                <button
                                  type="button"
                                  className="inv-catpro-action state-off inv-catpro-action-compact"
                                  onClick={() => openActionConfirm('retry_failed', campaign)}
                                  disabled={rowBusy}
                                >
                                  <i className="bi bi-arrow-repeat" />
                                  <span className="inv-catpro-action-label">Reintentar</span>
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="inv-warehouse-moves__pagination inv-ins-pagination email-campaigns-pagination">
                    <div className="inv-warehouse-moves__pagination-meta inv-ins-pagination__page">
                      {`Mostrando ${pageStart}-${pageEnd} de ${totalCampaigns}`}
                    </div>

                    <div className="inv-warehouse-moves__pagination-controls">
                      <button
                        type="button"
                        className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
                        onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, currentPage - 1) }))}
                        disabled={listLoading || currentPage <= 1}
                        aria-label="Página anterior"
                      >
                        <i className="bi bi-chevron-left" aria-hidden="true" />
                        <span>Anterior</span>
                      </button>

                      <div className="inv-warehouse-moves__pagination-pages">
                        {visiblePageNumbers.map((pageNumber) => (
                          <button
                            key={pageNumber}
                            type="button"
                            className={`inv-warehouse-moves__page-number ${pageNumber === currentPage ? 'is-active' : ''}`.trim()}
                            onClick={() => setFilters((prev) => ({ ...prev, page: pageNumber }))}
                            disabled={listLoading}
                            aria-label={`Ir a la página ${pageNumber}`}
                            aria-current={pageNumber === currentPage ? 'page' : undefined}
                          >
                            {pageNumber}
                          </button>
                        ))}
                      </div>

                      <div className="inv-warehouse-moves__pagination-status inv-ins-pagination__page">
                        {`Página ${currentPage} de ${totalPages}`}
                      </div>

                      <button
                        type="button"
                        className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
                        onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(totalPages, currentPage + 1) }))}
                        disabled={listLoading || currentPage >= totalPages}
                        aria-label="Página siguiente"
                      >
                        <span>Siguiente</span>
                        <i className="bi bi-chevron-right" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {formModal}
      {detailModal}
      {confirmModal}

      {toast.show ? (
        <div className="inv-toast-wrap" role="status" aria-live="polite">
          <div className={`inv-toast-card ${toastVariant}`}>
            <div className="inv-toast-icon">
              <i className={toastIconClass(toastVariant)} />
            </div>
            <div className="inv-toast-content">
              <div className="inv-toast-title">{toast.title}</div>
              <div className="inv-toast-message">{toast.message}</div>
            </div>
            <button type="button" className="inv-toast-close" onClick={closeToast} aria-label="Cerrar notificación">
              <i className="bi bi-x-lg" />
            </button>
            <div className="inv-toast-progress" />
          </div>
        </div>
      ) : null}
    </>
  );
};

export default EmailCampaignsPage;
