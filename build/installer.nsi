; 自定义进程检测宏
; 最大尝试次数（可被外部覆盖）
!ifndef CUSTOM_CHECK_APP_RUNNING_MAX_ATTEMPTS
  !define CUSTOM_CHECK_APP_RUNNING_MAX_ATTEMPTS 3
!endif

; 等待用户手动关闭的间隔（毫秒）
!ifndef CUSTOM_CHECK_APP_RUNNING_WAIT_INTERVAL
  !define CUSTOM_CHECK_APP_RUNNING_WAIT_INTERVAL 2000
!endif

; 强制结束后等待进程退出的时间（毫秒）
!ifndef CUSTOM_CHECK_APP_RUNNING_EXIT_WAIT
  !define CUSTOM_CHECK_APP_RUNNING_EXIT_WAIT 1000
!endif

!macro customCheckAppRunning
  ; 校验可执行文件名非空
  !if "${APP_EXECUTABLE_FILENAME}" == ""
    !error "APP_EXECUTABLE_FILENAME must be defined"
  !endif

  ; 保存寄存器
  Push $R0
  Push $R1

  ; 重试计数清零
  StrCpy $R1 0

  loop_check:
    IntOp $R1 $R1 + 1

    ; 检测进程是否存在（退出码 0 表示找到）
    ; 使用 /FO CSV 避免语言相关表头，2>nul 丢弃错误输出
    nsExec::Exec '"$SYSDIR\cmd.exe" /c tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO CSV /NH 2>nul | "$SYSDIR\find.exe" /I "${APP_EXECUTABLE_FILENAME}"'
    Pop $R0

    ; 退出码 0 表示找到进程
    StrCmp $R0 0 process_found
    Goto process_not_found

  process_not_found:
    ; 恢复寄存器
    Pop $R1
    Pop $R0
    Goto end_check

  process_found:
    ; 超过最大尝试次数，进入强制结束流程
    StrCmp $R1 ${CUSTOM_CHECK_APP_RUNNING_MAX_ATTEMPTS} force_kill

    ; 静默模式下不等待，直接强制结束
    IfSilent force_kill

    ; 等待用户手动关闭
    Sleep ${CUSTOM_CHECK_APP_RUNNING_WAIT_INTERVAL}
    Goto loop_check

  force_kill:
    ; 强制结束进程（排除安装程序自身）
    DetailPrint "正在强制关闭 ${APP_EXECUTABLE_FILENAME}..."
    nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM "${APP_EXECUTABLE_FILENAME}" /FI "PID ne $EXEPID" 2>nul'
    Pop $R0

    ; 检查 taskkill 返回码
    ; 0 = 成功, 128 = 进程未找到, 5 = 拒绝访问, 其他 = 错误
    StrCmp $R0 128 process_not_found
    StrCmp $R0 0 wait_for_exit
    StrCmp $R0 5 permission_denied
    DetailPrint "taskkill 返回码: $R0"
    Goto wait_for_exit

  permission_denied:
    ; 权限不足，提示用户手动关闭后重试
    DetailPrint "权限不足，无法结束进程（返回码 5）"
    ; 静默模式下直接退出
    IfSilent silent_fail
    MessageBox MB_RETRYCANCEL|MB_ICONSTOP "无法结束 ${APP_EXECUTABLE_FILENAME}（权限不足），请手动关闭后重试。" /SD IDCANCEL IDRETRY reset_retry
    Quit

  silent_fail:
    ; 静默安装模式下无法结束进程，退出安装
    DetailPrint "静默安装模式下无法结束进程，退出安装"
    Quit

  wait_for_exit:
    ; 等待进程退出
    Sleep ${CUSTOM_CHECK_APP_RUNNING_EXIT_WAIT}

    ; 再次检测进程
    nsExec::Exec '"$SYSDIR\cmd.exe" /c tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO CSV /NH 2>nul | "$SYSDIR\find.exe" /I "${APP_EXECUTABLE_FILENAME}"'
    Pop $R0

    StrCmp $R0 0 show_error
    Goto process_not_found

  show_error:
    ; 静默模式下直接退出
    IfSilent silent_fail
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY reset_retry
    Quit

  reset_retry:
    ; 重置重试计数，重新进行等待循环
    StrCpy $R1 0
    Goto loop_check

  end_check:
!macroend