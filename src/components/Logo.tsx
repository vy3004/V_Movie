import React from "react";

const Logo = ({ className = "" }: { className?: string }) => {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src="/logo.webp" alt="Logo" loading="lazy" />
  );
};

export default Logo;
