# Hospital Scheduler App — Claude Rules

## UI/UX Design Rules

### Always Use Global Components

Import shared components from `@/components/ui` — never re-implement them inline:

```ts
import {
  Alert, Button, DeleteIconButton, Input, Badge,
  Select, DropdownPanel, TabButton, TabsContainer,
  SearchInput, SearchDropdown, FilterPill, Toggle
} from "@/components/ui";
```

| Need | Use |
|------|-----|
| Any button/action | `<Button variant="..." size="...">` |
| Delete row action | `<DeleteIconButton>` |
| Text input | `<Input inputPrefix="...">` |
| Dropdown select | `<Select optionPrefix="...">` |
| Search box | `<SearchInput>` or `<SearchDropdown>` |
| Filter toggles | `<FilterPill active={...}>` |
| Small labeled tags | `<Badge className="...">` |
| Success/error feedback | `<Alert type="success|error|warning">` |
| On/off toggle | `<Toggle checked={...} onChange={...}>` |
| Tab navigation | `<TabsContainer>` + `<TabButton active={...}>` |
| Floating panel/menu | `<DropdownPanel open={...} onClose={...}>` |

---

### Colors

- Use color constants from `@/lib/colors.ts` — never hardcode one-off color combos.
  - `BADGE_COLORS` — attribute/filter badge colors
  - `DAY_TYPE_COLORS` — shift-type color sets (value / swatch / active)
  - `COLUMN_COLORS` — table column header colors
  - `SHIFT_COLORS` / `SHIFT_COLORS_LIGHT` — shift pills
- Primary interactive color: **blue-600** (`bg-blue-600`, `text-blue-600`)
- Neutral surfaces: **slate** scale (`bg-slate-50`, `border-slate-200`, `text-slate-500`)
- Destructive: **red-600**; Success: **emerald-600**; Warning: **amber-500**

---

### Typography

- Font: **Heebo** (already loaded in layout — do not import again)
- Body text: `text-sm` (14px), labels/badges: `text-xs`
- Prefer `font-medium` for interactive labels, `font-semibold` for headings

---

### Layout & Spacing

- Use Tailwind spacing utilities — no arbitrary values unless unavoidable
- Common padding: `px-4 py-2.5` (standard), `px-3 py-1.5` (compact)
- Common gaps: `gap-2` / `gap-3` between items, `gap-4` between sections
- Border radius: `rounded-xl` for buttons/cards, `rounded-2xl` for large containers, `rounded-full` for pills

---

### RTL

- This app is **Hebrew-first, RTL**. All new UI must work in RTL.
- Add `dir="rtl"` on containers where needed.
- Exception: toggle/switch tracks use `dir="ltr"` to keep CSS transforms correct.
- Text labels default to Hebrew.

---

### Modals & Overlays

Use this fixed overlay pattern (not native `<dialog>`):

```tsx
<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center">
  <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
    {/* header */}
    {/* content */}
    {/* footer: cancel + confirm buttons */}
  </div>
</div>
```

- Backdrop uses `bg-slate-900/40 backdrop-blur-sm`
- Content card: `rounded-2xl shadow-xl bg-white`
- Footer: secondary cancel button + primary/danger confirm button

---

### Tables

- Use standard HTML `<table>` with `sticky-header` class on `<thead>` for scrollable tables
- Alternate row backgrounds: `idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"`
- Hover: `hover:bg-blue-50/30`
- Inline editing: click to activate, blur/Enter to save — no separate edit mode page
- Row actions (delete, expand) go on the right side with `<DeleteIconButton>` or icon `<Button variant="icon">`

---

### Button Variants

| Variant | When to use |
|---------|-------------|
| `primary` | Main CTA (save, confirm) |
| `secondary` | Secondary actions, cancel |
| `danger` | Destructive actions |
| `success` | Positive confirmations |
| `ghost` | Tertiary/low-emphasis |
| `gradient` | Special emphasis only |
| `icon` | Icon-only row/toolbar actions |

---

### Icons

- Use **lucide-react** exclusively — no other icon libraries.
- Pass icons as `icon={<IconName size={16} />}` prop on `<Button>`.

---

### State & Feedback

- Loading state: disable the triggering button and show Hebrew label (e.g., `"שומר..."`)
- Errors: render `<Alert type="error">` near the action that failed
- Success: render `<Alert type="success">` (auto-dismiss or with `onClose`)
- Empty states: centered `text-sm text-slate-400` message inside the content card
