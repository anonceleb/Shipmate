import { useState } from "react";

const TODAY = new Date().toISOString().slice(0, 10);

/**
 * Generic persistent action register.
 *
 * @param {string}   storageKey  - localStorage key
 * @param {function} makeRef     - (n, fields) => string  — generate a ref for entry n
 * @returns {[entries, push, clear]}
 *   push(fields) — saves entry, returns the generated ref
 *   clear()      — empties register and localStorage
 */
export function useRegister(storageKey, makeRef) {
  const [register, setRegister] = useState(() => {
    try {
      const s = localStorage.getItem(storageKey);
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const push = (fields) => {
    const n = register.length + 1;
    const ref = makeRef(n, fields);
    const entry = { ref, date: TODAY, ...fields };
    const next = [entry, ...register];
    setRegister(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    return ref;
  };

  // Appends several entries in one state update — push() alone loses data
  // when called repeatedly in the same synchronous batch (stale `register` closure).
  const pushMany = (fieldsList) => {
    const base = register.length;
    const built = fieldsList.map((fields, i) => ({ ref: makeRef(base + i + 1, fields), date: TODAY, ...fields }));
    const next = [...built.reverse(), ...register];
    setRegister(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    return built.map(b => b.ref);
  };

  const clear = () => {
    setRegister([]);
    localStorage.removeItem(storageKey);
  };

  return [register, push, clear, pushMany];
}
