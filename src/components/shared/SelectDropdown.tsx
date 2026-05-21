import { useEffect, useId, useRef } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

export type SelectDropdownOption = {
  label: string;
  value: string;
};

export default function SelectDropdown({
  label,
  value,
  options,
  open,
  onToggle,
  onChange,
  onClose,
  menuZIndex = "z-40",
  buttonPadding = "px-4",
}: {
  label: string;
  value: string;
  options: SelectDropdownOption[];
  open: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  onClose?: () => void;
  menuZIndex?: string;
  buttonPadding?: string;
}) {
  const menuId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const selected =
    options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return;

    function closeMenu() {
      if (onClose) onClose();
      else onToggle();
    }

    function handlePointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, onToggle, open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={`flex h-12 w-full items-center justify-between rounded-2xl border bg-black ${buttonPadding} text-left transition ${open ? "border-red-500 ring-2 ring-red-600/15" : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-950"}`}
      >
        <span className="min-w-0">
          <span className="block text-[9px] font-black uppercase tracking-[0.22em] text-zinc-600">
            {label}
          </span>
          <span className="block truncate text-xs font-black uppercase tracking-wider text-zinc-300">
            {selected?.label || "-"}
          </span>
        </span>
        <ChevronDownIcon
          className={`size-3 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div
          id={menuId}
          role="listbox"
          className={`absolute left-0 right-0 top-14 ${menuZIndex} max-h-72 overflow-y-auto space-y-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-1.5 shadow-2xl shadow-black/70`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => onChange(option.value)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-black uppercase tracking-wider transition ${option.value === value ? "bg-red-600 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value ? <span>✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
