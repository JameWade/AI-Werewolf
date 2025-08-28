@echo off
echo 杀掉AI狼人杀相关端口进程...

for %%p in (3000 3001 3002 3003 3004 3005 3006 3007 3008) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p') do (
        if not "%%a"=="0" (
            echo 终止端口%%p的进程%%a
            taskkill /PID %%a /F >nul 2>&1
        )
    )
)

echo 完成！
pause