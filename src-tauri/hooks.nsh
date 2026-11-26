; Nook NSIS Installer Hooks
; Preserves launch on startup (HKCU Run key) across application updates

!macro NSIS_HOOK_PREINSTALL
  ; Terminate any running Nook instance so files in $INSTDIR are not locked during in-place upgrade
  nsExec::Exec 'taskkill /F /IM nook.exe'

  ; Check if Nook autostart was registered in Windows Run key prior to update (HKCU or HKLM)
  StrCpy $R9 "0"
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Nook"
  StrCmp $0 "" check_lowercase_hook 0
  StrCpy $R9 "1"
  Goto done_autostart_precheck

check_lowercase_hook:
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "nook"
  StrCmp $0 "" check_hklm_hook 0
  StrCpy $R9 "1"
  Goto done_autostart_precheck

check_hklm_hook:
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "Nook"
  StrCmp $0 "" check_hklm_lowercase_hook 0
  StrCpy $R9 "1"
  Goto done_autostart_precheck

check_hklm_lowercase_hook:
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "nook"
  StrCmp $0 "" done_autostart_precheck 0
  StrCpy $R9 "1"

done_autostart_precheck:
  ; Clean up any stale unquoted HKLM Run entries (NSIS runs elevated here)
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "Nook"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "nook"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; If autostart was enabled prior to update, restore it pointing to the updated binary
  StrCmp $R9 "1" 0 skip_autostart_restore
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Nook" '"$INSTDIR\nook.exe" --autostart'

skip_autostart_restore:
!macroend
