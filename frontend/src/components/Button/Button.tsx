import React, { type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'text' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold rounded-lg transition-all duration-200 cursor-pointer focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shadow-sm';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };

  const variantStyles = {
    primary: 'bg-[#C2410C] hover:bg-[#9A3412] text-[#FFFFFF] focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-2',
    secondary: 'bg-[#FFEDD5] hover:bg-[#FED7AA] text-[#C2410C]',
    outline: 'bg-white border border-[#E7E0D8] text-[#292524] hover:bg-[#FFF7ED] hover:border-[#D6CEC5]',
    text: 'bg-transparent text-[#78716C] hover:text-[#292524] shadow-none p-0 hover:bg-transparent',
    icon: 'p-2 bg-transparent hover:bg-[#FFF7ED] text-[#78716C] hover:text-[#292524] shadow-none',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
};
