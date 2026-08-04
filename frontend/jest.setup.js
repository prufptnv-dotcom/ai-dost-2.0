import '@testing-library/jest-dom';

window.HTMLElement.prototype.scrollIntoView = function() {};
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ models: [] }),
  })
);
