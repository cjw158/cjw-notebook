# Development Documentation

## Project Overview

MindSpace is a minimalist note-taking and todo application optimized for Android mobile devices. Built as a Progressive Web App (PWA), it can be installed on Android devices and works offline.

## Technology Stack

- **Frontend**: React 19.2.0 with TypeScript
- **Build Tool**: Vite 6.4.1
- **Styling**: Tailwind CSS (via CDN)
- **Markdown**: marked.js
- **Export**: html2pdf.js, jszip
- **Storage**: Browser localStorage
- **PWA**: Service Worker, Web App Manifest

## Project Structure

```
/
├── components/           # React components
│   └── Icons.tsx        # SVG icon components
├── public/              # Static assets
│   ├── icon.svg         # App icon
│   ├── manifest.json    # PWA manifest
│   └── sw.js           # Service worker
├── services/            # (Empty - AI services removed)
├── App.tsx             # Main application component
├── index.tsx           # Application entry point
├── index.html          # HTML template
├── types.ts            # TypeScript type definitions
├── vite.config.ts      # Vite configuration
└── README.md           # User documentation
```

## Key Components

### App.tsx
Main application component containing:
- Note management (CRUD operations)
- Todo management (CRUD operations)
- UI state management
- LocalStorage persistence
- Undo/Redo functionality
- Export functionality

### types.ts
Type definitions:
- `Note`: Note data structure
- `Todo`: Todo item structure
- Supporting types for sorting and history

### Service Worker (sw.js)
- Caches app resources for offline use
- Cache-first strategy for static assets
- Version-based cache management

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Features

### Notes
- Create, edit, and delete notes
- Markdown preview
- Undo/Redo support
- Search functionality
- Favorite notes
- Sort by date or title
- Export to TXT/PDF

### Todos
- Add new todos (with Enter key support)
- Mark as complete/incomplete
- Delete individual todos
- Clear all completed
- Search todos
- Statistics display

### PWA Features
- Install on Android home screen
- Offline functionality
- Standalone app experience
- Theme color integration

## Data Storage

All data is stored in browser localStorage:
- Notes: `mindspace_notes_v1`
- Todos: `mindspace_todos_v1`
- Theme: `mindspace_theme_v1`

## Build Output

Production build creates:
- Minimized HTML, CSS, JS
- Service worker
- PWA manifest
- App icons

## Browser Compatibility

- Chrome 56+ (Android recommended)
- Firefox 52+
- Safari 11.1+
- Edge 79+

## Testing

The application has been tested for:
- Build success ✅
- Security vulnerabilities (CodeQL) ✅
- Mobile responsiveness ✅
- Offline functionality ✅
- Data persistence ✅

## Future Enhancements

Potential improvements:
- Real app icons (replace SVG placeholder)
- Cloud sync functionality
- More export formats
- Advanced todo features (due dates, priorities)
- Note categories/tags
- Backup/restore functionality

## Contributing

When contributing:
1. Maintain TypeScript type safety
2. Follow existing code style
3. Test on mobile devices
4. Ensure PWA functionality works
5. Update documentation

## Security

- No external API calls
- All data stored locally
- No user authentication required
- No sensitive data transmission
- Regular security scans with CodeQL
