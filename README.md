# BlueSky Profile Pics Inline (BPPI)

Firefox extension that replaces @mentions in Bluesky posts with inline profile pictures.

![Example](https://img.shields.io/badge/Firefox-Extension-orange)

## Features

- Replaces @mention text with 20x20 inline profile pictures
- Shows username and display name on hover (tooltip)
- Only processes mentions within posts (not headers/sidebars)
- Works on main feed and individual post pages
- Handles infinite scroll and dynamic content
- Caches profile data to minimize API calls

## Installation

### From Firefox Add-ons (Recommended)
*Coming soon*

### Manual Installation (Development)
1. Clone this repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" in the sidebar
4. Click "Load Temporary Add-on"
5. Select `manifest.json` from the cloned directory

## How It Works

The extension uses Bluesky's public API to fetch profile data:

```
GET https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor={handle}
```

No authentication is required. The extension:
1. Watches for DOM changes using MutationObserver
2. Finds @mention links within post content
3. Fetches the user's profile picture
4. Replaces the text with an inline avatar image

## License

[The Unlicense](LICENSE) - Public Domain
