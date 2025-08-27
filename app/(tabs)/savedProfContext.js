import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
  } from "react";
  import AsyncStorage from "@react-native-async-storage/async-storage";
  
  const STORAGE_KEY = "savedProfs/v1";
  
  export const SavedProfsContext = createContext(null);
  
  // Normalize an id for any professor-shaped object
  const normalizeId = (x) =>
    String(x?.id ?? x?.profileUrl ?? x?.link ?? x?.name ?? "");
  
  /** Provider */
  export function SavedProfsProvider({ children }) {
    const [savedProfs, setSavedProfs] = useState([]);
  
    // Load once
    useEffect(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (raw) setSavedProfs(JSON.parse(raw));
        } catch (e) {
          console.warn("Failed to load saved profs", e);
        }
      })();
    }, []);
  
    // Persist on change
    useEffect(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(savedProfs)).catch(() => {});
    }, [savedProfs]);
  
    const isSaved = useCallback(
      (prof) => {
        const id = normalizeId(prof);
        return savedProfs.some((p) => normalizeId(p) === id);
      },
      [savedProfs]
    );
  
    const addProf = useCallback((prof) => {
      const id = normalizeId(prof);
      if (!id) return;
  
      setSavedProfs((prev) => {
        // avoid duplicates
        if (prev.some((p) => normalizeId(p) === id)) return prev;
        const normalized = { ...prof, id };
        return [...prev, normalized];
      });
    }, []);
  
    const removeProf = useCallback((profOrId) => {
      const id = typeof profOrId === "string" ? profOrId : normalizeId(profOrId);
      if (!id) return;
  
      setSavedProfs((prev) => prev.filter((p) => normalizeId(p) !== id));
    }, []);
  
    const clearProfs = useCallback(() => setSavedProfs([]), []);
  
    const value = useMemo(
      () => ({ savedProfs, addProf, removeProf, clearProfs, isSaved }),
      [savedProfs, addProf, removeProf, clearProfs, isSaved]
    );
  
    return (
      <SavedProfsContext.Provider value={value}>
        {children}
      </SavedProfsContext.Provider>
    );
  }
  
  /** Optional convenience hook */
  export function useSavedProfs() {
    const ctx = useContext(SavedProfsContext);
    if (!ctx) throw new Error("useSavedProfs must be used within SavedProfsProvider");
    return ctx;
  }
  