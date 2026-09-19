# ngx-generic-combobox

Accessible Angular components, built on Signals, where the accessibility is the point rather than a pass at the end.

Angular 22 · Signals · TypeScript · zero runtime dependencies

---

## Why this exists

Most component libraries treat accessibility as an attribute checklist. They add `role="listbox"`, add `aria-expanded`, and stop. The result passes an automated audit and is still unusable with a screen reader, because the hard parts are not attributes. They are focus management, what gets announced and when, and what happens when the list changes underneath someone who is typing.

This library is an attempt to do the hard parts properly, and to write down the reasoning where it is not obvious. Every non-trivial decision in the source has a comment explaining why, because "why not the other way" is the part that is normally lost.

It is deliberately small. One component ships today. I would rather have one that holds up under a real screen reader than twenty that hold up under an automated audit.

---

## Install

```bash
npm install ngx-generic-combobox
```

Requires Angular 22 or later. Components are standalone; there is no module to import.

---

## Combobox

An editable combobox with a listbox popup, following the [WAI-ARIA 1.2 combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).

```ts
import { Combobox, ComboboxOption } from 'ngx-generic-combobox';
```

```html
<ngx-combobox
  label="Country"
  [options]="countries"
  [(value)]="selected"
  placeholder="Start typing..."
  emptyMessage="No countries found"
/>
```

```ts
readonly countries: ComboboxOption<string>[] = [
  { value: 'eg', label: 'Egypt' },
  { value: 'de', label: 'Germany' },
  { value: 'jp', label: 'Japan', disabled: true },
];

readonly selected = signal<string | undefined>(undefined);
```

### API

| Input | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | `string` | **required** | A combobox without a label is unusable non-visually, so this is not optional. |
| `options` | `readonly ComboboxOption<T>[]` | **required** | |
| `value` | `T \| undefined` | `undefined` | Two-way bindable via `[(value)]`. |
| `placeholder` | `string` | `''` | |
| `disabled` | `boolean` | `false` | |
| `emptyMessage` | `string` | `'No results'` | Announced as well as displayed. |
| `filterFn` | `(option, query) => boolean` | case-insensitive substring | |

`filterFn` is exposed because the right matching rule is domain-specific. Command palettes want fuzzy matching, country codes want prefix-only, and names want diacritic folding. A single built-in rule would be wrong for most of them.

### Keyboard

| Key | Collapsed | Open |
| --- | --- | --- |
| `ArrowDown` | Open, activate first | Next enabled option |
| `Alt` + `ArrowDown` | Open, activate nothing | |
| `ArrowUp` | Open, activate last | Previous enabled option |
| `Home` / `End` | Text cursor | First / last enabled option |
| `Enter` | | Select active option |
| `Escape` | Clear the field | Close, keep selection |
| `Tab` | | Close, move on |

### The decisions worth explaining

**Virtual focus, not roving tabindex.** DOM focus never leaves the text input. The active option is communicated through `aria-activedescendant`. Moving real focus into the list satisfies a screen reader but breaks typing, which is the entire point of a combobox. This is the single thing most implementations get wrong.

**`aria-activedescendant` is omitted when nothing is active**, not set to an empty string. An empty value is a dangling reference, and some screen readers respond by announcing nothing at all rather than falling back sensibly.

**Escape has two behaviours.** Close first, clear only if already closed, per the APG. Collapsing both into "clear" destroys someone's input on a single mis-keypress.

**The result count is announced separately.** Filtering changes the list silently for a sighted user, so a polite live region reports how many options remain. Announcing the list itself would interrupt typing.

**Disabled options stay in the DOM.** They are skipped during navigation and cannot be selected, but they remain rendered and counted. A list whose length depends on how you arrived at it is disorienting for anyone relying on the announced count.

**Navigation stops at the ends rather than wrapping.** In a filtered list, wrapping makes it easy to pass the option you wanted without noticing.

**The active option is marked by more than colour.** It gets a background *and* an inset border, because colour alone fails [WCAG 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html). There is a `forced-colors` block for Windows High Contrast, where backgrounds are dropped entirely, and `prefers-reduced-motion` disables the chevron transition.

**Blur restores the selected label.** A half-typed query never survives as though it were a choice.

**The active option is scrolled into view.** With virtual focus the browser scrolls nothing for you, because DOM focus never moves into the list. `block: 'nearest'` scrolls the minimum required and does nothing when the option is already visible, so the list is not yanked on every keypress. Writing the Long List story is what surfaced this.

---

## Storybook

```bash
npm run storybook        # http://localhost:6006
npm run build-storybook  # static build
```

Nine stories, written as documentation rather than demos: Overview, Keyboard, Filtering, Custom Filter, Disabled Options, Preselected, No Results, Disabled, Long List. Each one explains the decision it demonstrates.

Worth trying with the keyboard, and ideally with a screen reader, because the interesting behaviour is invisible.

## Testing

```bash
npm test
```

20 tests, all passing. They assert the **accessibility contract rather than the implementation**: label association, `aria-controls`, `aria-expanded`, `aria-activedescendant` presence and absence, `aria-selected` exclusivity, `aria-disabled`, keyboard behaviour in both states, live region content, and the two Escape behaviours.

The distinction matters. A test asserting "clicking sets the value" survives a refactor that breaks the component for a screen reader user. A test asserting "`aria-activedescendant` points at the active option" does not.

One example of the suite doing its job: the first run failed on `Home` and `End`. The component was correct and the test was wrong, because those keys belong to the text cursor while the combobox is collapsed and only move between options once it is open. That is now asserted explicitly in both states.

---

## What is not done yet

Being honest about the boundary, because a library that overstates its coverage is worse than a small one.

- **Not yet verified against real screen readers.** The tests assert the ARIA contract, which is necessary but not sufficient. NVDA, JAWS and VoiceOver disagree with each other and with the spec in places that only manual testing finds. This is the next thing I intend to do.
- **No automated axe run** in CI yet.
- **Multi-select, option grouping and async loading** are not implemented. Each changes the ARIA pattern rather than extending it, and I would rather add them properly than approximate them.
- **RTL** is not explicitly tested. The layout uses logical properties, so it should behave, but "should" is not "verified". I have built right-to-left interfaces before and know better than to claim it untested.

---

## Roadmap

1. Manual screen reader verification (NVDA, VoiceOver)
2. Publish Storybook so it can be tried without cloning
3. A modal dialog with focus trap and inert background
4. Signals utilities: debounced signal, storage-synced signal

---

## Licence

MIT
