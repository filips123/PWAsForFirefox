### Pane and group titles should be translated in the same style and capitalization as existing Firefox messages in your language
### Example: https://pontoon.mozilla.org/sl/firefox/browser/browser/preferences/preferences.ftl/?search=pane-account-sync-title&search_identifiers=true
### Example: https://pontoon.mozilla.org/sl/firefox/browser/browser/preferences/preferences.ftl/?search=preferences-contrast-control-group&search_identifiers=true


## Web Applications Pane

pane-web-apps-title = Aplicaciones web
    .title = { pane-web-apps-title }
pane-web-apps-section =
    .heading = { pane-web-apps-title }
    .description = Puede que necesite reiniciar el navegador para aplicar los cambios
group-appearance-header =
    .label = Apariencia
    .description = Personalizar la integración de la aplicación web con la apariencia de su sistema operativo
group-appearance-titlebar-header =
    .label = Barra de título
group-appearance-colors-header =
    .label = Colores
group-interface-header =
    .label = Interfaz y 
    .description = Personalizar las barras de tareas y controles de la ventana de la aplicación web
group-behavior-header =
    .label = Navegación y comportamiento
    .description = Personalizar el comportamiento al abrir la aplicación web y navegar 
group-behavior-out-of-scope-header =
    .label = Navegación fuera de alcance
group-shortcuts-header =
    .label = Atajos de teclado
    .description = Activar / desactivar atajos de teclado

## Titlebar Preferences

dynamic-window-title =
    .label = Usar el título de la aplicación web como título de la ventana
dynamic-window-icon =
    .label = Usar el ícono de la aplicación web como ícono de la ventana
native-window-controls =
    .label = Siempre usar controles de ventana nativos

## Colors Preferences

sites-set-theme-color =
    .label = Permitir a las aplicaciones web cambiar el color del tema (barra de título)
sites-set-background-color =
    .label = Permitir a las aplicaciones web cambiar el fondo de la ventana
dynamic-theme-color =
    .label = Cambiar el color del tema dinámicamente

## Tabs Preference

enable-tabs-mode =
    .label = Activar múltiples pestañas
manage-tabs-behavior =
    .label = Más ajustes de pestañas

## Address Bar Preference

display-address-bar-label =
    .label = Visibilidad de la barra de direcciones
display-address-bar-choice-out-of-scope =
    .label = Visible cuando hay otra URL
display-address-bar-choice-always =
    .label = Siempre visible
display-address-bar-choice-never =
    .label = Nunca visible

## Launch Type Preference

launch-type-label =
    .label = Comportamiento al reiniciar
    .description = Al abrir una aplicación web ya abierta...
launch-type-choice-new-window =
    .label = Abrir aplicación en una ventana nueva
launch-type-choice-new-tab =
    .label = Abrir aplicación en una pestaña nueva
launch-type-choice-replace =
    .label = Reemplazar la pestaña existente
launch-type-choice-focus =
    .label = Poner la ventana en foco

## Links Target Preference

links-target-label =
    .label = Comportamiento de los enlaces
    .description = Al hacer clic en un enlace que normalmente se abre en una nueva pestaña...
links-target-choice-new-window =
    .label = Abrir enlace en una nueva ventana
links-target-choice-new-tab =
    .label = Abrir enlace en una nueva pestaña
links-target-choice-current-tab =
    .label = Reutilizar la pestaña actual
links-target-choice-keep =
    .label = Usar configuración actual

# Out-of-Scope Navigation Preferences

open-out-of-scope-in-default-browser =
    .label = Abrir las URL en el navegador predeterminado 
    .description = Atención: Puede dificultarse la autenticación de ciertas aplicaciones web
allowed-domains =
    .label = Permitir abrir siempre los dominios en la aplicación web
    .description = Ingresar una lista de dominios separados por comas (por ejemplo: sitio.com, *.sitio.com)
    .placeholder = sitio.com,*.sitio.com

## Keyboard Shortcuts Preferences

shortcuts-close-tab =
    .label = Cerrar pestaña {{$shortcut}}
shortcuts-close-window =
    .label = Cerrar ventana {{$shortcut}}
shortcuts-quit-application =
    .label = Salir de la aplicación {{$shortcut}}
shortcuts-private-browsing =
    .label = Navegación privada {{$shortcut}}
