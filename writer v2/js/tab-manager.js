// tab-manager.js
class TabManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.tabs = document.querySelectorAll('.tab');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        this.setupTabListeners();
    }

    setupTabListeners() {
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => this.activateTab(tab));
        });
    }

    /**
     * Activate a specific tab
     * @param {HTMLElement} tab - The tab to activate
     */
    activateTab(tab) {
        // Remove active class from all tabs
        this.tabs.forEach(t => t.classList.remove('active'));
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Hide all tab contents
        this.tabContents.forEach(content => content.classList.remove('active'));
        
        // Show the corresponding tab content
        const tabName = tab.getAttribute('data-tab');
        const tabContent = document.getElementById(`${tabName}-tab`);
        
        if (tabContent) {
            tabContent.classList.add('active');
        }

        // Emit event for potential additional logic
        this.eventBus.emit('tab:changed', tabName);
    }

    /**
     * Switch to a specific tab by name
     * @param {string} tabName - Name of the tab to switch to
     */
    switchToTab(tabName) {
        const tab = Array.from(this.tabs).find(
            t => t.getAttribute('data-tab') === tabName
        );
        
        if (tab) {
            this.activateTab(tab);
        }
    }
}

export default TabManager;
