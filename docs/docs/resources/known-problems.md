# Known Problems

These are things that I would like to fix eventually, but will currently stay, either
because they are too hard to fix, I don't know how to fix them, or would require modifying
the Firefox source. You can check the full list of issues on [GitHub Projects][link-projects]
page. I will appreciate any help to fix them.


* **All web apps are merged with the first one that was opened (macOS):**

    When some web app is already running, all newly launched web apps will merge with it
    and remain merged until all of them are closed. This will cause the app menu to display
    all web apps as part of the first web app that has been launched, with its icon and
    desktop actions.

    This happens because Apple only allows a process to be associated with a single
    application at all times. Perhaps this could be solved by using an IPC link between
    a host process and the main Firefox runtime process, the same way the Firefox parent
    process handles its content processes. This is just a wild theory though and has to be
    investigated further.

    This issue can be prevented by installing each web app into a different profile,
    which is the default behaviour on macOS.

    Check [this comment][link-merged-comment] and related discussions for ideas
    and possible solutions for fixing this. This problem is tracked as issue [#81]
    [link-merged-issue].


* **Extension cannot detect the native program when using sandboxed Firefox (Linux Flatpak):**

    When using Firefox distributed as a Flatpak package, the extension cannot detect the
    native program that is used. This is because Flatpak packages are sandboxed and cannot
    access/run other programs which is needed for Native Messaging API. This cannot be fixed
    until Native Messaging API gets support to work in sandboxed browser packages.

    The workaround for this is to uninstall Flatpak-based Firefox and install a normal DEB
    package instead. See [#76][link-flatpak-issue] for more details.

    Previously, this problem was also present on Snap, but it has been fixed recently. If
    you still cannot detect the native program, you can check out [the dedicated FAQ entry](faq.md#why-doesnt-the-extension-find-the-native-connector-on-linux)
    about common problems on Linux.

* **Web apps do not remember previous window positions and restore sessions:**

    When multiple web apps are installed in the same profile, individual web apps do not
    remember their previous window positions and sizes. This makes it hard to automatically
    open a web app with s specific window position and size.

    This happens because Firefox tracks window positions globally (per profile), and it
    is hard to change that using only UserChrome scripts. See [#256][link-session-issue]
    for more details.

    The workaround for this is to install each web app into a different profile.

[link-projects]: https://github.com/users/filips123/projects/1/views/1?filterQuery=status%3A%22On+Hold%22
[link-merged-comment]: https://github.com/filips123/PWAsForFirefox/issues/33#issuecomment-888511078
[link-merged-issue]: https://github.com/filips123/PWAsForFirefox/issues/81
[link-flatpak-issue]: https://github.com/filips123/PWAsForFirefox/issues/76
[link-session-issue]: https://github.com/filips123/PWAsForFirefox/issues/256
