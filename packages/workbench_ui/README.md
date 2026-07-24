# Artist Workbench UI

`artist_workbench_ui` is the independent visual language for Artist Style
Workbench products. It contains no NovelAI, networking, storage, or application
state code.

## Principles

- Design tokens before page-specific values.
- Small state-driven motion instead of decorative animation everywhere.
- Keyboard, pointer, and reduced-motion behavior are first-class requirements.
- Components expose semantic intent, not upstream application assumptions.
- New products consume the package instead of copying widget files.

## Included

- Color, spacing, radius, typography, shadow, and motion foundations.
- Light and dark theme builders.
- Buttons, tags, interactive cards, and text fields.
- Animated modal dialogs, feedback toasts, and collapsible sidebars.
- A component lab under `example/`.

Run the lab:

```text
cd packages/workbench_ui/example
flutter run -d windows
```
