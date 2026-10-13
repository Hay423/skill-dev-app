# Run this once to register the "boot the app at login" Scheduled Task.
#
# Not something Claude Code can run itself - scheduling in Task Scheduler is a
# one-off, user-approved setup step, the same way the project's Stop hook
# (.claude/hooks/build.sh) is wired up by hand in .claude/settings.local.json
# rather than by Claude. Re-run this script any time the repo moves, or to
# pick up a changed trigger.
#
# ASCII only, deliberately: Windows PowerShell 5.1 reads a .ps1 as ANSI, so a
# UTF-8 em dash in a string literal breaks the parse.
#
# What it registers:
#   Trigger : at logon, for this user
#   Action  : Git Bash running scripts/boot-app.sh, hidden window
#
# To remove it later:
#   Unregister-ScheduledTask -TaskName "skill-dev-app boot" -Confirm:$false

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot

# Git\bin\bash.exe, NOT Git\usr\bin\bash.exe. The usr/bin one runs in a bare
# MSYS environment: the Windows PATH is absent, so npm does not resolve and the
# build cannot run. It also fails to open a backslashed script path, which is
# why the argument below is POSIX-style.
$bashExe = "C:\Program Files\Git\bin\bash.exe"

if (-not (Test-Path $bashExe)) {
    throw "Git Bash not found at $bashExe - update this script with the correct path."
}

# C:\foo\bar -> /c/foo/bar
$drive = $repoRoot.Substring(0, 1).ToLower()
$pathPart = $repoRoot.Substring(2) -replace '\\', '/'
$bootScriptPosix = "/$drive$pathPart/scripts/boot-app.sh"

$action = New-ScheduledTaskAction -Execute $bashExe -Argument "-lc `"'$bootScriptPosix'`"" -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -Hidden -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "skill-dev-app boot" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Builds skill-dev-app and starts preview (4173) + dev (5173) at login." `
    -Force

Write-Host "Registered. It will run at your next login, or now with:"
Write-Host "  Start-ScheduledTask -TaskName 'skill-dev-app boot'"
