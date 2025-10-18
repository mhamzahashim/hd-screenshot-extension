// Editor script - handles screenshot editing and annotation

// Global state
let screenshotCanvas, annotationCanvas;
let screenshotCtx, annotationCtx;
let currentTool = 'select';
let currentColor = '#FF0000';
let lineWidth = 3;
let isDrawing = false;
let startX, startY;
let annotations = [];
let tempAnnotation = null;
let screenshotImage = null;
let currentZoom = 1.0;
let canvasWrapper = null;

// Initialize editor
document.addEventListener('DOMContentLoaded', async () => {
  // Get canvas elements
  screenshotCanvas = document.getElementById('screenshotCanvas');
  annotationCanvas = document.getElementById('annotationCanvas');
  canvasWrapper = document.getElementById('canvasWrapper');
  // Use willReadFrequently for better performance with blur tool
  screenshotCtx = screenshotCanvas.getContext('2d', { willReadFrequently: true });
  annotationCtx = annotationCanvas.getContext('2d');

  // Load screenshot from storage
  await loadScreenshot();

  // Setup tool buttons
  setupToolButtons();

  // Setup color picker
  setupColorPicker();

  // Setup line width
  setupLineWidth();

  // Setup zoom controls
  setupZoom();

  // Setup canvas events
  setupCanvasEvents();

  // Setup action buttons
  setupActionButtons();

  // Setup keyboard shortcuts
  setupKeyboardShortcuts();
});

// Load screenshot from chrome.storage
async function loadScreenshot() {
  const loadingIndicator = document.getElementById('loadingIndicator');

  try {
    console.log('Loading screenshot from storage...');
    const result = await chrome.storage.local.get('pendingScreenshot');
    console.log('Storage result:', result);
    const data = result.pendingScreenshot;

    if (!data) {
      console.error('No screenshot data found in storage');
      loadingIndicator.innerHTML = '<div class="spinner"></div><p>No screenshot data found. Please try capturing again.</p>';
      setTimeout(() => window.close(), 3000);
      return;
    }

    console.log('Screenshot data found, type:', data.captureType);
    const { imageData, captureType, extraData } = data;

    if (captureType === 'full') {
      // Stitch multiple screenshots for full page
      console.log('Stitching full page screenshot...');
      await stitchFullPageScreenshot(imageData, extraData);
    } else {
      // Load single screenshot
      console.log('Loading single screenshot...');
      await loadImage(imageData, captureType, extraData);
    }

    console.log('Screenshot loaded successfully!');
    loadingIndicator.classList.add('hidden');

    // Clear from storage
    chrome.storage.local.remove('pendingScreenshot');
  } catch (error) {
    console.error('Error loading screenshot:', error);
    loadingIndicator.innerHTML = '<div class="spinner"></div><p>Error: ' + error.message + '</p><p>Check the console for details.</p>';
    setTimeout(() => {
      if (confirm('Failed to load screenshot. Close this window?')) {
        window.close();
      }
    }, 2000);
  }
}

// Load image onto canvas
function loadImage(dataUrl, captureType, extraData) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      screenshotImage = img;

      if (captureType === 'area' && extraData) {
        // Crop to selected area - CORRECT DPR METHOD
        const { x, y, width, height, dpr } = extraData;

        console.log('Original CSS selection:', { x, y, width, height });
        console.log('Device Pixel Ratio:', dpr);
        console.log('Captured image size:', img.width, 'x', img.height);

        // Scale selection coordinates to match captured image (which is at DPR)
        const scaledX = Math.round(x * dpr);
        const scaledY = Math.round(y * dpr);
        const scaledWidth = Math.round(width * dpr);
        const scaledHeight = Math.round(height * dpr);

        console.log('Scaled selection (for cropping):', { scaledX, scaledY, scaledWidth, scaledHeight });

        // CRITICAL: Canvas size should be ORIGINAL CSS size, NOT scaled
        screenshotCanvas.width = width;   // CSS pixels, not scaled
        screenshotCanvas.height = height; // CSS pixels, not scaled
        annotationCanvas.width = width;
        annotationCanvas.height = height;

        console.log('Canvas size (CSS pixels):', width, 'x', height);

        // Draw: Take the SCALED portion from source, draw to ORIGINAL-sized canvas
        screenshotCtx.drawImage(
          img,
          scaledX,      // Source X (scaled)
          scaledY,      // Source Y (scaled)
          scaledWidth,  // Source Width (scaled)
          scaledHeight, // Source Height (scaled)
          0,            // Dest X
          0,            // Dest Y
          width,        // Dest Width (original CSS size)
          height        // Dest Height (original CSS size)
        );

        console.log('✓ SHARP - Drew scaled source to original-sized canvas');
      } else {
        // Full visible area
        screenshotCanvas.width = img.width;
        screenshotCanvas.height = img.height;
        annotationCanvas.width = img.width;
        annotationCanvas.height = img.height;
        screenshotCtx.drawImage(img, 0, 0);
      }

      resolve();
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Stitch full page screenshot - CORRECT method from claude.ai
async function stitchFullPageScreenshot(screenshots, dimensions) {
  console.log('Stitching', screenshots.length, 'sections...');

  const { scrollHeight, clientHeight } = dimensions;

  // Load first image to get actual dimensions
  const firstImg = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = screenshots[0].dataUrl;
  });

  const imgWidth = firstImg.width;
  const imgHeight = firstImg.height;

  console.log('Section size:', imgWidth, 'x', imgHeight);
  console.log('Total page height:', scrollHeight);

  // Calculate total canvas height based on DPR
  const dpr = imgHeight / clientHeight;
  const totalCanvasHeight = Math.round(scrollHeight * dpr);

  console.log('DPR:', dpr);
  console.log('Creating canvas:', imgWidth, 'x', totalCanvasHeight);

  screenshotCanvas.width = imgWidth;
  screenshotCanvas.height = totalCanvasHeight;
  annotationCanvas.width = imgWidth;
  annotationCanvas.height = totalCanvasHeight;

  // Draw each screenshot at its proper offset
  for (let i = 0; i < screenshots.length; i++) {
    const screenshot = screenshots[i];

    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = screenshot.dataUrl;
    });

    const offsetY = screenshot.offsetY * dpr;

    // Calculate draw height
    let drawHeight = img.height;

    // For the last screenshot, only draw the remaining portion
    if (screenshot.isLast) {
      const remainingHeight = totalCanvasHeight - offsetY;
      drawHeight = Math.min(img.height, remainingHeight);
      console.log(`Last section: cropping to ${drawHeight}px (remaining: ${remainingHeight}px)`);
    }

    // Draw the screenshot
    screenshotCtx.drawImage(
      img,
      0, 0,          // Source X, Y
      img.width,     // Source Width
      drawHeight,    // Source Height (may be cropped for last)
      0,             // Dest X
      offsetY,       // Dest Y (offset by scroll position)
      img.width,     // Dest Width
      drawHeight     // Dest Height
    );

    console.log(`Section ${i + 1} placed at Y: ${offsetY}, height: ${drawHeight}`);
  }

  console.log('✓ Stitching complete - No overlaps');

  // Store result
  screenshotImage = new Image();
  screenshotImage.src = screenshotCanvas.toDataURL();
}

// Setup tool buttons
function setupToolButtons() {
  const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');

  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentTool = btn.dataset.tool;

      // Update active state
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update cursor
      updateCursor();
    });
  });

  // Undo button
  document.getElementById('undoBtn').addEventListener('click', undo);

  // Clear button
  document.getElementById('clearBtn').addEventListener('click', clearAll);
}

// Setup color picker
function setupColorPicker() {
  const colorInput = document.getElementById('colorInput');

  colorInput.addEventListener('change', (e) => {
    currentColor = e.target.value;
  });

  // Color presets
  const presets = document.querySelectorAll('.color-preset');
  presets.forEach(preset => {
    preset.addEventListener('click', () => {
      currentColor = preset.dataset.color;
      colorInput.value = currentColor;
    });
  });
}

// Setup line width
function setupLineWidth() {
  const lineWidthInput = document.getElementById('lineWidth');
  const lineWidthValue = document.getElementById('lineWidthValue');

  lineWidthInput.addEventListener('input', (e) => {
    lineWidth = parseInt(e.target.value);
    lineWidthValue.textContent = lineWidth + 'px';
  });
}

// Setup canvas events
function setupCanvasEvents() {
  annotationCanvas.addEventListener('mousedown', handleMouseDown);
  annotationCanvas.addEventListener('mousemove', handleMouseMove);
  annotationCanvas.addEventListener('mouseup', handleMouseUp);
  annotationCanvas.addEventListener('mouseleave', handleMouseLeave);
}

// Handle mouse down
function handleMouseDown(e) {
  if (currentTool === 'select') return;

  const rect = annotationCanvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;

  isDrawing = true;

  if (currentTool === 'text') {
    addTextAnnotation(startX, startY);
  } else if (currentTool === 'pen' || currentTool === 'highlighter') {
    tempAnnotation = {
      tool: currentTool,
      color: currentColor,
      lineWidth: lineWidth,
      points: [{ x: startX, y: startY }]
    };
  }
}

// Handle mouse move
function handleMouseMove(e) {
  if (!isDrawing || currentTool === 'select' || currentTool === 'text') return;

  const rect = annotationCanvas.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;

  if (currentTool === 'pen' || currentTool === 'highlighter') {
    tempAnnotation.points.push({ x: currentX, y: currentY });
    redrawCanvas();
    drawTempAnnotation();
  } else {
    // Preview for shapes
    redrawCanvas();
    drawPreview(startX, startY, currentX, currentY);
  }
}

// Handle mouse up
function handleMouseUp(e) {
  if (!isDrawing || currentTool === 'select' || currentTool === 'text') return;

  const rect = annotationCanvas.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;

  if (currentTool === 'pen' || currentTool === 'highlighter') {
    annotations.push(tempAnnotation);
    tempAnnotation = null;
  } else {
    const annotation = {
      tool: currentTool,
      color: currentColor,
      lineWidth: lineWidth,
      startX: startX,
      startY: startY,
      endX: endX,
      endY: endY
    };
    annotations.push(annotation);
  }

  isDrawing = false;
  redrawCanvas();
}

// Handle mouse leave
function handleMouseLeave() {
  if (isDrawing && (currentTool === 'pen' || currentTool === 'highlighter')) {
    annotations.push(tempAnnotation);
    tempAnnotation = null;
  }
  isDrawing = false;
}

// Draw preview while drawing
function drawPreview(x1, y1, x2, y2) {
  annotationCtx.strokeStyle = currentColor;
  annotationCtx.lineWidth = lineWidth;
  annotationCtx.lineCap = 'round';
  annotationCtx.lineJoin = 'round';

  annotationCtx.beginPath();

  switch (currentTool) {
    case 'arrow':
      drawArrow(annotationCtx, x1, y1, x2, y2);
      break;
    case 'rectangle':
      annotationCtx.rect(x1, y1, x2 - x1, y2 - y1);
      break;
    case 'circle':
      const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      annotationCtx.arc(x1, y1, radius, 0, 2 * Math.PI);
      break;
    case 'blur':
      drawBlur(annotationCtx, x1, y1, x2, y2);
      return;
  }

  annotationCtx.stroke();
}

// Draw temp annotation (for pen/highlighter)
function drawTempAnnotation() {
  if (!tempAnnotation) return;

  annotationCtx.strokeStyle = tempAnnotation.color;
  annotationCtx.lineWidth = tempAnnotation.lineWidth;
  annotationCtx.lineCap = 'round';
  annotationCtx.lineJoin = 'round';

  if (tempAnnotation.tool === 'highlighter') {
    annotationCtx.globalAlpha = 0.4;
  }

  annotationCtx.beginPath();
  tempAnnotation.points.forEach((point, index) => {
    if (index === 0) {
      annotationCtx.moveTo(point.x, point.y);
    } else {
      annotationCtx.lineTo(point.x, point.y);
    }
  });
  annotationCtx.stroke();

  annotationCtx.globalAlpha = 1.0;
}

// Redraw canvas with all annotations
function redrawCanvas() {
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);

  annotations.forEach(ann => {
    annotationCtx.strokeStyle = ann.color;
    annotationCtx.lineWidth = ann.lineWidth;
    annotationCtx.lineCap = 'round';
    annotationCtx.lineJoin = 'round';

    if (ann.tool === 'highlighter') {
      annotationCtx.globalAlpha = 0.4;
    }

    annotationCtx.beginPath();

    switch (ann.tool) {
      case 'arrow':
        drawArrow(annotationCtx, ann.startX, ann.startY, ann.endX, ann.endY);
        annotationCtx.stroke();
        break;
      case 'rectangle':
        annotationCtx.rect(ann.startX, ann.startY, ann.endX - ann.startX, ann.endY - ann.startY);
        annotationCtx.stroke();
        break;
      case 'circle':
        const radius = Math.sqrt(Math.pow(ann.endX - ann.startX, 2) + Math.pow(ann.endY - ann.startY, 2));
        annotationCtx.arc(ann.startX, ann.startY, radius, 0, 2 * Math.PI);
        annotationCtx.stroke();
        break;
      case 'pen':
      case 'highlighter':
        ann.points.forEach((point, index) => {
          if (index === 0) {
            annotationCtx.moveTo(point.x, point.y);
          } else {
            annotationCtx.lineTo(point.x, point.y);
          }
        });
        annotationCtx.stroke();
        break;
      case 'blur':
        drawBlur(annotationCtx, ann.startX, ann.startY, ann.endX, ann.endY);
        break;
      case 'text':
        annotationCtx.font = `${ann.fontSize}px Arial`;
        annotationCtx.fillStyle = ann.color;
        annotationCtx.fillText(ann.text, ann.x, ann.y);
        break;
    }

    annotationCtx.globalAlpha = 1.0;
  });
}

// Draw arrow
function drawArrow(ctx, x1, y1, x2, y2) {
  const headLength = 15;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  // Draw line
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);

  // Draw arrowhead
  ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
}

// Draw blur effect
function drawBlur(ctx, x1, y1, x2, y2) {
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  // Validate dimensions
  if (width < 1 || height < 1) {
    return; // Skip if area is too small
  }

  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);

  // Make sure we're within canvas bounds
  const clampedX = Math.max(0, Math.min(x, screenshotCanvas.width - 1));
  const clampedY = Math.max(0, Math.min(y, screenshotCanvas.height - 1));
  const clampedWidth = Math.min(width, screenshotCanvas.width - clampedX);
  const clampedHeight = Math.min(height, screenshotCanvas.height - clampedY);

  if (clampedWidth < 1 || clampedHeight < 1) {
    return; // Skip if clamped area is invalid
  }

  try {
    const imageData = screenshotCtx.getImageData(clampedX, clampedY, clampedWidth, clampedHeight);

    // Pixelate effect
    pixelate(imageData, 10);

    ctx.putImageData(imageData, clampedX, clampedY);
  } catch (error) {
    console.error('Error applying blur:', error);
  }
}

// Pixelate image data
function pixelate(imageData, pixelSize) {
  const { width, height, data } = imageData;

  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      for (let py = 0; py < pixelSize && y + py < height; py++) {
        for (let px = 0; px < pixelSize && x + px < width; px++) {
          const pi = ((y + py) * width + (x + px)) * 4;
          data[pi] = r;
          data[pi + 1] = g;
          data[pi + 2] = b;
        }
      }
    }
  }
}

// Add text annotation
function addTextAnnotation(x, y) {
  const overlay = document.getElementById('textInputOverlay');
  const textInput = document.getElementById('textInput');

  overlay.style.left = x + 'px';
  overlay.style.top = y + 'px';
  overlay.style.display = 'block';
  textInput.value = '';
  textInput.focus();

  const finishText = () => {
    const text = textInput.value.trim();
    if (text) {
      annotations.push({
        tool: 'text',
        color: currentColor,
        text: text,
        x: x,
        y: y,
        fontSize: lineWidth * 5
      });
      redrawCanvas();
    }
    overlay.style.display = 'none';
    textInput.removeEventListener('blur', finishText);
  };

  textInput.addEventListener('blur', finishText);
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && e.ctrlKey)) {
      finishText();
    }
  });
}

// Undo last annotation
function undo() {
  if (annotations.length > 0) {
    annotations.pop();
    redrawCanvas();
  }
}

// Clear all annotations
function clearAll() {
  if (confirm('Clear all annotations?')) {
    annotations = [];
    redrawCanvas();
  }
}

// Update cursor based on tool
function updateCursor() {
  const cursors = {
    select: 'default',
    arrow: 'crosshair',
    rectangle: 'crosshair',
    circle: 'crosshair',
    pen: 'crosshair',
    text: 'text',
    highlighter: 'crosshair',
    blur: 'crosshair'
  };
  annotationCanvas.style.cursor = cursors[currentTool] || 'crosshair';
}

// Setup action buttons
function setupActionButtons() {
  document.getElementById('saveBtn').addEventListener('click', saveScreenshot);
  document.getElementById('copyBtn').addEventListener('click', copyToClipboard);
}

// Save screenshot
async function saveScreenshot() {
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = screenshotCanvas.width;
  finalCanvas.height = screenshotCanvas.height;
  const finalCtx = finalCanvas.getContext('2d');

  // Draw screenshot
  finalCtx.drawImage(screenshotCanvas, 0, 0);

  // Draw annotations
  finalCtx.drawImage(annotationCanvas, 0, 0);

  // Convert to blob
  finalCanvas.toBlob(async (blob) => {
    const url = URL.createObjectURL(blob);
    const filename = `screenshot-${Date.now()}.png`;

    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });

    URL.revokeObjectURL(url);
  }, 'image/png');
}

// Copy to clipboard
async function copyToClipboard() {
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = screenshotCanvas.width;
  finalCanvas.height = screenshotCanvas.height;
  const finalCtx = finalCanvas.getContext('2d');

  // Draw screenshot
  finalCtx.drawImage(screenshotCanvas, 0, 0);

  // Draw annotations
  finalCtx.drawImage(annotationCanvas, 0, 0);

  // Convert to blob
  finalCanvas.toBlob(async (blob) => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      alert('Screenshot copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy to clipboard. Please try saving instead.');
    }
  }, 'image/png');
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Tool shortcuts
    if (e.key.toLowerCase() === 'v' && !e.ctrlKey) setTool('select');
    if (e.key.toLowerCase() === 'a' && !e.ctrlKey) setTool('arrow');
    if (e.key.toLowerCase() === 'r' && !e.ctrlKey) setTool('rectangle');
    if (e.key.toLowerCase() === 'c' && !e.ctrlKey) setTool('circle');
    if (e.key.toLowerCase() === 'p' && !e.ctrlKey) setTool('pen');
    if (e.key.toLowerCase() === 't' && !e.ctrlKey) setTool('text');
    if (e.key.toLowerCase() === 'h' && !e.ctrlKey) setTool('highlighter');
    if (e.key.toLowerCase() === 'b' && !e.ctrlKey) setTool('blur');

    // Undo
    if (e.key === 'z' && e.ctrlKey) {
      e.preventDefault();
      undo();
    }

    // Save
    if (e.key === 's' && e.ctrlKey) {
      e.preventDefault();
      saveScreenshot();
    }

    // Zoom shortcuts
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomIn();
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomOut();
    }
    if (e.key === '0') {
      e.preventDefault();
      zoomActual();
    }
    if (e.key.toLowerCase() === 'f' && !e.ctrlKey) {
      e.preventDefault();
      zoomFit();
    }
  });
}

// Setup zoom controls
function setupZoom() {
  document.getElementById('zoomInBtn').addEventListener('click', zoomIn);
  document.getElementById('zoomOutBtn').addEventListener('click', zoomOut);
  document.getElementById('zoomFitBtn').addEventListener('click', zoomFit);
  document.getElementById('zoomActualBtn').addEventListener('click', zoomActual);

  // Mouse wheel zoom
  const canvasContainer = document.getElementById('canvasContainer');
  canvasContainer.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
    }
  }, { passive: false });

  // Initialize to fit
  setTimeout(() => zoomFit(), 100);
}

// Zoom in
function zoomIn() {
  currentZoom = Math.min(currentZoom * 1.2, 10); // Max 10x zoom
  applyZoom();
}

// Zoom out
function zoomOut() {
  currentZoom = Math.max(currentZoom / 1.2, 0.1); // Min 0.1x zoom
  applyZoom();
}

// Zoom to actual size (100%)
function zoomActual() {
  currentZoom = 1.0;
  applyZoom();
}

// Zoom to fit screen
function zoomFit() {
  const container = document.getElementById('canvasContainer');
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  const canvasWidth = screenshotCanvas.width;
  const canvasHeight = screenshotCanvas.height;

  const scaleX = (containerWidth - 40) / canvasWidth;
  const scaleY = (containerHeight - 40) / canvasHeight;

  currentZoom = Math.min(scaleX, scaleY, 1.0); // Don't zoom in beyond 100%
  applyZoom();
}

// Apply zoom transformation
function applyZoom() {
  canvasWrapper.style.transform = `scale(${currentZoom})`;

  // Update zoom level display
  document.getElementById('zoomLevel').textContent = Math.round(currentZoom * 100) + '%';

  // Update canvas wrapper size
  canvasWrapper.style.width = screenshotCanvas.width + 'px';
  canvasWrapper.style.height = screenshotCanvas.height + 'px';
}

function setTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
  updateCursor();
}
