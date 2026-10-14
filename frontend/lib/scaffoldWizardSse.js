'use strict';

function parseScaffoldWizardSse(raw) {
  const events = [];
  for (const frame of String(raw || '').split(/\r?\n\r?\n/)) {
    const dataLines = [];
    let eventName = null;
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) continue;
    const data = dataLines.join('\n');
    try {
      const event = JSON.parse(data);
      if (eventName && !event.type) event.type = eventName;
      events.push(event);
    } catch {
      events.push({ type: eventName || 'unparsed', raw: data });
    }
  }

  return {
    events,
    done: events.filter((event) => event?.type === 'done').at(-1) || null,
    error: events.find((event) => event?.type === 'error') || null,
    outputQuality: events.filter((event) => event?.type === 'output_quality').at(-1) || null,
  };
}

module.exports = { parseScaffoldWizardSse };
