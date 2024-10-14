const Loading = () => {
  return (
    <div className="flex-col gap-4 flex items-center justify-center col-span-3">
      <div className="size-16 border-4 border-transparent text-foreground text-4xl animate-spin flex items-center justify-center border-t-foreground rounded-full">
        <div className="size-12 border-4 border-transparent text-primary text-2xl animate-spin flex items-center justify-center border-t-primary rounded-full" />
      </div>
    </div>
  );
};

export default Loading;
