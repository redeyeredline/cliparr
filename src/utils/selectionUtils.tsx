// React hook for managing shift-click range selection in tables and lists.
// Provides multi-select functionality similar to Gmail and file managers with range selection.
import { useState, useCallback } from 'react';

/**
 * Hook for managing shift-click range selection in tables and lists
 * Similar to how Gmail, file managers, and other apps handle multi-select
 */
export function useShiftSelect<T>({
  items,
  getId,
}: {
  items: T[];
  getId: (item: T) => number | string;
}) {
  const [selected, setSelected] = useState<(number | string)[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<number | string | null>(null);

  const handleToggle = useCallback(
    (id: number | string, event: React.MouseEvent) => {
      if (event.shiftKey && lastSelectedId !== null) {
        const currentIndex = items.findIndex((item) => getId(item) === id);
        const lastIndex = items.findIndex((item) => getId(item) === lastSelectedId);
        const [start, end] = [Math.min(currentIndex, lastIndex), Math.max(currentIndex, lastIndex)];
        const rangeIds = items.slice(start, end + 1).map((item) => getId(item));

        setSelected((prev) => {
          const isAdding = !prev.includes(id);
          return isAdding
            ? [...new Set([...prev, ...rangeIds])]
            : prev.filter((sid) => !rangeIds.includes(sid));
        });
      } else {
        setSelected((prev) =>
          prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
        );
      }
      setLastSelectedId(id);
    },
    [items, getId, lastSelectedId],
  );

  const selectAll = useCallback(() => {
    const allIds = items.map((item) => getId(item));
    setSelected(allIds);
  }, [items, getId]);

  const deselectAll = useCallback(() => {
    setSelected([]);
    setLastSelectedId(null);
  }, []);

  const isSelected = useCallback((id: number | string) => selected.includes(id), [selected]);

  return {
    selected,
    handleToggle,
    selectAll,
    deselectAll,
    isSelected,
  };
}
