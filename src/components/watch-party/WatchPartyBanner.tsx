import { PlayIcon } from "@heroicons/react/24/solid";
import RoomCodeInput from "@/components/watch-party/RoomCodeInput";

const MOCK_FEATURES = [
  {
    num: "01",
    title: "Đồng Bộ",
    subtitle: "Thời gian thực",
    desc: "Trải nghiệm không độ trễ, mỗi khung hình đều khớp nhau đến từng mili giây.",
  },
  {
    num: "02",
    title: "Trò Chuyện",
    subtitle: "Voice & Chat",
    desc: "Tương tác sống động qua kênh thoại chất lượng cao và hệ thống emoji cá tính.",
  },
  {
    num: "03",
    title: "Đa Nền Tảng",
    subtitle: "Web, Mobile, TV",
    desc: "Đồng hành cùng bạn trên mọi hành trình, từ màn hình nhỏ đến rạp chiếu tại gia.",
  },
];

const Avatar = ({
  initials,
  color,
  size = 11,
}: {
  initials: string;
  color: string;
  size?: number;
}) => (
  <div
    className={`rounded-full border-2 border-[#0a0a0a] bg-gradient-to-tr ${color} flex items-center justify-center text-[11px] font-extrabold shadow-lg`}
    style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
  >
    {initials}
  </div>
);

const ArtisticFeature = ({
  num,
  title,
  subtitle,
  desc,
}: {
  num: string;
  title: string;
  subtitle: string;
  desc: string;
}) => (
  <div className="group relative flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1">
    <div
      aria-hidden="true"
      className="absolute -top-10 -left-4 text-8xl font-black text-white/[0.03] select-none pointer-events-none group-hover:text-red-600/5 transition-colors duration-500 text-transparent stroke-text"
      style={{ WebkitTextStroke: "1px rgba(255,255,255,0.05)" }}
    >
      {num}
    </div>
    <div className="flex items-center gap-3">
      <span className="text-red-600 font-black text-sm tracking-tighter uppercase">
        {num}. {title}
      </span>
      <div className="h-px flex-1 bg-white/10 group-hover:bg-red-600/30 transition-colors" />
    </div>
    <div className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em]">
      {subtitle}
    </div>
    <p className="text-sm text-zinc-400 leading-relaxed max-w-[240px]">
      {desc}
    </p>
  </div>
);

export default function WatchPartyBanner() {
  return (
    <section
      id="watch-party-banner"
      className="relative w-full min-h-[600px] lg:min-h-[700px] flex items-center justify-center overflow-hidden bg-[#0a0a0a] py-12 px-4 sm:px-14 lg:px-20"
    >
      {/* Background Ambient Glow */}
      <div
        aria-hidden="true"
        className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-red-600/20 rounded-full blur-[120px] pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[100px] pointer-events-none"
      />

      {/* Content Container */}
      <div className="container relative z-10 mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="flex flex-col items-start">
            {/* Ping Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-600/20 border border-red-600/50 rounded-full text-red-600 text-xs font-bold uppercase tracking-widest mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
              </span>
              Đừng bỏ lỡ
            </div>

            <h1 className="text-4xl md:text-6xl font-black leading-[0.9] tracking-tighter mb-8 uppercase italic">
              XEM CHUNG <br />
              <span
                className="text-transparent stroke-text"
                style={{ WebkitTextStroke: "1px white" }}
              >
                KẾT NỐI
              </span>
            </h1>

            <p className="text-md md:text-lg text-gray-400 mb-10 max-w-sm leading-relaxed">
              Trải nghiệm điện ảnh đỉnh cao cùng bạn bè dù ở bất cứ đâu. Đồng bộ
              hoàn hảo từng khung hình, trò chuyện không giới hạn.
            </p>

            {/* Component Client xử lý Input được nhúng vào đây */}
            <div className="mb-12 w-full">
              <RoomCodeInput />
            </div>

            {/* Social Proof / Avatars */}
            <div className="flex items-center gap-5">
              <div className="flex -space-x-3">
                <Avatar initials="NH" color="from-orange-400 to-red-600" />
                <Avatar initials="MT" color="from-purple-400 to-pink-500" />
                <Avatar initials="AD" color="from-blue-400 to-cyan-500" />
                <div className="w-11 h-11 rounded-full border-2 border-[#0a0a0a] bg-zinc-800 flex items-center justify-center text-[11px] font-bold shadow-lg">
                  +12
                </div>
              </div>
              <p className="text-xs text-zinc-500 font-medium italic">
                Hơn 12k người đang cùng xem trực tuyến
              </p>
            </div>
          </div>

          {/* Right Visual Content */}
          <div className="relative">
            <div className="relative w-full max-w-[560px] aspect-video bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-white/10 group">
              {/* Background Movie Image */}
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url('/vd_banner.avif')`,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

              {/* Sync UI Overlay */}
              <div className="absolute top-5 left-5 flex items-center gap-2">
                <div className="px-2 py-0.5 bg-red-600 text-[10px] font-bold rounded">
                  LIVE
                </div>
                <div className="text-[10px] font-medium text-white shadow-sm">
                  Tập 4: Sự trở lại của Rồng
                </div>
              </div>

              {/* Chat Bubbles */}
              <div className="absolute bottom-14 sm:bottom-16 right-2 sm:right-5 flex flex-col gap-3 items-end">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md p-1 sm:p-2 rounded-full border border-white/10">
                  <Avatar
                    initials="K"
                    color="from-yellow-400 to-green-500"
                    size={8}
                  />
                  <span className="text-[8px] sm:text-[10px] pr-2">
                    &ldquo;Phim này đỉnh quá!&rdquo;
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md p-1 sm:p-2 rounded-full border border-white/10">
                  <Avatar
                    initials="V"
                    color="from-orange-400 to-cyan-500"
                    size={8}
                  />
                  <span className="text-[10px] sm:text-[12px] pr-2 uppercase font-bold text-yellow-400">
                    😂 x 24
                  </span>
                </div>
              </div>

              {/* Player Controls Mockup */}
              <div className="absolute bottom-0 left-0 w-full h-12 bg-black/40 backdrop-blur-sm flex items-center px-5 gap-4">
                <PlayIcon className="w-4 h-4 text-white opacity-60 fill-current" />
                <div className="flex-1 h-1 bg-white/20 rounded-full relative">
                  <div className="absolute left-0 top-0 w-1/3 h-full bg-red-600 rounded-full shadow-[0_0_10px_rgba(229,9,20,0.5)]" />
                </div>
                <div className="text-[10px] opacity-60 font-mono">
                  12:45 / 45:00
                </div>
              </div>
            </div>

            {/* Abstract Decorators */}
            <div className="absolute -bottom-10 -right-10 w-48 h-48 border-[12px] border-white/5 rounded-full pointer-events-none" />
            <div className="absolute -top-10 -left-10 w-28 h-28 border-2 border-red-600/20 rounded-lg rotate-12 pointer-events-none" />
          </div>
        </div>

        {/* Artistic Feature Introduction Grid */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-24 border-t border-white/5 pt-12">
          {MOCK_FEATURES.map((f) => (
            <ArtisticFeature key={f.num} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}
