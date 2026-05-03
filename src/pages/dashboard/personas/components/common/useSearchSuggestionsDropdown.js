import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const MIN_CHARS_FOR_SUGGESTIONS = 2;
const MAX_RECENT_SEARCHES = 8;
const SEARCH_DROPDOWN_ANIMATION_MS = 220;
const SEARCH_INPUT_SELECTOR = '.inv-ins-search input[type="search"]';

export const normalizeSearchText = (value) => String(value ?? "").trim();

const readRecentSearches = (storageKey) => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeSearchText(item))
      .filter(Boolean)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
};

const persistRecentSearches = (storageKey, items) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    // Keep working even if storage is unavailable.
  }
};

const appendRecentSearch = (currentItems, term) => {
  const normalized = normalizeSearchText(term);
  if (!normalized) return Array.isArray(currentItems) ? currentItems : [];
  const withoutDuplicate = (Array.isArray(currentItems) ? currentItems : []).filter(
    (item) => normalizeSearchText(item).toLowerCase() !== normalized.toLowerCase()
  );
  return [normalized, ...withoutDuplicate].slice(0, MAX_RECENT_SEARCHES);
};

const findSearchInput = (panelNode) => {
  if (panelNode && typeof panelNode.querySelector === "function") {
    return panelNode.querySelector(SEARCH_INPUT_SELECTOR);
  }
  if (typeof document === "undefined") return null;
  return document.querySelector(SEARCH_INPUT_SELECTOR);
};

export default function useSearchSuggestionsDropdown({
  panelRef,
  search,
  setSearch,
  committedSearch,
  onSearchUpdate,
  predictiveSuggestions,
  recentStorageKey,
}) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState(() => readRecentSearches(recentStorageKey));
  const searchDropdownRef = useRef(null);
  const searchDropdownCloseTimerRef = useRef(null);
  const searchDropdownOpenFrameRef = useRef(null);
  const [searchDropdownPosition, setSearchDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 320,
  });
  const [isSearchDropdownMounted, setIsSearchDropdownMounted] = useState(false);
  const [isSearchDropdownVisible, setIsSearchDropdownVisible] = useState(false);

  const syncSearchDropdownPosition = useCallback(() => {
    const panel = panelRef?.current ?? null;
    const input = findSearchInput(panel);
    if (!panel || !input) return;

    const panelRect = panel.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const nextLeft = Math.max(12, inputRect.left - panelRect.left);
    const availableWidth = Math.max(220, panelRect.width - nextLeft - 12);
    const nextWidth = Math.max(220, Math.min(inputRect.width, availableWidth));
    const nextTop = Math.max(0, inputRect.bottom - panelRect.top + 10);

    setSearchDropdownPosition((prev) => {
      const unchanged =
        Math.abs(prev.top - nextTop) < 1 &&
        Math.abs(prev.left - nextLeft) < 1 &&
        Math.abs(prev.width - nextWidth) < 1;
      if (unchanged) return prev;
      return { top: nextTop, left: nextLeft, width: nextWidth };
    });
  }, [panelRef]);

  const pushRecentSearch = useCallback(
    (term) => {
      const normalized = normalizeSearchText(term);
      if (!normalized) return;
      setRecentSearches((prev) => {
        const next = appendRecentSearch(prev, normalized);
        persistRecentSearches(recentStorageKey, next);
        return next;
      });
    },
    [recentStorageKey]
  );

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    setActiveSuggestionIndex(-1);
    persistRecentSearches(recentStorageKey, []);
  }, [recentStorageKey]);

  const removeRecentSearch = useCallback(
    (term) => {
      const normalized = normalizeSearchText(term).toLowerCase();
      if (!normalized) return;
      setRecentSearches((prev) => {
        const next = (Array.isArray(prev) ? prev : []).filter(
          (item) => normalizeSearchText(item).toLowerCase() !== normalized
        );
        persistRecentSearches(recentStorageKey, next);
        return next;
      });
      setActiveSuggestionIndex(-1);
    },
    [recentStorageKey]
  );

  const applySearchSuggestion = useCallback(
    (value) => {
      const normalized = normalizeSearchText(value);
      if (!normalized) return;
      setSearch(normalized);
      if (typeof onSearchUpdate === "function") {
        onSearchUpdate(normalized, { source: "suggestion" });
      }
      setActiveSuggestionIndex(-1);
      setIsSearchFocused(false);
      pushRecentSearch(normalized);
      const input = findSearchInput(panelRef?.current ?? null);
      if (input && typeof input.blur === "function") input.blur();
    },
    [onSearchUpdate, panelRef, pushRecentSearch, setSearch]
  );

  const handleSearchInputChange = useCallback(
    (value) => {
      const nextValue = String(value ?? "");
      setSearch(nextValue);
      if (typeof onSearchUpdate === "function") {
        onSearchUpdate(nextValue, { source: "input" });
      }
      setActiveSuggestionIndex(-1);
    },
    [onSearchUpdate, setSearch]
  );

  useEffect(() => {
    if (!committedSearch) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- persisting recent searches is an intentional side effect of commit.
    pushRecentSearch(committedSearch);
  }, [committedSearch, pushRecentSearch]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const handleFocusIn = (event) => {
      const input = findSearchInput(panelRef?.current ?? null);
      if (!input) return;
      const dropdown = searchDropdownRef.current;
      const target = event.target;
      const focusOnInput = target === input;
      const focusInsideDropdown = Boolean(dropdown && dropdown.contains(target));

      if (focusOnInput || focusInsideDropdown) {
        setIsSearchFocused(true);
        return;
      }

      setIsSearchFocused(false);
      setActiveSuggestionIndex(-1);
    };

    const handleMouseDown = (event) => {
      const input = findSearchInput(panelRef?.current ?? null);
      const dropdown = searchDropdownRef.current;
      const target = event.target;
      const clickOnInput = Boolean(input && (target === input || input.contains(target)));
      const clickInsideDropdown = Boolean(dropdown && dropdown.contains(target));
      if (!clickOnInput && !clickInsideDropdown) {
        setIsSearchFocused(false);
        setActiveSuggestionIndex(-1);
      }
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [panelRef]);

  const isPredictiveSearch = normalizeSearchText(search).length >= MIN_CHARS_FOR_SUGGESTIONS;
  const recentSearchSuggestionItems = useMemo(
    () =>
      recentSearches.map((value) => ({
        id: `recent-${value.toLowerCase()}`,
        value,
        label: value,
        detail: "Busqueda reciente",
      })),
    [recentSearches]
  );

  const normalizedPredictiveSuggestions = useMemo(
    () =>
      (Array.isArray(predictiveSuggestions) ? predictiveSuggestions : [])
        .map((item, idx) => ({
          id: item?.id ?? `pred-${idx}`,
          value: normalizeSearchText(item?.value ?? item?.label ?? ""),
          label: normalizeSearchText(item?.label ?? item?.value ?? ""),
          detail: normalizeSearchText(item?.detail ?? "Sugerencia de busqueda"),
        }))
        .filter((item) => item.value && item.label),
    [predictiveSuggestions]
  );

  const searchSuggestionItems = useMemo(
    () => (isPredictiveSearch ? normalizedPredictiveSuggestions : recentSearchSuggestionItems),
    [isPredictiveSearch, normalizedPredictiveSuggestions, recentSearchSuggestionItems]
  );

  const shouldShowSearchSuggestions = useMemo(() => {
    if (!isSearchFocused) return false;
    if (isPredictiveSearch) return true;
    return searchSuggestionItems.length > 0;
  }, [isPredictiveSearch, isSearchFocused, searchSuggestionItems.length]);

  useEffect(() => {
    if (shouldShowSearchSuggestions) {
      if (searchDropdownCloseTimerRef.current) {
        window.clearTimeout(searchDropdownCloseTimerRef.current);
        searchDropdownCloseTimerRef.current = null;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount dropdown when suggestion mode is enabled.
      setIsSearchDropdownMounted(true);
      if (searchDropdownOpenFrameRef.current) {
        window.cancelAnimationFrame(searchDropdownOpenFrameRef.current);
      }
      searchDropdownOpenFrameRef.current = window.requestAnimationFrame(() => {
        setIsSearchDropdownVisible(true);
      });
      return undefined;
    }

    setIsSearchDropdownVisible(false);
    return undefined;
  }, [shouldShowSearchSuggestions]);

  useEffect(() => {
    if (!isSearchDropdownMounted || isSearchDropdownVisible) return undefined;

    searchDropdownCloseTimerRef.current = window.setTimeout(() => {
      setIsSearchDropdownMounted(false);
      searchDropdownCloseTimerRef.current = null;
    }, SEARCH_DROPDOWN_ANIMATION_MS);

    return () => {
      if (searchDropdownCloseTimerRef.current) {
        window.clearTimeout(searchDropdownCloseTimerRef.current);
        searchDropdownCloseTimerRef.current = null;
      }
    };
  }, [isSearchDropdownMounted, isSearchDropdownVisible]);

  useEffect(() => {
    if (!isSearchDropdownMounted) return undefined;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- recalculate popover position after mount/layout changes.
    syncSearchDropdownPosition();
    const handleLayoutChange = () => syncSearchDropdownPosition();

    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);
    return () => {
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  }, [isSearchDropdownMounted, syncSearchDropdownPosition, searchSuggestionItems.length]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep highlighted index bounded to current suggestions.
    setActiveSuggestionIndex((prev) =>
      searchSuggestionItems.length === 0 ? -1 : Math.min(prev, searchSuggestionItems.length - 1)
    );
  }, [searchSuggestionItems.length]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const handleKeyDown = (event) => {
      if (!isSearchFocused || !shouldShowSearchSuggestions || !searchSuggestionItems.length) return;
      const input = findSearchInput(panelRef?.current ?? null);
      if (!input || document.activeElement !== input) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSuggestionIndex((prev) =>
          prev < searchSuggestionItems.length - 1 ? prev + 1 : searchSuggestionItems.length - 1
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : 0));
        return;
      }

      if (event.key === "Enter" && activeSuggestionIndex >= 0) {
        event.preventDefault();
        applySearchSuggestion(searchSuggestionItems[activeSuggestionIndex]?.value);
        return;
      }

      if (event.key === "Escape") {
        setIsSearchFocused(false);
        setActiveSuggestionIndex(-1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    activeSuggestionIndex,
    applySearchSuggestion,
    isSearchFocused,
    panelRef,
    searchSuggestionItems,
    shouldShowSearchSuggestions,
  ]);

  useEffect(() => {
    return () => {
      if (searchDropdownCloseTimerRef.current) {
        window.clearTimeout(searchDropdownCloseTimerRef.current);
        searchDropdownCloseTimerRef.current = null;
      }
      if (searchDropdownOpenFrameRef.current) {
        window.cancelAnimationFrame(searchDropdownOpenFrameRef.current);
        searchDropdownOpenFrameRef.current = null;
      }
    };
  }, []);

  const searchDropdownTitle = isPredictiveSearch ? "Sugerencias" : "Busquedas recientes";
  const searchDropdownStyle = useMemo(
    () => ({
      top: `${searchDropdownPosition.top}px`,
      left: `${searchDropdownPosition.left}px`,
      width: `${searchDropdownPosition.width}px`,
    }),
    [searchDropdownPosition.left, searchDropdownPosition.top, searchDropdownPosition.width]
  );

  return {
    handleSearchInputChange,
    searchDropdownRef,
    isSearchDropdownMounted,
    isSearchDropdownVisible,
    searchDropdownStyle,
    searchDropdownTitle,
    isPredictiveSearch,
    searchSuggestionItems,
    activeSuggestionIndex,
    applySearchSuggestion,
    removeRecentSearch,
    clearRecentSearches,
    recentSearchesCount: recentSearches.length,
  };
}
