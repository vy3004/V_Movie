import React, { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  className = "",
  children,
  ...props
}) => {
  return (
    <button
      className={`px-3 py-2 bg-transparent hover:text-main hover:font-semibold ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
