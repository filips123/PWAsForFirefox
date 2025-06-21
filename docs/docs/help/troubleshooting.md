# Troubleshooting Tasks

!!! tip

    This page is designed as a guide in gathering logs and performing other troubleshooting
    tasks. Its provides step-by-step instructions on how to obtain necessary data that may
    be useful when troubleshooting the problems and reporting issues.

    For specific problem descriptions and their respective solutions, you should check
    out [the troubleshooting section](./faq.md#troubleshooting) of the Frequently Asked
    Questions page.

## Obtaining Extension Logs

1. In your main Firefox, open `about:debugging#/runtime/this-firefox`.
2. Find the correct extension and inspect it.
3. Errors/logs should be written to the "console" tab.
4. You may need to repeat the action that caused problems.

## Obtaining Native Logs

1. Create an empty `DEBUG` (without file extension) file in [the user data directory](../resources/installation-directories.md#user-data).
2. Repeat the same action that caused problems again.
3. The log files should be written to the same directory:<br>
   `firefoxpwa.log`, `firefoxpwa-stdout.log` and `firefoxpwa-stderr.log`

## Obtaining Runtime Logs

If the error happens while using web app:

1. Inside the web app, open the developer tools (++f12++) and their settings (++f1++).
2. Enable "browser chrome and add-on debugging toolboxes" and "remote debugging".
3. Press ++ctrl+alt+shift+i++ and accept the prompt.
4. Errors/logs should be written to the "console" tab.
5. You may need to switch the browser toolbox mode to multiprocess.

Alternatively, if the web app does not open properly:

1. Obtain the web app ID (for example, from the extension).
2. Launch the web app from the command line:
    ```shell
    firefoxpwa site launch ID -- --jsconsole
    ```
3. Errors/logs should be written to the "browser console" window.

## Accessing Manifests

In some cases, it might be useful to access the web app manifest of the website you
want to install. This can be done easily by opening the developer tools (++f12++),
navigating to the "application" tab and the "manifest" section.

However, some websites send different (possibly incomplete or incorrect) versions of
the manifest to clients they cannot identify, which may include PWAsForFirefox. In
most such cases, you can use `curl` to download the manifest with the same user-agent
as PWAsForFirefox, which should be the same as what the native program receives.

```shell
curl -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0" -H "Sec-Fetch-Site: none" -H "Sec-Fetch-Dest: manifest" "https://example.com/manifest.json"
```

## Reporting Issues

If you are having problems with the project, please make sure that you have read the
documentation, especially [the FAQ page](faq.md). Before creating bug reports, please
also check for any similar issues or pull requests. If any of them already exists, please
participle in that one.
S
If you cannot determine and fix the problem yourself, please open a new issue and provide
all the required information. If you were able to fix the problem, but you think the same
problem might happen to other users, please report it and include your fix, so other
users can find and fix it.

When you are creating a bug report, please include as many details as possible. Fill out the
required template, as that information will help us resolve it faster. [Our troubleshooting
tasks](troubleshooting.md) can help you geather logs and other useful information.

If you found a vulnerability or what you believe is a vulnerability, **do not** open a
public issue or disclose it publicly. Please read [our security policy](https://github.com/filips123/PWAsForFirefox/blob/main/.github/SECURITY.md)
for more details and steps for reporting it.
