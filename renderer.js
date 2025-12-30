/**
 * ChitChat - Electron Ollama Chat Client
 *
 * Copyright (c) 2025 David Smith (OnyxDrift)
 * Licensed under the MIT License
 * https://github.com/OnyxDrift/ChitChat
 */

// DOM Elements
const messagesContainer = document.getElementById('messages');
const chatContainer = document.querySelector('.chat-container');
const emptyState = document.getElementById('emptyState');
const chatTitle = document.getElementById('chatTitle');
const infoPromptTokens = document.getElementById('infoPromptTokens');
const infoResponseTokens = document.getElementById('infoResponseTokens');
const infoTotalTokens = document.getElementById('infoTotalTokens');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const settingsButton = document.getElementById('settingsButton');
const settingsMenuModal = document.getElementById('settingsMenuModal');
const closeSettingsMenu = document.getElementById('closeSettingsMenu');
const backendConfigOption = document.getElementById('backendConfigOption');
const systemPromptOption = document.getElementById('systemPromptOption');
const aboutOption = document.getElementById('aboutOption');
const configModal = document.getElementById('configModal');
const systemPromptModal = document.getElementById('systemPromptModal');
const closeSystemPromptModal = document.getElementById('closeSystemPromptModal');
const cancelPromptButton = document.getElementById('cancelPromptButton');
const promptConfigSelect = document.getElementById('promptConfigSelect');
const promptModelSelect = document.getElementById('promptModelSelect');
const systemPromptText = document.getElementById('systemPromptText');
const savePromptButton = document.getElementById('savePromptButton');
const clearPromptButton = document.getElementById('clearPromptButton');
const resetPromptButton = document.getElementById('resetPromptButton');
const promptHistoryButton = document.getElementById('promptHistoryButton');
const promptHistoryModal = document.getElementById('promptHistoryModal');
const closePromptHistoryModal = document.getElementById('closePromptHistoryModal');
const closePromptHistoryButton = document.getElementById('closePromptHistoryButton');
const promptHistoryList = document.getElementById('promptHistoryList');
const promptHistoryConfig = document.getElementById('promptHistoryConfig');
const promptHistoryModel = document.getElementById('promptHistoryModel');
const promptVersionIndicator = document.getElementById('promptVersionIndicator');
const unsavedDraftBadge = document.getElementById('unsavedDraftBadge');
const closeModal = document.getElementById('closeModal');
const cancelButton = document.getElementById('cancelButton');
const configSelect = document.getElementById('configSelect');
const setActiveButton = document.getElementById('setActiveButton');
const deleteConfigButton = document.getElementById('deleteConfigButton');
const configName = document.getElementById('configName');
const configHost = document.getElementById('configHost');
const configPort = document.getElementById('configPort');
const configTurns = document.getElementById('configTurns');
const configDescription = document.getElementById('configDescription');
const saveConfigButton = document.getElementById('saveConfigButton');

// Track original config values for change detection
let originalConfigValues = null;
const backendName = document.getElementById('backendName');
const backendHostContainer = document.getElementById('backendHostContainer');
const backendHost = document.getElementById('backendHost');
const connectionStatusDot = document.getElementById('connectionStatusDot');
const modelSelectorContainer = document.getElementById('modelSelectorContainer');
const modelSelect = document.getElementById('modelSelect');
const currentTime = document.getElementById('currentTime');

// State
let configs = [];
let activeConfigId = null;
let availableModels = [];
let selectedModel = null;

// Get formatted timestamp
function getTimestamp() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// Track the initial spacer height for gradual reduction
let initialSpacerHeight = 0;
let currentSpacerHeight = 0;

// Scroll a message to the top of the chat viewport
function scrollMessageToTop(messageElement) {
  // Check if this is the first question (only current user msg + streaming placeholder exist)
  // Don't add spacer for the first question in a new chat
  const allMessages = messagesContainer.querySelectorAll('.message');
  const isFirstMessage = allMessages.length <= 2; // Just user message + streaming placeholder

  if (isFirstMessage) {
    console.log('First message - no spacer needed');
    return;
  }

  // Add blank space at the bottom to ensure we can scroll
  const viewportHeight = chatContainer.clientHeight;

  // Remove any existing spacer first
  const existingSpacer = document.getElementById('scroll-spacer');
  if (existingSpacer) {
    existingSpacer.remove();
  }

  // Create a spacer element at the bottom
  const spacer = document.createElement('div');
  spacer.id = 'scroll-spacer';
  spacer.style.height = `${viewportHeight}px`;
  spacer.style.flexShrink = '0';
  messagesContainer.appendChild(spacer);

  // Track initial spacer height
  initialSpacerHeight = viewportHeight;
  currentSpacerHeight = viewportHeight;

  console.log('=== Scroll Debug ===');
  console.log('Added spacer height:', viewportHeight);

  // Wait for spacer to render, then scroll with smooth animation
  setTimeout(() => {
    // Recalculate scroll target after spacer is added
    const scrollTarget = messageElement.offsetTop - messagesContainer.offsetTop;

    // Smooth scroll animation
    chatContainer.scrollTo({
      top: scrollTarget,
      behavior: 'smooth'
    });

    console.log('Scroll target:', scrollTarget);
    console.log('Smooth scrolling to:', scrollTarget);
    console.log('===================');
  }, 50);
}

// Reduce spacer as content is added during streaming
function updateSpacerForStreamingContent() {
  const spacer = document.getElementById('scroll-spacer');
  if (!spacer || initialSpacerHeight === 0) return;

  // Aggressively reduce spacer as content is added
  const contentHeight = chatContainer.scrollHeight - chatContainer.clientHeight - currentSpacerHeight;

  // Reduce spacer more aggressively - remove it faster as content grows
  const newSpacerHeight = Math.max(0, initialSpacerHeight - contentHeight);

  if (newSpacerHeight !== currentSpacerHeight) {
    currentSpacerHeight = newSpacerHeight;
    if (newSpacerHeight === 0) {
      spacer.remove();
      initialSpacerHeight = 0;
    } else {
      spacer.style.height = `${newSpacerHeight}px`;
    }
  }
}

// Remove spacer when streaming completes
function removeScrollSpacer() {
  const spacer = document.getElementById('scroll-spacer');
  if (spacer) {
    spacer.remove();
    initialSpacerHeight = 0;
    currentSpacerHeight = 0;
    console.log('Removed scroll spacer after streaming completed');
  }
}

// Update empty state visibility based on message count
function updateEmptyState() {
  const hasMessages = messagesContainer.children.length > 0;
  if (hasMessages) {
    emptyState.classList.add('hidden');
  } else {
    emptyState.classList.remove('hidden');
  }
}

// Add a message to the chat
function addMessage(role, content, metadata = {}) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const roleLabel = document.createElement('div');
  roleLabel.className = 'message-role';
  const roleName = role === 'user' ? 'You' : getModelDisplayName();
  const timestamp = getTimestamp();
  roleLabel.textContent = `${roleName} • ${timestamp}`;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = content;

  // Append in correct order: roleLabel, durationBadge (if exists), contentDiv
  messageDiv.appendChild(roleLabel);

  // Add duration/tokens badge for messages with metadata
  if (metadata.duration || metadata.tokens) {
    const durationBadge = document.createElement('div');
    durationBadge.className = 'response-duration';

    let durationText = '';
    if (metadata.duration) {
      durationText = formatDuration(metadata.duration);
    }
    if (metadata.tokens) {
      durationText += durationText ? ` • ${metadata.tokens} tokens` : `${metadata.tokens} tokens`;
    }

    durationBadge.innerHTML = `<span class="duration-text">${durationText}</span>`;
    messageDiv.appendChild(durationBadge);
  }

  messageDiv.appendChild(contentDiv);
  messagesContainer.appendChild(messageDiv);

  // Update empty state visibility
  updateEmptyState();

  // Don't auto-scroll - let custom scroll logic handle positioning

  return messageDiv;
}

// Get display name from model (e.g., "gemma3:latest" -> "Gemma3")
function getModelDisplayName() {
  if (!selectedModel) return 'Assistant';

  // Extract name before colon
  const modelName = selectedModel.split(':')[0];

  // Capitalize first letter
  return modelName.charAt(0).toUpperCase() + modelName.slice(1);
}

// Create an assistant message that can be updated during streaming
function createStreamingMessage(startTime) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant';

  const roleLabel = document.createElement('div');
  roleLabel.className = 'message-role';
  const displayName = getModelDisplayName();
  roleLabel.textContent = displayName;

  // Create duration badge on the right
  const durationBadge = document.createElement('div');
  durationBadge.className = 'response-duration';
  durationBadge.innerHTML = `
    <span class="duration-text">0ms</span>
  `;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  // Add loading indicator
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'loading-indicator';
  loadingIndicator.innerHTML = '<span class="loading-dot"></span><span class="loading-dot"></span><span class="loading-dot"></span>';
  contentDiv.appendChild(loadingIndicator);

  messageDiv.appendChild(roleLabel);
  messageDiv.appendChild(durationBadge);
  messageDiv.appendChild(contentDiv);
  messagesContainer.appendChild(messageDiv);

  // Don't auto-scroll during streaming - let user read at their own pace

  // Update duration counter while waiting
  const durationSpan = durationBadge.querySelector('.duration-text');
  const updateInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    durationSpan.textContent = formatDuration(elapsed);
  }, 100);

  return { contentDiv, messageDiv, loadingIndicator, roleLabel, updateInterval, durationBadge };
}

// Format duration for display
function formatDuration(milliseconds) {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  const totalSeconds = Math.floor(milliseconds / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m${secs}s`;
}

// Update streaming message content
function updateStreamingMessage(elements, text, startTime = null, tokens = 0) {
  // Remove loading indicator on first update and add timestamp
  if (elements.loadingIndicator && elements.loadingIndicator.parentNode) {
    elements.loadingIndicator.remove();

    // Stop the duration counter and finalize duration display
    if (elements.updateInterval) {
      clearInterval(elements.updateInterval);
    }

    if (startTime) {
      const elapsed = Date.now() - startTime;
      const timestamp = getTimestamp();
      const displayName = getModelDisplayName();

      // Update role label with timestamp
      elements.roleLabel.textContent = `${displayName} • ${timestamp}`;

      // Update duration badge with final duration
      if (elements.durationBadge) {
        const durationSpan = elements.durationBadge.querySelector('.duration-text');
        if (durationSpan) {
          durationSpan.textContent = formatDuration(elapsed);
        }
      }
    }
  }

  // Update token count if available
  if (tokens > 0 && elements.durationBadge) {
    const durationSpan = elements.durationBadge.querySelector('.duration-text');
    if (durationSpan) {
      const currentDuration = durationSpan.textContent;
      durationSpan.textContent = `${currentDuration} • ${tokens} tokens`;
    }
  }

  elements.contentDiv.textContent = text;

  // Gradually reduce spacer as content streams in
  updateSpacerForStreamingContent();

  // Don't auto-scroll during streaming - let user read at their own pace
}

// Handle sending a message
async function handleSendMessage() {
  const message = messageInput.value.trim();

  if (!message) {
    return;
  }

  // Check if backend is configured
  const config = getActiveConfig();
  if (!config || !selectedModel) {
    addMessage('assistant', 'Please configure a backend and select a model first.');
    return;
  }

  // Check if server is reachable (quick pre-flight check)
  const statusDotDisconnected = connectionStatusDot.classList.contains('disconnected');
  if (statusDotDisconnected) {
    addMessage('assistant',
      `⚠️ Cannot connect to Ollama server at ${config.host}:${config.port}\n\n` +
      `The status indicator shows the server is currently unreachable.\n\n` +
      `Please check that:\n` +
      `• Ollama is running\n` +
      `• The server address and port are correct in Settings\n` +
      `• Your network connection is active\n\n` +
      `The connection status is checked automatically every 30 seconds.`
    );
    return;
  }

  // Add user message to chat
  const userMessageElement = addMessage('user', message);

  // Add to conversation history (will update with tokens later)
  addMessageToConversation('user', message);

  // Clear input
  messageInput.value = '';

  // Disable send button while processing
  sendButton.disabled = true;

  // Track request start time
  const requestStartTime = Date.now();

  // Create streaming message with live duration counter
  const messageElements = createStreamingMessage(requestStartTime);

  // NOW scroll after streaming placeholder is added (gives enough height to scroll properly)
  // But still calculate based on historical conversation only
  scrollMessageToTop(userMessageElement);
  let fullResponse = '';
  let responseTokens = 0;
  let promptTokens = 0;
  let firstChunkReceived = false;
  let firstChunkTime = null;

  // Build messages array with context
  const contextTurns = config.contextTurns !== undefined ? config.contextTurns : 10;
  const messagesToSend = [];

  // Get system prompt if one exists for this config and model
  const systemPrompt = getSystemPrompt(activeConfigId, selectedModel);

  // Add system prompt as first message if it exists
  if (systemPrompt) {
    messagesToSend.push({
      role: 'system',
      content: systemPrompt
    });
  }

  if (currentConversation && currentConversation.messages.length > 0 && contextTurns > 0) {
    // Get last N turns (each turn = user + assistant pair)
    // Take last (contextTurns * 2) messages to get N complete turns
    const contextMessages = currentConversation.messages.slice(-(contextTurns * 2));
    messagesToSend.push(...contextMessages.map(m => ({ role: m.role, content: m.content })));
  }

  // Add current user message
  messagesToSend.push({
    role: 'user',
    content: message
  });

  try {
    const url = `http://${config.host}:${config.port}/api/chat`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: messagesToSend,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);

          if (data.message && data.message.content) {
            fullResponse += data.message.content;

            // Pass startTime only on first chunk
            if (!firstChunkReceived) {
              firstChunkTime = Date.now() - requestStartTime;
              updateStreamingMessage(messageElements, fullResponse, requestStartTime);
              firstChunkReceived = true;
            } else {
              updateStreamingMessage(messageElements, fullResponse);
            }
          }

          // Capture and display token count from final chunk
          if (data.done) {
            if (data.eval_count) {
              responseTokens = data.eval_count;
              // Update the duration line with token count
              if (messageElements.durationBadge) {
                const durationSpan = messageElements.durationBadge.querySelector('.duration-text');
                if (durationSpan && !durationSpan.textContent.includes('tokens')) {
                  durationSpan.textContent = `${durationSpan.textContent} • ${responseTokens} tokens`;
                }
              }
            }
            if (data.prompt_eval_count) {
              promptTokens = data.prompt_eval_count;
            }
          }
        } catch (e) {
          console.error('Error parsing JSON:', e, 'Line:', line);
        }
      }
    }

    // Update user message with prompt token count
    if (promptTokens > 0 && userMessageElement) {
      // Add token badge to user message
      const tokenBadge = document.createElement('div');
      tokenBadge.className = 'response-duration';
      tokenBadge.innerHTML = `<span class="duration-text">${promptTokens} tokens</span>`;

      // Insert after role label
      const roleLabel = userMessageElement.querySelector('.message-role');
      if (roleLabel && roleLabel.nextSibling) {
        userMessageElement.insertBefore(tokenBadge, roleLabel.nextSibling);
      } else if (roleLabel) {
        roleLabel.after(tokenBadge);
      }

      // Update the user message in conversation history with token count
      if (currentConversation && currentConversation.messages.length > 0) {
        // Get the last message (should be the user message we just added)
        const lastMessage = currentConversation.messages[currentConversation.messages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
          lastMessage.tokens = promptTokens;
          saveConversations();
        }
      }
    }

    // Add assistant response to conversation history
    if (fullResponse) {
      addMessageToConversation('assistant', fullResponse, {
        duration: firstChunkTime,
        tokens: responseTokens
      });
    }

  } catch (error) {
    console.error('Error sending message:', error);

    // Immediately update connection status on connection errors
    if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
      connectionStatusDot.classList.remove('hidden', 'connected');
      connectionStatusDot.classList.add('disconnected');
    }

    // Provide user-friendly error messages
    let errorMessage = '';

    if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
      errorMessage = `Unable to connect to Ollama server at ${config.host}:${config.port}\n\n` +
                     `Please check that:\n` +
                     `• Ollama is running\n` +
                     `• The server address and port are correct\n` +
                     `• Your network connection is active\n\n` +
                     `Check the status indicator (●) in the bottom bar for connection status.`;
    } else if (error.message.includes('HTTP error')) {
      errorMessage = `Server error: ${error.message}\n\n` +
                     `The Ollama server returned an error. Please try again or check the server logs.`;
    } else {
      errorMessage = `An error occurred: ${error.message}\n\n` +
                     `Please try again. If the problem persists, check the console for details.`;
    }

    updateStreamingMessage(messageElements, errorMessage, requestStartTime, 0);
  } finally {
    // Remove the scroll spacer when streaming is complete
    removeScrollSpacer();

    sendButton.disabled = false;
    messageInput.focus();
  }
}

// Event listeners
sendButton.addEventListener('click', handleSendMessage);

messageInput.addEventListener('keydown', (e) => {
  // Send on Enter, new line on Shift+Enter
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
});

// Focus input on load
messageInput.focus();

// ============================================================
// Left Panel
// ============================================================

const leftPanel = document.getElementById('leftPanel');
const panelTab = document.querySelector('.panel-tab');
const newChatButton = document.getElementById('newChatButton');
let panelTimeout;

// Function to center panel and tab vertically
function centerPanelVertically() {
  const inputContainer = document.querySelector('.input-container');
  const statusBar = document.querySelector('.status-bar');

  const inputRect = inputContainer.getBoundingClientRect();
  const statusRect = statusBar.getBoundingClientRect();

  // Calculate available space above input
  const availableSpace = inputRect.top;

  // Get panel height
  const panelRect = leftPanel.getBoundingClientRect();
  const panelHeight = panelRect.height;

  // Center panel in available space
  const panelTop = (availableSpace - panelHeight) / 2;
  leftPanel.style.top = `${panelTop}px`;

  // Center tab on panel
  const panelCenterY = panelTop + (panelHeight / 2) - 30; // 30 is half of tab height
  panelTab.style.top = `${panelCenterY}px`;

  // Center empty state logo at the same vertical position as the tab
  const emptyStateLogo = emptyState;
  if (emptyStateLogo) {
    // Position empty state at the same vertical center as the panel tab (plus 30px to account for tab height)
    const emptyCenterY = panelCenterY + 30; // Add back the 30 we subtracted for tab positioning
    emptyStateLogo.style.top = `${emptyCenterY}px`;
  }
}

// Initial positioning with slower animation
panelTab.style.transition = 'left 0.45s ease, top 0.45s ease, opacity 0.45s ease, background-color 0.2s, color 0.2s';
leftPanel.style.transition = 'transform 0.45s ease, top 0.45s ease';
centerPanelVertically();

// After initial animation, switch to faster transitions for normal operation
setTimeout(() => {
  panelTab.style.transition = 'left 0.3s ease, top 0.3s ease, opacity 0.3s ease, background-color 0.2s, color 0.2s';
  leftPanel.style.transition = 'transform 0.3s ease, top 0.3s ease';
  emptyState.style.transition = 'top 0.3s ease, opacity 0.3s ease';
}, 450);

// Recalculate positions on window resize
window.addEventListener('resize', centerPanelVertically);

// New Chat functionality
newChatButton.addEventListener('click', () => {
  if (confirm('Start a new chat? This will clear the current conversation.')) {
    messagesContainer.innerHTML = '';
    updateEmptyState();
    createNewConversation();
  }
});

const inputContainer = document.querySelector('.input-container');

document.addEventListener('mousemove', (e) => {
  // Get the input container's position
  const inputRect = inputContainer.getBoundingClientRect();
  const deadZoneHeight = 20; // Gap above input area

  // Check if mouse is in the input area or dead zone
  const isInInputArea = e.clientY >= (inputRect.top - deadZoneHeight);

  // Get the panel tab's vertical position
  const tabRect = panelTab.getBoundingClientRect();
  const verticalBuffer = 100; // Vertical range above and below the tab
  const isInVerticalRange = e.clientY >= (tabRect.top - verticalBuffer) &&
                           e.clientY <= (tabRect.bottom + verticalBuffer);

  // Show panel if cursor is within 65px of left edge AND in vertical range AND not in input area
  if (e.clientX <= 65 && isInVerticalRange && !isInInputArea) {
    // Hide tab immediately when opening panel
    panelTab.style.opacity = '0';
    panelTab.style.pointerEvents = 'none';

    // Show panel
    leftPanel.classList.add('visible');

    // Clear any pending hide timeout
    if (panelTimeout) {
      clearTimeout(panelTimeout);
      panelTimeout = null;
    }
  } else if (e.clientX > 85) {
    // Hide panel if cursor moves away from panel area
    // Add a small delay before hiding
    if (!panelTimeout) {
      panelTimeout = setTimeout(() => {
        // Start closing panel
        leftPanel.classList.remove('visible');

        // Wait for panel to fully close before showing tab
        setTimeout(() => {
          panelTab.style.opacity = '1';
          panelTab.style.pointerEvents = 'auto';
        }, 300); // Match panel transition duration

        panelTimeout = null;
      }, 300);
    }
  }
});

// Hide panel when mouse leaves the window
document.addEventListener('mouseleave', () => {
  leftPanel.classList.remove('visible');

  // Show tab after panel closes
  setTimeout(() => {
    panelTab.style.opacity = '1';
    panelTab.style.pointerEvents = 'auto';
  }, 300);

  // Clear any pending timeout
  if (panelTimeout) {
    clearTimeout(panelTimeout);
    panelTimeout = null;
  }
});

// Hide panel when window loses focus
window.addEventListener('blur', () => {
  leftPanel.classList.remove('visible');

  // Show tab after panel closes
  setTimeout(() => {
    panelTab.style.opacity = '1';
    panelTab.style.pointerEvents = 'auto';
  }, 300);

  // Clear any pending timeout
  if (panelTimeout) {
    clearTimeout(panelTimeout);
    panelTimeout = null;
  }
});

// ============================================================
// Configuration Management
// ============================================================

function loadConfigs() {
  const stored = localStorage.getItem('backendConfigs');
  configs = stored ? JSON.parse(stored) : [];
  const storedActiveId = localStorage.getItem('activeConfigId');
  activeConfigId = storedActiveId || null;
}

function saveConfigs() {
  localStorage.setItem('backendConfigs', JSON.stringify(configs));
  if (activeConfigId) {
    localStorage.setItem('activeConfigId', activeConfigId);
  } else {
    localStorage.removeItem('activeConfigId');
  }
}

function getActiveConfig() {
  return configs.find(c => c.id === activeConfigId) || null;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function updateConfigDropdown() {
  configSelect.innerHTML = '';

  if (configs.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '-- No configurations --';
    configSelect.appendChild(option);
    setActiveButton.disabled = true;
    deleteConfigButton.disabled = true;
  } else {
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '-- Select or create new --';
    configSelect.appendChild(emptyOption);

    configs.forEach(config => {
      const option = document.createElement('option');
      option.value = config.id;
      const activeMarker = config.id === activeConfigId ? ' (Active)' : '';
      option.textContent = config.name + activeMarker;
      configSelect.appendChild(option);
    });

    const selectedId = configSelect.value;
    setActiveButton.disabled = !selectedId || selectedId === activeConfigId;
    deleteConfigButton.disabled = !selectedId;
  }
}

function clearConfigForm() {
  configName.value = '';
  configHost.value = '';
  configPort.value = '11434';
  configTurns.value = '10';
  configDescription.value = '';
  configSelect.value = '';
  deleteConfigButton.disabled = true;
  originalConfigValues = null;
  updateSaveButtonState();
  updateCancelButtonText();
}

function loadConfigIntoForm(config) {
  configName.value = config.name;
  configHost.value = config.host;
  configPort.value = config.port;
  configTurns.value = config.contextTurns !== undefined ? config.contextTurns : '10';
  configDescription.value = config.description || '';

  // Store original values for change detection
  originalConfigValues = {
    name: config.name,
    host: config.host,
    port: config.port,
    turns: config.contextTurns !== undefined ? String(config.contextTurns) : '10',
    description: config.description || ''
  };

  updateSaveButtonState();
  updateCancelButtonText();
}

// Check if form has been modified
function hasFormChanged() {
  if (!originalConfigValues) {
    // New config - enable if any required field has value
    return configName.value.trim() || configHost.value.trim() || configPort.value.trim();
  }

  // Existing config - check if any field changed
  return configName.value !== originalConfigValues.name ||
         configHost.value !== originalConfigValues.host ||
         configPort.value !== originalConfigValues.port ||
         configTurns.value !== originalConfigValues.turns ||
         configDescription.value !== originalConfigValues.description;
}

// Update save button state based on changes
function updateSaveButtonState() {
  const hasChanges = hasFormChanged();
  saveConfigButton.disabled = !hasChanges && originalConfigValues !== null;

  if (hasChanges) {
    saveConfigButton.classList.add('btn-modified');
  } else {
    saveConfigButton.classList.remove('btn-modified');
  }
}

// Update cancel button text based on changes
function updateCancelButtonText() {
  const hasChanges = hasFormChanged();
  cancelButton.textContent = hasChanges ? 'Cancel' : 'Close';
}

// ============================================================
// Settings Menu
// ============================================================

settingsButton.addEventListener('click', () => {
  settingsMenuModal.classList.remove('hidden');
});

closeSettingsMenu.addEventListener('click', () => {
  settingsMenuModal.classList.add('hidden');
});

settingsMenuModal.addEventListener('click', (e) => {
  if (e.target === settingsMenuModal) {
    settingsMenuModal.classList.add('hidden');
  }
});

backendConfigOption.addEventListener('click', () => {
  settingsMenuModal.classList.add('hidden');
  openConfigModal();
});

systemPromptOption.addEventListener('click', () => {
  settingsMenuModal.classList.add('hidden');
  openSystemPromptModal();
});

aboutOption.addEventListener('click', () => {
  settingsMenuModal.classList.add('hidden');
  alert('ChitChat - An Electron chat application powered by Ollama\n\nVersion 1.0.0');
});

persistenceManagementOption.addEventListener('click', () => {
  settingsMenuModal.classList.add('hidden');
  openPersistenceManagementModal();
});

// ============================================================
// Persistence Management
// ============================================================

const persistenceManagementModal = document.getElementById('persistenceManagementModal');
const closePersistenceManagementModal = document.getElementById('closePersistenceManagementModal');
const deleteChatPersistenceOption = document.getElementById('deleteChatPersistenceOption');
const deleteConfirmationModal = document.getElementById('deleteConfirmationModal');
const closeDeleteConfirmationModal = document.getElementById('closeDeleteConfirmationModal');
const confirmDeleteButton = document.getElementById('confirmDeleteButton');
const cancelDeleteButton = document.getElementById('cancelDeleteButton');

function openPersistenceManagementModal() {
  persistenceManagementModal.classList.remove('hidden');
}

closePersistenceManagementModal.addEventListener('click', () => {
  persistenceManagementModal.classList.add('hidden');
});

persistenceManagementModal.addEventListener('click', (e) => {
  if (e.target === persistenceManagementModal) {
    persistenceManagementModal.classList.add('hidden');
  }
});

deleteChatPersistenceOption.addEventListener('click', () => {
  persistenceManagementModal.classList.add('hidden');
  deleteConfirmationModal.classList.remove('hidden');
});

closeDeleteConfirmationModal.addEventListener('click', () => {
  deleteConfirmationModal.classList.add('hidden');
});

cancelDeleteButton.addEventListener('click', () => {
  deleteConfirmationModal.classList.add('hidden');
});

deleteConfirmationModal.addEventListener('click', (e) => {
  if (e.target === deleteConfirmationModal) {
    deleteConfirmationModal.classList.add('hidden');
  }
});

confirmDeleteButton.addEventListener('click', () => {
  // Delete all chat history and pinned conversations
  localStorage.removeItem('conversations');
  localStorage.removeItem('pinnedConversations');

  // Clear the current conversation
  conversations = [];
  currentConversation = null;

  // Clear the messages display
  messagesContainer.innerHTML = '';
  updateEmptyState();

  // Update the chat title
  chatTitle.textContent = 'New Chat';

  // Close the modal
  deleteConfirmationModal.classList.add('hidden');

  console.log('All chat persistence deleted');
  alert('All chat history and pinned conversations have been deleted.');
});

// ============================================================
// Modal Management
// ============================================================

function openConfigModal() {
  updateConfigDropdown();

  // Load active config if it exists, otherwise clear form
  if (activeConfigId) {
    const activeConfig = configs.find(c => c.id === activeConfigId);
    if (activeConfig) {
      configSelect.value = activeConfigId;
      loadConfigIntoForm(activeConfig);
      deleteConfigButton.disabled = false;
    } else {
      clearConfigForm();
    }
  } else {
    clearConfigForm();
  }

  configModal.classList.remove('hidden');
}

function closeConfigModal() {
  configModal.classList.add('hidden');
}

closeModal.addEventListener('click', closeConfigModal);
cancelButton.addEventListener('click', closeConfigModal);

configModal.addEventListener('click', (e) => {
  if (e.target === configModal) {
    closeConfigModal();
  }
});

closeSystemPromptModal.addEventListener('click', closeSystemPromptModalFunc);
cancelPromptButton.addEventListener('click', closeSystemPromptModalFunc);

systemPromptModal.addEventListener('click', (e) => {
  if (e.target === systemPromptModal) {
    closeSystemPromptModalFunc();
  }
});

function closeSystemPromptModalFunc() {
  systemPromptModal.classList.add('hidden');
}

closePromptHistoryModal.addEventListener('click', closePromptHistoryModalFunc);
closePromptHistoryButton.addEventListener('click', closePromptHistoryModalFunc);

promptHistoryModal.addEventListener('click', (e) => {
  if (e.target === promptHistoryModal) {
    closePromptHistoryModalFunc();
  }
});

function closePromptHistoryModalFunc() {
  promptHistoryModal.classList.add('hidden');
}

// Add input event listeners for change detection
[configName, configHost, configPort, configTurns, configDescription].forEach(field => {
  field.addEventListener('input', () => {
    updateSaveButtonState();
    updateCancelButtonText();
  });
});

configSelect.addEventListener('change', () => {
  const selectedId = configSelect.value;
  if (selectedId) {
    const config = configs.find(c => c.id === selectedId);
    if (config) {
      loadConfigIntoForm(config);
      setActiveButton.disabled = selectedId === activeConfigId;
      deleteConfigButton.disabled = false;
    }
  } else {
    clearConfigForm();
    setActiveButton.disabled = true;
    deleteConfigButton.disabled = true;
  }
});

setActiveButton.addEventListener('click', () => {
  const selectedId = configSelect.value;
  if (!selectedId) return;

  activeConfigId = selectedId;
  saveConfigs();
  updateConfigDropdown();
  updateStatusBar();

  alert('Active backend configuration updated!');
});

saveConfigButton.addEventListener('click', () => {
  const name = configName.value.trim();
  const host = configHost.value.trim();
  const port = configPort.value.trim();
  const turns = configTurns.value !== '' ? parseInt(configTurns.value) : 10;
  const description = configDescription.value.trim();

  if (!name || !host || !port) {
    alert('Please fill in all required fields (Name, Host, Port)');
    return;
  }

  const selectedId = configSelect.value;
  let configIdToLoad = selectedId;

  if (selectedId) {
    // Update existing config
    const config = configs.find(c => c.id === selectedId);
    if (config) {
      config.name = name;
      config.host = host;
      config.port = port;
      config.contextTurns = turns;
      config.description = description;
    }
  } else {
    // Create new config
    const newConfig = {
      id: generateId(),
      name,
      host,
      port,
      contextTurns: turns,
      description
    };
    configs.push(newConfig);
    configIdToLoad = newConfig.id;

    // Auto-select new config if it's the first one
    if (configs.length === 1) {
      activeConfigId = newConfig.id;
    }
  }

  saveConfigs();
  updateConfigDropdown();
  updateStatusBar();

  // Reload the saved config into the form and set dropdown
  const savedConfig = configs.find(c => c.id === configIdToLoad);
  if (savedConfig) {
    configSelect.value = savedConfig.id;
    loadConfigIntoForm(savedConfig);
    deleteConfigButton.disabled = false;
  }

  // If this is the active config, fetch models
  if (selectedId === activeConfigId || configs.length === 1) {
    fetchAvailableModels();
  }

  alert('Configuration saved!');
});

deleteConfigButton.addEventListener('click', () => {
  const selectedId = configSelect.value;
  if (!selectedId) return;

  const config = configs.find(c => c.id === selectedId);
  if (!config) return;

  if (confirm(`Are you sure you want to delete "${config.name}"?`)) {
    configs = configs.filter(c => c.id !== selectedId);

    // If we deleted the active config, clear it
    if (activeConfigId === selectedId) {
      activeConfigId = null;
      availableModels = [];
      selectedModel = null;
    }

    saveConfigs();
    updateConfigDropdown();
    updateStatusBar();
    clearConfigForm();
  }
});

// ============================================================
// System Prompt Management
// ============================================================

// Track original prompt value for change detection
let originalPromptValue = '';

// Load system prompts from localStorage
function loadSystemPrompts() {
  const stored = localStorage.getItem('systemPrompts');
  return stored ? JSON.parse(stored) : {};
}

// Save system prompts to localStorage
function saveSystemPrompts(prompts) {
  localStorage.setItem('systemPrompts', JSON.stringify(prompts));
}

// Get system prompt for a specific config and model
function getSystemPrompt(configId, modelName) {
  const prompts = loadSystemPrompts();
  const key = `${configId}::${modelName}`;
  return prompts[key] || '';
}

// Set system prompt for a specific config and model
function setSystemPrompt(configId, modelName, prompt) {
  const prompts = loadSystemPrompts();
  const key = `${configId}::${modelName}`;
  if (prompt && prompt.trim()) {
    prompts[key] = prompt.trim();
    // Add to history
    addPromptToHistory(configId, modelName, prompt.trim());
  } else {
    delete prompts[key];
  }
  saveSystemPrompts(prompts);
}

// Load prompt history from localStorage
function loadPromptHistory() {
  const stored = localStorage.getItem('systemPromptHistory');
  return stored ? JSON.parse(stored) : {};
}

// Save prompt history to localStorage
function savePromptHistory(history) {
  localStorage.setItem('systemPromptHistory', JSON.stringify(history));
}

// Add prompt to history
function addPromptToHistory(configId, modelName, prompt) {
  const history = loadPromptHistory();
  const key = `${configId}::${modelName}`;

  if (!history[key]) {
    history[key] = [];
  }

  // Add new entry with timestamp
  history[key].unshift({
    prompt: prompt,
    timestamp: Date.now()
  });

  // Keep only last 50 entries per config+model
  if (history[key].length > 50) {
    history[key] = history[key].slice(0, 50);
  }

  savePromptHistory(history);
}

// Get prompt history for a specific config and model
function getPromptHistory(configId, modelName) {
  const history = loadPromptHistory();
  const key = `${configId}::${modelName}`;
  return history[key] || [];
}

// Update button states based on current selection and changes
function updatePromptButtonStates() {
  const configId = promptConfigSelect.value;
  const modelName = promptModelSelect.value;
  const currentPrompt = systemPromptText.value;

  const hasSelection = configId && modelName;
  const hasChanges = currentPrompt !== originalPromptValue;

  // Save button: enabled only if has selection AND has changes
  savePromptButton.disabled = !hasSelection || !hasChanges;

  // Clear/Reset button logic: show Clear when unchanged, Reset when changed
  if (hasChanges) {
    // Show Reset button when there are changes
    clearPromptButton.classList.add('hidden');
    resetPromptButton.classList.remove('hidden');
    resetPromptButton.disabled = false;
  } else {
    // Show Clear button when unchanged
    resetPromptButton.classList.add('hidden');
    clearPromptButton.classList.remove('hidden');
    clearPromptButton.disabled = !hasSelection;
  }

  // Update Save button appearance if modified
  if (hasChanges && hasSelection) {
    savePromptButton.classList.add('btn-modified');
  } else {
    savePromptButton.classList.remove('btn-modified');
  }
}

async function openSystemPromptModal() {
  // Populate config dropdown
  promptConfigSelect.innerHTML = '<option value="">-- Select Configuration --</option>';
  configs.forEach(config => {
    const option = document.createElement('option');
    option.value = config.id;
    option.textContent = config.name;
    if (config.id === activeConfigId) {
      option.selected = true;
    }
    promptConfigSelect.appendChild(option);
  });

  // Clear model dropdown and prompt text
  promptModelSelect.innerHTML = '<option value="">-- Select Model --</option>';
  systemPromptText.value = '';
  originalPromptValue = '';

  // Hide version indicator and unsaved badge
  promptVersionIndicator.classList.add('hidden');
  unsavedDraftBadge.classList.add('hidden');

  // If there's an active config, load its models
  if (activeConfigId) {
    await loadModelsForPromptConfig(activeConfigId);

    // Set the currently selected model as default if it exists
    if (selectedModel) {
      promptModelSelect.value = selectedModel;

      // Load the system prompt for this model
      const prompt = getSystemPrompt(activeConfigId, selectedModel);
      systemPromptText.value = prompt;
      originalPromptValue = prompt;

      // Show version info if prompt exists
      if (prompt) {
        const history = getPromptHistory(activeConfigId, selectedModel);
        if (history.length > 0) {
          const currentVersion = history.length;
          const latestEntry = history[0];
          const date = new Date(latestEntry.timestamp);
          const dateStr = date.toLocaleString();

          promptVersionIndicator.textContent = `v${currentVersion} • ${dateStr}`;
          promptVersionIndicator.classList.remove('hidden');
        }
      }
    }
  }

  // Update button states
  updatePromptButtonStates();

  systemPromptModal.classList.remove('hidden');
}

async function loadModelsForPromptConfig(configId) {
  const config = configs.find(c => c.id === configId);
  if (!config) return;

  promptModelSelect.innerHTML = '<option value="">Loading...</option>';
  promptModelSelect.disabled = true;

  try {
    const url = `http://${config.host}:${config.port}/api/tags`;
    const response = await fetch(url);
    const data = await response.json();

    promptModelSelect.innerHTML = '<option value="">-- Select Model --</option>';

    if (data.models && data.models.length > 0) {
      data.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = model.name;
        promptModelSelect.appendChild(option);
      });
      promptModelSelect.disabled = false;
    } else {
      promptModelSelect.innerHTML = '<option value="">No models available</option>';
    }
  } catch (error) {
    console.error('Error fetching models:', error);
    promptModelSelect.innerHTML = '<option value="">Error loading models</option>';
  }
}

// Handle config selection change
promptConfigSelect.addEventListener('change', () => {
  const configId = promptConfigSelect.value;
  systemPromptText.value = '';
  originalPromptValue = '';

  // Hide version indicator and unsaved badge
  promptVersionIndicator.classList.add('hidden');
  unsavedDraftBadge.classList.add('hidden');

  if (configId) {
    loadModelsForPromptConfig(configId);
  } else {
    promptModelSelect.innerHTML = '<option value="">-- Select Model --</option>';
  }

  updatePromptButtonStates();
});

// Handle model selection change
promptModelSelect.addEventListener('change', () => {
  const configId = promptConfigSelect.value;
  const modelName = promptModelSelect.value;

  // Hide version indicator and unsaved badge initially
  promptVersionIndicator.classList.add('hidden');
  unsavedDraftBadge.classList.add('hidden');

  if (configId && modelName) {
    const prompt = getSystemPrompt(configId, modelName);
    systemPromptText.value = prompt;
    originalPromptValue = prompt;

    // Show version info if prompt exists
    if (prompt) {
      const history = getPromptHistory(configId, modelName);
      if (history.length > 0) {
        const currentVersion = history.length;
        const latestEntry = history[0];
        const date = new Date(latestEntry.timestamp);
        const dateStr = date.toLocaleString();

        promptVersionIndicator.textContent = `v${currentVersion} • ${dateStr}`;
        promptVersionIndicator.classList.remove('hidden');
      }
    }
  } else {
    systemPromptText.value = '';
    originalPromptValue = '';
  }

  updatePromptButtonStates();
});

// Handle textarea input for change detection
systemPromptText.addEventListener('input', () => {
  // Show unsaved draft badge when user makes changes
  const hasChanges = systemPromptText.value !== originalPromptValue;
  if (hasChanges) {
    unsavedDraftBadge.classList.remove('hidden');
    // Hide version indicator when editing
    promptVersionIndicator.classList.add('hidden');
  } else {
    unsavedDraftBadge.classList.add('hidden');
    // Show version indicator again if back to original
    const configId = promptConfigSelect.value;
    const modelName = promptModelSelect.value;
    if (configId && modelName && originalPromptValue) {
      const history = getPromptHistory(configId, modelName);
      if (history.length > 0) {
        const currentVersion = history.length;
        const latestEntry = history[0];
        const date = new Date(latestEntry.timestamp);
        const dateStr = date.toLocaleString();
        promptVersionIndicator.textContent = `v${currentVersion} • ${dateStr}`;
        promptVersionIndicator.classList.remove('hidden');
      }
    }
  }

  updatePromptButtonStates();
});

// Handle save button
savePromptButton.addEventListener('click', () => {
  const configId = promptConfigSelect.value;
  const modelName = promptModelSelect.value;
  const prompt = systemPromptText.value;

  if (!configId) {
    alert('Please select a server configuration');
    return;
  }

  if (!modelName) {
    alert('Please select a model');
    return;
  }

  setSystemPrompt(configId, modelName, prompt);

  // Update original value to current value
  originalPromptValue = prompt;

  // Hide unsaved badge
  unsavedDraftBadge.classList.add('hidden');

  // Update version indicator to show new version
  const history = getPromptHistory(configId, modelName);
  if (history.length > 0) {
    const currentVersion = history.length;
    const latestEntry = history[0];
    const date = new Date(latestEntry.timestamp);
    const dateStr = date.toLocaleString();

    promptVersionIndicator.textContent = `v${currentVersion} • ${dateStr}`;
    promptVersionIndicator.classList.remove('hidden');
  }

  // Update button states
  updatePromptButtonStates();

  alert('System prompt saved successfully!');
});

// Handle clear button
clearPromptButton.addEventListener('click', () => {
  if (confirm('Clear the system prompt? This will remove all text.')) {
    // Clear the textarea
    systemPromptText.value = '';

    // Update original value to empty
    originalPromptValue = '';

    // Hide unsaved badge
    unsavedDraftBadge.classList.add('hidden');

    // Hide version indicator
    promptVersionIndicator.classList.add('hidden');

    // Update button states
    updatePromptButtonStates();
  }
});

// Handle reset button
resetPromptButton.addEventListener('click', () => {
  if (confirm('Reset to the original saved version? All unsaved changes will be lost.')) {
    // Reset text to original saved version
    systemPromptText.value = originalPromptValue;

    // Hide unsaved badge
    unsavedDraftBadge.classList.add('hidden');

    // Show version indicator again if there's a saved version
    const configId = promptConfigSelect.value;
    const modelName = promptModelSelect.value;
    if (configId && modelName && originalPromptValue) {
      const history = getPromptHistory(configId, modelName);
      if (history.length > 0) {
        const currentVersion = history.length;
        const latestEntry = history[0];
        const date = new Date(latestEntry.timestamp);
        const dateStr = date.toLocaleString();
        promptVersionIndicator.textContent = `v${currentVersion} • ${dateStr}`;
        promptVersionIndicator.classList.remove('hidden');
      }
    }

    // Update button states
    updatePromptButtonStates();
  }
});

// Handle history button
promptHistoryButton.addEventListener('click', () => {
  const configId = promptConfigSelect.value;
  const modelName = promptModelSelect.value;

  if (!configId || !modelName) {
    alert('Please select a server configuration and model to view history');
    return;
  }

  openPromptHistoryModal(configId, modelName);
});

// Open and display prompt history
function openPromptHistoryModal(configId, modelName) {
  const config = configs.find(c => c.id === configId);
  const configName = config ? config.name : configId;

  // Set header info
  promptHistoryConfig.textContent = `Config: ${configName}`;
  promptHistoryModel.textContent = `Model: ${modelName}`;

  // Get history for this config+model
  const history = getPromptHistory(configId, modelName);

  // Get current saved system prompt to check which one is active
  const currentSavedPrompt = getSystemPrompt(configId, modelName);

  // Clear existing list
  promptHistoryList.innerHTML = '';

  if (history.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.style.textAlign = 'center';
    emptyMessage.style.padding = '20px';
    emptyMessage.style.color = '#808080';
    emptyMessage.textContent = 'No history available for this model';
    promptHistoryList.appendChild(emptyMessage);
  } else {
    history.forEach((entry, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'conversation-item has-pin';

      // Check if this is the active (currently saved) prompt
      const isActive = entry.prompt === currentSavedPrompt;

      // Add pin icon
      const pinIcon = document.createElement('img');
      pinIcon.src = 'assets/thumbtack.svg';
      pinIcon.className = 'prompt-history-pin';
      if (isActive) {
        pinIcon.classList.add('active');
      }

      const titleDiv = document.createElement('div');
      titleDiv.className = 'conversation-title';

      // Show first 100 characters of prompt as preview
      const preview = entry.prompt.length > 100
        ? entry.prompt.substring(0, 100) + '...'
        : entry.prompt;
      titleDiv.textContent = preview;

      const metaDiv = document.createElement('div');
      metaDiv.className = 'conversation-meta';

      const timeSpan = document.createElement('span');
      timeSpan.className = 'conversation-time';
      const date = new Date(entry.timestamp);
      timeSpan.textContent = date.toLocaleString();

      // Calculate version number (newest = highest version)
      const versionNumber = history.length - index;
      const versionSpan = document.createElement('span');
      versionSpan.className = 'conversation-model';
      versionSpan.textContent = `v${versionNumber}`;

      metaDiv.appendChild(timeSpan);
      metaDiv.appendChild(versionSpan);

      itemDiv.appendChild(pinIcon);
      itemDiv.appendChild(titleDiv);
      itemDiv.appendChild(metaDiv);

      // Right-click context menu
      itemDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showPromptHistoryContextMenu(e.clientX, e.clientY, configId, modelName, index, entry, versionNumber, isActive);
      });

      promptHistoryList.appendChild(itemDiv);
    });
  }

  promptHistoryModal.classList.remove('hidden');
}

// Context menu for prompt history
let activePromptHistoryContextMenu = null;

function showPromptHistoryContextMenu(x, y, configId, modelName, index, entry, versionNumber, isActive) {
  // Remove existing menu if any
  if (activePromptHistoryContextMenu) {
    activePromptHistoryContextMenu.remove();
    activePromptHistoryContextMenu = null;
  }

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  // View Full Text
  const viewItem = document.createElement('div');
  viewItem.className = 'context-menu-item';
  viewItem.innerHTML = `
    <img src="assets/info.svg" alt="View" class="context-menu-icon">
    View Full Text
  `;
  viewItem.addEventListener('click', () => {
    showFullTextModal(entry.prompt, versionNumber);
    closePromptHistoryContextMenu();
  });

  // Load in Editor
  const editItem = document.createElement('div');
  editItem.className = 'context-menu-item';
  editItem.innerHTML = `
    <img src="assets/pencil.svg" alt="Edit" class="context-menu-icon">
    Load in Editor
  `;
  editItem.addEventListener('click', () => {
    systemPromptText.value = entry.prompt;
    originalPromptValue = getSystemPrompt(configId, modelName);
    unsavedDraftBadge.classList.add('hidden');
    const dateStr = new Date(entry.timestamp).toLocaleString();
    promptVersionIndicator.textContent = `v${versionNumber} • ${dateStr}`;
    promptVersionIndicator.classList.remove('hidden');
    updatePromptButtonStates();
    closePromptHistoryModalFunc();
    closePromptHistoryContextMenu();
  });

  // Set as Active (only if not already active)
  if (!isActive) {
    const setActiveItem = document.createElement('div');
    setActiveItem.className = 'context-menu-item';
    setActiveItem.innerHTML = `
      <img src="assets/chart-set-theory.svg" alt="Set Active" class="context-menu-icon">
      Set as Active
    `;
    setActiveItem.addEventListener('click', () => {
      // Set as active without adding to history (it's already in history)
      const prompts = loadSystemPrompts();
      const key = `${configId}::${modelName}`;
      prompts[key] = entry.prompt;
      saveSystemPrompts(prompts);

      // Update the System Prompt Management UI if it's open for this config+model
      if (!systemPromptModal.classList.contains('hidden')) {
        const currentConfigId = promptConfigSelect.value;
        const currentModelName = promptModelSelect.value;

        if (currentConfigId === configId && currentModelName === modelName) {
          systemPromptText.value = entry.prompt;
          originalPromptValue = entry.prompt;
          unsavedDraftBadge.classList.add('hidden');

          // Show version indicator
          const dateStr = new Date(entry.timestamp).toLocaleString();
          promptVersionIndicator.textContent = `v${versionNumber} • ${dateStr}`;
          promptVersionIndicator.classList.remove('hidden');

          updatePromptButtonStates();
        }
      }

      openPromptHistoryModal(configId, modelName); // Refresh to update pin
      closePromptHistoryContextMenu();
    });
    menu.appendChild(setActiveItem);
  }

  // Delete
  const deleteItem = document.createElement('div');
  deleteItem.className = 'context-menu-item danger';
  deleteItem.innerHTML = `
    <img src="assets/trash-xmark.svg" alt="Delete" class="context-menu-icon">
    Delete Version
  `;
  deleteItem.addEventListener('click', () => {
    deletePromptHistoryVersion(configId, modelName, index);
    closePromptHistoryContextMenu();
  });

  menu.appendChild(viewItem);
  menu.appendChild(editItem);
  menu.appendChild(deleteItem);

  document.body.appendChild(menu);

  activePromptHistoryContextMenu = menu;

  setTimeout(() => {
    document.addEventListener('click', closePromptHistoryContextMenu);
  }, 0);
}

function closePromptHistoryContextMenu() {
  if (activePromptHistoryContextMenu) {
    activePromptHistoryContextMenu.remove();
    activePromptHistoryContextMenu = null;
  }
  document.removeEventListener('click', closePromptHistoryContextMenu);
}

// Show full text modal
function showFullTextModal(promptText, versionNumber) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.maxWidth = '800px';
  content.style.maxHeight = '80vh';

  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = `
    <h2>System Prompt v${versionNumber}</h2>
    <button class="close-button" onclick="this.closest('.modal').remove()">&times;</button>
  `;

  const body = document.createElement('div');
  body.className = 'modal-body';
  body.style.maxHeight = '60vh';
  body.style.overflowY = 'auto';
  body.style.whiteSpace = 'pre-wrap';
  body.style.wordWrap = 'break-word';
  body.textContent = promptText;

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.style.justifyContent = 'flex-end';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn-cancel';
  closeBtn.textContent = 'Close';
  closeBtn.onclick = () => modal.remove();
  footer.appendChild(closeBtn);

  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(footer);
  modal.appendChild(content);
  document.body.appendChild(modal);

  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function deletePromptHistoryVersion(configId, modelName, index) {
  if (!confirm('Delete this version from history?')) {
    return;
  }

  const history = loadPromptHistory();
  const key = `${configId}::${modelName}`;

  console.log('[DELETE] ConfigId:', configId, 'Model:', modelName, 'Index:', index);
  console.log('[DELETE] History length before:', history[key] ? history[key].length : 0);

  if (history[key] && history[key][index]) {
    // Check if we're deleting the currently active version
    const currentSavedPrompt = getSystemPrompt(configId, modelName);
    const deletingActive = history[key][index].prompt === currentSavedPrompt;

    console.log('[DELETE] Deleting active?', deletingActive);

    // Remove the entry at the specified index
    history[key].splice(index, 1);

    console.log('[DELETE] History length after splice:', history[key].length);

    // If we deleted the active version and there are still versions left,
    // set the newest version as the new active one
    if (deletingActive && history[key].length > 0) {
      const newActivePrompt = history[key][0].prompt;
      setSystemPrompt(configId, modelName, newActivePrompt);

      // Update the UI if System Prompt Management modal is open
      if (!systemPromptModal.classList.contains('hidden')) {
        const currentConfigId = promptConfigSelect.value;
        const currentModelName = promptModelSelect.value;

        // If viewing the same config+model, update the textarea
        if (currentConfigId === configId && currentModelName === modelName) {
          systemPromptText.value = newActivePrompt;
          originalPromptValue = newActivePrompt;

          // Hide unsaved badge
          unsavedDraftBadge.classList.add('hidden');

          // Show version indicator for new active version
          const latestEntry = history[key][0];
          const date = new Date(latestEntry.timestamp);
          const dateStr = date.toLocaleString();
          promptVersionIndicator.textContent = `v${history[key].length} • ${dateStr}`;
          promptVersionIndicator.classList.remove('hidden');

          // Update button states
          updatePromptButtonStates();
        }
      }
    }

    // If no entries left, remove the key entirely
    if (history[key].length === 0) {
      delete history[key];

      // Clear the saved system prompt too
      setSystemPrompt(configId, modelName, '');

      // Update UI if viewing this config+model
      if (!systemPromptModal.classList.contains('hidden')) {
        const currentConfigId = promptConfigSelect.value;
        const currentModelName = promptModelSelect.value;

        if (currentConfigId === configId && currentModelName === modelName) {
          systemPromptText.value = '';
          originalPromptValue = '';
          unsavedDraftBadge.classList.add('hidden');
          promptVersionIndicator.classList.add('hidden');
          updatePromptButtonStates();
        }
      }
    }

    // Save updated history
    savePromptHistory(history);

    console.log('[DELETE] Deletion complete. Refreshing modal...');

    // Refresh the history display
    openPromptHistoryModal(configId, modelName);
  } else {
    console.log('[DELETE] ERROR: Could not find history entry at index', index);
  }
}

// ============================================================
// Model Management
// ============================================================

async function fetchAvailableModels() {
  const config = getActiveConfig();
  console.log('fetchAvailableModels called, config:', config);

  if (!config) {
    console.log('No active config, hiding model selector');
    modelSelectorContainer.classList.add('hidden');
    return;
  }

  const url = `http://${config.host}:${config.port}/api/tags`;
  console.log('Fetching models from:', url);

  try {
    const response = await fetch(url);
    console.log('Fetch response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Received data:', data);

    availableModels = data.models || [];
    console.log('Available models:', availableModels.length);

    updateModelSelector();

    // Load saved model for this config, or auto-select first model
    if (availableModels.length > 0) {
      if (config.selectedModel && availableModels.find(m => m.name === config.selectedModel)) {
        // Use saved model if it exists in the available models
        selectedModel = config.selectedModel;
        previousModel = selectedModel; // Track this as the previous model
        modelSelect.value = selectedModel;
        console.log('Loaded saved model:', selectedModel);
      } else if (!selectedModel) {
        // Auto-select first model if no saved model
        selectedModel = availableModels[0].name;
        previousModel = selectedModel; // Track this as the previous model
        modelSelect.value = selectedModel;
        config.selectedModel = selectedModel;
        saveConfigs();
        console.log('Auto-selected model:', selectedModel);
      }
    }

    // Adjust width to fit selected model
    adjustModelSelectWidth();
  } catch (error) {
    console.error('Failed to fetch models:', error);
    console.error('Error details:', error.message);
    modelSelectorContainer.classList.add('hidden');
  }
}

function updateModelSelector() {
  console.log('updateModelSelector called, availableModels:', availableModels.length);
  modelSelect.innerHTML = '';

  if (availableModels.length === 0) {
    console.log('No models available, hiding selector');
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No models available';
    modelSelect.appendChild(option);
    modelSelectorContainer.classList.add('hidden');
  } else {
    console.log('Populating model dropdown with', availableModels.length, 'models');
    availableModels.forEach(model => {
      const option = document.createElement('option');
      option.value = model.name;
      option.textContent = model.name;
      modelSelect.appendChild(option);
    });

    if (selectedModel) {
      modelSelect.value = selectedModel;
    }

    console.log('Showing model selector container');
    modelSelectorContainer.classList.remove('hidden');
  }
}

// Adjust select width to fit content
function adjustModelSelectWidth() {
  if (!selectedModel) return;

  // Create temporary element to measure text width
  const temp = document.createElement('span');
  temp.style.font = window.getComputedStyle(modelSelect).font;
  temp.style.visibility = 'hidden';
  temp.style.position = 'absolute';
  temp.textContent = selectedModel;
  document.body.appendChild(temp);

  // Get text width and add padding for dropdown arrow + padding
  const textWidth = temp.offsetWidth;
  document.body.removeChild(temp);

  // Set width (add extra for padding and dropdown arrow)
  const width = Math.min(Math.max(textWidth + 45, 85), 275);
  modelSelect.style.width = `${width}px`;
}

// Moved to bottom with model change confirmation logic

// ============================================================
// Status Bar
// ============================================================

async function checkBackendConnection() {
  const config = getActiveConfig();
  if (!config) {
    connectionStatusDot.classList.add('hidden');
    return;
  }

  try {
    const response = await fetch(`http://${config.host}:${config.port}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (response.ok) {
      connectionStatusDot.classList.remove('hidden', 'disconnected');
      connectionStatusDot.classList.add('connected');
    } else {
      connectionStatusDot.classList.remove('hidden', 'connected');
      connectionStatusDot.classList.add('disconnected');
    }
  } catch (error) {
    connectionStatusDot.classList.remove('hidden', 'connected');
    connectionStatusDot.classList.add('disconnected');
  }
}

function updateStatusBar() {
  const config = getActiveConfig();
  console.log('updateStatusBar called, activeConfigId:', activeConfigId, 'config:', config);

  if (config) {
    backendName.textContent = config.name;
    backendHost.textContent = `${config.host}:${config.port}`;
    backendHostContainer.classList.remove('hidden');
    console.log('Status bar updated, calling fetchAvailableModels');
    fetchAvailableModels();
    checkBackendConnection();
  } else {
    backendName.textContent = 'No backend configured';
    backendHostContainer.classList.add('hidden');
    modelSelectorContainer.classList.add('hidden');
    connectionStatusDot.classList.add('hidden');
  }
}

// Check backend connection periodically
setInterval(checkBackendConnection, 30000);

function updateClock() {
  currentTime.textContent = getTimestamp();
}

// Update clock every second
setInterval(updateClock, 1000);
updateClock();

// ============================================================
// Conversation History
// ============================================================

const pinButton = document.getElementById('pinButton');
const pinnedModal = document.getElementById('pinnedModal');
const closePinnedModal = document.getElementById('closePinnedModal');
const pinnedList = document.getElementById('pinnedList');

const historyButton = document.getElementById('historyButton');
const historyModal = document.getElementById('historyModal');
const closeHistoryModal = document.getElementById('closeHistoryModal');
const conversationList = document.getElementById('conversationList');

// Rename modal elements
const renameModal = document.getElementById('renameModal');
const closeRenameModal = document.getElementById('closeRenameModal');
const conversationTitle = document.getElementById('conversationTitle');
const saveRenameButton = document.getElementById('saveRenameButton');
const cancelRenameButton = document.getElementById('cancelRenameButton');
let conversationToRename = null;

// Current conversation state
let currentConversation = null;
let conversations = [];

// Fibonacci sequence for title updates: 1, 2, 3, 5, 8, then every 8
const titleUpdateSequence = [1, 2, 3, 5, 8];

// Function to format timestamp for display
function formatConversationTime(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Today - show military time HH:MM
  if (diffDays === 0 && now.getDate() === date.getDate()) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // Yesterday
  if (diffDays === 1 || (diffDays === 0 && now.getDate() !== date.getDate())) {
    return 'Yesterday';
  }

  // Last 7 days - show day name
  if (diffDays < 7) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  }

  // Less than a year - show MM/DD
  const yearDiff = now.getFullYear() - date.getFullYear();
  if (yearDiff === 0) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}`;
  }

  // Older than a year - show MM/DD/YYYY
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

// Load conversations from localStorage
function loadConversations() {
  const stored = localStorage.getItem('conversations');
  conversations = stored ? JSON.parse(stored) : [];
  console.log('Loaded conversations:', conversations.length, conversations);
}

// Save conversations to localStorage
function saveConversations() {
  localStorage.setItem('conversations', JSON.stringify(conversations));
  console.log('Saved conversations:', conversations.length, conversations);
}

// Create a new conversation
function createNewConversation() {
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const conversationNumber = conversations.length + 1;

  currentConversation = {
    id: id,
    title: `Conversation #${conversationNumber}`,
    timestamp: new Date().toISOString(),
    model: selectedModel,
    messages: [],
    messageCount: 0,
    lastTitleUpdate: 0
  };

  conversations.unshift(currentConversation); // Add to beginning (newest first)
  saveConversations();
  updateChatTitle();
  updateConversationInfo();
  return currentConversation;
}

// Update the chat title in the top status bar
function updateChatTitle() {
  if (!currentConversation || currentConversation.messages.length === 0) {
    chatTitle.textContent = 'New Chat';
  } else {
    chatTitle.textContent = currentConversation.title;
  }
}

// Update conversation info statistics
function updateConversationInfo() {
  // Calculate token counts
  let promptTokens = 0;
  let responseTokens = 0;

  if (currentConversation && currentConversation.messages) {
    currentConversation.messages.forEach(msg => {
      if (msg.tokens) {
        if (msg.role === 'user') {
          promptTokens += msg.tokens;
        } else if (msg.role === 'assistant') {
          responseTokens += msg.tokens;
        }
      }
    });
  }

  infoPromptTokens.textContent = promptTokens.toLocaleString();
  infoResponseTokens.textContent = responseTokens.toLocaleString();
  infoTotalTokens.textContent = (promptTokens + responseTokens).toLocaleString();
}

// Generate title using AI
async function generateConversationTitle(conversation) {
  const config = getActiveConfig();
  if (!config || !conversation.messages.length) return;

  // Build a summary of the conversation
  const conversationText = conversation.messages
    .slice(0, 6) // Use first 6 messages for title generation
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const titlePrompt = `Based on this conversation, generate a concise 3-5 word title that captures the main topic. Only respond with the title, nothing else:\n\n${conversationText}`;

  try {
    const response = await fetch(`http://${config.host}:${config.port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: conversation.model,
        messages: [{ role: 'user', content: titlePrompt }],
        stream: false
      })
    });

    if (response.ok) {
      const data = await response.json();
      const title = data.message.content.trim().replace(/^["']|["']$/g, ''); // Remove quotes
      conversation.title = title;
      saveConversations();
      updateChatTitle();
    }
  } catch (error) {
    console.error('Error generating title:', error);
  }
}

// Check if we should update the title
function shouldUpdateTitle(messageCount) {
  // First check Fibonacci sequence: 1, 2, 3, 5, 8
  if (titleUpdateSequence.includes(messageCount)) {
    return true;
  }
  // After 8, update every 8 questions: 16, 24, 32, 40...
  if (messageCount > 8 && messageCount % 8 === 0) {
    return true;
  }
  return false;
}

// Add message to current conversation
function addMessageToConversation(role, content, metadata = {}) {
  if (!currentConversation) {
    createNewConversation();
  }

  const now = new Date().toISOString();
  const message = {
    role: role,
    content: content,
    timestamp: now
  };

  // Add metadata (duration for assistant, tokens for both)
  if (role === 'assistant' && metadata.duration !== undefined) {
    message.duration = metadata.duration;
  }
  if (metadata.tokens !== undefined) {
    message.tokens = metadata.tokens;
  }

  currentConversation.messages.push(message);

  // Update conversation timestamp to reflect last message time
  currentConversation.timestamp = now;

  currentConversation.messageCount = Math.floor(currentConversation.messages.length / 2); // Count exchanges

  // Re-sort conversations array to put most recent first
  conversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  saveConversations();
  updateConversationInfo();

  // Check if we should update the title (only if not manually renamed)
  if (!currentConversation.manuallyRenamed &&
      shouldUpdateTitle(currentConversation.messageCount) &&
      currentConversation.messageCount !== currentConversation.lastTitleUpdate) {
    currentConversation.lastTitleUpdate = currentConversation.messageCount;
    generateConversationTitle(currentConversation);
  }
}

// Load a conversation
function loadConversation(conversationId) {
  const conversation = conversations.find(c => c.id === conversationId);
  if (!conversation) return;

  console.log('Loading conversation:', conversation.id, 'with', conversation.messages.length, 'messages');
  currentConversation = conversation;

  // Update model tracking to match loaded conversation
  selectedModel = conversation.model;
  previousModel = conversation.model;

  // Update model selector dropdown to show conversation's model
  if (modelSelect) {
    modelSelect.value = conversation.model;
    adjustModelSelectWidth();
  }

  // Clear and reload messages
  messagesContainer.innerHTML = '';
  updateEmptyState();
  conversation.messages.forEach(msg => {
    const metadata = {};
    if (msg.duration !== undefined) {
      metadata.duration = msg.duration;
    }
    if (msg.tokens !== undefined) {
      metadata.tokens = msg.tokens;
    }
    addMessage(msg.role, msg.content, metadata);
  });

  updateChatTitle();
  updateConversationInfo();
  historyModal.classList.add('hidden');
  pinnedModal.classList.add('hidden');
}

// Render conversation list (unpinned only)
function renderConversationList() {
  const unpinnedConvs = conversations.filter(c => !c.isPinned);
  console.log('Rendering conversation list, count:', unpinnedConvs.length);
  conversationList.innerHTML = '';

  if (unpinnedConvs.length === 0) {
    const empty = document.createElement('div');
    empty.style.textAlign = 'center';
    empty.style.color = '#808080';
    empty.style.padding = '40px 20px';
    empty.textContent = 'No conversations yet. Start chatting to create history!';
    conversationList.appendChild(empty);
    return;
  }

  unpinnedConvs.forEach(conv => {
    const item = document.createElement('div');
    item.className = 'conversation-item';
    item.dataset.id = conv.id;

    const title = document.createElement('div');
    title.className = 'conversation-title';
    title.textContent = conv.title;

    const meta = document.createElement('div');
    meta.className = 'conversation-meta';

    const time = document.createElement('span');
    time.className = 'conversation-time';
    time.textContent = formatConversationTime(conv.timestamp);

    const model = document.createElement('span');
    model.className = 'conversation-model';
    model.textContent = conv.model.split(':')[0];
    model.title = conv.model; // Show full model name on hover

    meta.appendChild(time);
    meta.appendChild(model);

    item.appendChild(title);
    item.appendChild(meta);

    // Click to load conversation
    item.addEventListener('click', () => {
      loadConversation(conv.id);
    });

    // Right-click to show context menu
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, conv.id, false); // false = not pinned
    });

    conversationList.appendChild(item);
  });
}

// Render pinned conversation list
function renderPinnedList() {
  const pinnedConvs = conversations.filter(c => c.isPinned);
  console.log('Rendering pinned list, count:', pinnedConvs.length);
  pinnedList.innerHTML = '';

  if (pinnedConvs.length === 0) {
    const empty = document.createElement('div');
    empty.style.textAlign = 'center';
    empty.style.color = '#808080';
    empty.style.padding = '40px 20px';
    empty.textContent = 'No pinned conversations yet. Pin a conversation to keep it here!';
    pinnedList.appendChild(empty);
    return;
  }

  pinnedConvs.forEach(conv => {
    const item = document.createElement('div');
    item.className = 'conversation-item';
    item.dataset.id = conv.id;

    const title = document.createElement('div');
    title.className = 'conversation-title';
    title.textContent = conv.title;

    const meta = document.createElement('div');
    meta.className = 'conversation-meta';

    const time = document.createElement('span');
    time.className = 'conversation-time';
    time.textContent = formatConversationTime(conv.timestamp);

    const model = document.createElement('span');
    model.className = 'conversation-model';
    model.textContent = conv.model.split(':')[0];
    model.title = conv.model; // Show full model name on hover

    meta.appendChild(time);
    meta.appendChild(model);

    item.appendChild(title);
    item.appendChild(meta);

    // Click to load conversation
    item.addEventListener('click', () => {
      loadConversation(conv.id);
    });

    // Right-click to show context menu
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, conv.id, true); // true = pinned
    });

    pinnedList.appendChild(item);
  });
}

// Context menu for conversation items
let activeContextMenu = null;

function showContextMenu(x, y, conversationId, isPinned) {
  // Remove any existing context menu
  if (activeContextMenu) {
    activeContextMenu.remove();
    activeContextMenu = null;
  }

  // Create context menu
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  // Rename option
  const renameItem = document.createElement('div');
  renameItem.className = 'context-menu-item';
  renameItem.innerHTML = `
    <img src="assets/pencil.svg" alt="Rename" class="context-menu-icon">
    Rename
  `;
  renameItem.addEventListener('click', () => {
    renameConversation(conversationId);
    menu.remove();
    activeContextMenu = null;
  });

  // Pin/Unpin option
  const pinItem = document.createElement('div');
  pinItem.className = 'context-menu-item';
  pinItem.innerHTML = `
    <img src="assets/thumbtack.svg" alt="${isPinned ? 'Unpin' : 'Pin'}" class="context-menu-icon">
    ${isPinned ? 'Unpin' : 'Pin'}
  `;
  pinItem.addEventListener('click', () => {
    togglePinConversation(conversationId);
    menu.remove();
    activeContextMenu = null;
  });

  // Delete option
  const deleteItem = document.createElement('div');
  deleteItem.className = 'context-menu-item danger';
  deleteItem.innerHTML = `
    <img src="assets/trash-xmark.svg" alt="Delete" class="context-menu-icon">
    Delete
  `;
  deleteItem.addEventListener('click', () => {
    deleteConversation(conversationId);
    menu.remove();
    activeContextMenu = null;
  });

  menu.appendChild(renameItem);
  menu.appendChild(pinItem);
  menu.appendChild(deleteItem);
  document.body.appendChild(menu);
  activeContextMenu = menu;

  // Close menu on click outside
  setTimeout(() => {
    document.addEventListener('click', closeContextMenu);
  }, 0);
}

function closeContextMenu() {
  if (activeContextMenu) {
    activeContextMenu.remove();
    activeContextMenu = null;
  }
  document.removeEventListener('click', closeContextMenu);
}

function renameConversation(conversationId) {
  const conversation = conversations.find(c => c.id === conversationId);
  if (!conversation) return;

  conversationToRename = conversation;
  conversationTitle.value = conversation.title;
  renameModal.classList.remove('hidden');

  // Focus the input field
  setTimeout(() => conversationTitle.focus(), 100);
}

function togglePinConversation(conversationId) {
  const conversation = conversations.find(c => c.id === conversationId);
  if (!conversation) return;

  conversation.isPinned = !conversation.isPinned;
  saveConversations();

  // Re-render both lists
  renderConversationList();
  renderPinnedList();
}

function deleteConversation(conversationId) {
  const conversation = conversations.find(c => c.id === conversationId);
  if (!conversation) return;

  if (confirm(`Delete "${conversation.title}"?`)) {
    // If this is the current conversation, clear the chat
    if (currentConversation && currentConversation.id === conversationId) {
      messagesContainer.innerHTML = '';
      updateEmptyState();
      currentConversation = null;
      updateChatTitle(); // Reset title to "New Chat"
    }

    // Remove from array
    conversations = conversations.filter(c => c.id !== conversationId);
    saveConversations();

    // Re-render both lists
    renderConversationList();
    renderPinnedList();
  }
}

// Pin button click
pinButton.addEventListener('click', () => {
  renderPinnedList();
  pinnedModal.classList.remove('hidden');
});

// Close pinned modal
closePinnedModal.addEventListener('click', () => {
  pinnedModal.classList.add('hidden');
});

pinnedModal.addEventListener('click', (e) => {
  if (e.target === pinnedModal) {
    pinnedModal.classList.add('hidden');
  }
});

// History button click
historyButton.addEventListener('click', () => {
  renderConversationList();
  historyModal.classList.remove('hidden');
});

// Close history modal
closeHistoryModal.addEventListener('click', () => {
  historyModal.classList.add('hidden');
});

historyModal.addEventListener('click', (e) => {
  if (e.target === historyModal) {
    historyModal.classList.add('hidden');
  }
});

// Rename modal handlers
saveRenameButton.addEventListener('click', () => {
  if (!conversationToRename) return;

  const newTitle = conversationTitle.value.trim();
  if (newTitle) {
    conversationToRename.title = newTitle;
    conversationToRename.manuallyRenamed = true;
    saveConversations();
    renderConversationList();
  }

  renameModal.classList.add('hidden');
  conversationToRename = null;
});

cancelRenameButton.addEventListener('click', () => {
  renameModal.classList.add('hidden');
  conversationToRename = null;
});

closeRenameModal.addEventListener('click', () => {
  renameModal.classList.add('hidden');
  conversationToRename = null;
});

renameModal.addEventListener('click', (e) => {
  if (e.target === renameModal) {
    renameModal.classList.add('hidden');
    conversationToRename = null;
  }
});

// Press Enter to save, Escape to cancel
conversationTitle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveRenameButton.click();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    cancelRenameButton.click();
  }
});

// ============================================================
// Model Change Confirmation
// ============================================================

let previousModel = selectedModel;

modelSelect.addEventListener('change', () => {
  const newModel = modelSelect.value;

  if (previousModel && previousModel !== newModel && currentConversation && currentConversation.messages && currentConversation.messages.length > 0) {
    if (confirm('Changing the model will start a new conversation. Continue?')) {
      selectedModel = newModel;
      previousModel = newModel;

      // Save selected model to active config
      const config = getActiveConfig();
      if (config) {
        config.selectedModel = selectedModel;
        saveConfigs();
      }

      // Clear current conversation
      messagesContainer.innerHTML = '';
      updateEmptyState();

      // Create new conversation with new model
      createNewConversation();

      adjustModelSelectWidth();
    } else {
      // Revert to previous model
      modelSelect.value = previousModel;
    }
  } else {
    selectedModel = newModel;
    previousModel = newModel;

    // Save selected model to active config
    const config = getActiveConfig();
    if (config) {
      config.selectedModel = selectedModel;
      saveConfigs();
    }

    adjustModelSelectWidth();
  }
});

// ============================================================
// Initialization
// ============================================================

loadConfigs();
loadConversations();
updateChatTitle();
updateConversationInfo();
updateStatusBar();
