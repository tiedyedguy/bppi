// BlueSky Profile Pics Inline (BPPI)
// Replaces @mentions in posts with inline profile pictures

(function() {
  'use strict';

  // Cache for profile data to avoid duplicate API calls
  const profileCache = new Map();

  // Set to track already processed links
  const processedLinks = new WeakSet();

  // Bluesky public API endpoint
  const API_BASE = 'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile';

  /**
   * Fetch profile data from Bluesky API
   * @param {string} handle - The user handle
   * @returns {Promise<Object|null>} Profile data or null on failure
   */
  async function fetchProfile(handle) {
    // Check cache first
    if (profileCache.has(handle)) {
      return profileCache.get(handle);
    }

    try {
      const response = await fetch(`${API_BASE}?actor=${encodeURIComponent(handle)}`);

      if (!response.ok) {
        console.warn(`[BPPI] Failed to fetch profile for ${handle}: ${response.status}`);
        profileCache.set(handle, null);
        return null;
      }

      const data = await response.json();
      profileCache.set(handle, data);
      return data;
    } catch (error) {
      console.warn(`[BPPI] Error fetching profile for ${handle}:`, error);
      profileCache.set(handle, null);
      return null;
    }
  }

  /**
   * Extract handle from a profile link
   * @param {HTMLAnchorElement} link - The anchor element
   * @returns {string|null} The handle or null
   */
  function extractHandle(link) {
    const href = link.getAttribute('href');
    if (!href) return null;

    // Match /profile/{handle} pattern
    const match = href.match(/\/profile\/([^/?#]+)/);
    if (!match) return null;

    return match[1];
  }

  /**
   * Check if a link is inside a post container (not in headers/sidebars)
   * @param {HTMLElement} link - The link element
   * @returns {boolean}
   */
  function isInPost(link) {
    // Exclude areas that are definitely NOT post content

    // Profile header/sidebar areas
    if (link.closest('[data-testid="profileHeaderDisplayName"]')) return false;
    if (link.closest('[data-testid="profileHeaderHandle"]')) return false;
    if (link.closest('[data-testid="suggestedFollows"]')) return false;
    if (link.closest('[data-testid="whoToFollow"]')) return false;

    // Navigation and menus
    if (link.closest('nav')) return false;
    if (link.closest('[role="navigation"]')) return false;
    if (link.closest('[data-testid="homeScreenFeedTabs"]')) return false;

    // Post author headers (not the content) - check by structure
    // Author links typically don't start with @ in their visible text
    const linkText = link.textContent?.trim();
    if (!linkText?.startsWith('@')) return false;

    // If we're inside any post-related container, allow it
    const inPostContent = link.closest('[data-testid="postText"]') ||
                          link.closest('[data-testid^="feedItem"]') ||
                          link.closest('[data-testid="threadPost"]') ||
                          link.closest('[data-testid="postThreadItem"]') ||
                          link.closest('article') ||
                          link.closest('[data-testid="replyBtn"]')?.parentElement;

    if (inPostContent) return true;

    // For thread views, check if we're in the main content area
    const mainContent = link.closest('main') || link.closest('[data-testid="mainContent"]');
    if (mainContent) {
      // Make sure we're not in a header section within main
      const isInHeader = link.closest('[data-testid="postMeta"]') ||
                         link.closest('header');
      if (!isInHeader) return true;
    }

    return false;
  }

  /**
   * Check if link is a mention (starts with @)
   * @param {HTMLAnchorElement} link
   * @returns {boolean}
   */
  function isMention(link) {
    const text = link.textContent?.trim();
    return text && text.startsWith('@');
  }

  /**
   * Replace a mention link with a profile picture
   * @param {HTMLAnchorElement} link - The mention link
   */
  async function replaceMention(link) {
    // Skip if already processed
    if (processedLinks.has(link)) return;
    processedLinks.add(link);

    const handle = extractHandle(link);
    if (!handle) return;

    // Create placeholder image
    const img = document.createElement('img');
    img.className = 'bppi-avatar bppi-loading';
    img.alt = link.textContent;
    img.title = link.textContent; // Tooltip with @handle

    // Store original text for fallback
    const originalText = link.textContent;

    // Replace link content with image
    link.innerHTML = '';
    link.appendChild(img);

    // Fetch profile and update image
    const profile = await fetchProfile(handle);

    if (profile && profile.avatar) {
      img.src = profile.avatar;
      img.title = `${profile.displayName || handle} (@${handle})`;
      img.classList.remove('bppi-loading');

      img.onload = () => {
        img.classList.add('bppi-loaded');
      };

      img.onerror = () => {
        // Restore original text on image load failure
        link.textContent = originalText;
        processedLinks.delete(link);
      };
    } else {
      // Restore original text if profile fetch failed
      link.textContent = originalText;
      processedLinks.delete(link);
    }
  }

  /**
   * Process all mention links on the page
   */
  function processMentions() {
    // Find all profile links
    const links = document.querySelectorAll('a[href*="/profile/"]');

    const mentionsToProcess = [];

    for (const link of links) {
      // Skip already processed
      if (processedLinks.has(link)) continue;

      // Only process @mentions in posts
      if (!isMention(link)) continue;
      if (!isInPost(link)) continue;

      mentionsToProcess.push(link);
    }

    // Process mentions with requestIdleCallback for performance
    if (mentionsToProcess.length > 0) {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          mentionsToProcess.forEach(link => replaceMention(link));
        });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          mentionsToProcess.forEach(link => replaceMention(link));
        }, 0);
      }
    }
  }

  /**
   * Set up MutationObserver to watch for new content
   */
  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldProcess = true;
          break;
        }
      }

      if (shouldProcess) {
        // Debounce processing
        if (setupObserver.timeout) {
          clearTimeout(setupObserver.timeout);
        }
        setupObserver.timeout = setTimeout(processMentions, 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialize
  function init() {
    console.log('[BPPI] Bluesky Profile Pictures extension loaded');

    // Process existing mentions
    processMentions();

    // Watch for new content (infinite scroll, navigation)
    setupObserver();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
