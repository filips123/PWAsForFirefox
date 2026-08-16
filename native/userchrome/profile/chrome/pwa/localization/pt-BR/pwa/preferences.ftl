### Pane and group titles should be translated in the same style and capitalization as existing Firefox messages in your language
### Example: https://pontoon.mozilla.org/sl/firefox/browser/browser/preferences/preferences.ftl/?search=pane-account-sync-title&search_identifiers=true
### Example: https://pontoon.mozilla.org/sl/firefox/browser/browser/preferences/preferences.ftl/?search=preferences-contrast-control-group&search_identifiers=true


## Web Applications Pane

pane-web-apps-title = Aplicativos Web
    .title = { pane-web-apps-title }
pane-web-apps-section =
    .heading = { pane-web-apps-title }
    .description = Pode ser necessário reiniciar o navegador para que essas configurações sejam aplicadas.
group-appearance-header =
    .label = Aparência
    .description = Personalize visualmente a forma como a aplicação web se integra com o seu sistema operativo.
group-appearance-titlebar-header =
    .label = Barra de título
group-appearance-colors-header =
    .label = Cores
group-interface-header =
    .label = Interface e layout
    .description = Personalize as barras de ferramentas e os controles na janela do aplicativo da web.
group-behavior-header =
    .label = Navegação e comportamento
    .description = Personalize o comportamento do aplicativo web durante a navegação e a abertura.
group-behavior-out-of-scope-header =
    .label = Navegação fora do escopo
group-shortcuts-header =
    .label = Atalhos de teclado
    .description = Personalize quais atalhos de teclado estão ativados.

## Titlebar Preferences

dynamic-window-title =
    .label = Alterar o título da janela com base no título do aplicativo da web
dynamic-window-icon =
    .label = Alterar o ícone da janela com base no ícone do aplicativo da web
native-window-controls =
    .label = Sempre use controles de janela nativos

## Colors Preferences

sites-set-theme-color =
    .label = Permitir que aplicativos da Web substituam a cor do tema (barra de título)
sites-set-background-color =
    .label = Permitir que aplicativos da ‘web’ substituam a cor de fundo
dynamic-theme-color =
    .label = Alterar dinamicamente a cor do tema

## Tabs Preference

enable-tabs-mode =
    .label = Ative a interface com várias abas
manage-tabs-behavior =
    .label = Gerenciar mais configurações de comportamento da guia

## Address Bar Preference

display-address-bar-label =
    .label = Visibilidade da barra de endereço
display-address-bar-choice-out-of-scope =
    .label = Visível quando a URL está fora do escopo
display-address-bar-choice-always =
    .label = Sempre visível
display-address-bar-choice-never =
    .label = Nunca visível

## Launch Type Preference

launch-type-label =
    .label = Comportamento de reinicialização do aplicativo
    .description = Ao iniciar um aplicativo web que já está em execução…
launch-type-choice-new-window =
    .label = Abrir aplicativo em uma nova janela
launch-type-choice-new-tab =
    .label = Abrir aplicativo em uma nova aba
launch-type-choice-replace =
    .label = Substituir a aba existente
launch-type-choice-focus =
    .label = Focar a janela existente

## Links Target Preference

links-target-label =
    .label = Comportamento de abertura de links
    .description = Ao clicar em um link que normalmente abre em uma nova aba ou janela…
links-target-choice-new-window =
    .label = Abrir link em uma nova janela
links-target-choice-new-tab =
    .label = Abrir link em uma nova aba
links-target-choice-current-tab =
    .label = Substitua a aba atual
links-target-choice-keep =
    .label = Não altere o comportamento do link

# Out-of-Scope Navigation Preferences

open-out-of-scope-in-default-browser =
    .label = Abrir URLs fora do escopo no navegador padrão
    .description = Aviso: Pode interromper os fluxos de autenticação em alguns aplicativos da web
allowed-domains =
    .label = Domínios sempre podem ser abertos no navegador do aplicativo
    .description = Insira uma lista de domínios separados por vírgulas (por exemplo, example.com,*.example.com)…
    .placeholder = example.com, *.example.com

## Keyboard Shortcuts Preferences

shortcuts-close-tab =
    .label = Fechar aba ({ $shortcut })
shortcuts-close-window =
    .label = Fechar janela ({ $shortcut })
shortcuts-quit-application =
    .label = Sair do aplicativo ({ $shortcut })
shortcuts-private-browsing =
    .label = Navegação privada ({ $shortcut })
