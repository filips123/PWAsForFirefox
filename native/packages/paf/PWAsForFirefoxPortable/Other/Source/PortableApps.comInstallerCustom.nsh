!include PortableApps.comInstallerMoveFiles.nsh

!macro CustomCodePostInstall
    CreateDirectory "$INSTDIR\Data\runtime"
    ${MoveFiles} DIR+FORCE "*" "$INSTDIR\Data\extracted\core" "$INSTDIR\Data\runtime"
    RMDir /r "$INSTDIR\Data\extracted"
!macroend
