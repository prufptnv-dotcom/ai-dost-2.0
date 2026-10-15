# AI-Dost Smart Workspace UI/UX Refresh

## Scope
Pre-release UI/UX intervention before Phase 5.4. This refresh addresses the current visual failure mode: excessive rectangular borders, icon-only navigation, weak grouping, and low information density.

## Design direction
- Keep the Editorial Workbench foundation: Ink/Paper surfaces, terracotta primary accent, semantic status colors, Sora/Inter/JetBrains Mono.
- Move from a "boxed terminal" appearance to a calm productivity workspace.
- Use hierarchy, spacing, surface contrast, and selective elevation instead of borders around every element.
- Make navigation self-describing on desktop and icon-compact on smaller screens.
- Preserve existing routes, keyboard shortcuts, theme support, accessibility, and all application behavior.

## Implemented
1. Desktop navigation upgraded from a 56-64px icon rail to a 248px grouped workspace sidebar.
2. All major product surfaces are directly reachable from navigation: Chat, Agent, IDE, Projects, Artifacts, Resume, Voice, Images, MCP, History, Settings.
3. New-task CTA is persistent and visually primary.
4. System status is surfaced at the bottom of navigation.
5. Global header now exposes workspace/project context, current view, search/command access, notifications, and profile affordance.
6. Responsive sidebar collapses to an icon-first rail below 900px and 58px at phone widths.
7. Geometry tokens are softened from 2-10px architectural rectangles to 4-18px progressive radii.
8. Dark elevation is improved with restrained physical shadows rather than glow effects.
9. Existing dark/light semantic color architecture remains intact.

## Deliberate non-goals
- No backend/API behavior changes.
- No database or migration changes.
- No removal of existing Chat/Agent/IDE capabilities.
- No neon gradients, decorative particle effects, or "AI magic" visual language.
- No fake metrics or fabricated workspace activity.

## QA required before merge
Run:
- `npm run lint`
- `npm test`
- `npm run build`
- real-browser screenshots at 1440x900, 1024x768, 390x844
- dark + light theme
- verify zero horizontal overflow
- verify keyboard shortcuts and navigation to all 11 views
- verify command palette, composer, agent, IDE, resume and artifact flows
