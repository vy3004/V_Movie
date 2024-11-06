import React from "react";

const Logo = ({ className = "" }: { className?: string }) => {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      height={51}
      width={176}
      src="/logo.webp"
      alt="Logo"
    />
  );
};

export default Logo;
