# Installation Directories

## Executables

Global system directory for the main executable files. Contains the main `firefoxpwa`
executable that handles the command-line features and launches web apps.

On Windows, also contains the `firefoxpwa-connector` executable that handles native
messaging connections from the browser extension, and the native app manifest. On Linux
and macOS, they are located at the appropriate locations for that platform.

Can be overwritten by a `FFPWA_EXECUTABLES` build- or run-time environment variable.

!!! warning

    Changing this variable to another directory also requires modifying the installation
    scripts to install executables into that directory and set the correct native app
    manifest path.

**Default Location:**

* Windows: `C:\Program Files\FirefoxPWA\` (can be set during installation)
* PortableApps.com: `#{root}\App\PWAsForFirefox\`
* Linux: `/usr/bin/`
* macOS: `/usr/local/bin/`
* Homebrew: `#{prefix}/bin/`

**Required Permissions:**

* Read

### Main Executable

**Default Location:**

* Windows: `C:\Program Files\FirefoxPWA\firefoxpwa.exe`
* PortableApps.com: `#{root}\App\PWAsForFirefox\firefoxpwa.exe`
* Linux: `/usr/bin/firefoxpwa`
* macOS: `/usr/local/bin/firefoxpwa`
* Homebrew: `#{prefix}/bin/firefoxpwa`

### Connector Executable

**Default Location:**

* Windows: `C:\Program Files\FirefoxPWA\firefoxpwa-connector.exe`
* PortableApps.com: `#{root}\App\PWAsForFirefox\firefoxpwa-connector.exe`
* Linux: `/usr/libexec/firefoxpwa-connector`
* macOS: `/usr/local/libexec/firefoxpwa-connector`
* Homebrew: `#{prefix}/libexec/firefoxpwa-connector`

!!! note

    The connector executable is *not* installed in the main executables directory
    on systems other than Windows.

## System Data

Global system directory for the project data. Stores the UserChrome modifications which
are later copied to the user-specific profile directories at the web-app-launch-time.

On Windows, also contains the shell completions files. On Linux and macOS, they are
located at the appropriate locations for that platform.

When using PortableApps.com or when manually chosen by the user, this directory can also
contain the runtime.

Can be overwritten by a `FFPWA_SYSDATA` build- or run-time environment variable.

!!! warning

    Changing this variable to another directory also requires modifying the installation
    scripts to install system project data into that directory.

**Default Location:**

* Windows: `C:\Program Files\FirefoxPWA\` (can be set during installation)
* PortableApps.com: `#{root}\App\PWAsForFirefox\`
* Linux: `/usr/share/firefoxpwa/`
* macOS: `/usr/local/share/firefoxpwa/`
* Homebrew: `#{prefix}/share/`

**Required Permissions:**

* Read

### UserChrome

**Default Location:**

* Windows: `C:\Program Files\FirefoxPWA\userchrome\`
* PortableApps.com: `#{root}\App\PWAsForFirefox\userchrome\`
* Linux: `/usr/share/firefoxpwa/userchrome/`
* macOS: `/usr/local/share/firefoxpwa/userchrome/`
* Homebrew: `#{prefix}/share/userchrome/`

### Completions

**Default Location:**

* Windows: `C:\Program Files\FirefoxPWA\completions\`
* PortableApps.com: *Not installed by default*
* Linux & macOS: *Appropriate locations for shells*

## User Data

User-specific directory for the project data. Stores the internal Firefox instance,
profile directories with user data, web app icons (on Windows), as well as the
configuration and log files.

Can be overwritten by a `FFPWA_USERDATA` build- or run-time environment variable.

**Default Location:**

* Windows: `%APPDATA%\FirefoxPWA\`
* PortableApps.com: `#{root}\Data\`
* Linux: `${XDG_DATA_HOME:="$HOME/.local/share"}/firefoxpwa/`
* macOS: `$HOME/Library/Application Support/firefoxpwa/`

**Required Permissions:**

* Read
* Write

### Runtime

**Default Location:**

* Windows: `%APPDATA%\FirefoxPWA\runtime\`
* PortableApps.com: `#{root}\App\PWAsForFirefox\runtime\`
* Linux: `${XDG_DATA_HOME:="$HOME/.local/share"}/firefoxpwa/runtime/`
* macOS: `$HOME/Library/Application Support/firefoxpwa/runtime/`

!!! note

    The runtime is *not* installed in the user data directory when using PortableApps.com
    package to comply with PortableApps.com packaging guidelines about not having binary
    files in the data directory.

!!! note

    If the runtime is not already installed to the user data directory, the program will
    also attempt to use the runtime from the system data directory. In this case, you need
    to make sure the directory is writeable by all users to make the patching work.

### Profiles

**Default Location:**

* Windows: `%APPDATA%\FirefoxPWA\profiles\`
* PortableApps.com: `#{root}\Data\profiles\`
* Linux: `${XDG_DATA_HOME:="$HOME/.local/share"}/firefoxpwa/profiles/`
* macOS: `$HOME/Library/Application Support/firefoxpwa/profiles/`
