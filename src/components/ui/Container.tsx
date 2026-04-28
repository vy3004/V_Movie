interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

const Container = ({ children, className = "" }: ContainerProps) => {
  return (
    <div className={`mx-auto px-4 sm:px-14 lg:px-20 ${className}`}>
      {children}
    </div>
  );
};

export default Container;
