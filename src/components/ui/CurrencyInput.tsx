import React, { useState, useEffect } from 'react';

type Props = {
  value: number | '';
  onChange: (value: number | '') => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
};

export const CurrencyInput: React.FC<Props> = ({ value, onChange, className, placeholder, required }) => {
  const [displayValue, setDisplayValue] = useState<string>('');

  useEffect(() => {
    if (value === '' || value === undefined || value === null) {
      setDisplayValue('');
    } else {
      setDisplayValue(value.toLocaleString('en-US'));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, '');
    if (rawValue === '') {
      setDisplayValue('');
      onChange('');
      return;
    }
    const num = Number(rawValue);
    if (!isNaN(num) && num >= 0) {
      setDisplayValue(num.toLocaleString('en-US'));
      onChange(num);
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
      required={required}
    />
  );
};
