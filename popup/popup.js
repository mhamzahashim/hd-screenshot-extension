// Popup script - handles user interactions

document.addEventListener('DOMContentLoaded', () => {
  // Get buttons
  const captureVisibleBtn = document.getElementById('captureVisible');
  const captureAreaBtn = document.getElementById('captureArea');
  const captureFullBtn = document.getElementById('captureFull');
  const settingsBtn = document.getElementById('settingsBtn');

  // Capture visible area
  captureVisibleBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'captureVisible' });
    window.close();
  });

  // Capture selected area
  captureAreaBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'captureArea' });
    window.close();
  });

  // Capture full page
  captureFullBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'captureFull' });
    window.close();
  });

  // Settings (placeholder for now)
  settingsBtn.addEventListener('click', () => {
    // TODO: Open settings page
    alert('Settings coming soon!');
  });

  // Add keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === '1') captureVisibleBtn.click();
    if (e.key === '2') captureAreaBtn.click();
    if (e.key === '3') captureFullBtn.click();
  });
});
