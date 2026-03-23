import { useCallback, useEffect, useState } from 'react';
import { publicMenuBootstrapService } from '../services/publicMenuBootstrapService';

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
      setError(err?.message || 'No pudimos cargar las sucursales.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  return {
    branches,
    loading,
    error,
    reloadBranches: loadBranches
  };
};

