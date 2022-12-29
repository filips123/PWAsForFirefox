!include PortableApps.comInstallerMoveFiles.nsh

!macro CustomCodePostInstall
    CreateDirectory "$INSTDIR\App\PWAsForFirefox\runtime"
    ${MoveFiles} DIR+FORCE "*" "$INSTDIR\App\PWAsForFirefox\extracted\core" "$INSTDIR\App\PWAsForFirefox\runtime"
    RMDir /r "$INSTDIR\App\PWAsForFirefox\extracted"
!macroend
