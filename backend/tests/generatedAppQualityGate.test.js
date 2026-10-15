const test = require('node:test');
const assert = require('node:assert/strict');
const { GeneratedAppQualityGate, STATUS } = require('../quality-evaluation/generatedAppQualityGate');

test('Phase 7: Generated Application Quality Gate', async (t) => {
  const gate = new GeneratedAppQualityGate();

  await t.test('1. Valid complete dashboard passes quality gate with VERIFIED_PASS', async () => {
    const files = {
      'src/App.jsx': `
        import React, { useState } from 'react';
        import { DataTable } from './components/DataTable';
        import { ChartView } from './components/ChartView';

        export function App() {
          const [searchQuery, setSearchQuery] = useState('');
          const [isLoading, setIsLoading] = useState(false);
          const [error, setError] = useState(null);

          const exportCsv = () => {
            const blob = new Blob(["name,value\\nA,10\\nB,20"], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'data.csv';
            a.click();
          };

          return (
            <div className="dashboard">
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
              <button onClick={exportCsv}>Export CSV</button>
              <ChartView />
              <DataTable query={searchQuery} />
            </div>
          );
        }
      `,
      'src/components/ChartView.jsx': `
        import React from 'react';
        export function ChartView() {
          return (
            <div className="chart">
              <svg width="400" height="200">
                <rect x="10" y="20" width="30" height="150" fill="#3b82f6" />
                <rect x="50" y="50" width="30" height="120" fill="#10b981" />
              </svg>
            </div>
          );
        }
      `,
      'src/components/DataTable.jsx': `
        import React from 'react';
        export function DataTable({ query }) {
          const rows = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
            .filter(r => r.name.toLowerCase().includes(query.toLowerCase()));
          return (
            <table>
              <thead><tr><th>ID</th><th>Name</th></tr></thead>
              <tbody>
                {rows.map(r => <tr key={r.id}><td>{r.id}</td><td>{r.name}</td></tr>)}
              </tbody>
            </table>
          );
        }
      `
    };

    const res = await gate.evaluate({
      files,
      caseId: 'dashboard-search-charts-csv',
      model: 'test-model'
    });

    assert.strictEqual(res.status, STATUS.VERIFIED_PASS);
    assert.strictEqual(res.criticalDefectCount, 0);
    assert.ok(res.coveragePercent >= 80, `Expected coverage >= 80, got ${res.coveragePercent}`);
    assert.ok(res.detectedCapabilities.includes('search_filtering'));
    assert.ok(res.detectedCapabilities.includes('csv_export'));
    assert.ok(res.detectedCapabilities.includes('data_visualization'));
  });

  await t.test('2. Dashboard with empty handler or anti-pattern fails quality gate', async () => {
    const brokenFiles = {
      'src/App.jsx': `
        import React from 'react';
        export function App() {
          return (
            <div>
              <button onClick={() => {}}>Export CSV</button>
              <p>TODO: implement export</p>
            </div>
          );
        }
      `
    };

    const res = await gate.evaluate({
      files: brokenFiles,
      caseId: 'dashboard-search-charts-csv',
      model: 'test-model'
    });

    assert.strictEqual(res.status, STATUS.FAILED);
    assert.ok(res.criticalDefectCount > 0, 'Expected critical defects detected');
    const hasEmptyHandler = res.defects.some(d => d.type === 'EMPTY_EVENT_HANDLER');
    const hasAntiPattern = res.defects.some(d => d.type === 'ANTI_PATTERN_DETECTED');
    assert.ok(hasEmptyHandler || hasAntiPattern);
  });

  await t.test('3. Booking app with timezone and cancellation satisfies canonical case', async () => {
    const bookingFiles = {
      'src/BookingApp.jsx': `
        import React, { useState } from 'react';

        export function BookingApp() {
          const [selectedDate, setSelectedDate] = useState('2026-10-20');
          const [timezone, setTimezone] = useState('UTC');
          const [status, setStatus] = useState('pending');
          const [showModal, setShowModal] = useState(false);

          const slots = ['09:00', '10:00', '11:00'];

          const handleCancel = () => {
            setStatus('cancelled');
            setShowModal(false);
          };

          return (
            <div>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
              <select value={timezone} onChange={e => setTimezone(e.target.value)}>
                <option value="UTC">UTC</option>
                <option value="EST">EST</option>
              </select>
              <div className="slots">
                {slots.map(s => (
                  <button key={s} disabled={s === '10:00'} onClick={() => setStatus('confirmed')}>
                    {s} ({timezone})
                  </button>
                ))}
              </div>
              <span className="badge">{status}</span>
              <button onClick={() => setShowModal(true)}>Cancel Booking</button>
              {showModal && (
                <div className="modal">
                  <p>Confirm cancellation?</p>
                  <button onClick={handleCancel}>Confirm Cancel</button>
                </div>
              )}
            </div>
          );
        }
      `
    };

    const res = await gate.evaluate({
      files: bookingFiles,
      caseId: 'booking-timezone-cancellation',
      model: 'test-model'
    });

    assert.strictEqual(res.status, STATUS.VERIFIED_PASS);
    assert.ok(res.detectedCapabilities.includes('timezone_conversion'));
    assert.ok(res.detectedCapabilities.includes('cancellation_flow'));
    assert.ok(res.detectedCapabilities.includes('date_slot_selection'));
  });

  await t.test('4. E-Commerce cart with checkout validation satisfies canonical case', async () => {
    const ecommerceFiles = {
      'src/EcommerceApp.jsx': `
        import React, { useState } from 'react';

        export function EcommerceApp() {
          const [cartItems, setCartItems] = useState([]);
          const [promo, setPromo] = useState('');
          const [discount, setDiscount] = useState(0);
          const [category, setCategory] = useState('all');

          const addToCart = (product) => {
            setCartItems(prev => [...prev, product]);
            localStorage.setItem('cart', JSON.stringify(cartItems));
          };

          const applyPromo = () => {
            if (promo === 'SAVE10') setDiscount(10);
          };

          const handleCheckout = (e) => {
            e.preventDefault();
            if (cartItems.length === 0) return alert('Cart empty');
          };

          return (
            <div>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                <option value="all">All</option>
              </select>
              <button onClick={() => addToCart({ id: 1, name: 'Shoes', price: 50 })}>Add Shoes</button>
              <div className="cart">
                <input value={promo} onChange={e => setPromo(e.target.value)} placeholder="Coupon" />
                <button onClick={applyPromo}>Apply Discount</button>
              </div>
              <form onSubmit={handleCheckout}>
                <input required placeholder="Name" />
                <button type="submit">Complete Checkout</button>
              </form>
            </div>
          );
        }
      `
    };

    const res = await gate.evaluate({
      files: ecommerceFiles,
      caseId: 'ecommerce-cart-checkout',
      model: 'test-model'
    });

    assert.strictEqual(res.status, STATUS.VERIFIED_PASS);
    assert.ok(res.detectedCapabilities.includes('cart_operations'));
    assert.ok(res.detectedCapabilities.includes('discount_calculation'));
    assert.ok(res.detectedCapabilities.includes('form_validation'));
  });
});
