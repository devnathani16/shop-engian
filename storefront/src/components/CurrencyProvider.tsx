'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type CurrencyContextType = {
  baseCurrency: string;
  selectedCurrency: string;
  exchangeRates: Record<string, number>;
  setSelectedCurrency: (currency: string) => void;
  formatPrice: (amount: number, forceCurrency?: string) => string;
  isLoading: boolean;
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ 
  children, 
  baseCurrency = 'USD', 
  subdomain 
}: { 
  children: React.ReactNode, 
  baseCurrency?: string,
  subdomain: string
}) {
  const [selectedCurrency, setSelectedCurrency] = useState<string>(baseCurrency);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('storefront_currency');
    if (saved) {
      setSelectedCurrency(saved);
    } else {
      setSelectedCurrency(baseCurrency);
    }
  }, [baseCurrency]);

  // Save to local storage when changed
  useEffect(() => {
    localStorage.setItem('storefront_currency', selectedCurrency);
  }, [selectedCurrency]);

  // Fetch exchange rates from backend
  useEffect(() => {
    const fetchRates = async () => {
      try {
        setIsLoading(true);
        // Using subdomain to hit our new backend endpoint
        const res = await fetch(`http://api.localhost:8080/api/storefront/${subdomain}/exchange-rates?base=${baseCurrency}`);
        const data = await res.json();
        if (data.rates) {
          setExchangeRates(data.rates);
        }
      } catch (err) {
        console.error("Failed to fetch exchange rates", err);
      } finally {
        setIsLoading(false);
      }
    };
    if (subdomain && baseCurrency) {
      fetchRates();
    }
  }, [subdomain, baseCurrency]);

  const formatPrice = (amount: number, forceCurrency?: string) => {
    const targetCurrency = forceCurrency || selectedCurrency;
    let convertedAmount = amount;
    
    // If we have rates and the target is different from base
    if (exchangeRates[targetCurrency] && targetCurrency !== baseCurrency) {
      convertedAmount = amount * exchangeRates[targetCurrency];
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: targetCurrency,
      minimumFractionDigits: 2,
    }).format(convertedAmount);
  };

  return (
    <CurrencyContext.Provider value={{
      baseCurrency,
      selectedCurrency,
      setSelectedCurrency,
      exchangeRates,
      formatPrice,
      isLoading
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
