'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';
import { HiCheck } from 'react-icons/hi';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, indeterminate, checked, onChange, disabled, ...props }, ref) => {
    return (
      <label className={clsx(
        'inline-flex items-center gap-2 cursor-pointer',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}>
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="sr-only peer"
            {...props}
          />
          <div className={clsx(
            'w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center',
            'peer-focus:ring-2 peer-focus:ring-main-1/30 peer-focus:ring-offset-1 peer-focus:ring-offset-dark-2',
            checked || indeterminate
              ? 'bg-main-1 border-main-1'
              : 'bg-dark-3 border-dark-4 hover:border-dark-5',
            error && 'border-red-500'
          )}>
            {checked && (
              <HiCheck className="w-3.5 h-3.5 text-white" />
            )}
            {indeterminate && !checked && (
              <div className="w-2.5 h-0.5 bg-white rounded-full" />
            )}
          </div>
        </div>
        {label && (
          <span className={clsx(
            'text-sm',
            error ? 'text-red-500' : 'text-gray-1'
          )}>
            {label}
          </span>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

