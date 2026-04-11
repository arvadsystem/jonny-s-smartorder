import { apiFetch } from './api';

const withFilters = (basePath, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', String(filters.status));
  if (filters.q) params.set('q', String(filters.q));
  if (filters.date_from) params.set('date_from', String(filters.date_from));
  if (filters.date_to) params.set('date_to', String(filters.date_to));
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
};

export const emailCampaignsService = {
  list: (filters = {}) => apiFetch(withFilters('/email-campaigns', filters), 'GET'),
  smtpDiagnostic: () => apiFetch('/email-campaigns/smtp-diagnostic', 'GET'),
  getById: (idCampaign) => apiFetch(`/email-campaigns/${idCampaign}`, 'GET'),
  getRecipients: (idCampaign, filters = {}) =>
    apiFetch(withFilters(`/email-campaigns/${idCampaign}/recipients`, filters), 'GET'),
  create: (payload) => apiFetch('/email-campaigns', 'POST', payload),
  update: (idCampaign, payload) => apiFetch(`/email-campaigns/${idCampaign}`, 'PUT', payload),
  sendNow: (idCampaign) => apiFetch(`/email-campaigns/${idCampaign}/send-now`, 'POST', {}),
  retryFailed: (idCampaign) => apiFetch(`/email-campaigns/${idCampaign}/retry-failed`, 'POST', {}),
  cancel: (idCampaign) => apiFetch(`/email-campaigns/${idCampaign}/cancel`, 'POST', {})
};
