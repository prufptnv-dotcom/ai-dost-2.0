class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('ai-dost-theme') || 'light';
        this.applyTheme();
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('ai-dost-theme', this.theme);
        this.applyTheme();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        
        // Update button icons
        const lightIcon = document.querySelector('.light-icon');
        const darkIcon = document.querySelector('.dark-icon');
        
        if (lightIcon && darkIcon) {
            if (this.theme === 'dark') {
                lightIcon.style.display = 'none';
                darkIcon.style.display = 'inline';
            } else {
                lightIcon.style.display = 'inline';
                darkIcon.style.display = 'none';
            }
        }
    }
}

const themeManager = new ThemeManager();

function toggleTheme() {
    themeManager.toggleTheme();
}
