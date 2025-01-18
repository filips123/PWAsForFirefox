# Каталоги установки

## Исполняемые файлы {: id="исполняемые_файлы"}

Глобальный системный каталог для основных исполняемых файлов. Содержит основной исполняемый файл `firefoxpwa`,
который обрабатывает функции командной строки и запускает веб-приложения.

На Windows также содержит исполняемый файл `firefoxpwa-connector`, который обрабатывает соединения с нативным
сообщением от расширения браузера и манифест нативного приложения. На Linux и macOS они расположены в
соответствующих местах для этих платформ.

Может быть переопределён переменной окружения `FFPWA_EXECUTABLES` во время сборки или выполнения.

!!! warning

    Изменение этой переменной на другой каталог также требует изменения скриптов установки для установки исполняемых файлов в этот каталог и установки правильного пути к манифесту нативного приложения.

**Место по умолчанию:**

* Windows: `C:\Program Files\FirefoxPWA\` (можно установить во время установки)
* PortableApps.com: `#{root}\App\PWAsForFirefox\`
* Linux: `/usr/bin/`
* macOS и BSD: `/usr/local/bin/`
* Homebrew: `#{prefix}/bin/`

**Необходимые разрешения:**

* Чтение

### Основной исполняемый файл {: id="основной_исполняемый_файл"}

**Место по умолчанию:**

* Windows: `C:\Program Files\FirefoxPWA\firefoxpwa.exe`
* PortableApps.com: `#{root}\App\PWAsForFirefox\firefoxpwa.exe`
* Linux: `/usr/bin/firefoxpwa`
* macOS и BSD: `/usr/local/bin/firefoxpwa`
* Homebrew: `#{prefix}/bin/firefoxpwa`

### Исполняемый файл коннектора {: id="исполняемый_файл_коннектора"}

**Место по умолчанию:**

* Windows: `C:\Program Files\FirefoxPWA\firefoxpwa-connector.exe`
* PortableApps.com: `#{root}\App\PWAsForFirefox\firefoxpwa-connector.exe`
* Linux: `/usr/libexec/firefoxpwa-connector`
* macOS и BSD: `/usr/local/libexec/firefoxpwa-connector`
* Homebrew: `#{prefix}/libexec/firefoxpwa-connector`

!!! note

    Исполняемый файл коннектора *не* устанавливается в основной каталог исполняемых файлов
    на системах, отличных от Windows.

## Системные данные {: id="системные_данные"}

Глобальный системный каталог для данных проекта. Хранит модификации UserChrome, которые
позже копируются в каталоги профилей, специфичные для пользователя, во время запуска веб-приложения.

На Windows также содержит файлы завершения оболочки. На Linux и macOS они расположены в
соответствующих местах для этих платформ.

При использовании PortableApps.com или когда пользователь выбирает вручную, этот каталог также
может содержать среду выполнения.

Может быть переопределён переменной окружения `FFPWA_SYSDATA` во время сборки или выполнения.

!!! warning

    Изменение этой переменной на другой каталог также требует изменения скриптов установки для установки системных данных проекта в этот каталог.

**Место по умолчанию:**

* Windows: `C:\Program Files\FirefoxPWA\` (можно установить во время установки)
* PortableApps.com: `#{root}\App\PWAsForFirefox\`
* Linux: `/usr/share/firefoxpwa/`
* macOS и BSD: `/usr/local/share/firefoxpwa/`
* Homebrew: `#{prefix}/share/`

**Необходимые разрешения:**

* Чтение

### UserChrome {: id="userchrome"}

**Место по умолчанию:**

* Windows: `C:\Program Files\FirefoxPWA\userchrome\`
* PortableApps.com: `#{root}\App\PWAsForFirefox\userchrome\`
* Linux: `/usr/share/firefoxpwa/userchrome/`
* macOS и BSD: `/usr/local/share/firefoxpwa/userchrome/`
* Homebrew: `#{prefix}/share/userchrome/`

### Сompletions {: id="completions"}

**Место по умолчанию:**

* Windows: `C:\Program Files\FirefoxPWA\completions\`
* PortableApps.com: *Не устанавливается по умолчанию*
* Linux и macOS и BSD: *Соответствующие места для оболочек*

## Данные пользователя {: id="данные_пользователя"}

Каталог, специфичный для пользователя, для данных проекта. Хранит внутренний экземпляр Firefox,
каталоги профилей с пользовательскими данными, иконки веб-приложений (на Windows), а также
файлы конфигурации и логи.

Может быть переопределён переменной окружения `FFPWA_USERDATA` во время сборки или выполнения.

**Место по умолчанию:**

* Windows: `%APPDATA%\FirefoxPWA\`
* PortableApps.com: `#{root}\Data\`
* Linux и BSD: `${XDG_DATA_HOME:="$HOME/.local/share"}/firefoxpwa/`
* macOS: `$HOME/Library/Application Support/firefoxpwa/`

**Необходимые разрешения:**

* Чтение
* Запись

### Среда выполнения {: id="среда_выполнения"}

**Место по умолчанию:**

* Windows: `%APPDATA%\FirefoxPWA\runtime\`
* PortableApps.com: `#{root}\App\PWAsForFirefox\runtime\`
* Linux и BSD: `${XDG_DATA_HOME:="$HOME/.local/share"}/firefoxpwa/runtime/`
* macOS: `$HOME/Library/Application Support/firefoxpwa/runtime/`

!!! note

    Среда выполнения *не* устанавливается в каталог пользовательских данных при использовании пакета PortableApps.com
    в соответствии с руководящими принципами упаковки PortableApps.com о том, что бинарные
    файлы не должны находиться в каталоге данных.

!!! note

    Если среда выполнения ещё не установлена в каталог пользовательских данных, программа также попытается использовать
    среду выполнения из системного каталога данных. В этом случае вам нужно убедиться,
    что каталог доступен для записи всеми пользователями, чтобы патчинг сработал.

### Профили {: id="профили"}

**Место по умолчанию:**

* Windows: `%APPDATA%\FirefoxPWA\profiles\`
* PortableApps.com: `#{root}\Data\profiles\`
* Linux и BSD: `${XDG_DATA_HOME:="$HOME/.local/share"}/firefoxpwa/profiles/`
* macOS: `$HOME/Library/Application Support/firefoxpwa/profiles/`
