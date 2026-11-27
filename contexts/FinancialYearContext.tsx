"use client";

import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { getCurrentFY, normalizeFYCode } from "../lib/financial-year";

interface FinancialYearContextValue {
  selectedFY: string;
  currentFY: string;
  setSelectedFY: (fy: string) => void;
  resetToCurrentFY: () => void;
}

const FinancialYearContext = createContext<FinancialYearContextValue | undefined>(undefined);

export function FinancialYearProvider({ children }: { children: React.ReactNode }) {
  const currentFY = useMemo(() => getCurrentFY(), []);
  const [selectedFY, setSelectedFYState] = useState<string>(currentFY);

  const setSelectedFY = useCallback((fy: string) => {
    setSelectedFYState(normalizeFYCode(fy));
  }, []);

  const resetToCurrentFY = useCallback(() => {
    setSelectedFYState(currentFY);
  }, [currentFY]);

  const value = useMemo(
    () => ({
      selectedFY,
      currentFY,
      setSelectedFY,
      resetToCurrentFY,
    }),
    [selectedFY, currentFY, setSelectedFY, resetToCurrentFY]
  );

  return <FinancialYearContext.Provider value={value}>{children}</FinancialYearContext.Provider>;
}

export function useFinancialYear(): FinancialYearContextValue {
  const ctx = useContext(FinancialYearContext);
  if (!ctx) {
    const fallbackFY = getCurrentFY();
    return {
      selectedFY: fallbackFY,
      currentFY: fallbackFY,
      setSelectedFY: () => {},
      resetToCurrentFY: () => {},
    };
  }
  return ctx;
}
