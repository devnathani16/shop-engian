'use client';

import React from 'react';
import { useCurrency } from './CurrencyProvider';

export default function CurrencySelector() {
  const { selectedCurrency, setSelectedCurrency, exchangeRates, baseCurrency } = useCurrency();

  // Always include the base currency in the available options
  const availableCurrencies = Array.from(new Set([baseCurrency, ...Object.keys(exchangeRates)]));
  
  // To avoid huge lists, let's filter to just some popular ones if we have a lot
  const popularCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'JPY'];
  const displayCurrencies = availableCurrencies.filter(c => popularCurrencies.includes(c));

  // If base currency isn't in popular, make sure it's included
  if (!displayCurrencies.includes(baseCurrency)) {
    displayCurrencies.unshift(baseCurrency);
  }

  return (
    <select
      value={selectedCurrency}
      onChange={(e) => setSelectedCurrency(e.target.value)}
      className="bg-transparent text-sm font-medium text-zinc-600 border-none cursor-pointer focus:ring-0 hover:text-zinc-900 transition-colors py-1"
    >
      {displayCurrencies.map((currency) => (
        <option key={currency} value={currency}>
          {currency}
        </option>
      ))}
    </select>
  );
}
