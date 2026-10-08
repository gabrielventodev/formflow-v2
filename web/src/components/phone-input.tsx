"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";
import examples from "libphonenumber-js/mobile/examples";
import { DEFAULT_PHONE_COUNTRY, FREQUENT_COUNTRIES, countryName } from "@/lib/form-schema";
import { cn } from "@/lib/utils";

type Country = { code: CountryCode; name: string; dial: string; search: string };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

let allCountries: Country[] | undefined;
/** Every country with a calling code, sorted by Spanish name. */
function countries(): Country[] {
  allCountries ??= getCountries()
    .map((code) => {
      const name = countryName(code);
      const dial = getCountryCallingCode(code);
      return { code, name, dial, search: fold(`${name} ${code}`) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return allCountries;
}

// libphonenumber's sample for Chile is a landline-looking "(2) 2123 4567"; applicants give their cell.
const EXAMPLES: Partial<Record<CountryCode, string>> = { CL: "9 6123 4567" };

function asCountry(code: string | undefined): CountryCode {
  return code && (getCountries() as string[]).includes(code) ? (code as CountryCode) : (DEFAULT_PHONE_COUNTRY as CountryCode);
}

/** Splits a stored answer into the picker's country and the number as the applicant sees it. */
function split(value: string, fallback: CountryCode): { country: CountryCode; national: string } {
  // Free text from before the picker ("llamar al anexo 22") is shown as it was typed.
  const p = /^\+?[\d\s().-]+$/.test(value) ? parsePhoneNumberFromString(value, fallback) : undefined;
  if (p?.country) return { country: p.country, national: p.formatNational() };
  return { country: fallback, national: value };
}

/** The number in E.164 ("+56961234567"), or undefined when nothing was typed. */
function toE164(national: string, country: CountryCode): string | undefined {
  const digits = national.replace(/\D/g, "");
  if (!digits) return undefined;
  if (national.trim().startsWith("+")) return `+${digits}`;
  const p = parsePhoneNumberFromString(national, country);
  return p ? p.number : `+${getCountryCallingCode(country)}${digits}`;
}

export function Flag({ code, className }: { code: string; className?: string }) {
  return (
    // Same-origin SVGs from country-flag-icons, since Windows doesn't draw flag emoji.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/flags/${code}.svg`}
      alt=""
      loading="lazy"
      className={cn("h-3.5 w-[21px] shrink-0 rounded-[2px] object-cover ring-1 ring-black/10", className)}
    />
  );
}

/**
 * Phone number with a country picker. The flag and calling code follow the chosen country,
 * and pasting a number with its code ("+54 9 11…") switches the country by itself. Emits E.164.
 */
export function PhoneInput({
  id,
  value,
  defaultCountry,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  defaultCountry?: string;
  disabled?: boolean;
  onChange: (v: string | undefined) => void;
}) {
  const fallback = asCountry(defaultCountry);
  const [state, setState] = useState(() => split(value, fallback));
  const emitted = useRef<string | undefined>(value || undefined);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  // Follow answers set from outside (a reset, a loaded draft), not our own edits.
  useEffect(() => {
    if ((value || undefined) !== emitted.current) {
      emitted.current = value || undefined;
      setState(split(value, fallback));
    }
  }, [value, fallback]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const emit = (national: string, country: CountryCode) => {
    setState({ country, national });
    const v = toE164(national, country);
    emitted.current = v;
    onChange(v);
  };

  const type = (raw: string) => {
    // Digits and the usual separators only; letters never get in.
    const clean = raw.replace(/[^\d\s()+.-]/g, "").replace(/(?!^)\+/g, "");
    if (clean.trim().startsWith("+")) {
      const p = parsePhoneNumberFromString(clean);
      if (p?.country && p.isPossible()) return emit(p.formatNational(), p.country);
    }
    emit(clean, state.country);
  };

  const tidy = () => {
    const p = parsePhoneNumberFromString(state.national, state.country);
    if (p?.isValid() && p.country) emit(p.formatNational(), p.country);
  };

  const shown = useMemo(() => {
    const q = fold(query.trim());
    const all = countries();
    if (!q) {
      const frequent = FREQUENT_COUNTRIES.flatMap((c) => all.filter((x) => x.code === c));
      return { frequent, rest: all };
    }
    if (/^\+?\d+$/.test(q)) {
      // A calling code: exact matches first, the region's usual countries before the rest.
      const code = q.replace("+", "");
      const rank = (c: Country) => (c.dial === code ? 0 : 2) + (FREQUENT_COUNTRIES.includes(c.code) ? 0 : 1);
      const rest = all.filter((c) => c.dial.startsWith(code)).sort((a, b) => rank(a) - rank(b));
      return { frequent: [], rest };
    }
    return { frequent: [], rest: all.filter((c) => c.search.includes(q)) };
  }, [query]);
  const options = [...shown.frequent, ...shown.rest];

  const pick = (c: Country) => {
    setOpen(false);
    setQuery("");
    emit(state.national.trim().startsWith("+") ? "" : state.national, c.code);
    input.current?.focus();
  };

  const openList = () => {
    setQuery("");
    setActive(0);
    setOpen(true);
  };

  const onListKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(0, Math.min(options.length - 1, active + (e.key === "ArrowDown" ? 1 : -1)));
      setActive(next);
      list.current?.querySelector(`[data-i="${next}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) pick(options[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const example = EXAMPLES[state.country] ?? getExampleNumber(state.country, examples)?.formatNational();
  const listId = `${id}-paises`;

  const row = (c: Country, i: number) => (
    <li
      key={`${i}-${c.code}`}
      data-i={i}
      role="option"
      aria-selected={c.code === state.country}
      onPointerMove={() => setActive(i)}
      onClick={() => pick(c)}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm",
        i === active && "bg-zinc-100",
        c.code === state.country && "font-medium",
      )}
    >
      <Flag code={c.code} />
      <span className="min-w-0 flex-1 truncate">{c.name}</span>
      <span className="text-zinc-500 tabular-nums">+{c.dial}</span>
    </li>
  );

  return (
    <div ref={root} className="relative">
      <div className="flex">
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`País: ${countryName(state.country)} +${getCountryCallingCode(state.country)}`}
          onClick={() => (open ? setOpen(false) : openList())}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-l-md border border-r-0 border-zinc-300 bg-zinc-50 pl-2.5 pr-2 text-sm text-zinc-800 hover:bg-zinc-100 focus:z-10 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:hover:bg-zinc-50"
        >
          <Flag code={state.country} />
          <span className="tabular-nums">+{getCountryCallingCode(state.country)}</span>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
        </button>
        <input
          ref={input}
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={state.national}
          placeholder={example}
          disabled={disabled}
          onChange={(e) => type(e.target.value)}
          onBlur={tidy}
          className="h-9 w-full min-w-0 rounded-r-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-50"
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg sm:right-auto sm:w-80">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-3">
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                list.current?.scrollTo({ top: 0 });
              }}
              onKeyDown={onListKey}
              placeholder="Buscar país o código"
              aria-controls={listId}
              aria-label="Buscar país o código"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
            />
          </div>
          <ul ref={list} id={listId} role="listbox" className="max-h-64 overflow-y-auto overscroll-contain py-1">
            {shown.frequent.map(row)}
            {shown.frequent.length > 0 && <li role="separator" className="my-1 border-t border-zinc-100" />}
            {shown.rest.map((c, i) => row(c, i + shown.frequent.length))}
            {options.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">No encontramos ese país</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
