// src/components/shared/MoneyText.tsx
import React from 'react';

interface MoneyTextProps {
  minor: number;
  currency?: string;
}

export const MoneyText: React.FC<MoneyTextProps> = ({ minor, currency = 'GHS' }) => {
  const major = minor / 100;
  const formatted = major.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return <span>{currency} {formatted}</span>;
};