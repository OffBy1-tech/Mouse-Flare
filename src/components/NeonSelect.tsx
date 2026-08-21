import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

// Custom dropdown matching the Windows ComboBox template (and the reference
// kit's "Choose an option" menu): the browser's native <select> popup can't be
// themed, so the open list is a portalled neon card instead. Follows the
// select-only combobox ARIA pattern — focus stays on the trigger button and
// aria-activedescendant tracks the highlighted option.

export interface NeonSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface NeonSelectGroup {
  label: string;
  options: NeonSelectOption[];
}

interface NeonSelectProps {
  value: string;
  onChange: (value: string) => void;
  /** Flat options; ignored when `groups` is given. */
  options?: NeonSelectOption[];
  /** Grouped options (e.g. built-in archetypes vs custom presets). */
  groups?: NeonSelectGroup[];
  /** Shown when `value` matches no option. */
  placeholder?: string;
  disabled?: boolean;
  /** Sizing/width classes for the trigger (text size, padding, width). */
  className?: string;
  ariaLabel?: string;
}

type RenderItem =
  | { kind: 'group'; label: string }
  | { kind: 'option'; option: NeonSelectOption; flatIndex: number };

const DROPDOWN_MAX_HEIGHT = 248;

export const NeonSelect: React.FC<NeonSelectProps> = ({
  value,
  onChange,
  options,
  groups,
  placeholder = 'Select…',
  disabled = false,
  className = '',
  ariaLabel,
}) => {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef({ buffer: '', at: 0 });

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState({ top: 0, left: 0, width: 0, maxHeight: DROPDOWN_MAX_HEIGHT });

  const { flat, items } = useMemo(() => {
    const flatList: NeonSelectOption[] = [];
    const renderItems: RenderItem[] = [];
    const pushGroup = (label: string | null, opts: NeonSelectOption[]) => {
      if (label !== null) renderItems.push({ kind: 'group', label });
      for (const option of opts) {
        renderItems.push({ kind: 'option', option, flatIndex: flatList.length });
        flatList.push(option);
      }
    };
    if (groups) {
      for (const group of groups) pushGroup(group.label, group.options);
    } else {
      pushGroup(null, options ?? []);
    }
    return { flat: flatList, items: renderItems };
  }, [groups, options]);

  const selectedIndex = flat.findIndex((o) => o.value === value);
  const selectedLabel = selectedIndex >= 0 ? flat[selectedIndex].label : placeholder;

  const open = () => {
    if (disabled || flat.length === 0) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openUp = spaceBelow < Math.min(DROPDOWN_MAX_HEIGHT, 160) && spaceAbove > spaceBelow;
      const maxHeight = Math.min(DROPDOWN_MAX_HEIGHT, Math.max(96, openUp ? spaceAbove : spaceBelow));
      setPlacement({
        top: openUp ? rect.top - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight,
      });
      // openUp anchors the list by translating it above the trigger.
      listAnchorsUpRef.current = openUp;
    }
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : flat.findIndex((o) => !o.disabled));
    setIsOpen(true);
  };
  const listAnchorsUpRef = useRef(false);

  const close = () => setIsOpen(false);

  const commit = (index: number) => {
    const option = flat[index];
    if (!option || option.disabled) return;
    close();
    triggerRef.current?.focus();
    if (option.value !== value) onChange(option.value);
  };

  const step = (from: number, dir: 1 | -1) => {
    let i = from;
    for (let n = 0; n < flat.length; n++) {
      i = (i + dir + flat.length) % flat.length;
      if (!flat[i].disabled) return i;
    }
    return from;
  };

  const edge = (dir: 1 | -1) => {
    const ordered = dir === 1 ? flat.map((_, i) => i) : flat.map((_, i) => flat.length - 1 - i);
    return ordered.find((i) => !flat[i].disabled) ?? -1;
  };

  const typeahead = (key: string) => {
    const now = Date.now();
    const state = typeaheadRef.current;
    state.buffer = now - state.at > 500 ? key : state.buffer + key;
    state.at = now;
    const query = state.buffer.toLowerCase();
    // Single-char queries cycle to the NEXT match; longer queries refine in place.
    const start = activeIndex < 0 ? 0 : state.buffer.length > 1 ? activeIndex : activeIndex + 1;
    for (let n = 0; n < flat.length; n++) {
      const idx = (start + n) % flat.length;
      const candidate = flat[idx];
      if (!candidate.disabled && candidate.label.toLowerCase().startsWith(query)) {
        if (isOpen) setActiveIndex(idx);
        else commit(idx);
        return;
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!isOpen) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        open();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        typeahead(e.key);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => step(i, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => step(i, -1));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(edge(1));
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(edge(-1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(activeIndex);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close();
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeahead(e.key);
    }
  };

  // Close on outside pointerdown, outside scroll, or resize while open.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !listRef.current?.contains(target)) close();
    };
    const onScroll = (e: Event) => {
      if (listRef.current && e.target instanceof Node && listRef.current.contains(e.target)) return;
      close();
    };
    const onResize = () => close();
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [isOpen]);

  // Keep the highlighted option in view while navigating.
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-flat-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, activeIndex]);

  const activeId = activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-listbox` : undefined}
        aria-activedescendant={isOpen ? activeId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          if (!listRef.current?.contains(e.relatedTarget as Node)) close();
        }}
        className={`neon-input neon-select-trigger rounded-lg cursor-pointer font-medium disabled:opacity-50 disabled:cursor-default ${className}`}
      >
        <span className={`truncate ${selectedIndex < 0 ? 'text-neutral-500' : ''}`}>{selectedLabel}</span>
        <ChevronDown className="neon-select-chevron w-3.5 h-3.5 shrink-0 text-violet-300" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={listRef}
            id={`${id}-listbox`}
            role="listbox"
            aria-label={ariaLabel}
            className="neon-dropdown fixed z-[9999] p-1 text-xs"
            style={{
              top: placement.top,
              left: placement.left,
              minWidth: placement.width,
              maxHeight: placement.maxHeight,
              transform: listAnchorsUpRef.current ? 'translateY(-100%)' : undefined,
            }}
            // Keep focus on the trigger so blur-close and keyboard keep working.
            onPointerDown={(e) => e.preventDefault()}
          >
            {items.map((item) =>
              item.kind === 'group' ? (
                <div
                  key={`g-${item.label}`}
                  role="presentation"
                  className="neon-group-label px-2 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wide"
                >
                  {item.label}
                </div>
              ) : (
                <div
                  key={item.option.value}
                  id={`${id}-opt-${item.flatIndex}`}
                  data-flat-index={item.flatIndex}
                  role="option"
                  aria-selected={item.flatIndex === selectedIndex}
                  aria-disabled={item.option.disabled || undefined}
                  onMouseMove={() => {
                    if (!item.option.disabled && activeIndex !== item.flatIndex) setActiveIndex(item.flatIndex);
                  }}
                  onClick={() => commit(item.flatIndex)}
                  className={`neon-option flex items-center justify-between gap-2 px-2 py-1.5 ${
                    item.flatIndex === selectedIndex
                      ? 'neon-option-selected'
                      : item.flatIndex === activeIndex && !item.option.disabled
                        ? 'neon-option-active'
                        : ''
                  }`}
                >
                  <span className="truncate">{item.option.label}</span>
                  {item.flatIndex === selectedIndex && <span aria-hidden="true">✓</span>}
                </div>
              )
            )}
          </div>,
          document.body
        )}
    </>
  );
};
