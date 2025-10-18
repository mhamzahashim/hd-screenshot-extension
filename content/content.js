// Content script - injected into web pages for area selection

let selectionOverlay = null;
let selectionBox = null;
let startX = 0;
let startY = 0;
let isSelecting = false;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);

  if (request.action === 'startSelection') {
    console.log('Initializing selection mode...');
    initSelectionMode();
    sendResponse({ status: 'started' });
  }

  return true; // Keep channel open for async response
});

// Initialize selection mode
function initSelectionMode() {
  // Create overlay
  selectionOverlay = document.createElement('div');
  selectionOverlay.id = 'hd-screenshot-overlay';
  selectionOverlay.innerHTML = `
    <div class="overlay-backdrop"></div>
    <div class="selection-box"></div>
    <div class="selection-hint">
      Click and drag to select an area • Press ESC to cancel
    </div>
  `;
  document.body.appendChild(selectionOverlay);

  selectionBox = selectionOverlay.querySelector('.selection-box');

  // Add event listeners
  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', handleKeyDown);

  // Change cursor
  document.body.style.cursor = 'crosshair';
}

// Handle mouse down
function handleMouseDown(e) {
  if (!selectionOverlay) return;

  isSelecting = true;
  startX = e.clientX + window.scrollX;
  startY = e.clientY + window.scrollY;

  selectionBox.style.left = startX + 'px';
  selectionBox.style.top = startY + 'px';
  selectionBox.style.width = '0px';
  selectionBox.style.height = '0px';
  selectionBox.style.display = 'block';
}

// Handle mouse move
function handleMouseMove(e) {
  if (!isSelecting || !selectionOverlay) return;

  const currentX = e.clientX + window.scrollX;
  const currentY = e.clientY + window.scrollY;

  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);

  selectionBox.style.left = left + 'px';
  selectionBox.style.top = top + 'px';
  selectionBox.style.width = width + 'px';
  selectionBox.style.height = height + 'px';

  // Update dimensions display
  const hint = selectionOverlay.querySelector('.selection-hint');
  hint.textContent = `${Math.round(width)} × ${Math.round(height)} px`;
}

// Handle mouse up
function handleMouseUp(e) {
  if (!isSelecting || !selectionOverlay) return;

  isSelecting = false;

  const currentX = e.clientX + window.scrollX;
  const currentY = e.clientY + window.scrollY;

  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  // Minimum selection size
  if (width < 10 || height < 10) {
    cleanupSelection();
    return;
  }

  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);

  // Get actual device pixel ratio
  const dpr = window.devicePixelRatio || 1;

  // Send viewport coordinates (CSS pixels) with DPR
  const coordinates = {
    x: left - window.scrollX,
    y: top - window.scrollY,
    width: width,
    height: height,
    dpr: dpr  // Pass the actual DPR from the page
  };

  console.log('Sending selection coordinates with DPR:', coordinates);

  // Send coordinates to background script
  chrome.runtime.sendMessage({
    action: 'captureAreaComplete',
    coordinates: coordinates
  });

  cleanupSelection();
}

// Handle keyboard
function handleKeyDown(e) {
  if (e.key === 'Escape' && selectionOverlay) {
    cleanupSelection();
  }
}

// Cleanup selection mode
function cleanupSelection() {
  if (selectionOverlay) {
    selectionOverlay.remove();
    selectionOverlay = null;
    selectionBox = null;
  }

  document.removeEventListener('mousedown', handleMouseDown);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('keydown', handleKeyDown);

  document.body.style.cursor = '';
  isSelecting = false;
}
