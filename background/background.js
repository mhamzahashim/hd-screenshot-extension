// Background service worker - handles extension logic

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureVisible') {
    captureVisibleArea();
  } else if (request.action === 'captureArea') {
    captureSelectedArea();
  } else if (request.action === 'captureFull') {
    captureFullPage();
  }
});

// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-visible') {
    captureVisibleArea();
  } else if (command === 'capture-area') {
    captureSelectedArea();
  } else if (command === 'capture-full') {
    captureFullPage();
  }
});

// Capture visible area of the current tab
async function captureVisibleArea() {
  try {
    console.log('Starting visible area capture...');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Active tab:', tab);

    // Check if we can capture this URL
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
      showNotification('Cannot Capture', 'Chrome does not allow capturing chrome:// or extension pages for security reasons.');
      return;
    }

    // Capture in highest quality
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 100
    });
    console.log('Capture successful! Data URL length:', dataUrl.length);

    // Open editor with the captured image
    openEditor(dataUrl, 'visible');
  } catch (error) {
    console.error('Error capturing visible area:', error);
    showNotification('Capture failed', 'Could not capture the visible area. Error: ' + error.message);
  }
}

// Capture selected area
async function captureSelectedArea() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    console.log('Starting area selection for tab:', tab.id);

    // Check if we can capture this URL
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
      showNotification('Cannot Capture', 'Chrome does not allow capturing chrome:// or extension pages for security reasons.');
      return;
    }

    // Always inject scripts (Chrome handles duplicates automatically)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content.js']
    }).catch(err => console.log('Script already injected or error:', err));

    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['content/content.css']
    }).catch(err => console.log('CSS already injected or error:', err));

    // Wait a moment for scripts to initialize
    await new Promise(resolve => setTimeout(resolve, 150));

    // Send message to content script to start selection
    console.log('Sending startSelection message...');
    chrome.tabs.sendMessage(tab.id, { action: 'startSelection' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);
        showNotification('Please Refresh Page', 'Please refresh this page (F5) and try again.');
      } else {
        console.log('Selection started successfully:', response);
      }
    });
  } catch (error) {
    console.error('Error starting area selection:', error);
    showNotification('Capture failed', 'Could not start area selection. Error: ' + error.message);
  }
}

// Capture full page (scrolling)
async function captureFullPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if we can capture this URL
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
      showNotification('Cannot Capture', 'Chrome does not allow capturing chrome:// or extension pages for security reasons.');
      return;
    }

    // Full page capture doesn't need persistent content scripts, just inject the function
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: captureFullPageScript
      });
    } catch (injectionError) {
      console.error('Script injection failed:', injectionError);
      showNotification('Please Refresh Page', 'Please refresh this page (F5) and try again. Extension scripts need to be loaded.');
    }
  } catch (error) {
    console.error('Error capturing full page:', error);
    showNotification('Capture failed', 'Could not capture the full page. Try refreshing the page (F5).');
  }
}

// Script to be injected for full page capture
function captureFullPageScript() {
  // This will be executed in the page context
  chrome.runtime.sendMessage({ action: 'startFullPageCapture' });
}

// Listen for full page capture request from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureAreaComplete') {
    // Area selection complete, capture and crop
    captureAndCrop(request.coordinates, sender.tab.id, sender.tab.windowId);
  } else if (request.action === 'startFullPageCapture') {
    performFullPageCapture(sender.tab.id, sender.tab.windowId);
  }
});

// Capture visible area and crop to selected coordinates
async function captureAndCrop(coords, tabId, windowId) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: 'png',
      quality: 100
    });

    // Open editor with cropping info
    openEditor(dataUrl, 'area', coords);
  } catch (error) {
    console.error('Error capturing and cropping:', error);
  }
}

// Perform full page capture by scrolling and stitching
async function performFullPageCapture(tabId, windowId) {
  try {
    console.log('Starting full page capture...');

    // STEP 1: Inject CSS to hide fixed/sticky elements (prevent overlaps)
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      css: `
        * {
          position: static !important;
        }
        body, html {
          overflow: visible !important;
        }
      `
    }).catch(err => console.log('CSS injection (non-critical):', err));

    // STEP 2: Get page dimensions
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        return {
          scrollHeight: document.documentElement.scrollHeight,
          scrollWidth: document.documentElement.scrollWidth,
          clientHeight: document.documentElement.clientHeight,
          clientWidth: document.documentElement.clientWidth,
          scrollX: window.scrollX,
          scrollY: window.scrollY
        };
      }
    });

    const dimensions = result.result;
    console.log('Page dimensions:', dimensions);
    console.log(`  scrollHeight: ${dimensions.scrollHeight}`);
    console.log(`  clientHeight: ${dimensions.clientHeight}`);

    const screenshots = [];
    const numScreenshots = Math.ceil(dimensions.scrollHeight / dimensions.clientHeight);

    console.log(`Will take ${numScreenshots} screenshots`);

    // Show notification
    showNotification('Capturing Full Page...', 'Please wait, capturing entire page in HD quality.');

    // STEP 3: Scroll and capture with proper delays (Chrome API limit: 2 calls/second)
    for (let i = 0; i < numScreenshots; i++) {
      const scrollY = i * dimensions.clientHeight;
      const isLast = (i === numScreenshots - 1);

      console.log(`Capturing section ${i + 1}/${numScreenshots}...`);

      // Scroll to position using instant behavior
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (y) => {
          window.scrollTo({ top: y, left: 0, behavior: 'instant' });
        },
        args: [scrollY]
      });

      // Wait for page to render
      await new Promise(resolve => setTimeout(resolve, 300));

      // Capture screenshot at maximum quality
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: 'png',
        quality: 100
      });

      // Store screenshot with metadata
      screenshots.push({
        dataUrl: dataUrl,
        offsetY: scrollY,
        isLast: isLast
      });

      // Wait between captures to respect Chrome's rate limit (2 per second)
      if (!isLast) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    console.log(`Total screenshots captured: ${screenshots.length}`);

    // STEP 4: Restore original scroll position
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (x, y) => window.scrollTo({ top: y, left: x, behavior: 'instant' }),
      args: [dimensions.scrollX, dimensions.scrollY]
    });

    // STEP 5: Remove injected CSS
    await chrome.scripting.removeCSS({
      target: { tabId: tabId },
      css: `
        * {
          position: static !important;
        }
        body, html {
          overflow: visible !important;
        }
      `
    }).catch(err => console.log('CSS removal (non-critical):', err));

    console.log('Scroll restored, CSS removed, opening editor...');

    // Show completion notification
    showNotification('Full Page Captured!', 'Opening editor with your HD full-page screenshot.');

    // Open editor with all screenshots for stitching
    openEditor(screenshots, 'full', dimensions);
  } catch (error) {
    console.error('Error performing full page capture:', error);
    showNotification('Capture failed', 'Could not capture the full page: ' + error.message);
  }
}

// Open editor window
function openEditor(imageData, captureType, extraData = null) {
  console.log('Opening editor with capture type:', captureType);

  // Store the image data in chrome.storage for the editor to access
  const screenshotData = {
    pendingScreenshot: {
      imageData: imageData,
      captureType: captureType,
      extraData: extraData,
      timestamp: Date.now()
    }
  };

  console.log('Storing screenshot data in chrome.storage...');

  // Calculate approximate size
  let dataSize = 0;
  if (Array.isArray(imageData)) {
    dataSize = imageData.reduce((sum, img) => sum + img.length, 0);
  } else {
    dataSize = imageData.length;
  }
  console.log('Screenshot data size:', Math.round(dataSize / 1024 / 1024), 'MB');

  chrome.storage.local.set(screenshotData, () => {
    if (chrome.runtime.lastError) {
      console.error('Error storing screenshot:', chrome.runtime.lastError);
      const errorMsg = chrome.runtime.lastError.message || 'Unknown error';

      if (errorMsg.includes('QUOTA_BYTES')) {
        showNotification('Screenshot Too Large', 'The screenshot is too large to store. Try capturing a smaller area or shorter page.');
      } else {
        showNotification('Storage Error', 'Failed to store screenshot: ' + errorMsg);
      }
      return;
    }

    console.log('Screenshot data stored successfully!');

    // Verify storage
    chrome.storage.local.get('pendingScreenshot', (result) => {
      console.log('Verification - Data in storage:', result.pendingScreenshot ? 'YES' : 'NO');
      if (result.pendingScreenshot) {
        console.log('Data type:', result.pendingScreenshot.captureType);
      }
    });

    // Open editor in new tab
    console.log('Creating editor tab...');
    chrome.tabs.create({
      url: chrome.runtime.getURL('editor/editor.html')
    }, (tab) => {
      console.log('Editor tab created:', tab.id);
    });
  });
}

// Show notification
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: title,
    message: message
  });
}
