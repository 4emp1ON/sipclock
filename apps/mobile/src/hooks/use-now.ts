import { useEffect, useState } from 'react';

/** Current Date, refreshed on every minute boundary. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = new Date();
      setNow(current);
      timer = setTimeout(tick, 60_000 - (current.getSeconds() * 1000 + current.getMilliseconds()));
    };
    const first = new Date();
    timer = setTimeout(tick, 60_000 - (first.getSeconds() * 1000 + first.getMilliseconds()));
    return () => clearTimeout(timer);
  }, []);

  return now;
}
