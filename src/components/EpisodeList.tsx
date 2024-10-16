import { Episode, ServerData } from "@/lib/types";

interface EpisodeListProps {
  servers: Episode[];
  episodeSelected: string | null;
  onSelect: (data: ServerData) => void;
}

const EpisodeList = ({
  servers,
  episodeSelected,
  onSelect,
}: EpisodeListProps) => {
  return servers.map((server, serverIdx) => (
    <div key={serverIdx} className="mb-6">
      <h3 className="text-lg font-bold mb-2">{server.server_name}</h3>
      <div className="grid grid-cols-8 gap-4">
        {server.server_data.length > 0 ? (
          server.server_data.map((sv) => (
            <button
              key={sv.slug}
              className={`p-2 rounded hover:bg-primary transition ${
                sv.slug === episodeSelected ? "bg-primary" : "bg-gray-800"
              }`}
              onClick={() => onSelect(sv)}
              disabled={sv.slug === episodeSelected}
            >
              {sv.name}
            </button>
          ))
        ) : (
          <p className="text-center text-gray-500">
            Không có tập phim nào để chọn.
          </p>
        )}
      </div>
    </div>
  ));
};

export default EpisodeList;
