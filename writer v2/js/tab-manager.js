// tab-manager.js - Tab navigation management
import eventBus from './event-bus.js';

class TabManager {
    constructor() {
        this.currentTab = 'basic';
    }
    
    init() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.getAttribute('data-tab'));
            });
        });
        
        // Initialize with first tab
        this.switchTab('basic');
        
        eventBus.publish('log', { message: 'Tab navigation initialized', type: 'info' });
    }
    
    switchTab(tabName) {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(t => t.classList.remove('active'));
        
        const selectedTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        
        // Hide all content sections
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Show selected content
        const tabContent = document.getElementById(`${tabName}-tab`);
        if (tabContent) {
            tabContent.classList.add('active');
        }
        
        this.currentTab = tabName;
        
        // Publish tab change event
        eventBus.publish('tabChanged', { tab: tabName });
    }
    
    getCurrentTab() {
        return this.currentTab;
    }
}

// Create and export a singleton instance
const tabManager = new TabManager();
export default tabManager;
