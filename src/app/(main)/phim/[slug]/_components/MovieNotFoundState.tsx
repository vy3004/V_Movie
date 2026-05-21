import Link from "next/link";

export default function MovieNotFoundState() {
  return (
    <div className="col-span-12 xl:col-span-8 py-6 animate-in fade-in duration-500">
      <section className="relative overflow-hidden rounded-[2rem] border border-red-500/20 bg-zinc-950 px-6 py-14 text-center shadow-[0_0_80px_rgba(220,38,38,0.12)] sm:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(220,38,38,0.22),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(250,204,21,0.12),transparent_24%)]" />
        <div className="absolute inset-x-8 top-8 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
        <div className="relative mx-auto flex max-w-xl flex-col items-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-red-500/30 bg-red-500/10 text-4xl font-black text-red-400 shadow-[0_0_40px_rgba(220,38,38,0.25)]">
            404
          </div>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.45em] text-red-400/80">
            Không tìm thấy dữ liệu
          </p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white sm:text-5xl">
            Phim không tồn tại
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-zinc-400 sm:text-base">
            Liên kết có thể đã hết hạn, phim bị xoá, hoặc nguồn phim hiện không phản hồi.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-primary/90"
            >
              Về trang chủ
            </Link>
            <Link
              href="/phim-moi-cap-nhat"
              className="rounded-full border border-zinc-700 px-6 py-3 text-sm font-black uppercase tracking-wide text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
            >
              Xem phim mới
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
