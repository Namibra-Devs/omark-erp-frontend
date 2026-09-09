// src/components/shared/PhoneInput.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Input, Select } from 'antd';
import type { InputProps } from 'antd';

export interface CountryItem {
  code: string;
  dialCode: string;
  name: string;
  flag: string;
  placeholder: string;
}

export const COUNTRIES: CountryItem[] = [
  { code: 'GH', dialCode: '+233', name: 'Ghana', flag: '🇬🇭', placeholder: '24 000 0000' },
  { code: 'NG', dialCode: '+234', name: 'Nigeria', flag: '🇳🇬', placeholder: '802 000 0000' },
  { code: 'US', dialCode: '+1', name: 'United States', flag: '🇺🇸', placeholder: '(555) 000-0000' },
  { code: 'GB', dialCode: '+44', name: 'United Kingdom', flag: '🇬🇧', placeholder: '7911 123456' },
  { code: 'CA', dialCode: '+1', name: 'Canada', flag: '🇨🇦', placeholder: '(555) 000-0000' },
  { code: 'ZA', dialCode: '+27', name: 'South Africa', flag: '🇿🇦', placeholder: '71 000 0000' },
  { code: 'AE', dialCode: '+971', name: 'United Arab Emirates', flag: '🇦🇪', placeholder: '50 000 0000' },
  { code: 'DE', dialCode: '+49', name: 'Germany', flag: '🇩🇪', placeholder: '151 0000000' },
  { code: 'FR', dialCode: '+33', name: 'France', flag: '🇫🇷', placeholder: '6 00 00 00 00' },
  { code: 'KE', dialCode: '+254', name: 'Kenya', flag: '🇰🇪', placeholder: '712 000000' },
  { code: 'CI', dialCode: '+225', name: 'Ivory Coast', flag: '🇨🇮', placeholder: '07 00 00 00' },
  { code: 'LR', dialCode: '+231', name: 'Liberia', flag: '🇱🇷', placeholder: '77 000 0000' },
  { code: 'SL', dialCode: '+232', name: 'Sierra Leone', flag: '🇸🇱', placeholder: '76 000000' },
  { code: 'TG', dialCode: '+228', name: 'Togo', flag: '🇹🇬', placeholder: '90 00 00 00' },
  { code: 'BJ', dialCode: '+229', name: 'Benin', flag: '🇧🇯', placeholder: '97 00 00 00' },
  { code: 'CN', dialCode: '+86', name: 'China', flag: '🇨🇳', placeholder: '138 0000 0000' },
  { code: 'IN', dialCode: '+91', name: 'India', flag: '🇮🇳', placeholder: '98765 43210' },
  { code: 'AU', dialCode: '+61', name: 'Australia', flag: '🇦🇺', placeholder: '400 000 000' },
  { code: 'IT', dialCode: '+39', name: 'Italy', flag: '🇮🇹', placeholder: '320 000 0000' },
  { code: 'ES', dialCode: '+34', name: 'Spain', flag: '🇪🇸', placeholder: '600 000 000' },
  { code: 'NL', dialCode: '+31', name: 'Netherlands', flag: '🇳🇱', placeholder: '6 12345678' },
  { code: 'INT', dialCode: '+', name: 'Other / International', flag: '🌐', placeholder: 'Enter phone number' },
];

export interface PhoneInputProps extends Omit<InputProps, 'onChange' | 'value'> {
  value?: string;
  onChange?: (value: string) => void;
  defaultCountryCode?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  defaultCountryCode = 'GH',
  ...props
}) => {
  // Determine initial country from value or default
  const [countryCode, setCountryCode] = useState<string>(() => {
    if (!value) return defaultCountryCode;
    const matched = COUNTRIES.find((c) => c.dialCode !== '+' && value.startsWith(c.dialCode));
    return matched ? matched.code : defaultCountryCode;
  });

  const selectedCountry = useMemo(() => {
    return COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];
  }, [countryCode]);

  // Extract local portion from full value
  const localNumber = useMemo(() => {
    if (!value) return '';
    if (selectedCountry.dialCode !== '+' && value.startsWith(selectedCountry.dialCode)) {
      return value.slice(selectedCountry.dialCode.length).trim();
    }
    return value;
  }, [value, selectedCountry]);

  // If external value changes and starts with a known dial code, update country code
  useEffect(() => {
    if (value && value.startsWith('+')) {
      const match = COUNTRIES.find((c) => c.dialCode !== '+' && value.startsWith(c.dialCode));
      if (match && match.code !== countryCode) {
        setCountryCode(match.code);
      }
    }
  }, [value, countryCode]);

  const handleCountryChange = (newCode: string) => {
    setCountryCode(newCode);
    const newCountry = COUNTRIES.find((c) => c.code === newCode) || COUNTRIES[0];
    
    // Recalculate formatted value with new dial code
    let cleaned = localNumber.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }
    if (newCountry.dialCode === '+') {
      onChange?.(cleaned ? (cleaned.startsWith('+') ? cleaned : `+${cleaned}`) : '');
    } else {
      onChange?.(cleaned ? `${newCountry.dialCode}${cleaned}` : '');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // If user explicitly typed a full international number with plus (e.g. +1 555...)
    if (raw.startsWith('+')) {
      const match = COUNTRIES.find((c) => c.dialCode !== '+' && raw.startsWith(c.dialCode));
      if (match) {
        setCountryCode(match.code);
        let digitsOnly = raw.slice(match.dialCode.length).replace(/\D/g, '');
        if (digitsOnly.startsWith('0')) digitsOnly = digitsOnly.slice(1);
        onChange?.(`${match.dialCode}${digitsOnly}`);
        return;
      }
      // General international
      const sanitized = '+' + raw.replace(/[^\d]/g, '');
      onChange?.(sanitized);
      return;
    }

    // Strip non-digits
    let cleaned = raw.replace(/\D/g, '');

    // If user enters local number starting with 0, strip leading 0 for dialing
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }

    if (selectedCountry.dialCode === '+') {
      onChange?.(cleaned ? `+${cleaned}` : '');
    } else {
      onChange?.(cleaned ? `${selectedCountry.dialCode}${cleaned}` : '');
    }
  };

  const countrySelectOptions = useMemo(
    () =>
      COUNTRIES.map((c) => ({
        value: c.code,
        label: `${c.flag} ${c.dialCode} (${c.name})`,
      })),
    []
  );

  const selectBefore = (
    <Select
      value={countryCode}
      onChange={handleCountryChange}
      showSearch
      popupMatchSelectWidth={260}
      optionFilterProp="label"
      style={{ width: 120 }}
      options={countrySelectOptions}
    />
  );

  return (
    <Input
      {...props}
      addonBefore={selectBefore}
      value={localNumber}
      onChange={handleInputChange}
      placeholder={selectedCountry.placeholder}
      allowClear
    />
  );
};