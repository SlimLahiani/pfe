import React from 'react';

interface LogoProps {
  showText?: boolean;
  className?: string;
  iconSize?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  iconSize = 'md',
}) => {
  const sizeClasses = {
    sm: 'h-24',
    md: 'h-32',
    lg: 'h-44',
    xl: 'h-72',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src="/logo.png"
        alt="CreativArt"
        className={`${sizeClasses[iconSize]} w-auto object-contain`}
      />
    </div>
  );
};
