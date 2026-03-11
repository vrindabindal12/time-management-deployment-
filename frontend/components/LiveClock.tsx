'use client';

import { useState, useEffect } from 'react';

export default function LiveClock({ className }: { className?: string }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleString());
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return <span className={className}>{time}</span>;
}
