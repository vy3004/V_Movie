interface VideoPlayerProps {
  movieSrc: string;
  movieName: string;
}

const VideoPlayer = ({ movieSrc, movieName }: VideoPlayerProps) => {
  return (
    <div className="my-8 space-y-4">
      <div className="relative h-0 pb-[56.25%] overflow-hidden rounded-lg">
        <iframe
          src={movieSrc}
          className="absolute top-0 left-0 size-full"
          width="100%"
          height="100%"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          title={movieName}
        />
      </div>
      <h2 className="text-xl font-bold mb-2">{movieName}</h2>
    </div>
  );
};

export default VideoPlayer;
