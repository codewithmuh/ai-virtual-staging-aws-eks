import { STYLES } from "@/lib/styles";
import type { StyleId } from "@/lib/types";

interface Props {
  value: StyleId;
  onChange: (style: StyleId) => void;
  disabled?: boolean;
}

/**
 * Four styles as radio buttons: compact tiles in a grid on phones and tablets (two or four across),
 * so the Stage button stays close to the photo; a list in the desktop side panel.
 */
export function StylePicker({ value, onChange, disabled }: Props) {
  return (
    <fieldset
      disabled={disabled}
      className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-1 lg:gap-0 lg:divide-y lg:divide-line lg:border-y lg:border-line"
    >
      <legend className="sr-only">Style</legend>
      {STYLES.map((s) => {
        const checked = s.id === value;
        return (
          <label
            key={s.id}
            className={`group relative flex cursor-pointer flex-col items-start gap-2.5 rounded-[4px] border p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-[-2px] has-focus-visible:outline-shu lg:flex-row lg:items-center lg:gap-4 lg:rounded-none lg:border-0 lg:py-3 lg:pr-2 lg:pl-3 ${
              checked ? "border-ink bg-paper-2" : "border-line hover:bg-paper-2/60"
            }`}
          >
            <input
              type="radio"
              name="style"
              value={s.id}
              checked={checked}
              onChange={() => onChange(s.id)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={`absolute inset-y-0 left-0 hidden w-0.5 transition-colors lg:block ${checked ? "bg-ink" : "bg-transparent"}`}
            />
            <span aria-hidden className="flex shrink-0 -space-x-1.5">
              {s.swatches.map((c) => (
                <span
                  key={c}
                  className={`size-5 rounded-full ring-2 ${checked ? "ring-paper-2" : "ring-paper group-hover:ring-paper-2"}`}
                  style={{ background: c }}
                />
              ))}
            </span>
            <span className="min-w-0 lg:flex-1">
              <span className="block text-[15px] font-medium text-ink">{s.name}</span>
              <span className="line-clamp-2 text-[12.5px] leading-snug text-ink-3 lg:line-clamp-1 lg:text-[13px]">
                {s.note}
              </span>
            </span>
            <span
              aria-hidden
              className={`absolute top-3 right-3 grid size-4 shrink-0 place-items-center rounded-full border transition-colors lg:static ${
                checked ? "border-ink bg-ink" : "border-ink-4"
              }`}
            >
              {checked && <span className="size-1.5 rounded-full bg-paper" />}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
