/**
 * NFC Vault Toast Component
 * A custom web component for displaying toast notifications
 */

// Define the Toast web component
class ToastNotification extends HTMLElement {
    constructor() {
        super();
        
        // Create shadow DOM
        this.attachShadow({ mode: 'open' });
        
        // Create container for toasts
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container';
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            :host {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 1000;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            
            .toast-container {
                display: flex;
                flex-direction: column-reverse;
                gap: 10px;
                max-width: 350px;
            }
            
            .toast {
                padding: 12px 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: flex-start;
                animation: toast-in 0.3s ease-out forwards;
                margin-top: 10px;
                backdrop-filter: blur(5px);
                transition: transform 0.3s ease, opacity 0.3s ease;
            }
            
            .toast.removing {
                animation: toast-out 0.3s ease-in forwards;
            }
            
            .toast-icon {
                margin-right: 12px;
                font-size: 20px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
            }
            
            .toast-content {
                flex: 1;
            }
            
            .toast-title {
                font-weight: 600;
                margin: 0 0 4px 0;
                font-size: 16px;
            }
            
            .toast-message {
                margin: 0;
                font-size: 14px;
                line-height: 1.4;
            }
            
            .toast-close {
                background: none;
                border: none;
                color: inherit;
                opacity: 0.5;
                cursor: pointer;
                font-size: 18px;
                margin-left: 8px;
                padding: 0;
                flex-shrink: 0;
            }
            
            .toast-close:hover {
                opacity: 0.8;
            }
            
            .toast-success {
                background-color: rgba(16, 185, 129, 0.9);
                color: white;
                border-left: 4px solid #059669;
            }
            
            .toast-error {
                background-color: rgba(239, 68, 68, 0.9);
                color: white;
                border-left: 4px solid #dc2626;
            }
            
            .toast-warning {
                background-color: rgba(245, 158, 11, 0.9);
                color: white;
                border-left: 4px solid #d97706;
            }
            
            .toast-info {
                background-color: rgba(37, 99, 235, 0.9);
                color: white;
                border-left: 4px solid #1d4ed8;
            }
            
            @keyframes toast-in {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes toast-out {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        
        // Append elements to shadow root
        this.shadowRoot.appendChild(style);
        this.shadowRoot.appendChild(this.toastContainer);
    }
    
    /**
     * Show a toast notification
     * @param {Object} options Toast options
     * @param {string} options.type Toast type (success, error, warning, info)
     * @param {string} options.title Toast title
     * @param {string} options.message Toast message
     * @param {number} options.duration Duration in ms (default: 5000, 0 for no auto-close)
     */
    show(options) {
        const { type = 'info', title = '', message = '', duration = 5000 } = options;
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Create icon element
        const icon = document.createElement('div');
        icon.className = 'toast-icon';
        
        // Set icon based on type
        switch (type) {
            case 'success':
                icon.textContent = '✓';
                break;
            case 'error':
                icon.textContent = '✕';
                break;
            case 'warning':
                icon.textContent = '!';
                break;
            case 'info':
                icon.textContent = 'i';
                break;
        }
        
        // Create content element
        const content = document.createElement('div');
        content.className = 'toast-content';
        
        // Add title if provided
        if (title) {
            const titleEl = document.createElement('h4');
            titleEl.className = 'toast-title';
            titleEl.textContent = title;
            content.appendChild(titleEl);
        }
        
        // Add message
        const messageEl = document.createElement('p');
        messageEl.className = 'toast-message';
        messageEl.textContent = message;
        content.appendChild(messageEl);
        
        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => this.removeToast(toast));
        
        // Assemble toast
        toast.appendChild(icon);
        toast.appendChild(content);
        toast.appendChild(closeBtn);
        
        // Add to container
        this.toastContainer.appendChild(toast);
        
        // Auto-remove after duration (if not 0)
        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentNode === this.toastContainer) {
                    this.removeToast(toast);
                }
            }, duration);
        }
        
        return toast;
    }
    
    /**
     * Remove a toast with animation
     * @param {HTMLElement} toast Toast element to remove
     */
    removeToast(toast) {
        // Add removing class for animation
        toast.classList.add('removing');
        
        // Remove after animation completes
        setTimeout(() => {
            if (toast.parentNode === this.toastContainer) {
                this.toastContainer.removeChild(toast);
            }
        }, 300);
    }
    
    /**
     * Shorthand for success toast
     */
    success(title, message, duration) {
        return this.show({ type: 'success', title, message, duration });
    }
    
    /**
     * Shorthand for error toast
     */
    error(title, message, duration) {
        return this.show({ type: 'error', title, message, duration });
    }
    
    /**
     * Shorthand for warning toast
     */
    warning(title, message, duration) {
        return this.show({ type: 'warning', title, message, duration });
    }
    
    /**
     * Shorthand for info toast
     */
    info(title, message, duration) {
        return this.show({ type: 'info', title, message, duration });
    }
    
    /**
     * Clear all toasts
     */
    clearAll() {
        const toasts = this.toastContainer.querySelectorAll('.toast');
        toasts.forEach(toast => this.removeToast(toast));
    }
}

// Register custom element
customElements.define('toast-notification', ToastNotification);

// Create a global toast instance for easy access
let globalToast;
document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('toast-notification')) {
        globalToast = document.createElement('toast-notification');
        document.body.appendChild(globalToast);
    }
});

// Export toast module for script module imports
export default {
    /**
     * Show a success toast
     * @param {string} title - The title
     * @param {string} message - The message
     * @param {number} duration - Duration in ms (default: 5000)
     */
    success(title, message, duration = 5000) {
        if (globalToast) {
            return globalToast.success(title, message, duration);
        }
    },
    
    /**
     * Show an error toast
     * @param {string} title - The title
     * @param {string} message - The message
     * @param {number} duration - Duration in ms (default: 5000)
     */
    error(title, message, duration = 5000) {
        if (globalToast) {
            return globalToast.error(title, message, duration);
        }
    },
    
    /**
     * Show a warning toast
     * @param {string} title - The title
     * @param {string} message - The message
     * @param {number} duration - Duration in ms (default: 5000)
     */
    warning(title, message, duration = 5000) {
        if (globalToast) {
            return globalToast.warning(title, message, duration);
        }
    },
    
    /**
     * Show an info toast
     * @param {string} title - The title
     * @param {string} message - The message
     * @param {number} duration - Duration in ms (default: 5000)
     */
    info(title, message, duration = 5000) {
        if (globalToast) {
            return globalToast.info(title, message, duration);
        }
    },
    
    /**
     * Show a custom toast
     * @param {Object} options Toast options
     */
    show(options) {
        if (globalToast) {
            return globalToast.show(options);
        }
    },
    
    /**
     * Clear all toasts
     */
    clearAll() {
        if (globalToast) {
            globalToast.clearAll();
        }
    }
};
