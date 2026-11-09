# 매주 토요일 21:10, 일요일 10:00에 로또 당첨번호를 갱신하고
# 새 회차가 추가되면 브라우저로 결과 페이지를 엽니다.
# PC가 꺼져 있어 놓친 경우 다음에 켜질 때 실행됩니다.
#
# 등록:  powershell -ExecutionPolicy Bypass -File lotto\scripts\register-schedule.ps1
# 해제:  Unregister-ScheduledTask -TaskName LottoResultCheck -Confirm:$false

$script = Join-Path $PSScriptRoot 'update-data.mjs'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$node = (Get-Command node).Source

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$script`" --open" -WorkingDirectory $repo
$triggers = @(
  (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Saturday -At '21:10'),
  (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At '10:00')
)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

Register-ScheduledTask -TaskName 'LottoResultCheck' -Description '로또 당첨번호 갱신 후 새 회차가 있으면 결과 페이지 열기' `
  -Action $action -Trigger $triggers -Settings $settings -Force | Out-Null

Get-ScheduledTask -TaskName 'LottoResultCheck' | Get-ScheduledTaskInfo | Select-Object TaskName, NextRunTime
