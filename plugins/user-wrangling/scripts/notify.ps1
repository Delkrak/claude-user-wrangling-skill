# Called by notify.mjs. Text arrives in environment variables, never on the
# command line, so nothing in a message is ever parsed by PowerShell.

$title = $env:CLAUDE_NOTIFY_TITLE
$message = $env:CLAUDE_NOTIFY_MESSAGE
$spoken = $env:CLAUDE_NOTIFY_SPOKEN

if ($env:CLAUDE_NOTIFY_TOAST -eq '1') {
    try {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(
            [Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $texts = $xml.GetElementsByTagName('text')
        $texts.Item(0).AppendChild($xml.CreateTextNode($title)) | Out-Null
        $texts.Item(1).AppendChild($xml.CreateTextNode($message)) | Out-Null
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
        # Windows only shows toasts from a registered app id; PowerShell's own is always there.
        $appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
    } catch {
        Write-Error "Toast failed: $_"
    }
}

if ($spoken) {
    Add-Type -AssemblyName System.Speech
    $voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $voice.Speak($spoken)
    $voice.Dispose()
}
