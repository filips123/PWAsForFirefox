---
hide:
  - path
---

<style>
.md-sidebar--primary {
  visibility: hidden;
}
</style>

<div style="text-align:center;">
<h1 style="margin-bottom:0.35em;">Progressive Web Apps for Firefox</h1>
<em>Инструмент для установки, управления и использования Progressive Web Apps (PWAs) в Mozilla Firefox</em>
</div>

<div style="text-align:center;" markdown>

[![Релиз](https://img.shields.io/github/v/release/filips123/PWAsForFirefox?sort=semver&style=flat-square&cacheSeconds=3600)](https://github.com/filips123/PWAsForFirefox/releases/latest)
[![Пользователи](https://img.shields.io/amo/users/pwas-for-firefox?style=flat-square&cacheSeconds=86400)](https://addons.mozilla.org/firefox/addon/pwas-for-firefox/)
[![Оценка](https://img.shields.io/amo/rating/pwas-for-firefox?style=flat-square&cacheSeconds=86400)](https://addons.mozilla.org/firefox/addon/pwas-for-firefox/reviews/)
[![Лицензия](https://img.shields.io/github/license/filips123/PWAsForFirefox?style=flat-square&cacheSeconds=86400)](https://github.com/filips123/PWAsForFirefox/blob/main/LICENSE)
[![Репозитории](https://img.shields.io/repology/repositories/firefoxpwa?style=flat-square&cacheSeconds=86400)](https://repology.org/project/firefoxpwa/versions)
[![Packagecloud.io DEB](https://img.shields.io/badge/deb-packagecloud.io-844fec.svg?style=flat-square)](https://packagecloud.io/filips/FirefoxPWA)
[![Packagecloud.io RPM](https://img.shields.io/badge/rpm-packagecloud.io-844fec.svg?style=flat-square)](https://packagecloud.io/filips/FirefoxPWA)

</div>

---

<!-- Once MkDocs Material card grids are publicly available (Goat's Horn) -->
<!-- We can try to use them to make this page look better and more "attractive" -->
<!-- Also add links to specific documentation pages, screenshots, descriptions, etc. -->

## О проекте {: style="margin-top:0;" }

[Progressive Web Apps (PWAs)](https://developer.mozilla.org/docs/Web/Progressive_web_apps)
— это веб-приложения, которые используют веб-API и функции вместе со стратегией прогрессивного улучшения, чтобы
предоставить пользователю опыт, похожий на нативное приложение, для кросс-платформенных веб-приложений. Хотя
Firefox поддерживает многие API прогрессивных веб-приложений, он не поддерживает функциональность установки их как
отдельного системного приложения с опытом, похожим на приложение. Эта функциональность также известна как
Site Specific Browser (SSB).

Этот проект создаёт модифицированную среду выполнения Firefox, чтобы позволить устанавливать веб-сайты
как отдельные приложения и предоставляет консольный инструмент и расширение браузера для установки, управления
и использования их.

!!! tip

    Вы можете узнать больше о проекте в [файле README в репозитори](https://github.com/filips123/PWAsForFirefox),
    где вы такж можете поставить заёздочку проекту. :star:

    Вы также должны посетить [нашу страницу ЧАВО](help/faq.md) и [раздел «О проекте»](about/how-it-works.md),
    если хотите узнать больше о проекте.

## Использование

!!! tip

    Вам следует установить [расширение для браузера](https://addons.mozilla.org/firefox/addon/pwas-for-firefox/)
    и следовать инструкциям по установке в браузере.

Вы можете ознакомиться со [страницей установки](installation/requirements.md) для получения дополнительных сведений об
установке и настройке проекта. Для подробных инструкций по использованию, пожалуйста, также ознакомьтесь с
[руководством пользователя](user-guide/extension.md) и связанными страницами.

## Возможности

* Инструмент командной строки для установки, управления и Progressive Web Apps в Firefox.
* Расширение для настройки нативных программ и установки, управления и запуска PWAs и их профилей непосредственно из основного браузера Firefox.
* Изолированная установка Firefox и профилей, которые хранят PWAs.
* Установленные PWAs имеют свои собственные записи в меню «Пуск» и значки на панели задач и работают в своём собственном окне.
* Установленные PWAs не имеют вкладок и адресной строки для лучшего ощущения приложения.
* Поддержка установки всех веб-сайтов как Progressive Web Apps.
* Поддержка всех дополнений/расширений Firefox и встроенных функций Firefox.
* Поддержка автоматической (инициируемой пользователем) установки и патчинга установки и профилей.

Вы можете увидеть полный список возможностей [на специальной странице](about/supported-features.md).

## Спонсоры

<!-- Headings here need to use HTML, so they don't appear in the table of contents -->

<h3>Спонсоры</h3>

Спасибо [packagecloud.io](https://packagecloud.io/) за спонсорство проекта и
предоставление бесплатного хостинга для наших DEB- и RPM-пакетов!

[![Private NPM repository and Maven, RPM, DEB, PyPi and RubyGems repository · packagecloud](https://assets-production.packagecloud.io/assets/packagecloud-logo-light-3c521566d5567fe0ce8435ef1f9485b0c3ad28a958af6f520d82ad3b232d2ff3.png){ loading=lazy width=500 }](https://packagecloud.io/)

Спасибо [SignPath Foundation](https://signpath.org/) за предоставление нам бесплатного сертификата
подписи кода для пакетов Windows и [SignPath](https://about.signpath.io/)
за предоставление инфраструктуры для подписания кода!
{: style="padding-top:0.5rem;" }

[![Free Code Signing for Open Source software · SignPath](https://signpath.org/assets/logo.svg){ loading=lazy width=500 }](https://signpath.org/)


Спасибо всем донатерам за финансовую поддержку нашего проекта!
{: style="padding-top:0.5rem;padding-bottom:0.5rem;" }

!!! note

    Пожалуйста, посетите [сервисы поддержки донатами](about/contributing.md#donations), если у вас
    есть желание помочь проекту донатом.

<h3>Контрибьюторы</h3>

Спасибо [всем контрибьюторам](https://github.com/filips123/PWAsForFirefox/graphs/contributors)
этого проекта за предоставленную помощь и разработку!

[![Контрибьюторы](https://contrib.rocks/image?repo=filips123/PWAsForFirefox){ loading=lazy }](https://github.com/filips123/PWAsForFirefox/graphs/contributors)

<h3>Другие упоминания</h3>

Спасибо [всем мейнтейнерам пакетов](https://repology.org/project/firefoxpwa/information),
которые следят за тем, чтобы проект был актуальным! Спасибо [всем переводчикам](https://crowdin.com/project/firefoxpwa),
которые делают проект доступным на многих языках! Спасибо [всем, кто поставил звёздочку](https://github.com/filips123/PWAsForFirefox/stargazers)
нашему репозиторию на GitHub. Наконец спасибо Mozilla и их разработчикам за
создание Firefox и возможность модифицировать его UI, используя JavaScript!

---

<small markdown>**Примечание:** Часть этого сайта всё ещё в разрабоке. Пожалуйста, используйте
кнопку обратной связи и откройте issues на GitHub с вашим отзывом или предложением с потенциальными
улучшениями. Вы также можете принять участие [в обсуждении на GitHub](https://github.com/filips123/PWAsForFirefox/discussions/335)
про сайт-документацию. Спасибо!</small>
