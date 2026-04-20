"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, KeyIcon, PlayIcon } from "@heroicons/react/24/solid";

export default function RoomCodeInput() {
  const router = useRouter();

  const [showCodeInput, setShowCodeInput] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");

  // Hàm xử lý khi user gõ phím
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const safeValue = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);

    setRoomCode(safeValue);
    if (error) setError("");
  };

  const handleJoinRoom = () => {
    if (roomCode.length < 6) {
      setError("Mã phòng phải đủ 6 ký tự!");
      return;
    }

    router.push(`/xem-chung/${roomCode}`);
  };

  return (
    <div className="w-full sm:w-auto sm:h-[64px] relative">
      {!showCodeInput ? (
        <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-left-4 duration-300">
          <Link
            href="/xem-chung"
            className="w-full sm:w-auto px-8 py-4 sm:px-10 h-full bg-red-600 hover:bg-[#b20710] text-white font-bold rounded-lg flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-red-600/10"
          >
            <PlayIcon className="fill-current w-5 h-5" />
            Tham gia ngay
          </Link>
          <button
            onClick={() => setShowCodeInput(true)}
            className="w-full sm:w-auto px-8 py-4 sm:px-10 h-full bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg flex items-center justify-center gap-3 border border-white/10 backdrop-blur-md transition-all active:scale-95"
          >
            <KeyIcon className="w-5 h-5 text-zinc-400" />
            Nhập mã phòng
          </button>
        </div>
      ) : (
        <div className="relative w-full max-w-sm h-full">
          <div
            className={`flex items-center bg-zinc-900 border rounded-lg p-1 w-full h-full animate-in fade-in slide-in-from-left-4 duration-300 ${error ? "border-red-600" : "border-red-600/50"}`}
          >
            <div className="flex items-center gap-3 px-3">
              <KeyIcon className="w-5 h-5 text-red-600" />
            </div>

            <input
              type="text"
              placeholder="MÃ GỒM 6 CHỮ SỐ..."
              value={roomCode}
              onChange={handleInputChange}
              onBlur={() => {
                if (!roomCode) {
                  setShowCodeInput(false);
                  setError("");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoinRoom();
              }}
              autoFocus
              className="flex-1 bg-transparent border-none outline-none text-white font-black placeholder:text-zinc-600 placeholder:font-normal text-sm tracking-widest"
            />

            <button
              onClick={handleJoinRoom}
              className="bg-red-600 p-3 rounded-md hover:bg-[#b20710] transition-colors h-full aspect-square flex items-center justify-center mr-1"
            >
              <ArrowRightIcon className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Thông báo lỗi nhỏ gọn nằm dưới ô input */}
          {error && (
            <div className="absolute -bottom-6 left-2 text-[11px] font-medium text-red-500 animate-in fade-in slide-in-from-top-1">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
