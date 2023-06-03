!include PortableApps.comInstallerMoveFiles.nsh

!macro CustomCodePostInstall
    IfFileExists "$INSTDIR\App\PWAsForFirefox\runtime\firefox.exe" remove copy

    copy:
    ; Copy only if runtime does not exist yet
    CreateDirectory "$INSTDIR\App\PWAsForFirefox\runtime"
    ${MoveFiles} DIR+FORCE "*" "$INSTDIR\App\PWAsForFirefox\extracted\core" "$INSTDIR\App\PWAsForFirefox\runtime"

    remove:
    ; Then remove the temporary extracted directory
    RMDir /r "$INSTDIR\App\PWAsForFirefox\extracted"
!macroend
