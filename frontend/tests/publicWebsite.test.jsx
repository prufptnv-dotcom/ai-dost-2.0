import React from 'react';
import { render, screen } from '@testing-library/react';
import { PublicNavbar } from '../components/public/PublicNavbar';
import { PublicFooter } from '../components/public/PublicFooter';
import HomePage from '../pages/index';
import ProductPage from '../pages/product';
import CapabilitiesPage from '../pages/capabilities';
import HowItWorksPage from '../pages/how-it-works';
import SecurityPage from '../pages/security';
import PrivacyPage from '../pages/privacy';
import TermsPage from '../pages/terms';
import PolicyPage from '../pages/policy';
import AboutPage from '../pages/about';
import ChangelogPage from '../pages/changelog';
import SupportPage from '../pages/support';
import DocsIndexPage from '../pages/docs/index';
import GettingStartedDoc from '../pages/docs/getting-started';

// Mock useRouter
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: '',
      asPath: '/',
      push: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
      },
      beforePopState: jest.fn(() => true),
      prefetch: jest.fn(() => Promise.resolve()),
    };
  },
}));

describe('Public Website & Documentation Ecosystem (Phase W1)', () => {
  test('PublicNavbar renders navigation landmarks, links, and workspace CTA', () => {
    render(<PublicNavbar theme="dark" onToggleTheme={jest.fn()} />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /AI-Dost Home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Product$/i })).toHaveAttribute('href', '/product');
    expect(screen.getByRole('link', { name: /^Capabilities$/i })).toHaveAttribute('href', '/capabilities');
    expect(screen.getByRole('link', { name: /^How It Works$/i })).toHaveAttribute('href', '/how-it-works');
    expect(screen.getByRole('link', { name: /^Security$/i })).toHaveAttribute('href', '/security');
    expect(screen.getByRole('link', { name: /^Docs$/i })).toHaveAttribute('href', '/docs');
    expect(screen.getByRole('link', { name: /Launch Workspace/i })).toHaveAttribute('href', '/dashboard');
  });

  test('PublicFooter renders trust and legal columns with valid paths', () => {
    render(<PublicFooter />);

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Product/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Resources/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Trust & Legal/i })).toBeInTheDocument();

    const privacyLinks = screen.getAllByRole('link', { name: /Privacy/i });
    expect(privacyLinks.length).toBeGreaterThanOrEqual(1);
    expect(privacyLinks[0]).toHaveAttribute('href', '/privacy');

    const termsLinks = screen.getAllByRole('link', { name: /Terms/i });
    expect(termsLinks.length).toBeGreaterThanOrEqual(1);
    expect(termsLinks[0]).toHaveAttribute('href', '/terms');
  });

  test('HomePage renders canonical hero, outcome groups, and execution lifecycle', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: /Tell AI-Dost what you need/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Autonomous Workspace/i)[0]).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /The 8-Stage Autonomous Pipeline/i })).toBeInTheDocument();
  });

  test('ProductPage details 5 architectural layers and core values', () => {
    render(<ProductPage />);

    expect(screen.getByRole('heading', { name: /5 Disciplined Architectural Layers/i })).toBeInTheDocument();
    expect(screen.getByText(/Autonomous Supervisor Engine/i)).toBeInTheDocument();
    expect(screen.getByText(/Multi-Model Inference Cascade/i)).toBeInTheDocument();
  });

  test('CapabilitiesPage organizes capabilities around outcomes', () => {
    render(<CapabilitiesPage />);

    expect(screen.getByRole('heading', { name: /Build & Code/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Research & Synthesize/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Create Documents & Media/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Verify & Self-Heal/i })).toBeInTheDocument();
  });

  test('HowItWorksPage renders the complete 8-stage lifecycle and role matrix', () => {
    render(<HowItWorksPage />);

    expect(screen.getByRole('heading', { name: /The 8-Stage Lifecycle/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Role-Based Authority Matrix/i })).toBeInTheDocument();
    expect(screen.getByText('SUPERVISOR')).toBeInTheDocument();
    expect(screen.getByText('RESEARCHER')).toBeInTheDocument();
    expect(screen.getByText('CODER')).toBeInTheDocument();
    expect(screen.getByText('VERIFIER')).toBeInTheDocument();
  });

  test('SecurityPage renders grounded controls and honest disclosures without fabricated claims', () => {
    render(<SecurityPage />);

    expect(screen.getByRole('heading', { name: /Defensive Local Autonomy/i })).toBeInTheDocument();
    expect(screen.getByText(/Local-First Workstation Storage/i)).toBeInTheDocument();
    expect(screen.getByText(/Path Traversal & Perimeter Defense/i)).toBeInTheDocument();
    expect(screen.getByText(/No Fabricated Compliance Badges/i)).toBeInTheDocument();
  });

  test('PrivacyPage renders local data residency, zero tracking, and deletion rights', () => {
    render(<PrivacyPage />);

    expect(screen.getByRole('heading', { name: /Privacy by Architecture/i })).toBeInTheDocument();
    expect(screen.getByText(/1. Information Storage & Residency/i)).toBeInTheDocument();
    expect(screen.getByText(/4. Data Retention & Deletion/i)).toBeInTheDocument();
  });

  test('TermsPage & PolicyPage render legal scaffolding and responsible AI guidelines', () => {
    const { unmount: unmountTerms } = render(<TermsPage />);
    expect(screen.getByRole('heading', { name: /Terms of Service/i })).toBeInTheDocument();
    expect(screen.getByText(/Ownership of AI Outputs/i)).toBeInTheDocument();
    unmountTerms();

    render(<PolicyPage />);
    expect(screen.getByRole('heading', { name: /Responsible AI Policy/i })).toBeInTheDocument();
    expect(screen.getByText(/Prohibited Exploitation & Abuse/i)).toBeInTheDocument();
  });

  test('AboutPage and ChangelogPage render verified project facts without false corporate claims', () => {
    const { unmount: unmountAbout } = render(<AboutPage />);
    expect(screen.getByRole('heading', { name: /About AI-Dost/i })).toBeInTheDocument();
    expect(screen.getByText(/Transparent Project Scope/i)).toBeInTheDocument();
    unmountAbout();

    render(<ChangelogPage />);
    expect(screen.getByRole('heading', { name: /Changelog/i })).toBeInTheDocument();
    expect(screen.getByText(/v2.0.0-rc.1/i)).toBeInTheDocument();
  });

  test('SupportPage and DocsHub render developer onboarding and runbooks', () => {
    const { unmount: unmountSupport } = render(<SupportPage />);
    expect(screen.getByRole('heading', { name: /Support & Community Hub/i })).toBeInTheDocument();
    unmountSupport();

    const { unmount: unmountDocs } = render(<DocsIndexPage />);
    expect(screen.getByRole('heading', { name: /Documentation Hub/i })).toBeInTheDocument();
    unmountDocs();

    render(<GettingStartedDoc />);
    expect(screen.getByRole('heading', { name: /Quickstart & Installation/i })).toBeInTheDocument();
  });
});
