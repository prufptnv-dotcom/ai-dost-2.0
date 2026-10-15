import React from 'react';
import { render, screen } from '@testing-library/react';
import AppIcon, { APP_ICONS } from '../components/ui/AppIcon';

describe('AppIcon (Font Awesome standard)', () => {
  test('renders a real Font Awesome svg, not an empty span', () => {
    const { container } = render(<AppIcon name="search" size={15} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('data-icon')).toBe('magnifying-glass');
  });

  test('size prop becomes font-size style', () => {
    const { container } = render(<AppIcon name="plus" size={22} />);
    const svg = container.querySelector('svg');
    expect(svg.style.fontSize).toBe('22px');
  });

  test('unknown name falls back to circle (never blank)', () => {
    const { container } = render(<AppIcon name="does-not-exist" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('data-icon')).toBe('circle');
  });

  test('every mapped icon resolves to a real FA definition', () => {
    const bad = Object.entries(APP_ICONS).filter(([, def]) => !def || !def.iconName);
    expect(bad.map(([k]) => k)).toEqual([]);
  });

  test('loader auto-spins', () => {
    const { container } = render(<AppIcon name="loader" />);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('class') || '').toMatch(/fa-spin|fa-circle-notch/);
  });

  test('brand icons resolve (github)', () => {
    const { container } = render(<AppIcon name="github" />);
    expect(container.querySelector('svg').getAttribute('data-prefix')).toBe('fab');
  });

  // Regression: callers spread parent props onto AppIcon (sModal, isOpen,
  // packageJsonContent, onUpdatePackageJson...). Spreading them onto
  // FontAwesomeIcon put them on <svg> → React "does not recognize the X prop"
  // warnings on every render of CopilotIDE/Dashboard.
  test('unknown props are NOT forwarded to the DOM', () => {
    const { container } = render(
      <AppIcon
        name="search"
        sModal
        isOpen
        packageJsonContent={{ a: 1 }}
        onUpdatePackageJson={() => {}}
        onRunCommand={() => {}}
        someRandomKey="nope"
      />
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    for (const attr of ['smodal', 'isopen', 'packagejsoncontent', 'somerandomkey']) {
      expect(svg.hasAttribute(attr)).toBe(false);
    }
    expect(svg.getAttributeNames()).not.toContain('onUpdatePackageJson');
    expect(svg.getAttributeNames()).not.toContain('onRunCommand');
  });

  test('safe props (aria/data/title/onClick) ARE forwarded', () => {
    const onClick = jest.fn();
    const { container } = render(
      <AppIcon name="search" aria-label="Search" title="Search tools" data-qa="hdr-search" onClick={onClick} />
    );
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('aria-label')).toBe('Search');
    expect(svg.getAttribute('data-qa')).toBe('hdr-search');
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // FA 7 dropped <title> rendering — AppIcon maps title -> aria-label so the
  // prop still does something useful (accessible name), never a silent no-op.
  test('title becomes aria-label when no explicit aria-label is given', () => {
    const { container } = render(<AppIcon name="settings" title="Open settings" />);
    expect(container.querySelector('svg').getAttribute('aria-label')).toBe('Open settings');
  });

  test('explicit aria-label wins over title', () => {
    const { container } = render(<AppIcon name="settings" title="tooltip" aria-label="Real label" />);
    expect(container.querySelector('svg').getAttribute('aria-label')).toBe('Real label');
  });
});
