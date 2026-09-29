# Implementation Quality

## Semantic controls
- `<button>` for actions.
- `<a>`/router Link for navigation.
- `<label>` associated with inputs.
- `<table>` for tabular data.
- Heading order reflects document structure.

## Content resilience
- flex/grid children can shrink (`min-width: 0` where needed);
- long strings wrap/truncate deliberately;
- images have dimensions;
- list/table empty states are defined;
- loading states do not create avoidable layout shifts.

## State feedback
Interactive components should define applicable:
- hover;
- active;
- focus-visible;
- disabled;
- loading;
- invalid;
- selected.

## Motion
- animate transform/opacity when possible;
- no `transition: all`;
- reduced-motion fallback;
- user interaction may interrupt animation.

## Navigation/state
When meaningful, encode filter/tab/pagination state in the URL or persistent view model so the interface is shareable and recoverable.
