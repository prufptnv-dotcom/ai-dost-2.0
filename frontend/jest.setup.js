import '@testing-library/jest-dom';

window.HTMLElement.prototype.scrollIntoView = function() {};
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ models: [] }),
  })
);

// jsdom does not ship TextEncoder/TextDecoder/Streams — polyfill from Node.
const { TextEncoder, TextDecoder } = require('util');
const { WritableStream, ReadableStream, TransformStream } = require('stream/web');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.WritableStream = WritableStream;
global.ReadableStream = ReadableStream;
global.TransformStream = TransformStream;
if (typeof window.TextEncoder === 'undefined') window.TextEncoder = TextEncoder;
if (typeof window.TextDecoder === 'undefined') window.TextDecoder = TextDecoder;
if (typeof window.WritableStream === 'undefined') window.WritableStream = WritableStream;
