---
hide:
  - path
---

<style>
.md-sidebar--primary {
  visibility: hidden;
}
.hero-section {
  text-align: center;
  padding: 2rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  margin-bottom: 2rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
}
.hero-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}
.hero-subtitle {
  font-size: 1.2rem;
  opacity: 0.9;
  margin-bottom: 1.5rem;
}
.badges-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
}
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}
.feature-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 1.5rem;
  border-left: 4px solid #667eea;
  box-shadow: 0 4px 16px rgba(0,0,0,0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
}
.feature-icon {
  font-size: 2rem;
  margin-bottom: 1rem;
}
.cta-section {
  background: linear-gradient(135deg, #2196F3 0%, #21CBF3 100%);
  color: white;
  padding: 2rem;
  border-radius: 12px;
  text-align: center;
  margin: 2rem 0;
}
.sponsor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  align-items: center;
  text-align: center;
  margin: 2rem 0;
}
.sponsor-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.05);
}
</style>

<div class="hero-section">
  <h1 class="hero-title">🦊 Progressive Web Apps for Firefox</h1>
  <p class="hero-subtitle">Transform any website into a native desktop app experience</p>
  <div class="badges-container">
    <a href="https://github.com/filips123/PWAsForFirefox/releases/latest">
      <img src="https://img.shields.io/github/v/release/filips123/PWAsForFirefox?sort=semver&style=flat-square&cacheSeconds=3600" alt="Release">
    </a>
    <a href="https://addons.mozilla.org/firefox/addon/pwas-for-firefox/">
      <img src="https://img.shields.io/amo/users/pwas-for-firefox?style=flat-square&cacheSeconds=86400" alt="Users">
    </a>
    <a href="https://addons.mozilla.org/firefox/addon/pwas-for-firefox/reviews/">
      <img src="https://img.shields.io/amo/rating/pwas-for-firefox?style=flat-square&cacheSeconds=86400" alt="Rating">
    </a>
    <a href="https://github.com/filips123/PWAsForFirefox/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/filips123/PWAsForFirefox?style=flat-square&cacheSeconds=86400" alt="License">
    </a>
    <a href="https://repology.org/project/firefoxpwa/versions">
      <img src="https://img.shields.io/repology/repositories/firefoxpwa?style=flat-square&cacheSeconds=86400" alt="Repositories">
    </a>
    <a href="https://packagecloud.io/filips/FirefoxPWA">
      <img src="https://img.shields.io/badge/deb-packagecloud.io-844fec.svg?style=flat-square" alt="DEB">
    </a>
    <a href="https://packagecloud.io/filips/FirefoxPWA">
      <img src="https://img.shields.io/badge/rpm-packagecloud.io-844fec.svg?style=flat-square" alt="RPM">
    </a>
  </div>
</div>

---

## 🚀 What is PWAsForFirefox?

[Progressive Web Apps (PWAs)](https://developer.mozilla.org/docs/Web/Progressive_web_apps) are web applications that use modern web APIs and features along with progressive enhancement strategy to bring a native app-like user experience to cross-platform web applications. 

While Firefox supports many Progressive Web App APIs, it lacks the functionality to install them as standalone system applications with an app-like experience. This functionality is often known as a **Site Specific Browser (SSB)**.

**PWAsForFirefox** creates a custom modified Firefox runtime that allows websites to be installed as standalone apps, complete with a console tool and browser extension for easy management.

!!! tip "⭐ Love this project?"

    You can see more details about the project in [the repository README file](https://github.com/filips123/PWAsForFirefox), where you can also **star the project**! ⭐

    Don't forget to check our [FAQ page](help/faq.md) and [about section](about/how-it-works.md) for more technical details.

---

## 🎯 Quick Start

<div class="cta-section">
  <h3 style="margin-top:0;">🚀 Ready to get started?</h3>
  <p>Install the browser extension and follow the in-browser setup instructions!</p>
  <a href="https://addons.mozilla.org/firefox/addon/pwas-for-firefox/" style="background: white; color: #2196F3; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 1rem;">
    📦 Install Extension
  </a>
</div>

### 📚 Detailed Setup

For comprehensive installation and setup instructions:

- **[📋 Installation Requirements](installation/requirements.md)** - System requirements and prerequisites
- **[👤 User Guide](user-guide/extension.md)** - Step-by-step usage instructions
- **[❓ Help & Support](help/support.md)** - Troubleshooting and FAQ

---

## ✨ Key Features

<div class="feature-grid">
  <div class="feature-card">
    <div class="feature-icon">🖥️</div>
    <h3>Command-Line Tool</h3>
    <p>Powerful CLI to install, manage, and run Progressive Web Apps directly in Firefox with full control over your applications.</p>
  </div>
  
  <div class="feature-card">
    <div class="feature-icon">🧩</div>
    <h3>Browser Extension</h3>
    <p>Seamless extension to set up native programs and manage PWAs directly from your main Firefox browser interface.</p>
  </div>
  
  <div class="feature-card">
    <div class="feature-icon">🔒</div>
    <h3>Isolated Environment</h3>
    <p>Dedicated Firefox installation and profiles that store PWAs separately from your main browsing experience.</p>
  </div>
  
  <div class="feature-card">
    <div class="feature-icon">📱</div>
    <h3>Native App Experience</h3>
    <p>Installed PWAs get their own start menu entry, taskbar icon, and run in dedicated windows like native applications.</p>
  </div>
  
  <div class="feature-card">
    <div class="feature-icon">🎨</div>
    <h3>Clean Interface</h3>
    <p>No tabs or address bar - just pure app experience with a clean, distraction-free interface for better productivity.</p>
  </div>
  
  <div class="feature-card">
    <div class="feature-icon">🌐</div>
    <h3>Universal Support</h3>
    <p>Install any website as a Progressive Web App, regardless of whether it officially supports PWA features.</p>
  </div>
  
  <div class="feature-card">
    <div class="feature-icon">🔧</div>
    <h3>Full Firefox Features</h3>
    <p>Complete compatibility with all Firefox addons, extensions, and built-in features - no compromises on functionality.</p>
  </div>
  
  <div class="feature-card">
    <div class="feature-icon">🔄</div>
    <h3>Auto Updates</h3>
    <p>Automatic installation and patching of the runtime and profiles, triggered by user action for security and convenience.</p>
  </div>
</div>

!!! info "🔍 Want more details?"
    
    Check out our [complete features list](about/supported-features.md) for an in-depth look at all capabilities and technical specifications.

---

## 🙏 Our Amazing Supporters

### 💎 Premium Sponsors

<div class="sponsor-grid">
  <div class="sponsor-card">
    <h4>📦 Package Hosting</h4>
    <a href="https://packagecloud.io/">
      <img src="https://assets-production.packagecloud.io/assets/packagecloud-logo-light-3c521566d5567fe0ce8435ef1f9485b0c3ad28a958af6f520d82ad3b232d2ff3.png" 
           alt="Private NPM repository and Maven, RPM, DEB, PyPi and RubyGems repository · packagecloud" 
           style="max-width: 100%; height: auto;">
    </a>
    <p><small>Thanks to <strong>packagecloud.io</strong> for sponsoring this project and providing free hosting for our DEB and RPM packages!</small></p>
  </div>
  
  <div class="sponsor-card">
    <h4>✍️ Code Signing</h4>
    <a href="https://signpath.org/">
      <img src="https://signpath.org/assets/logo.svg" 
           alt="Free Code Signing for Open Source software · SignPath" 
           style="max-width: 100%; height: auto;">
    </a>
    <p><small>Thanks to <strong>SignPath Foundation</strong> for providing free code signing certificates and <strong>SignPath</strong> for the signing infrastructure!</small></p>
  </div>
</div>

### 💝 Community Support

**🎉 Financial Contributors**  
Thanks to all donors for providing financial support for the project!

!!! note "💰 Want to help?"

    Please check [supported donation services](about/contributing.md#donations) if you want to help the project by donating.

**👥 Code Contributors**  
Thanks to [all contributors](https://github.com/filips123/PWAsForFirefox/graphs/contributors) for their help and feature development!

[![Contributors](https://contrib.rocks/image?repo=filips123/PWAsForFirefox)](https://github.com/filips123/PWAsForFirefox/graphs/contributors)

**🌟 Special Thanks**  

- **📦 Package Maintainers**: [All package maintainers](https://repology.org/project/firefoxpwa/information) keeping the project up-to-date across different distributions
- **🌍 Translators**: [All translators](https://crowdin.com/project/firefoxpwa) making the project available in multiple languages  
- **⭐ Stargazers**: [All GitHub users](https://github.com/filips123/PWAsForFirefox/stargazers) who starred our repository
- **🦊 Mozilla Team**: Mozilla and its developers for creating Firefox and making UI modifications possible with JavaScript

---

<div style="background: #f8f9fa; padding: 2rem; border-radius: 12px; border-left: 4px solid #ffc107;">
  <h3 style="margin-top: 0; color: #856404;">🚧 Documentation Status</h3>
  <p style="margin-bottom: 0;"><strong>Note:</strong> Parts of this website are still work-in-progress. Please use the feedback button and open GitHub issues with your feedback and suggestions about potential improvements. You can also participate <a href="https://github.com/filips123/PWAsForFirefox/discussions/335">in our GitHub discussion</a> about the documentation website. Thank you for your patience and contribution!</p>
</div>

---

<div style="text-align: center; margin-top: 3rem;">
  <h3>🚀 Ready to Transform Your Web Experience?</h3>
  <p>Join thousands of users who have already enhanced their browsing with PWAsForFirefox!</p>
  
  <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-top: 1.5rem;">
    <a href="https://addons.mozilla.org/firefox/addon/pwas-for-firefox/" 
       style="background: #667eea; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
      📦 Install Extension
    </a>
    <a href="installation/requirements.md" 
       style="background: #28a745; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
      📖 Setup Guide
    </a>
    <a href="https://github.com/filips123/PWAsForFirefox" 
       style="background: #333; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
      ⭐ Star on GitHub
    </a>
  </div>
</div>
