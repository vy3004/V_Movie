import React, { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ className, children, ...props }) => {
  return (
    <button
      className={`z-30 px-3 py-2 bg-transparent rounded-custom-shape text-foreground relative after:-z-20 after:absolute after:h-1 after:w-1 after:bg-custom-gradient after:left-5 overflow-hidden after:bottom-0 after:translate-y-full after:rounded-md after:hover:scale-[300] after:hover:transition-all after:hover:duration-700 after:transition-all after:duration-500 transition-all duration-500 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
