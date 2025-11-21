'use client';

/**
 * Error Display Component
 *
 * Displays error messages from API responses in the UI
 */

import React from 'react';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ErrorSeverity = 'error' | 'warning' | 'info';

interface ErrorDisplayProps {
  title?: string;
  message: string;
  severity?: ErrorSeverity;
  details?: Record<string, string>;
  onDismiss?: () => void;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
}

const severityConfig = {
  error: {
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    iconColor: 'text-destructive',
    textColor: 'text-destructive',
    icon: AlertCircle
  },
  warning: {
    bgColor: 'bg-[hsl(var(--chart-3))]/10',
    borderColor: 'border-[hsl(var(--chart-3))]/30',
    iconColor: 'text-[hsl(var(--chart-3))]',
    textColor: 'text-[hsl(var(--chart-3))]',
    icon: AlertTriangle
  },
  info: {
    bgColor: 'bg-[hsl(var(--chart-1))]/10',
    borderColor: 'border-[hsl(var(--chart-1))]/30',
    iconColor: 'text-[hsl(var(--chart-1))]',
    textColor: 'text-[hsl(var(--chart-1))]',
    icon: Info
  }
};

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  title,
  message,
  severity = 'error',
  details,
  onDismiss,
  actions
}) => {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div
      className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 ${config.textColor}`}
      role="alert"
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <Icon className={`w-5 h-5 ${config.iconColor}`} />
        </div>

        {/* Content */}
        <div className="flex-1">
          {title && (
            <h3 className="font-semibold mb-1">{title}</h3>
          )}
          <p className="text-sm">{message}</p>

          {/* Details */}
          {details && Object.entries(details).length > 0 && (
            <details className="mt-3 cursor-pointer">
              <summary className="text-sm font-medium hover:underline">
                Show details
              </summary>
              <div className="mt-2 space-y-1 text-xs font-mono">
                {Object.entries(details).map(([key, value]) => (
                  <div key={key} className="break-words">
                    <span className="font-semibold">{key}:</span> {value}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Actions */}
          {actions && actions.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {actions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={action.onClick}
                  className={`text-sm font-medium px-3 py-1.5 rounded transition-colors ${
                    action.variant === 'primary'
                      ? `${config.iconColor} hover:opacity-80`
                      : `${config.borderColor} border hover:opacity-80`
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`flex-shrink-0 ${config.iconColor} hover:opacity-70 transition-opacity`}
            aria-label="Dismiss error"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Error List Component
 * Displays multiple errors
 */
interface ErrorListProps {
  errors: Array<string | ErrorDisplayProps>;
  onDismissAll?: () => void;
}

export const ErrorList: React.FC<ErrorListProps> = ({ errors, onDismissAll }) => {
  const [visibleErrors, setVisibleErrors] = React.useState<Set<number>>(
    new Set(errors.map((_, idx) => idx))
  );

  const handleDismiss = (idx: number) => {
    const newVisible = new Set(visibleErrors);
    newVisible.delete(idx);
    setVisibleErrors(newVisible);

    if (newVisible.size === 0 && onDismissAll) {
      onDismissAll();
    }
  };

  return (
    <div className="space-y-2">
      {errors.map((error, idx) =>
        visibleErrors.has(idx) ? (
          <div key={idx}>
            {typeof error === 'string' ? (
              <ErrorDisplay
                message={error}
                onDismiss={() => handleDismiss(idx)}
              />
            ) : (
              <ErrorDisplay
                {...error}
                onDismiss={() => {
                  error.onDismiss?.();
                  handleDismiss(idx);
                }}
              />
            )}
          </div>
        ) : null
      )}
    </div>
  );
};

/**
 * Hook to manage error state
 */
export function useError() {
  const [errors, setErrors] = React.useState<(ErrorDisplayProps & { id?: number })[]>([]);

  const addError = (error: Omit<ErrorDisplayProps, 'onDismiss'>) => {
    const id = Math.random();
    setErrors(prev => [...prev, { ...error, id, onDismiss: () => removeError(id) }]);

    // Auto-dismiss after 5 seconds if no actions
    if (!error.actions) {
      setTimeout(() => removeError(id), 5000);
    }
  };

  const removeError = (id: number | ErrorDisplayProps) => {
    setErrors(prev =>
      prev.filter(e =>
        typeof id === 'number'
          ? e.id !== id
          : e !== id
      )
    );
  };

  const clearErrors = () => setErrors([]);

  return {
    errors,
    addError,
    removeError,
    clearErrors,
    hasErrors: errors.length > 0
  };
}
