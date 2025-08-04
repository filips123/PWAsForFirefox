# Install

## Explanation
PWA's run in a discrete browser environment seperate from your browser sessions. To do this we need a browser that is customised for the task of running these PWA's. We install an application which loads a customised installation of Firefox to run them. Then manage all of this with a new browser extension for your existing browser. The details of both components are discussed in the sections further below as we discuss the installation process here.

## Automated
The installation has been largely simplified with the browser extension taking you through the application install. So install the extension first from [the Firefox Add-ons website][link-addon-store]. Then following the instructions it will provide to you.

## Manual
In some cases the extension will fail to install the necessary components so you will need to complete this step. First we need to check if the directory has been created. 

### Application Install
Check if one of the following directores exist in your system.

    Windows: %APPDATA%\FirefoxPWA
    PortableApps.com: #{root}\App\PWAsForFirefox
    Linux & BSD: ${XDG_DATA_HOME:="$HOME/.local/share"}/firefoxpwa
    macOS: $HOME/Library/Application Support/firefoxpwa

If not then you need to install the application first - see the [application][link-native] section. Once done the directory should exist and you can continue with the browser install.

#### Windows Tips
Users can open File Explorer and click on the directory name at the top so it is highlighted. Now copy and paste the following to overwrite the highlighted text then press enter.
``` 
%APPDATA%\FirefoxPWA
```
 If the directory exists it should just appear with no errors.

### Browser install
Lastly we need to install the firefox browser we will use for running our PWA's See the [browser][link-browser] section for details.



[link-addon-store]: https://addons.mozilla.org/firefox/addon/pwas-for-firefox/
[link-native]: https://github.com/filips123/PWAsForFirefox/blob/main/docs/docs/installation/native.md
[link-browser]: https://github.com/filips123/PWAsForFirefox/blob/main/docs/docs/installation/browser.md