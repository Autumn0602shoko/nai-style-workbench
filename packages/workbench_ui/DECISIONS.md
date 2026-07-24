# UI Kit Architecture Decisions

## Boundary

The package may depend on Flutter UI APIs, but it must not depend on:

- authentication or remote APIs;
- Riverpod or application providers;
- databases or local account storage;
- NovelAI- or Danbooru-specific models;
- page-level routing.

Consumers provide state and callbacks. Components only render intent and
interaction feedback.

## Motion

- Motion must explain state changes or confirm user input.
- Pointer hover should not rearrange surrounding layout.
- Continuous animation is reserved for progress or a deliberate character.
- Every duration must pass through `WorkbenchMotion.resolve` so reduced-motion
  preferences are respected.

## Styling

- Components consume `WorkbenchTokens`, `WorkbenchSurface`, and
  `WorkbenchMotion`.
- No unexplained color, radius, spacing, or duration literals in page code.
- New themes are composed from the same semantic roles instead of forking
  component implementations.

## Quality gates

- Public components require widget tests.
- Keyboard focus and semantics are part of component acceptance.
- Visual changes are reviewed in the component lab before product adoption.
- Product-specific variants belong in the product until they prove reusable.
