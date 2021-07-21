%define __spec_install_post %{nil}
%define __os_install_post %{_dbpath}/brp-compress
%define debug_package %{nil}

Name: firefoxpwa
Summary: The native part of the FirefoxPWA project
Version: @@VERSION@@
Release: @@RELEASE@@%{?dist}
License: MPLv2.0
Group: Applications/Internet
Source: %{name}-%{version}.tar.gz
URL: https://github.com/filips123/FirefoxPWA
Packager: filips <projects@filips.si>

Recommends: (firefox or firefox-esr or firefox-beta or firefox-nightly)
Supplements: firefox firefox-esr firefox-beta firefox-nightly

BuildRoot: %{_tmppath}/%{name}-%{version}-%{release}-root

%description
Progressive Web Apps (PWAs) are web apps that use web APIs and features along
with progressive enhancement strategy to bring a native app-like user experience
to cross-platform web applications. Although Firefox supports many of Progressive
Web App APIs, it does not support functionality to install them as a standalone
system app with an app-like experience.

This project modifies Firefox to allow websites to be installed as standalone
apps and provides a console tool and browser extension to install, manage and
use them.

This package contains only the native part of the FirefoxPWA project. You
should also install the browser extension if you haven't already. You can
download it from <https://addons.mozilla.org/firefox/addon/firefoxpwa/>.

%prep
%setup -q

%install
# Duplicate the manifest file over lib and lib64 directories
# Needed because otherwise the manifest may not be detected on some platforms
mkdir -p usr/lib64/mozilla/native-messaging-hosts
cp usr/lib/mozilla/native-messaging-hosts/firefoxpwa.json usr/lib64/mozilla/native-messaging-hosts/firefoxpwa.json

# Make shell completions executable
chmod 755 usr/share/bash-completion/completions/firefoxpwa
chmod 755 usr/share/fish/completions/firefoxpwa.fish
chmod 755 usr/share/zsh/vendor-completions/_firefoxpwa

# Copy all files to the build root
rm -rf %{buildroot}
mkdir -p %{buildroot}
cp -a * %{buildroot}

%clean
# Just remove the build root
rm -rf %{buildroot}

%posttrans
# Add notice that it is recommended to also install the extension
if [ $1 == 0 ]
then
    echo "You have successfully installed the native part of the FirefoxPWA project"
    echo "You should also install the Firefox extension if you haven't already"
    echo "Download: https://addons.mozilla.org/firefox/addon/firefoxpwa/"
fi

%postun
# Add warning that runtime, profiles and sites are still installed
if [ $1 == 0 ]
then
    echo "Runtime, profiles and sites are still installed in user directories"
    echo "You can remove them manually after this package is uninstalled"
    echo "Doing that will remove all installed PWA sites and their data"
fi

%files
%defattr(-,root,root,-)

# Executables
%{_prefix}/bin/firefoxpwa
%{_prefix}/libexec/firefoxpwa-connector

# Manifests
%{_prefix}/lib/mozilla/native-messaging-hosts/firefoxpwa.json
%{_prefix}/lib64/mozilla/native-messaging-hosts/firefoxpwa.json

# Completions
%{_datadir}/bash-completion/completions/firefoxpwa
%{_datadir}/fish/completions/firefoxpwa.fish
%{_datadir}/zsh/vendor-completions/_firefoxpwa

# Documentation
%doc %{_docdir}/firefoxpwa/README.md
%doc %{_docdir}/firefoxpwa/README-NATIVE.md
%doc %{_docdir}/firefoxpwa/README-EXTENSION.md
%license %{_docdir}/firefoxpwa/copyright

# UserChrome
%{_datadir}/firefoxpwa/userchrome/
