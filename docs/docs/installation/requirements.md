# Requirements

## Application

### Supported Systems

* Windows (pre-built MSI installer)
* Debian-like Linux (pre-built DEB package)
* Red Hat-like Linux (pre-built RPM package)
* Arch-like Linux (package in `[extra]` repository)
* Gentoo-like Linux (ebuild in GURU overlay)
* NixOS Linux (nixpkgs package)
* Other Linux (source installation only)
* macOS (bottled Homebrew formula)
* BSD (source installation only)[^4]

### Application Requirements

* Windows: [Visual C++ Redistributable](https://support.microsoft.com/en-us/help/2977003/the-latest-supported-visual-c-downloads)
* macOS: Xcode Command Line Tools[^2]
* Linux: `glibc` 2.18 or later[^3]

## Extension

## Supported Browsers

* Last 2 Firefox versions *OR* Firefox ESR
* Other Firefox-based browsers may also work[^1]

[^1]: Check [FAQ](../help/faq.md#how-to-use-an-alternative-browser-as-a-main-browser) for additional setup.
[^2]: Automatically installed if using Homebrew.
[^3]: Automatically installed as a package dependency.
[^4]: Support for BSD relies on XDG Desktop Entry Specification and is not regularly tested.
