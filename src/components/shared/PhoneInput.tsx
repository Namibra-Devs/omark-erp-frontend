// src/components/shared/PhoneInput.tsx
import React from 'react';
import { Input } from 'antd';
import type { InputProps } from 'antd';

interface PhoneInputProps extends Omit<InputProps, 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({ value, onChange, ...props }) => {
  const normalizeToE164 = (phone: string): string => {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0, replace with +233
    if (cleaned.startsWith('0')) {
      cleaned = '+233' + cleaned.slice(1);
    }
    // If starts with 233 without +, add +
    else if (cleaned.startsWith('233')) {
      cleaned = '+' + cleaned;
    }
    // If no prefix, assume Ghana number and add +233
    else if (cleaned.length === 9) {
      cleaned = '+233' + cleaned;
    }
    
    return cleaned;
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const normalized = normalizeToE164(rawValue);
    onChange?.(normalized);
  };
  
  return (
    <Input
      {...props}
      value={value}
      onChange={handleChange}
      placeholder="+233 XX XXX XXXX"
    />
  );
};