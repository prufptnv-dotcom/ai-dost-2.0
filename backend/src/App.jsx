import { useState, useCallback } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  const increment = useCallback(() => setCount((c) => c + 1), []);
  const decrement = useCallback(() => setCount((c) => c - 1), []);
  const reset = useCallback(() => setCount(0), []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
        color: '#fff',
      }}
    >
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚛️ React Counter</h1>
      <p style={{ opacity: 0.7, marginBottom: '2rem' }}>Click the buttons to change the count</p>

      <div
        style={{
          fontSize: '5rem',
          fontWeight: 700,
          marginBottom: '2rem',
          color: count >= 0 ? '#4ade80' : '#f87171',
          transition: 'color 0.3s ease',
        }}
      >
        {count}
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={decrement}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1.1rem',
            border: 'none',
            borderRadius: '8px',
            background: '#ef4444',
            color: '#fff',
            cursor: 'pointer',
            transition: 'transform 0.1s',
          }}
        >
          − Decrement
        </button>
        <button
          onClick={reset}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1.1rem',
            border: 'none',
            borderRadius: '8px',
            background: '#6b7280',
            color: '#fff',
            cursor: 'pointer',
            transition: 'transform 0.1s',
          }}
        >
          ↺ Reset
        </button>
        <button
          onClick={increment}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1.1rem',
            border: 'none',
            borderRadius: '8px',
            background: '#22c55e',
            color: '#fff',
            cursor: 'pointer',
            transition: 'transform 0.1s',
          }}
        >
          + Increment
        </button>
      </div>
    </div>
  );
}
