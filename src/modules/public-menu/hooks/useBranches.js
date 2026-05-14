import { useCallback, useEffect, useState } from 'react';
import { publicMenuBootstrapService } from '../services/publicMenuBootstrapService';
import { toPublicMenuUiErrorMessage } from '../utils/publicMenuApiError';

const BRANCH_STATUS_REFRESH_MS = 60_000;

// Retrieves branches for the initial selection step.
export const useBranches = () => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBranches = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const rows = await publicMenuBootstrapService.getBranches();
      setBranches(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setBranches([]);
      setError(toPublicMenuUiErrorMessage(err, 'No pudimos cargar las sucursales.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBranches();

    const interval = window.setInterval(() => {
      loadBranches();
    }, BRANCH_STATUS_REFRESH_MS);

    return () => window.clearInterval(interval);
  }, [loadBranches]);

  return {
    branches,
    loading,
    error,
    reloadBranches: loadBranches
  };
};
