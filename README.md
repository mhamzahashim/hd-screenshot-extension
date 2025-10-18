# HD Screenshot Pro - Chrome Extension

A powerful Chrome extension for capturing HD screenshots with advanced annotation tools. Better than Lightshot.

## Features

### Core Capture Modes
- **Visible Area** - Capture what you see on the screen (Alt+Shift+S)
- **Select Area** - Drag to select a custom region (Alt+Shift+A)
- **Full Page** - Capture entire scrolling page (Alt+Shift+F)

### Annotation Tools
- **Arrow** - Draw arrows to point out details (A)
- **Rectangle** - Draw rectangles (R)
- **Circle** - Draw circles (C)
- **Pen** - Freehand drawing (P)
- **Text** - Add text annotations (T)
- **Highlighter** - Semi-transparent highlighting (H)
- **Blur** - Pixelate sensitive information (B)

### Editor Features
- ✓ **HD/4K Quality** - Captures at native device pixel ratio (up to 8K on high-DPI displays!)
- ✓ **Zoom Controls** - Zoom in/out up to 1000%, fit to screen, actual size
- ✓ **Color Picker** - 7 presets + custom colors
- ✓ **Adjustable Line Width** - 1-20px slider
- ✓ **Undo/Clear** - Fix mistakes easily
- ✓ **Copy to Clipboard** - Instant sharing
- ✓ **Save as PNG** - Lossless, maximum quality
- ✓ **Keyboard Shortcuts** - Power user friendly
- ✓ **Clean, Modern UI** - Professional dark theme

## Installation

### Method 1: Load Unpacked (Development)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `hd-screenshot-extension` folder
5. The extension is now installed!

### Method 2: Pack Extension (Optional)

1. Go to `chrome://extensions/`
2. Click "Pack extension"
3. Select the `hd-screenshot-extension` folder
4. This creates a `.crx` file you can share

## How to Use

### Capturing Screenshots

**Option 1: Using the Popup**
1. Click the extension icon in your toolbar
2. Choose a capture mode:
   - Visible Area
   - Select Area (drag to select region)
   - Full Page (scrolling capture)

**Option 2: Using Keyboard Shortcuts**
- `Alt+Shift+S` - Capture visible area
- `Alt+Shift+A` - Select area to capture
- `Alt+Shift+F` - Capture full page

### Editing Screenshots

After capturing, the editor opens automatically:

1. **Select a tool** from the toolbar (or use keyboard shortcut)
2. **Choose a color** using the color picker or presets
3. **Adjust line width** with the slider
4. **Draw on the screenshot** by clicking and dragging
5. **Add text** by clicking where you want text to appear
6. **Undo** mistakes with the undo button (Ctrl+Z)

### Saving and Sharing

- **Save** - Click the Save button or press Ctrl+S
  - Choose location and filename
  - Saves as PNG format
- **Copy** - Click the Copy button
  - Copies to clipboard
  - Paste into other applications

## Keyboard Shortcuts

### Capture Shortcuts
- `Alt+Shift+S` - Capture visible area
- `Alt+Shift+A` - Select area
- `Alt+Shift+F` - Full page capture

### Editor Shortcuts

**Tools:**
- `V` - Select tool
- `A` - Arrow tool
- `R` - Rectangle tool
- `C` - Circle tool
- `P` - Pen tool
- `T` - Text tool
- `H` - Highlighter tool
- `B` - Blur tool

**Zoom:**
- `+` or `=` - Zoom in
- `-` - Zoom out
- `0` - Actual size (100%)
- `F` - Fit to screen
- `Ctrl+Scroll` - Zoom with mouse wheel

**Actions:**
- `Ctrl+Z` - Undo
- `Ctrl+S` - Save
- `ESC` - Cancel selection (during area capture)

## Technical Details

### Built With
- Chrome Extension Manifest V3
- HTML5 Canvas API
- Vanilla JavaScript (no frameworks)
- Chrome APIs: tabs, storage, downloads, scripting

### Browser Compatibility
- Chrome (latest)
- Edge (Chromium-based)
- Brave
- Opera
- Other Chromium-based browsers

### Permissions Required
- `activeTab` - Capture current tab
- `tabs` - Access tab information
- `storage` - Save preferences
- `downloads` - Save screenshots
- `scripting` - Inject selection overlay
- `<all_urls>` - Capture any website

## Why Choose HD Screenshot Pro?

### vs. Lightshot

| Feature | Lightshot | HD Screenshot Pro |
|---------|-----------|-------------------|
| Full page capture | Limited | ✓ Advanced scrolling |
| HD Quality | Compressed | ✓ True HD |
| Annotation tools | 6 basic | ✓ 8 advanced |
| Blur/Privacy | Basic | ✓ Pixelate effect |
| Keyboard shortcuts | Limited | ✓ Comprehensive |
| Export formats | PNG only | PNG (JPG in future) |
| Privacy | Cloud required | ✓ Local-first |
| Open source | No | ✓ Yes |

## Troubleshooting

### Extension won't load
- Make sure you're in Developer mode
- Check the Chrome console for errors
- Try reloading the extension

### Extension doesn't work on existing tabs
- **Solution**: Refresh the page (F5) and try again
- **Why**: Extension scripts only load when the page loads
- **Works on**: All new tabs opened after installing the extension
- You'll see a helpful notification if you need to refresh

### Screenshots are blank
- Some websites block screenshots (like Netflix)
- Try refreshing the page first
- Check browser permissions

### Select area is blurry
- **Fixed!** Make sure you're using the latest version
- Refresh the page (F5) if it was open before installing the extension
- The extension now properly handles high-DPI displays

### Area selection not working
- Make sure you drag a region (minimum 10x10 pixels)
- Press ESC to cancel and try again
- Refresh the page (F5) if it was open before extension install

### Full page capture incomplete
- Make sure the page is actually scrollable (not just one screen)
- Some pages with lazy loading may not capture fully
- Try scrolling to the bottom first, then back to top
- Infinite scroll pages may have issues
- Check service worker console for "Will take X screenshots" - should be > 1

## Development

### Project Structure
```
hd-screenshot-extension/
├── manifest.json           # Extension configuration
├── popup/                  # Extension popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/                # Injected into web pages
│   ├── content.js
│   └── content.css
├── background/             # Service worker
│   └── background.js
├── editor/                 # Screenshot editor
│   ├── editor.html
│   ├── editor.css
│   └── editor.js
├── icons/                  # Extension icons
└── README.md
```

### Future Enhancements (Phase 2)
- [ ] OCR text extraction
- [ ] More export formats (JPG, PDF, WebP)
- [ ] Cloud upload and sharing
- [ ] Screenshot history
- [ ] Advanced editing (crop, resize, filters)
- [ ] Custom watermarks and templates
- [ ] Batch export
- [ ] Settings page

## Contributing

This is an open-source project. Contributions are welcome!

## License

MIT License - feel free to use and modify

## Support

For issues, questions, or feature requests, please open an issue on the project repository.

---

**Built with ❤️ for better screenshots**

Version 1.0.0 | 2025-10-18
